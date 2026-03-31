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

const wrap = (value: number, limit: number): number =>
  ((value % limit) + limit) % limit;

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

export const createParticleFieldState = ({
  width,
  height,
  reducedMotion,
  seed,
}: CreateParams): ParticleFieldState => {
  const random = makeRandom(seed);

  const ambientCount = 32;
  const ringCount = 84;

  const baseRadius = Math.min(width, height) * 0.2;
  const thickness = baseRadius * 0.35;

  const ambientParticles: AmbientParticle[] = Array.from({ length: ambientCount }, () => {
    const driftX = random() * 0.6 - 0.3;
    const driftY = random() * 0.6 - 0.3;

    return {
      x: random() * width,
      y: random() * height,
      size: 0.8 + random() * 1.8,
      alpha: 0.2 + random() * 0.6,
      driftX,
      driftY,
      phase: random() * TAU,
    };
  });

  const ringParticles: RingParticle[] = Array.from({ length: ringCount }, () => {
    const angle = random() * TAU;
    const orbitOffset = random() * thickness * 0.5 - thickness * 0.25;
    const localRadius = baseRadius + orbitOffset;

    return {
      x: width * 0.5 + Math.cos(angle) * localRadius,
      y: height * 0.5 + Math.sin(angle) * localRadius,
      angle,
      orbitOffset,
      dashLength: 0.8 + random() * 6.5,
      size: 1 + random() * 1.7,
      alpha: 0.35 + random() * 0.5,
      hue: 180 + random() * 120,
    };
  });

  const centerY = height * 0.5;

  return {
    width,
    height,
    reducedMotion,
    ambientParticles,
    ringParticles,
    cluster: {
      centerX: width * 0.5,
      centerY,
      targetX: width * 0.5,
      targetY: centerY,
      radius: baseRadius,
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
  const dt = clamp(deltaMs / 16.666, 0, 4);
  const easedScroll = clamp(scrollProgress, 0, 1);
  const motionScale = state.reducedMotion ? 0.25 : 1;
  const particleScale = state.reducedMotion ? 0.4 : 1;

  const targetYFromScroll = state.height * (0.48 + easedScroll * 0.2);
  const pointerActive = pointer.active;
  const pointerTargetX = pointer.x;
  const pointerTargetY = pointer.y;

  const pointerWeight = pointerActive ? 0.18 * motionScale : 0;
  const scrollWeight = pointerActive ? 0.06 * motionScale : 0.04 * motionScale;

  const nextTargetX =
    state.cluster.targetX +
    (pointerTargetX - state.cluster.targetX) * pointerWeight * dt +
    (pointer.vx || 0) * 0.45 * motionScale;

  const nextTargetY =
    state.cluster.targetY +
    (targetYFromScroll - state.cluster.targetY) * scrollWeight * dt +
    (pointerActive ? (pointerTargetY - state.cluster.targetY) * pointerWeight * 0.4 * dt : 0) +
    (pointer.vy || 0) * 0.25 * motionScale;

  const targetX = nextTargetX;
  const targetY = nextTargetY;

  const clusterFollow = state.reducedMotion ? 0.22 : 0.45;
  const energyImpulse = pointerActive
    ? Math.min(
        1,
        0.35 +
          Math.abs(pointer.vx) * 0.12 +
          Math.abs(pointer.vy) * 0.15 +
          Math.abs(pointerTargetX - state.cluster.centerX) * 0.00035 +
          Math.abs(pointerTargetY - state.cluster.centerY) * 0.0008
      )
    : 0;
  const nextEnergy = clamp(
    state.cluster.energy * (state.reducedMotion ? 0.92 : 0.9) + energyImpulse * (state.reducedMotion ? 0.18 : 0.35),
    0,
    1
  );

  const nextAmbientParticles = state.ambientParticles.map((particle) => {
    const nextX = particle.x + particle.driftX * (particleScale * dt * 3);
    const nextY = particle.y + particle.driftY * (particleScale * dt * 3);

    return {
      ...particle,
      x: wrap(nextX, state.width),
      y: wrap(nextY, state.height),
      phase: (particle.phase + 0.01 * dt * (1 + motionScale * 2)) % TAU,
    };
  });

  const centerX = state.cluster.centerX;
  const centerY = state.cluster.centerY;
  const nextCenterX =
    centerX + (targetX - centerX) * clusterFollow * dt * (0.6 + motionScale * 0.4);
  const nextCenterY =
    centerY + (targetY - centerY) * clusterFollow * dt * (0.6 + motionScale * 0.4);

  const nextRingParticles = state.ringParticles.map((particle) => {
    const orbitPulse =
      Math.sin((state.cluster.time / 1600 + particle.angle) * 0.5) * 0.06;
    const orbitSpeed = 0.0032 * (0.35 + nextEnergy) * (state.reducedMotion ? 0.45 : 1);
    const angle = particle.angle + orbitSpeed * dt * TAU;
    const radius = state.cluster.radius + particle.orbitOffset + orbitPulse * state.cluster.thickness;

    return {
      ...particle,
      angle,
      x: nextCenterX + Math.cos(angle) * radius,
      y: nextCenterY + Math.sin(angle) * radius,
      dashLength: Math.max(
        0.3,
        particle.dashLength * (1 - state.cluster.time * 0.000001 * (1 + nextEnergy * 2))
      ),
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
