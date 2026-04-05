import { describe, expect, it } from "vitest";

import {
  createWelcomeStageTimeline,
  resolveWelcomeStageSnapshot,
} from "../components/welcome/welcomeStageTimeline";

describe("welcomeStageTimeline", () => {
  const sceneIds = ["hero", "story-1", "story-2", "story-3", "endcap"] as const;
  const toProgress = (timeline: { totalUnits: number }, unit: number) =>
    unit / timeline.totalUnits;

  it("compresses the desktop rail and starts corridor feedback during hero dwell", () => {
    const timeline = createWelcomeStageTimeline({
      sceneIds,
      mobile: false,
      reducedMotion: false,
    });
    const heroScene = timeline.scenes[0];
    const heroDwellStart =
      heroScene.start + heroScene.durations.preEnter + heroScene.durations.enter;
    const beforeLeadIn = resolveWelcomeStageSnapshot(
      timeline,
      toProgress(timeline, heroDwellStart + heroScene.durations.dwell * 0.12)
    );
    const corridorLeadIn = resolveWelcomeStageSnapshot(
      timeline,
      toProgress(timeline, heroDwellStart + heroScene.durations.dwell * 0.32)
    );

    expect(timeline.trackLengthVh).toBeGreaterThanOrEqual(540);
    expect(timeline.trackLengthVh).toBeLessThanOrEqual(630);
    expect(timeline.sceneDurations.hero.dwell).toBeLessThan(0.8);
    expect(timeline.sceneDurations["story-1"].dwell).toBeLessThan(0.6);

    expect(beforeLeadIn.activeSceneId).toBe("hero");
    expect(beforeLeadIn.sceneStates.hero.phase).toBe("dwell");
    expect(beforeLeadIn.signalStageMode).toBe("portal");
    expect(beforeLeadIn.corridorProgress).toBeCloseTo(0, 2);
    expect(beforeLeadIn.ctaMode).toBe("hero");

    expect(corridorLeadIn.activeSceneId).toBe("hero");
    expect(corridorLeadIn.sceneStates.hero.phase).toBe("dwell");
    expect(corridorLeadIn.signalStageMode).toBe("corridor");
    expect(corridorLeadIn.corridorProgress).toBeGreaterThan(0.08);
    expect(corridorLeadIn.ctaDockProgress).toBeGreaterThan(0.08);
    expect(corridorLeadIn.ctaMode).toBe("morph");
    expect(corridorLeadIn.incomingSceneId).toBeUndefined();
  });

  it("hands scene ownership to the incoming chapter before the outgoing one fully ends", () => {
    const timeline = createWelcomeStageTimeline({
      sceneIds,
      mobile: false,
      reducedMotion: false,
    });
    const storyOne = timeline.scenes[1];
    const storyTwo = timeline.scenes[2];
    const endcapScene = timeline.scenes[4];

    const heroToStoryHandoff = resolveWelcomeStageSnapshot(
      timeline,
      toProgress(
        timeline,
        storyOne.start + storyOne.durations.preEnter + storyOne.durations.enter * 0.35
      )
    );
    const storyToStoryHandoff = resolveWelcomeStageSnapshot(
      timeline,
      toProgress(
        timeline,
        storyTwo.start + storyTwo.durations.preEnter + storyTwo.durations.enter * 0.4
      )
    );
    const storyToEndcapHandoff = resolveWelcomeStageSnapshot(
      timeline,
      toProgress(
        timeline,
        endcapScene.start +
          endcapScene.durations.preEnter +
          endcapScene.durations.enter * 0.35
      )
    );
    const laterStoryToEndcapHandoff = resolveWelcomeStageSnapshot(
      timeline,
      toProgress(
        timeline,
        endcapScene.start +
          endcapScene.durations.preEnter +
          endcapScene.durations.enter * 0.75
      )
    );

    expect(heroToStoryHandoff.sceneStates.hero.phase).toBe("exit");
    expect(heroToStoryHandoff.sceneStates["story-1"].phase).toBe("enter");
    expect(heroToStoryHandoff.activeSceneId).toBe("story-1");
    expect(heroToStoryHandoff.signalStageMode).toBe("theater");
    expect(heroToStoryHandoff.ctaMode).toBe("docked");

    expect(storyToStoryHandoff.sceneStates["story-1"].phase).toBe("exit");
    expect(storyToStoryHandoff.sceneStates["story-2"].phase).toBe("enter");
    expect(storyToStoryHandoff.activeSceneId).toBe("story-2");
    expect(storyToStoryHandoff.signalStageMode).toBe("theater");

    expect(["dwell", "exit"]).toContain(storyToEndcapHandoff.sceneStates["story-3"].phase);
    expect(storyToEndcapHandoff.sceneStates.endcap.phase).toBe("enter");
    expect(storyToEndcapHandoff.activeSceneId).toBe("story-3");
    expect(storyToEndcapHandoff.incomingSceneId).toBe("endcap");
    expect(storyToEndcapHandoff.signalStageMode).toBe("theater");
    expect(storyToEndcapHandoff.ctaMode).toBe("docked");

    expect(laterStoryToEndcapHandoff.sceneStates["story-3"].phase).toBe("exit");
    expect(laterStoryToEndcapHandoff.sceneStates.endcap.phase).toBe("enter");
    expect(laterStoryToEndcapHandoff.activeSceneId).toBe("endcap");
    expect(laterStoryToEndcapHandoff.signalStageMode).toBe("resolved");
    expect(laterStoryToEndcapHandoff.ctaMode).toBe("endcap");
  });

  it("locks later chapters into theater mode and resolves the settled endcap", () => {
    const timeline = createWelcomeStageTimeline({
      sceneIds,
      mobile: false,
      reducedMotion: false,
    });

    const settledStoryTwo = resolveWelcomeStageSnapshot(timeline, 0.62);
    const settledEndcap = resolveWelcomeStageSnapshot(timeline, 0.96);

    expect(settledStoryTwo.activeSceneId).toBe("story-2");
    expect(settledStoryTwo.signalStageMode).toBe("theater");
    expect(settledStoryTwo.stageTone).toBeCloseTo(1, 2);
    expect(settledStoryTwo.ctaDockProgress).toBeCloseTo(1, 2);
    expect(settledStoryTwo.ctaMode).toBe("docked");
    expect(settledStoryTwo.sceneStates["story-2"].phase).toBe("dwell");
    expect(settledStoryTwo.sceneStates["story-2"].primary).toBe(true);

    expect(settledEndcap.activeSceneId).toBe("endcap");
    expect(settledEndcap.signalStageMode).toBe("resolved");
    expect(settledEndcap.ctaMode).toBe("endcap");
    expect(settledEndcap.sceneStates.endcap.phase).toBe("dwell");
    expect(settledEndcap.sceneStates.endcap.primary).toBe(true);
  });

  it("shortens dwell windows for mobile and reduced motion", () => {
    const desktop = createWelcomeStageTimeline({
      sceneIds,
      mobile: false,
      reducedMotion: false,
    });
    const mobileReduced = createWelcomeStageTimeline({
      sceneIds,
      mobile: true,
      reducedMotion: true,
    });

    expect(mobileReduced.trackLengthVh).toBeLessThan(desktop.trackLengthVh);
    expect(mobileReduced.sceneDurations.hero.dwell).toBeLessThan(
      desktop.sceneDurations.hero.dwell
    );
    expect(mobileReduced.sceneDurations["story-1"].dwell).toBeLessThan(
      desktop.sceneDurations["story-1"].dwell
    );
  });

  it("rejects duplicate scene ids before building an unsafe record-based snapshot", () => {
    expect(() =>
      createWelcomeStageTimeline({
        sceneIds: ["hero", "story-1", "story-1"] as const,
        mobile: false,
        reducedMotion: false,
      })
    ).toThrow("unique scene ids");
  });
});
