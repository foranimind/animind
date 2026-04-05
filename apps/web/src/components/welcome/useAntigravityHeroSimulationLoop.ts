import { useEffect, type MutableRefObject } from "react";

import type { AntigravityHeroStageRuntimeInputs } from "./AntigravityHeroPoints";
import type {
  AntigravityHeroSimulationPointerState,
  AntigravityHeroSimulationState,
} from "./antigravityHeroSimulation";
import { stepAntigravityHeroSimulationState } from "./antigravityHeroSimulation";

type UseAntigravityHeroSimulationLoopOptions = {
  active: boolean;
  initialSimulation: AntigravityHeroSimulationState;
  pointerRef: MutableRefObject<AntigravityHeroSimulationPointerState>;
  renderCurrentFrame: () => void;
  runtimeInputsRef: MutableRefObject<AntigravityHeroStageRuntimeInputs>;
  simulationRef: MutableRefObject<AntigravityHeroSimulationState>;
};

export const useAntigravityHeroSimulationLoop = ({
  active,
  initialSimulation,
  pointerRef,
  renderCurrentFrame,
  runtimeInputsRef,
  simulationRef,
}: UseAntigravityHeroSimulationLoopOptions) => {
  useEffect(() => {
    simulationRef.current = initialSimulation;
    renderCurrentFrame();
  }, [initialSimulation, renderCurrentFrame, simulationRef]);

  useEffect(() => {
    renderCurrentFrame();

    if (!active) {
      return;
    }

    let frameHandle = 0;
    let previousTimestamp = 0;
    let cancelled = false;

    const step = (timestamp: number) => {
      if (cancelled) {
        return;
      }

      const deltaMs = previousTimestamp > 0 ? timestamp - previousTimestamp : 16;
      previousTimestamp = timestamp;
      const inputs = runtimeInputsRef.current;

      simulationRef.current = stepAntigravityHeroSimulationState(simulationRef.current, {
        deltaMs,
        pointer: pointerRef.current,
        scrollProgress: inputs.scrollProgress,
        corridorProgress: inputs.corridorProgress,
        sceneStrength: inputs.sceneStrength,
      });
      renderCurrentFrame();
      frameHandle = window.requestAnimationFrame(step);
    };

    frameHandle = window.requestAnimationFrame(step);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameHandle);
    };
  }, [active, pointerRef, renderCurrentFrame, runtimeInputsRef, simulationRef]);
};
