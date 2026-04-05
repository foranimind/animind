import { useEffect, useMemo, useRef, useState } from "react";

import {
  WELCOME_STAGE_SCENE_IDS,
  createWelcomeStageTimeline,
  resolveWelcomeStageSnapshot,
} from "../components/welcome/welcomeStageTimeline";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type UseWelcomeStageTimelineArgs = {
  mobile: boolean;
  reducedMotion: boolean;
};

export const useWelcomeStageTimeline = ({
  mobile,
  reducedMotion,
}: UseWelcomeStageTimelineArgs) => {
  const railRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);

  const timeline = useMemo(
    () =>
      createWelcomeStageTimeline({
        sceneIds: WELCOME_STAGE_SCENE_IDS,
        mobile,
        reducedMotion,
      }),
    [mobile, reducedMotion]
  );

  useEffect(() => {
    let frameHandle = 0;

    const readProgress = () => {
      const rail = railRef.current;
      if (!rail) {
        return 0;
      }

      const viewportHeight = window.innerHeight || 1;
      const rect = rail.getBoundingClientRect();
      const travel = Math.max(rail.offsetHeight - viewportHeight, 1);
      const traveled = clamp(-rect.top, 0, travel);

      return traveled / travel;
    };

    const commitProgress = () => {
      frameHandle = 0;
      const nextProgress = readProgress();

      setProgress((current) =>
        Math.abs(current - nextProgress) > 0.0005 ? nextProgress : current
      );
    };

    const scheduleProgressUpdate = () => {
      if (frameHandle !== 0) {
        return;
      }

      frameHandle = window.requestAnimationFrame(commitProgress);
    };

    scheduleProgressUpdate();
    window.addEventListener("scroll", scheduleProgressUpdate, { passive: true });
    window.addEventListener("resize", scheduleProgressUpdate);

    return () => {
      if (frameHandle !== 0) {
        window.cancelAnimationFrame(frameHandle);
      }
      window.removeEventListener("scroll", scheduleProgressUpdate);
      window.removeEventListener("resize", scheduleProgressUpdate);
    };
  }, [timeline.trackLengthVh]);

  return {
    railRef,
    railMinHeight: `${timeline.trackLengthVh}vh`,
    progress,
    snapshot: resolveWelcomeStageSnapshot(timeline, progress),
  };
};
