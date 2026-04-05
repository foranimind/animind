import type { CSSProperties, ReactNode } from "react";

import { classNames } from "../../lib/classNames";

import type {
  WelcomeStagePhase,
  WelcomeStageSceneId,
  WelcomeStageSceneState,
} from "./welcomeStageTimeline";

type WelcomeStageSceneShellProps = {
  children: ReactNode;
  className?: string;
  contentLayer: number | string;
  layout?: string;
  sceneId: WelcomeStageSceneId;
  sceneState: WelcomeStageSceneState;
  style?: CSSProperties;
  visibilityProgress?: number;
};

const clampSceneVisibility = (progress: number) => Math.min(1, Math.max(0, progress));

const formatSceneValue = (value: number) =>
  Number.parseFloat(value.toFixed(3)).toString();

export const resolveWelcomeStageSceneOpacity = ({
  phase,
  progress,
}: {
  phase: WelcomeStagePhase;
  progress: number;
}) => {
  const visibility = clampSceneVisibility(progress);

  if (phase === "dwell") {
    return 1;
  }

  if (phase === "exit") {
    return 1 - visibility;
  }

  return visibility;
};

export const WelcomeStageSceneShell = ({
  children,
  className,
  contentLayer,
  layout,
  sceneId,
  sceneState,
  style,
  visibilityProgress,
}: WelcomeStageSceneShellProps) => {
  const isPrimary = sceneState.primary;
  const sceneVisibility = clampSceneVisibility(visibilityProgress ?? sceneState.progress);
  const sceneOpacity = resolveWelcomeStageSceneOpacity({
    phase: sceneState.phase,
    progress: sceneVisibility,
  });
  const sceneStyle = {
    "--scene-content-layer": String(contentLayer),
    "--scene-visibility": formatSceneValue(sceneVisibility),
    opacity: formatSceneValue(sceneOpacity),
    ...style,
  } as CSSProperties;

  return (
    <section
      className={classNames("welcome-stage-scene-shell welcome-stage-scene", className)}
      data-scene-id={sceneId}
      data-scene-shell-id={sceneId}
      data-layout={layout}
      data-phase={sceneState.phase}
      data-primary={String(isPrimary)}
      data-scene-progress={sceneState.progress.toFixed(3)}
      style={sceneStyle}
      aria-hidden={isPrimary ? undefined : true}
      inert={isPrimary ? undefined : true}
    >
      {children}
    </section>
  );
};
