export type WelcomeStageSceneId =
  | "hero"
  | "story-1"
  | "story-2"
  | "story-3"
  | "endcap";

export type WelcomeStagePhase = "pre-enter" | "enter" | "dwell" | "exit";

export type WelcomeStageCtaMode = "hero" | "morph" | "docked" | "endcap";

export type WelcomeSignalStageMode =
  | "portal"
  | "corridor"
  | "theater"
  | "resolved";

export const WELCOME_STAGE_SCENE_IDS = [
  "hero",
  "story-1",
  "story-2",
  "story-3",
  "endcap",
] as const;

type WelcomeStageDurations = {
  preEnter: number;
  enter: number;
  dwell: number;
  exit: number;
};

type SceneDefinition = {
  id: WelcomeStageSceneId;
  start: number;
  end: number;
  durations: WelcomeStageDurations;
};

export type WelcomeStageSceneState = {
  phase: WelcomeStagePhase;
  progress: number;
  titleProgress: number;
  detailProgress: number;
  intensity: number;
  primary: boolean;
};

export type WelcomeStageSnapshot = {
  activeSceneId: WelcomeStageSceneId;
  incomingSceneId?: WelcomeStageSceneId;
  ctaMode: WelcomeStageCtaMode;
  signalStageMode: WelcomeSignalStageMode;
  stageTone: number;
  corridorProgress: number;
  ctaDockProgress: number;
  sceneStates: Record<WelcomeStageSceneId, WelcomeStageSceneState>;
};

