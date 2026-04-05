import {
  createParticleFieldState,
  stepParticleFieldState,
  type ParticleFieldPointer,
  type RingParticle,
} from "./particleFieldModel";

type HeroParticleFieldOptions = {
  boundsElement?: HTMLElement;
  getCorridorProgress?: () => number;
  getScrollProgress: () => number;
  getSceneStrength?: () => number;
  interactionRoot?: HTMLElement;
  reducedMotion: boolean;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const readClampedScrollProgress = (getScrollProgress: () => number) => {
  const value = getScrollProgress();
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clamp(value, 0, 1);
};

const readClampedSceneStrength = (getSceneStrength?: () => number) => {
  if (!getSceneStrength) {
    return 1;
  }

  const value = getSceneStrength();
  if (!Number.isFinite(value)) {
    return 1;
  }

  return clamp(value, 0, 1);
};

const readClampedCorridorProgress = (getCorridorProgress?: () => number) => {
  if (!getCorridorProgress) {
    return 0;
  }

  const value = getCorridorProgress();
  if (!Number.isFinite(value)) {
    return 0;
  }

  return clamp(value, 0, 1);
};

const drawRingParticle = (
  context: CanvasRenderingContext2D,
  particle: RingParticle,
  clusterEnergy: number,
  sceneStrength: number,
  corridorProgress: number
) => {
  const tangentX = -Math.sin(particle.angle);
  const tangentY = Math.cos(particle.angle);
  const halfDash = particle.dashLength * (0.62 + clusterEnergy * 0.34);
  const alpha = clamp(
    particle.alpha *
      (0.88 + clusterEnergy * 0.22) *
      sceneStrength *
      (0.92 + corridorProgress * 0.08),
    0.08 * sceneStrength,
    0.96
  );
  const lineWidth = particle.size * (0.92 + clusterEnergy * 0.18 + corridorProgress * 0.05);

  context.beginPath();
  context.moveTo(particle.x - tangentX * halfDash, particle.y - tangentY * halfDash);
  context.lineTo(particle.x + tangentX * halfDash, particle.y + tangentY * halfDash);
  context.strokeStyle = `hsla(${particle.hue} 82% 53% / ${alpha})`;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.stroke();
};

export const startHeroParticleField = (
  canvas: HTMLCanvasElement,
  {
    boundsElement,
    getCorridorProgress,
    getScrollProgress,
    getSceneStrength,
    interactionRoot,
    reducedMotion,
  }: HeroParticleFieldOptions
) => {
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const resolvedInteractionRoot = interactionRoot ?? canvas.parentElement;
  const resolvedBoundsElement = boundsElement ?? canvas.parentElement;
  if (!resolvedInteractionRoot || !resolvedBoundsElement) {
    return null;
  }

  const pointer: ParticleFieldPointer = {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  };
  let boundsLeft = 0;
  let boundsTop = 0;
  let cssWidth = 1;
  let cssHeight = 1;
  let devicePixelRatio = 1;
  let frameHandle = 0;
  let lastFrameTime = performance.now();
  let lastPointerTime = performance.now();
  let state = createParticleFieldState({
    width: cssWidth,
    height: cssHeight,
    reducedMotion,
    seed: 11,
  });

  const syncCanvasBounds = () => {
    const bounds = resolvedBoundsElement.getBoundingClientRect();
    boundsLeft = bounds.left;
    boundsTop = bounds.top;

    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));
    const nextDpr =
      typeof window === "undefined" ? 1 : clamp(window.devicePixelRatio || 1, 1, 2);

    if (nextWidth === cssWidth && nextHeight === cssHeight && nextDpr === devicePixelRatio) {
      return;
    }

    cssWidth = nextWidth;
    cssHeight = nextHeight;
    devicePixelRatio = nextDpr;

    canvas.width = Math.max(1, Math.round(cssWidth * devicePixelRatio));
    canvas.height = Math.max(1, Math.round(cssHeight * devicePixelRatio));
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    state = createParticleFieldState({
      width: cssWidth,
      height: cssHeight,
      reducedMotion,
      seed: 11,
    });
  };

  const updatePointerFromEvent = (event: PointerEvent) => {
    const nextX = clamp(event.clientX - boundsLeft, 0, cssWidth);
    const nextY = clamp(event.clientY - boundsTop, 0, cssHeight);
    const now = performance.now();
    const deltaMs = Math.max(now - lastPointerTime, 16);

    pointer.vx = (nextX - pointer.x) / deltaMs;
    pointer.vy = (nextY - pointer.y) / deltaMs;
    pointer.x = nextX;
    pointer.y = nextY;
    pointer.active = true;
    lastPointerTime = now;
  };

  const handlePointerEnter = (event: PointerEvent) => {
    syncCanvasBounds();
    updatePointerFromEvent(event);
  };

  const handlePointerMove = (event: PointerEvent) => {
    updatePointerFromEvent(event);
  };

  const handlePointerLeave = () => {
    pointer.active = false;
    pointer.vx = 0;
    pointer.vy = 0;
  };

  const handleResize = () => {
    syncCanvasBounds();
  };

  const renderFrame = (timestamp: number) => {
    const deltaMs = Math.max(timestamp - lastFrameTime, 16);
    lastFrameTime = timestamp;
    const sceneStrength = readClampedSceneStrength(getSceneStrength);
    const corridorProgress = readClampedCorridorProgress(getCorridorProgress);

    state = stepParticleFieldState(state, {
      deltaMs,
      pointer: {
        active: pointer.active,
        x: pointer.x,
        y: pointer.y,
        vx: pointer.vx,
        vy: pointer.vy,
      },
      scrollProgress: readClampedScrollProgress(getScrollProgress),
    });

    context.clearRect(0, 0, cssWidth, cssHeight);

    const ambientDrift = state.cluster.time * 0.0012;
    const ambientBias = 0.26 + sceneStrength * 0.74 - corridorProgress * 0.08;
    for (const particle of state.ambientParticles) {
      const alphaPulse = 0.72 + Math.sin(ambientDrift + particle.phase) * 0.28;
      const alpha = clamp(
        particle.alpha * alphaPulse * ambientBias,
        0.04 * sceneStrength,
        0.36
      );
      const radius = particle.size * (0.88 + alphaPulse * 0.18);
      context.beginPath();
      context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(20, 24, 34, ${alpha})`;
      context.fill();
    }

    for (const particle of state.ringParticles) {
      drawRingParticle(
        context,
        particle,
        state.cluster.energy + corridorProgress * 0.25,
        sceneStrength,
        corridorProgress
      );
    }

    frameHandle = window.requestAnimationFrame(renderFrame);
  };

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          syncCanvasBounds();
        });

  syncCanvasBounds();
  resolvedInteractionRoot.addEventListener("pointerenter", handlePointerEnter);
  resolvedInteractionRoot.addEventListener("pointermove", handlePointerMove);
  resolvedInteractionRoot.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("resize", handleResize);
  resizeObserver?.observe(resolvedBoundsElement);
  frameHandle = window.requestAnimationFrame(renderFrame);

  return () => {
    window.cancelAnimationFrame(frameHandle);
    resolvedInteractionRoot.removeEventListener("pointerenter", handlePointerEnter);
    resolvedInteractionRoot.removeEventListener("pointermove", handlePointerMove);
    resolvedInteractionRoot.removeEventListener("pointerleave", handlePointerLeave);
    window.removeEventListener("resize", handleResize);
    resizeObserver?.disconnect();
  };
};
