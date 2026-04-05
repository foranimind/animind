import type { CSSProperties } from "react";

import type {
  WelcomeSignalStageMode,
  WelcomeStageSceneId,
} from "./welcomeStageTimeline";

type SignalStageFrameProps = {
  activeSceneId: WelcomeStageSceneId;
  corridorProgress: number;
  ctaDockProgress: number;
  mode: WelcomeSignalStageMode;
  stageTone: number;
};

export function resolveSignalStageBeamOpacity({
  mode,
  stageTone,
}: {
  mode: WelcomeSignalStageMode;
  stageTone: number;
}): number {
  if (mode !== "corridor") {
    return 0;
  }

  return Math.min(1, Math.max(0, 0.2 + stageTone * 0.65));
}

export const SignalStageFrame = ({
  activeSceneId,
  corridorProgress,
  ctaDockProgress,
  mode,
  stageTone,
}: SignalStageFrameProps) => {
  const style = {
    "--stage-tone": String(stageTone),
    "--corridor-progress": String(corridorProgress),
    "--cta-dock-progress": String(ctaDockProgress),
  } as CSSProperties;
  const beamStyle = {
    opacity: resolveSignalStageBeamOpacity({ mode, stageTone }),
  } satisfies CSSProperties;

  return (
    <div
      className="welcome-signal-stage"
      data-active-scene={activeSceneId}
      data-mode={mode}
      style={style}
      aria-hidden="true"
    >
      <div className="welcome-signal-stage__halo" />
      <div className="welcome-signal-stage__frame" />
      <div className="welcome-signal-stage__beam" style={beamStyle} />
    </div>
  );
};
