export type ParticleFieldPointer = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type AmbientParticle = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  driftX: number;
  driftY: number;
  phase: number;
};

export type RingParticle = {
  x: number;
  y: number;
  angle: number;
  orbitOffset: number;
  baseHue: number;
  baseAlpha: number;
  baseDashLength: number;
  arcMix: number;
  dashLength: number;
  size: number;
  alpha: number;
  hue: number;
};

export type ParticleFieldState = {
  width: number;
  height: number;
  reducedMotion: boolean;
  ambientParticles: AmbientParticle[];
  ringParticles: RingParticle[];
  cluster: {
    centerX: number;
    centerY: number;
    targetX: number;
    targetY: number;
    radius: number;
    radiusX: number;
    radiusY: number;
    thickness: number;
    energy: number;
    time: number;
  };
};

type CreateParams = {
  width: number;
  height: number;
  reducedMotion: boolean;
  seed?: number;
};

type StepParams = {
  deltaMs: number;
  scrollProgress: number;
  pointer: ParticleFieldPointer;
};

const TAU = Math.PI * 2;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeDimension = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
};

const wrapPosition = (value: number, limit: number): number => {
  if (limit <= 0) {
    return 0;
  }

  const wrapped = value % limit;
  return wrapped < 0 ? wrapped + limit : wrapped;
};

const makeRandom = (seed?: number): (() => number) => {
  if (seed === undefined || Number.isNaN(seed)) {
    return Math.random;
  }

  let state = (seed >>> 0) || 1;

  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
};

const getAreaScale = (width: number, height: number) => {
  const baseline = 1280 * 720;
  if (width <= 0 || height <= 0) {
    return 0.75;
  }

  return clamp((width * height) / baseline, 0.75, 1.35);
};

export const createParticleFieldState = ({
  width,
  height,
  reducedMotion,
  seed,
}: CreateParams): ParticleFieldState => {
  const safeWidth = normalizeDimension(width);
  const safeHeight = normalizeDimension(height);
  const random = makeRandom(seed);
  const areaScale = getAreaScale(safeWidth, safeHeight);

  const ambientCount = Math.max(28, Math.round((reducedMotion ? 52 : 88) * areaScale));
  const ringCount = Math.max(92, Math.round((reducedMotion ? 116 : 172) * areaScale));

  const baseRadius = Math.min(safeWidth, safeHeight) * (reducedMotion ? 0.33 : 0.38);
  const radiusX = baseRadius * (reducedMotion ? 1.08 : 1.18);
  const radiusY = baseRadius * (reducedMotion ? 0.76 : 0.84);
  const thickness = baseRadius * (reducedMotion ? 0.2 : 0.24);

  const centerX = safeWidth * 0.77;
  const centerY = safeHeight * 0.54;

  const ambientParticles: AmbientParticle[] = Array.from({ length: ambientCount }, () => ({
    x: safeWidth ? random() * safeWidth : 0,
    y: safeHeight ? random() * safeHeight : 0,
    size: 0.55 + random() * 1.35,
    alpha: 0.08 + random() * 0.24,
    driftX: random() * 0.32 - 0.16,
    driftY: random() * 0.32 - 0.16,
    phase: random() * TAU,
  }));

  const ringParticles: RingParticle[] = Array.from({ length: ringCount }, () => {
    const angle = random() * TAU;
    const orbitOffset = (random() - 0.5) * thickness * 1.8;
    const arcMix = random();
    const orbitX = radiusX + orbitOffset;
    const orbitY = radiusY + orbitOffset * 0.72;
    const baseHue = 12 + random() * 330;
    const baseAlpha = 0.34 + random() * 0.4;
    const baseDashLength = 2.4 + random() * 8.8;

    return {
      x: safeWidth ? centerX + Math.cos(angle) * orbitX : 0,
      y: safeHeight ? centerY + Math.sin(angle) * orbitY : 0,
      angle,
      orbitOffset,
      baseHue,
      baseAlpha,
      baseDashLength,
      arcMix,
      dashLength: baseDashLength,
      size: 1.1 + random() * 2.2,
      alpha: baseAlpha,
      hue: baseHue,
    };
  });

  return {
    width,
    height,
    reducedMotion,
    ambientParticles,
    ringParticles,
    cluster: {
      centerX,
      centerY,
      targetX: centerX,
      targetY: centerY,
      radius: baseRadius,
      radiusX,
      radiusY,
      thickness,
      energy: 0,
      time: 0,
    },
  };
};

