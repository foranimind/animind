import {
  useCallback,
  type CSSProperties,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";

import {
  buildAntigravityHeroField,
} from "./antigravityHeroField";
import { AntigravityHeroFallback } from "./AntigravityHeroFallback";
import { supportsAntigravityHeroWebGL } from "./antigravityHeroSupport";
import { type AntigravityHeroSimulationPointerState } from "./antigravityHeroSimulation";
import {
  AntigravityHeroPoints,
  type AntigravityHeroStageRuntimeInputs,
  createAntigravityHeroStageViewport,
  type AntigravityHeroStageViewport,
} from "./AntigravityHeroPoints";

type AntigravityHeroStageSize = {
  width: number;
  height: number;
};

type AntigravityHeroStageProps = {
  active: boolean;
  corridorProgress: number;
  reducedMotion: boolean;
  scrollProgress: number;
  sceneStrength: number;
  webglSupported?: boolean | null;
  seed?: number;
};

const DEFAULT_STAGE_SIZE: AntigravityHeroStageSize = {
  width: 960,
  height: 640,
};

const normalizePointer = (
  pointer: AntigravityHeroSimulationPointerState
): AntigravityHeroSimulationPointerState => ({
  active: Boolean(pointer.active),
  x: Number.isFinite(pointer.x) ? pointer.x : 0,
  y: Number.isFinite(pointer.y) ? pointer.y : 0,
  vx: Number.isFinite(pointer.vx) ? pointer.vx : 0,
  vy: Number.isFinite(pointer.vy) ? pointer.vy : 0,
});

const getParticleCount = (
  width: number,
  height: number,
  reducedMotion: boolean
): number => {
  const area = Math.max(width, 1) * Math.max(height, 1);
  const density = reducedMotion ? 0.38 : 0.62;
  const adaptiveFloor = Math.min(width, height) * (reducedMotion ? 0.24 : 0.34);
  return Math.round(Math.max(area * density * 0.001, adaptiveFloor));
};

const createStageViewport = (size: AntigravityHeroStageSize): AntigravityHeroStageViewport =>
  createAntigravityHeroStageViewport(size.width, size.height);

const measureStage = (element: HTMLDivElement | null): AntigravityHeroStageSize => {
  if (!element) {
    return DEFAULT_STAGE_SIZE;
  }

  const rect = element.getBoundingClientRect();
  const width = Number.isFinite(rect.width) && rect.width > 0 ? rect.width : DEFAULT_STAGE_SIZE.width;
  const height =
    Number.isFinite(rect.height) && rect.height > 0 ? rect.height : DEFAULT_STAGE_SIZE.height;

  return {
    width,
    height,
  };
};

const useStageSize = (ref: RefObject<HTMLDivElement | null>): AntigravityHeroStageSize => {
  const [size, setSize] = useState<AntigravityHeroStageSize>(DEFAULT_STAGE_SIZE);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      setSize(measureStage(element));
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateSize);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [ref]);

  return size;
};

const useSimulationPointer = () => {
  const pointerRef = useRef<AntigravityHeroSimulationPointerState>({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  });

  const updatePointer = useCallback((nextPointer: AntigravityHeroSimulationPointerState) => {
    pointerRef.current = normalizePointer(nextPointer);
  }, []);

  return {
    pointerRef,
    updatePointer,
  };
};

export const AntigravityHeroStage = ({
  active,
  corridorProgress,
  reducedMotion,
  scrollProgress,
  sceneStrength,
  seed,
  webglSupported,
}: AntigravityHeroStageProps) => {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [supportsWebGL, setSupportsWebGL] = useState<boolean | null>(null);
  const size = useStageSize(shellRef);
  const { pointerRef, updatePointer } = useSimulationPointer();
  const runtimeInputsRef = useRef<AntigravityHeroStageRuntimeInputs>({
    active,
    corridorProgress,
    reducedMotion,
    scrollProgress,
    sceneStrength,
  });
  const field = useMemo(
    () =>
      buildAntigravityHeroField({
        width: size.width,
        height: size.height,
        reducedMotion,
        seed,
      }),
    [reducedMotion, seed, size.height, size.width]
  );
  const viewport = useMemo(() => createStageViewport(size), [size]);
  const particleCount = getParticleCount(size.width, size.height, reducedMotion);
  const resolvedSupportsWebGL =
    typeof webglSupported !== "undefined" ? webglSupported : supportsWebGL;
  runtimeInputsRef.current = {
    active,
    corridorProgress,
    reducedMotion,
    scrollProgress,
    sceneStrength,
  };

  useEffect(() => {
    if (typeof webglSupported !== "undefined") {
      return;
    }

    setSupportsWebGL(supportsAntigravityHeroWebGL());
  }, [webglSupported]);

  const shellStyle = {
    "--hero-scene-strength": String(sceneStrength),
    "--hero-scroll-progress": String(scrollProgress),
    "--hero-corridor-progress": String(corridorProgress),
  } as CSSProperties;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const resetPointer = () => {
      updatePointer({
        active: false,
        x: pointerRef.current.x,
        y: pointerRef.current.y,
        vx: 0,
        vy: 0,
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = shellRef.current?.getBoundingClientRect();
      if (!rect) {
        resetPointer();
        return;
      }

      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!inside) {
        resetPointer();
        return;
      }

      const nextX = event.clientX - rect.left;
      const nextY = event.clientY - rect.top;
      const previous = pointerRef.current;
      const firstActiveSample = !previous.active;

      updatePointer({
        active: true,
        x: nextX,
        y: nextY,
        vx: firstActiveSample ? 0 : nextX - previous.x,
        vy: firstActiveSample ? 0 : nextY - previous.y,
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", resetPointer);
    window.addEventListener("blur", resetPointer);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", resetPointer);
      window.removeEventListener("blur", resetPointer);
    };
  }, [pointerRef, updatePointer]);

  return (
    <div
      ref={shellRef}
      className="antigravity-hero-stage"
      data-testid="antigravity-hero-stage"
      data-active={String(active)}
      data-reduced-motion={String(reducedMotion)}
      data-webgl-support={resolvedSupportsWebGL === null ? "pending" : String(resolvedSupportsWebGL)}
      data-coordinate-contract="orthographic-pixel"
      data-pointer-contract="window-tracking"
      data-renderer-contract={
        resolvedSupportsWebGL === true ? "shader-point-cloud" : "fallback-unified-field"
      }
      style={shellStyle}
      aria-hidden="true"
    >
      <div className="antigravity-hero-stage__wash" />
      {resolvedSupportsWebGL === true ? (
        <Canvas
          className="antigravity-hero-stage__canvas"
          orthographic={true}
          camera={{
            position: [0, 0, 100],
            left: viewport.left,
            right: viewport.right,
            top: viewport.top,
            bottom: viewport.bottom,
            near: 0.1,
            far: 1000,
            zoom: 1,
          }}
          dpr={[1, 2]}
        >
          <AntigravityHeroPoints
            active={active}
            field={field}
            particleCount={particleCount}
            pointerRef={pointerRef}
            reducedMotion={reducedMotion}
            runtimeInputsRef={runtimeInputsRef}
            viewport={viewport}
          />
        </Canvas>
      ) : (
        <AntigravityHeroFallback
          active={active}
          corridorProgress={corridorProgress}
          reducedMotion={reducedMotion}
          scrollProgress={scrollProgress}
          sceneStrength={sceneStrength}
        />
      )}
    </div>
  );
};