export type WelcomeStageTimeline = {
  scenes: SceneDefinition[];
  trackLengthVh: number;
  sceneDurations: Record<WelcomeStageSceneId, WelcomeStageDurations>;
  mobile: boolean;
  reducedMotion: boolean;
  totalUnits: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const createInactiveSceneState = (): WelcomeStageSceneState => ({
  phase: "pre-enter",
  progress: 0,
  titleProgress: 0,
  detailProgress: 0,
  intensity: 0,
  primary: false,
});

const getSceneKind = (sceneId: WelcomeStageSceneId) => {
  if (sceneId === "hero") {
    return "hero";
  }

  if (sceneId === "endcap") {
    return "endcap";
  }

  return "story";
};

const getTransitionOverlap = (
  previousId: WelcomeStageSceneId,
  nextId: WelcomeStageSceneId,
  previousDurations: WelcomeStageDurations,
  nextDurations: WelcomeStageDurations
) => {
  // Keep a readable corridor between hero and theater, then relay later scenes faster.
  const previousKind = getSceneKind(previousId);
  const nextKind = getSceneKind(nextId);

  if (previousKind === "hero" && nextKind === "story") {
    return nextDurations.preEnter + nextDurations.enter * 0.48;
  }

  if (previousKind === "story" && nextKind === "endcap") {
    return (
      nextDurations.preEnter +
      nextDurations.enter * 0.35 +
      previousDurations.exit * 0.15
    );
  }

  if (previousKind === "story" && nextKind === "story") {
    return (
      nextDurations.preEnter +
      nextDurations.enter +
      previousDurations.exit * 0.2
    );
  }

  return 0;
};

const resolveCorridorProgress = ({
  heroState,
  storyOneState,
}: {
  heroState: WelcomeStageSceneState;
  storyOneState: WelcomeStageSceneState;
}) => {
  const heroLeadIn =
    heroState.phase === "dwell"
      ? clamp((heroState.progress - 0.22) / 0.78, 0, 1) * 0.64
      : heroState.phase === "exit"
        ? 0.64 + heroState.progress * 0.36
        : 0;

  const storyLeadIn = !isSceneVisible(storyOneState)
    ? 0
    : storyOneState.phase === "pre-enter"
      ? 0.18 + storyOneState.progress * 0.24
      : storyOneState.phase === "enter"
        ? 0.42 + storyOneState.progress * 0.46
        : storyOneState.phase === "dwell" || storyOneState.phase === "exit"
          ? 1
          : 0;

  return clamp(Math.max(heroLeadIn, storyLeadIn), 0, 1);
};

const resolveSignalStageMode = ({
  activeSceneId,
  corridorProgress,
}: {
  activeSceneId: WelcomeStageSceneId;
  corridorProgress: number;
}): WelcomeSignalStageMode => {
  if (activeSceneId === "endcap") {
    return "resolved";
  }

  if (activeSceneId === "hero" && corridorProgress > 0) {
    return "corridor";
  }

  if (activeSceneId === "hero") {
    return "portal";
  }

  return "theater";
};

const validateSceneIds = (sceneIds: readonly WelcomeStageSceneId[]) => {
  if (sceneIds.length === 0) {
    throw new Error("createWelcomeStageTimeline requires at least one scene id.");
  }

  if (new Set(sceneIds).size !== sceneIds.length) {
    throw new Error("createWelcomeStageTimeline requires unique scene ids.");
  }
};

const isSceneVisible = (sceneState: WelcomeStageSceneState) =>
  sceneState.phase !== "pre-enter" || sceneState.progress > 0.001;

const buildDurations = (mobile: boolean, reducedMotion: boolean) => {
  const hero = reducedMotion
    ? { preEnter: 0.14, enter: 0.2, dwell: 0.32, exit: 0.16 }
    : mobile
      ? { preEnter: 0.2, enter: 0.28, dwell: 0.56, exit: 0.26 }
      : { preEnter: 0.18, enter: 0.26, dwell: 0.62, exit: 0.24 };

  const story = reducedMotion
    ? { preEnter: 0.12, enter: 0.18, dwell: 0.24, exit: 0.16 }
    : mobile
      ? { preEnter: 0.18, enter: 0.26, dwell: 0.48, exit: 0.24 }
      : { preEnter: 0.14, enter: 0.22, dwell: 0.44, exit: 0.22 };

  const endcap = reducedMotion
    ? { preEnter: 0.1, enter: 0.16, dwell: 0.22, exit: 0.1 }
    : mobile
      ? { preEnter: 0.14, enter: 0.22, dwell: 0.34, exit: 0.16 }
      : { preEnter: 0.12, enter: 0.18, dwell: 0.34, exit: 0.14 };

  return {
    hero,
    "story-1": story,
    "story-2": story,
    "story-3": story,
    endcap,
  } satisfies Record<WelcomeStageSceneId, WelcomeStageDurations>;
};

export const createWelcomeStageTimeline = ({
  sceneIds,
  mobile,
  reducedMotion,
}: {
  sceneIds: readonly WelcomeStageSceneId[];
  mobile: boolean;
  reducedMotion: boolean;
}): WelcomeStageTimeline => {
  validateSceneIds(sceneIds);
  const sceneDurations = buildDurations(mobile, reducedMotion);
  let cursor = 0;
  let previousScene: SceneDefinition | undefined;

  const scenes = sceneIds.map((id) => {
    const durations = sceneDurations[id];
    const overlap = previousScene
      ? Math.min(
          getTransitionOverlap(
            previousScene.id,
            id,
            previousScene.durations,
            durations
          ),
          cursor
        )
      : 0;
    const start = Math.max(0, cursor - overlap);
    const span =
      durations.preEnter + durations.enter + durations.dwell + durations.exit;
    const scene = {
      id,
      start,
      end: start + span,
      durations,
    };
    cursor = scene.end;
    previousScene = scene;
    return scene;
  });

  return {
    scenes,
    sceneDurations,
    mobile,
    reducedMotion,
    totalUnits: cursor,
    trackLengthVh: Math.round(100 + cursor * (mobile ? 115 : 135)),
  };
};

const shouldPromoteIncomingScene = ({
  currentSceneId,
  incomingSceneId,
  incomingState,
  corridorProgress,
}: {
  currentSceneId: WelcomeStageSceneId;
  incomingSceneId: WelcomeStageSceneId;
  incomingState: WelcomeStageSceneState;
  corridorProgress: number;
}) => {
  if (!isSceneVisible(incomingState)) {
    return false;
  }

  const incomingKind = getSceneKind(incomingSceneId);
  const currentKind = getSceneKind(currentSceneId);

  if (currentSceneId === "hero" && incomingSceneId === "story-1") {
    if (
      incomingState.phase === "enter" &&
      incomingState.progress >= 0.28
    ) {
      return true;
    }

    return (
      incomingState.phase === "pre-enter" &&
      incomingState.progress >= 0.7 &&
      corridorProgress >= 0.42
    );
  }

  if (currentKind === "story" && incomingKind === "story") {
    return (
      (incomingState.phase === "enter" && incomingState.progress >= 0.35) ||
      incomingState.phase === "dwell" ||
      incomingState.phase === "exit"
    );
  }

  if (currentKind === "story" && incomingSceneId === "endcap") {
    return (
      (incomingState.phase === "enter" && incomingState.progress >= 0.72) ||
      incomingState.phase === "dwell" ||
      incomingState.phase === "exit"
    );
  }

  return false;
};

const resolveActiveSceneId = ({
  timeline,
  sceneStates,
  occupiedSceneId,
  corridorProgress,
}: {
  timeline: WelcomeStageTimeline;
  sceneStates: Record<WelcomeStageSceneId, WelcomeStageSceneState>;
  occupiedSceneId: WelcomeStageSceneId;
  corridorProgress: number;
}) => {
  const occupiedIndex = timeline.scenes.findIndex(
    (scene) => scene.id === occupiedSceneId
  );
  const nextScene = timeline.scenes[occupiedIndex + 1];

  if (!nextScene) {
    return occupiedSceneId;
  }

  const incomingState = sceneStates[nextScene.id];
  return shouldPromoteIncomingScene({
    currentSceneId: occupiedSceneId,
    incomingSceneId: nextScene.id,
    incomingState,
    corridorProgress,
  })
    ? nextScene.id
    : occupiedSceneId;
};

const resolveIncomingSceneId = ({
  timeline,
  sceneStates,
  activeSceneId,
}: {
  timeline: WelcomeStageTimeline;
  sceneStates: Record<WelcomeStageSceneId, WelcomeStageSceneState>;
  activeSceneId: WelcomeStageSceneId;
}) => {
  const activeIndex = timeline.scenes.findIndex((scene) => scene.id === activeSceneId);
  const nextScene = timeline.scenes[activeIndex + 1];

  if (!nextScene || !isSceneVisible(sceneStates[nextScene.id])) {
    return undefined;
  }

  return nextScene.id;
};

const resolveSceneState = (
  scene: SceneDefinition,
  unit: number
): WelcomeStageSceneState => {
  const local = clamp(unit - scene.start, 0, scene.end - scene.start);
  const { preEnter, enter, dwell, exit } = scene.durations;
  const enterEnd = preEnter + enter;
  const dwellEnd = enterEnd + dwell;

  if (local < preEnter) {
    const progress = clamp(local / preEnter, 0, 1);
    return {
      phase: "pre-enter",
      progress,
      titleProgress: progress * 0.4,
      detailProgress: 0,
      intensity: progress * 0.28,
      primary: false,
    };
  }

  if (local < enterEnd) {
    const progress = clamp((local - preEnter) / enter, 0, 1);
    return {
      phase: "enter",
      progress,
      titleProgress: lerp(0.4, 1, progress),
      detailProgress: progress * 0.72,
      intensity: lerp(0.28, 1, progress),
      primary: progress > 0.45,
    };
  }

  if (local < dwellEnd) {
    const progress = clamp((local - enterEnd) / dwell, 0, 1);
    return {
      phase: "dwell",
      progress,
      titleProgress: 1,
      detailProgress: lerp(0.72, 1, progress),
      intensity: 1,
      primary: true,
    };
  }

  const progress = clamp((local - dwellEnd) / Math.max(exit, 0.001), 0, 1);
  return {
    phase: "exit",
    progress,
    titleProgress: lerp(1, 0.2, progress),
    detailProgress: lerp(1, 0, progress),
    intensity: lerp(1, 0.08, progress),
    primary: false,
  };
};

export const resolveWelcomeStageSnapshot = (
  timeline: WelcomeStageTimeline,
  normalizedProgress: number
): WelcomeStageSnapshot => {
  const unit = clamp(normalizedProgress, 0, 1) * timeline.totalUnits;
  const sceneMap = new Map(timeline.scenes.map((scene) => [scene.id, scene]));
  const sceneStates = WELCOME_STAGE_SCENE_IDS.reduce<
    Record<WelcomeStageSceneId, WelcomeStageSceneState>
  >((result, sceneId) => {
    result[sceneId] = sceneMap.has(sceneId)
      ? resolveSceneState(sceneMap.get(sceneId)!, unit)
      : createInactiveSceneState();
    return result;
  }, {} as Record<WelcomeStageSceneId, WelcomeStageSceneState>);

  const occupiedSceneId =
    timeline.scenes.find((scene) => unit >= scene.start && unit <= scene.end)?.id ??
    timeline.scenes.at(-1)?.id ??
    "endcap";
  const corridorProgress = resolveCorridorProgress({
    heroState: sceneStates.hero,
    storyOneState: sceneStates["story-1"],
  });
  const activeSceneId = resolveActiveSceneId({
    timeline,
    sceneStates,
    occupiedSceneId,
    corridorProgress,
  });
  if (!Object.values(sceneStates).some((sceneState) => sceneState.primary)) {
    sceneStates[activeSceneId] = {
      ...sceneStates[activeSceneId],
      primary: true,
    };
  }
  const activeState = sceneStates[activeSceneId];
  const incomingSceneId = resolveIncomingSceneId({
    timeline,
    sceneStates,
    activeSceneId,
  });
  const signalStageMode = resolveSignalStageMode({
    activeSceneId,
    corridorProgress,
  });
  const stageTone =
    signalStageMode === "portal" ? 0 : signalStageMode === "corridor" ? corridorProgress : 1;
  const ctaDockProgress =
    signalStageMode === "portal" ? 0 : signalStageMode === "corridor" ? corridorProgress : 1;
  const ctaMode: WelcomeStageCtaMode =
    activeSceneId === "hero"
      ? activeState.phase === "exit" || corridorProgress > 0.02
        ? "morph"
        : "hero"
      : activeSceneId === "endcap"
        ? "endcap"
        : "docked";

  return {
    activeSceneId,
    incomingSceneId,
    ctaMode,
    signalStageMode,
    stageTone,
    corridorProgress,
    ctaDockProgress,
    sceneStates,
  };
};