export const stepParticleFieldState = (
  state: ParticleFieldState,
  { deltaMs, scrollProgress, pointer }: StepParams
): ParticleFieldState => {
  const safeWidth = normalizeDimension(state.width);
  const safeHeight = normalizeDimension(state.height);
  const dt = clamp(deltaMs / 16.666, 0, 4);
  const easedScroll = clamp(scrollProgress, 0, 1);
  const pointerActive = pointer.active;
  const motionScale = state.reducedMotion ? 0.36 : 1;

  const idlePhase = state.cluster.time * 0.00018;
  const idleTargetX =
    safeWidth * 0.77 +
    Math.cos(idlePhase * 0.9) * safeWidth * (state.reducedMotion ? 0.016 : 0.036);
  const scrollTargetY = safeHeight * (0.53 + easedScroll * 0.16);
  const idleTargetY =
    scrollTargetY +
    Math.sin(idlePhase * 0.74 + 0.42) * safeHeight * (state.reducedMotion ? 0.012 : 0.032);

  const pointerTargetX =
    pointerActive && Number.isFinite(pointer.x)
      ? clamp(pointer.x + safeWidth * 0.06, safeWidth * 0.32, safeWidth * 0.94)
      : idleTargetX;
  const pointerTargetY =
    pointerActive && Number.isFinite(pointer.y)
      ? clamp(pointer.y + safeHeight * 0.03, safeHeight * 0.18, safeHeight * 0.86)
      : idleTargetY;
  const pointerVx = pointerActive && Number.isFinite(pointer.vx) ? pointer.vx : 0;
  const pointerVy = pointerActive && Number.isFinite(pointer.vy) ? pointer.vy : 0;

  const idleWeight = pointerActive ? 0.04 : 0.1 * (state.reducedMotion ? 0.62 : 1);
  const pointerWeight = pointerActive ? 0.18 * motionScale : 0;
  const scrollWeight = 0.16 * (state.reducedMotion ? 0.72 : 1);

  const targetX =
    state.cluster.targetX +
    (idleTargetX - state.cluster.targetX) * idleWeight * dt +
    (pointerTargetX - state.cluster.targetX) * pointerWeight * dt +
    pointerVx * 10 * motionScale;
  const targetY =
    state.cluster.targetY +
    (scrollTargetY - state.cluster.targetY) * scrollWeight * dt +
    (idleTargetY - state.cluster.targetY) * idleWeight * dt +
    (pointerTargetY - state.cluster.targetY) * pointerWeight * dt * 0.82 +
    pointerVy * 8 * motionScale;

  const follow = state.reducedMotion ? 0.16 : 0.28;
  const nextCenterX = state.cluster.centerX + (targetX - state.cluster.centerX) * follow * dt;
  const nextCenterY = state.cluster.centerY + (targetY - state.cluster.centerY) * follow * dt;

  const energyImpulse = pointerActive
    ? Math.min(
        1,
        0.2 +
          Math.abs(pointerVx) * 0.12 +
          Math.abs(pointerVy) * 0.14 +
          (Math.abs(pointerTargetX - state.cluster.centerX) +
            Math.abs(pointerTargetY - state.cluster.centerY)) *
            0.00045
      )
    : 0;
  const energyDecay = state.reducedMotion ? 0.93 : 0.89;
  const nextEnergy = clamp(
    state.cluster.energy * energyDecay + energyImpulse * (state.reducedMotion ? 0.18 : 0.32),
    0,
    1
  );

  const nextAmbientParticles = state.ambientParticles.map((particle) => {
    const nextX = particle.x + particle.driftX * dt * 4.8;
    const nextY = particle.y + particle.driftY * dt * 4.8;

    return {
      ...particle,
      x: wrapPosition(nextX, safeWidth),
      y: wrapPosition(nextY, safeHeight),
      phase: (particle.phase + 0.006 * dt * (1 + motionScale)) % TAU,
    };
  });

  const orbitMotion = 0.0026 * TAU * (0.78 + nextEnergy * 0.46) * (state.reducedMotion ? 0.54 : 1);
  const hueShift = easedScroll * 44 + state.cluster.time * (state.reducedMotion ? 0.001 : 0.0018);

  const nextRingParticles = state.ringParticles.map((particle) => {
    const angle = particle.angle + orbitMotion * dt * (0.82 + particle.arcMix * 0.36);
    const pulse = Math.sin(state.cluster.time * 0.0019 + particle.arcMix * TAU) * state.cluster.thickness * 0.12;
    const orbitX = state.cluster.radiusX + particle.orbitOffset + pulse;
    const orbitY = state.cluster.radiusY + particle.orbitOffset * 0.72 - pulse * 0.42;

    const lobeA = Math.max(0, Math.cos(angle - 0.48));
    const lobeB = Math.max(0, Math.cos(angle - 2.62));
    const lobeC = Math.max(0, Math.cos(angle - 4.42)) * 0.36;
    const arcStrength = clamp(
      0.14 + lobeA * 0.62 + lobeB * 0.5 + lobeC + particle.arcMix * 0.08,
      0.1,
      1
    );

    return {
      ...particle,
      angle,
      x: nextCenterX + Math.cos(angle) * orbitX,
      y: nextCenterY + Math.sin(angle) * orbitY,
      alpha: clamp(particle.baseAlpha * arcStrength * (0.82 + nextEnergy * 0.34), 0.08, 0.96),
      dashLength: particle.baseDashLength * (0.82 + arcStrength * 0.34),
      hue: (particle.baseHue + hueShift + arcStrength * 18) % 360,
    };
  });

  return {
    ...state,
    ambientParticles: nextAmbientParticles,
    ringParticles: nextRingParticles,
    cluster: {
      ...state.cluster,
      centerX: nextCenterX,
      centerY: nextCenterY,
      targetX,
      targetY,
      energy: nextEnergy,
      time: state.cluster.time + deltaMs,
    },
  };
};
