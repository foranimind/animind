import {
  type AntigravityHeroField,
  type AntigravityHeroFieldPoint,
  sampleAntigravityHeroFieldPoints,
} from "./antigravityHeroField";

const TAU = Math.PI * 2;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }

  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const makeSeededRandom = (seed: number): (() => number) => {
  let state = (seed >>> 0) || 1;

  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
};

const normalizeDimension = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const gaussian = (delta: number, spread: number): number => {
  const safeSpread = Math.max(spread, 0.0001);
  const scaled = delta / safeSpread;
  return Math.exp(-scaled * scaled);
};

const mixColor = (
  cool: number,
  warm: number,
  accent: number,
  phase: number,
  presence: number,
  localWeight: number,
  particleBias: number
): AntigravityHeroParticleColor => {
  const colorPhase = (phase % TAU) / TAU;
  const warmWindow = clamp(1 - Math.abs(colorPhase - 0.68) / 0.26, 0, 1);
  const accentWindow = clamp(1 - Math.abs(colorPhase - 0.84) / 0.22, 0, 1);
  const warmCarrier = clamp((particleBias - 0.37) * 2.35, 0, 1) * warmWindow;
  const accentCarrier = clamp((particleBias - 0.43) * 2.9, 0, 1) * accentWindow;
  const coolAmount = clamp(
    cool * (0.62 + presence * 0.1) +
      (1 - colorPhase) * 0.03 -
      warmCarrier * 0.08 -
      accentCarrier * 0.03,
    0,
    1
  );
  const warmAmount = clamp(
    warm * (0.22 + localWeight * 0.14) +
      warmCarrier * 0.68 +
      colorPhase * 0.04 +
      particleBias * 0.04,
    0,
    1
  );
  const accentAmount = clamp(
    accent * (0.2 + (1 - presence) * 0.14 + localWeight * 0.04) + accentCarrier * 0.64,
    0,
    1
  );

  return {
    r: clamp(
      0.21 + coolAmount * 0.01 + warmAmount * 0.18 + warmCarrier * 0.62 + accentCarrier * 0.36,
      0,
      1
    ),
    g: clamp(0.2 + coolAmount * 0.13 + warmAmount * 0.11 + accentCarrier * 0.14, 0, 1),
    b: clamp(0.43 + coolAmount * 0.28 - warmAmount * 0.03 - warmCarrier * 0.22 - accentCarrier * 0.16, 0, 1),
    a: clamp(0.54 + presence * 0.34 + accentAmount * 0.12, 0, 1),
  };
};

const lerpColor = (
  start: AntigravityHeroParticleColor,
  end: AntigravityHeroParticleColor,
  amount: number
): AntigravityHeroParticleColor => ({
  r: lerp(start.r, end.r, amount),
  g: lerp(start.g, end.g, amount),
  b: lerp(start.b, end.b, amount),
  a: lerp(start.a, end.a, amount),
});

const distanceToSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number => {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby;

  if (lengthSquared <= 0.0001) {
    return Math.hypot(px - ax, py - ay);
  }

  const projection = clamp(((px - ax) * abx + (py - ay) * aby) / lengthSquared, 0, 1);
  const closestX = ax + abx * projection;
  const closestY = ay + aby * projection;

  return Math.hypot(px - closestX, py - closestY);
};

const safePointer = (pointer: AntigravityHeroSimulationPointerState): AntigravityHeroSimulationPointerState => ({
  active: Boolean(pointer.active),
  x: Number.isFinite(pointer.x) ? pointer.x : 0,
  y: Number.isFinite(pointer.y) ? pointer.y : 0,
  vx: Number.isFinite(pointer.vx) ? pointer.vx : 0,
  vy: Number.isFinite(pointer.vy) ? pointer.vy : 0,
});

const buildStageTarget = (
  field: AntigravityHeroField,
  scrollProgress: number,
  corridorProgress: number,
  sceneStrength: number
): AntigravityHeroSimulationStage => {
  const safeScrollProgress = clamp(scrollProgress, 0, 1);
  const safeCorridorProgress = clamp(corridorProgress, 0, 1);
  const safeSceneStrength = clamp(sceneStrength, 0, 1);
  const fieldWidth = normalizeDimension(field.width);
  const fieldHeight = normalizeDimension(field.height);
  const baseCenterX = field.centerX;
  const baseCenterY = field.centerY;

  return {
    centerX: clamp(
      baseCenterX +
        (safeCorridorProgress - 0.18) *
          fieldWidth *
          0.048 *
          (0.24 + safeSceneStrength * 0.34),
      0,
      fieldWidth
    ),
    centerY: clamp(
      baseCenterY +
        (0.18 - safeScrollProgress) *
          fieldHeight *
          0.036 *
          (0.2 + safeSceneStrength * 0.3) -
        safeCorridorProgress * fieldHeight * 0.004,
      0,
      fieldHeight
    ),
    compressionX: clamp(
      0.99 + safeCorridorProgress * 0.03 - safeScrollProgress * 0.01 + safeSceneStrength * 0.01,
      0.94,
      1.06
    ),
    compressionY: clamp(
      1 + safeScrollProgress * 0.03 - safeCorridorProgress * 0.015 - safeSceneStrength * 0.01,
      0.95,
      1.08
    ),
    scrollProgress: safeScrollProgress,
    corridorProgress: safeCorridorProgress,
    sceneStrength: safeSceneStrength,
  };
};

const createDefaultStage = (field: AntigravityHeroField): AntigravityHeroSimulationStage =>
  buildStageTarget(field, 0, 0, 0);

const projectHomePositionToStage = (
  field: AntigravityHeroField,
  stage: AntigravityHeroSimulationStage,
  homePosition: { x: number; y: number }
) => ({
  x: clamp(
    stage.centerX + (homePosition.x - field.centerX) * stage.compressionX,
    0,
    normalizeDimension(field.width)
  ),
  y: clamp(
    stage.centerY + (homePosition.y - field.centerY) * stage.compressionY,
    0,
    normalizeDimension(field.height)
  ),
});

const createParticle = (
  field: AntigravityHeroField,
  point: AntigravityHeroFieldPoint,
  random: () => number
): AntigravityHeroSimulationParticle => {
  const sizeSeed = random();
  const orientationSeed = random();
  const presencePhase = random() * TAU;
  const normalizedX = point.x / Math.max(normalizeDimension(field.width), 1);
  const normalizedY = point.y / Math.max(normalizeDimension(field.height), 1);
  const copyLaneFade =
    gaussian(normalizedX - 0.5, 0.14) * gaussian(normalizedY - 0.47, 0.16);
  const localWeight = clamp(
    point.occupancy * 0.62 +
      point.shapeBias * 0.16 +
      point.colorBias * 0.12 +
      (1 - point.lifecycleAllowance) * 0.06,
    0.03,
    1
  );
  const clusterAffinity = clamp(
    point.occupancy * 0.6 + point.shapeBias * 0.16 + point.colorBias * 0.2,
    0.05,
    1
  );
  const corridorLift = copyLaneFade * (0.08 + point.occupancy * 0.08);
  const visibilityBias = clamp(1 - copyLaneFade * 0.01 + corridorLift * 0.4, 0.94, 1.14);
  const baseVisibility = clamp(
    (point.occupancy * (0.46 + point.shapeBias * 0.4) +
      point.colorBias * 0.06 +
      (1 - point.lifecycleAllowance) * 0.03 +
      point.lifecycleAllowance * 0.03) *
      (0.92 + clusterAffinity * 0.44) *
      visibilityBias +
      corridorLift * 0.18,
    0.05,
    0.98
  );

  return {
    homePosition: { x: point.x, y: point.y },
    position: { x: point.x, y: point.y },
    velocity: { x: 0, y: 0 },
    baseOccupancy: point.occupancy,
    lifecycleAllowance: point.lifecycleAllowance,
    shapeBias: point.shapeBias,
    clusterAffinity,
    presence: clamp(
      0.14 + baseVisibility * (1.02 + (Math.sin(presencePhase) + 1) * 0.2) + corridorLift * 0.22,
      0.06,
      1
    ),
    presencePhase,
    colorBias: point.colorBias,
    currentColor: mixColor(
      field.colorBias.cool,
      field.colorBias.warm,
      field.colorBias.accent,
      presencePhase,
      localWeight,
      localWeight,
      point.colorBias
    ),
    sizeSeed,
    orientationSeed,
    localWeight,
  };
};

export type AntigravityHeroSimulationPointerState = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type AntigravityHeroParticleColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type AntigravityHeroSimulationParticle = {
  homePosition: { x: number; y: number };
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  baseOccupancy: number;
  lifecycleAllowance: number;
  shapeBias: number;
  clusterAffinity: number;
  presence: number;
  presencePhase: number;
  colorBias: number;
  currentColor: AntigravityHeroParticleColor;
  sizeSeed: number;
  orientationSeed: number;
  localWeight: number;
};

export type AntigravityHeroSimulationStage = {
  centerX: number;
  centerY: number;
  compressionX: number;
  compressionY: number;
  scrollProgress: number;
  corridorProgress: number;
  sceneStrength: number;
};

export type AntigravityHeroSimulationState = {
  field: AntigravityHeroField;
  particles: AntigravityHeroSimulationParticle[];
  timeMs: number;
  phase: number;
  seed: number;
  attractor: { x: number; y: number };
  stage: AntigravityHeroSimulationStage;
};

export type AntigravityHeroSimulationInput = {
  field: AntigravityHeroField;
  particleCount: number;
  seed?: number;
};

export type AntigravityHeroSimulationStepInput = {
  deltaMs: number;
  pointer: AntigravityHeroSimulationPointerState;
  scrollProgress?: number;
  corridorProgress?: number;
  sceneStrength?: number;
};

const updateParticle = (
  field: AntigravityHeroField,
  particle: AntigravityHeroSimulationParticle,
  statePhase: number,
  deltaMs: number,
  pointer: AntigravityHeroSimulationPointerState,
  attractor: { x: number; y: number },
  stage: AntigravityHeroSimulationStage
): AntigravityHeroSimulationParticle => {
  const dt = clamp(deltaMs / 16, 0, 4);
  const deltaSeconds = clamp(deltaMs / 1000, 0, 0.1);
  const pointerState = safePointer(pointer);
  const next = {
    homePosition: particle.homePosition,
    position: { ...particle.position },
    velocity: { ...particle.velocity },
    baseOccupancy: particle.baseOccupancy,
    lifecycleAllowance: particle.lifecycleAllowance,
    shapeBias: particle.shapeBias,
    clusterAffinity: particle.clusterAffinity,
    presence: particle.presence,
    presencePhase: particle.presencePhase,
    colorBias: particle.colorBias,
    currentColor: particle.currentColor,
    sizeSeed: particle.sizeSeed,
    orientationSeed: particle.orientationSeed,
    localWeight: particle.localWeight,
  };

  const homeOffsetX = next.homePosition.x - field.centerX;
  const homeOffsetY = next.homePosition.y - field.centerY;
  const stageHomeX = stage.centerX + homeOffsetX * stage.compressionX;
  const stageHomeY = stage.centerY + homeOffsetY * stage.compressionY;
  const attractorOffsetX = attractor.x - stage.centerX;
  const attractorOffsetY = attractor.y - stage.centerY;
  let translatedHomeX =
    stageHomeX + attractorOffsetX * (0.24 + next.clusterAffinity * 0.96);
  let translatedHomeY =
    stageHomeY + attractorOffsetY * (0.14 + next.clusterAffinity * 0.42);
  const translatedNormX = translatedHomeX / Math.max(normalizeDimension(field.width), 1);
  const translatedNormY = translatedHomeY / Math.max(normalizeDimension(field.height), 1);
  const toHomeX = translatedHomeX - next.position.x;
  const toHomeY = translatedHomeY - next.position.y;
  const homeDistance = Math.max(Math.hypot(toHomeX, toHomeY), 0.0001);
  const homeDirectionX = toHomeX / homeDistance;
  const homeDirectionY = toHomeY / homeDistance;
  const tangentX = -homeDirectionY;
  const tangentY = homeDirectionX;
  const ringRadius = Math.hypot(
    homeOffsetX / Math.max(normalizeDimension(field.width) * 0.34, 1),
    homeOffsetY / Math.max(normalizeDimension(field.height) * 0.28, 1)
  );
  const ringBias = gaussian(ringRadius - 1.02, 0.24);

  const phasePulse = Math.sin(next.presencePhase + statePhase * 0.08);
  const phaseDrift = Math.sin(next.presencePhase * 0.53 + next.sizeSeed * TAU);
  const turnoverWave = Math.sin(next.presencePhase * 1.17 + statePhase * 1.61 + next.orientationSeed * TAU);
  const turnoverPulse = (turnoverWave + 1) * 0.5;
  const baselineLocalWeight = clamp(
    next.baseOccupancy * 0.62 +
      next.shapeBias * 0.16 +
      next.colorBias * 0.12 +
      (1 - next.lifecycleAllowance) * 0.06,
    0.03,
    1
  );
  const corridorLift =
    gaussian(translatedNormX - 0.5, 0.16) * gaussian(translatedNormY - 0.48, 0.2);
  const baseVisibility = clamp(
    (next.baseOccupancy * (0.46 + next.shapeBias * 0.4) +
      next.colorBias * 0.06 +
      (1 - next.lifecycleAllowance) * 0.03 +
      next.lifecycleAllowance * 0.03) *
      (0.92 + next.clusterAffinity * 0.44 + ringBias * 0.06) +
      corridorLift * 0.16,
    0.05,
    0.98
  );
  const turnoverAmplitude = 0.06 + next.lifecycleAllowance * 0.22;
  const ambientPenalty = (1 - next.clusterAffinity) * 0.05;

  let targetLocalWeight = clamp(
    baselineLocalWeight + phasePulse * 0.02 + ringBias * 0.06 + stage.sceneStrength * 0.02,
    0.03,
    1
  );
  let presenceTarget = clamp(
    0.12 +
      baseVisibility * (1.06 + phasePulse * 0.08) +
      turnoverPulse * turnoverAmplitude -
      next.lifecycleAllowance * 0.06 +
      phaseDrift * 0.025 -
      ambientPenalty +
      ringBias * 0.08 +
      stage.sceneStrength * 0.04 +
      corridorLift * 0.04,
    0.03,
    0.98
  );

  const active = pointerState.active;
  if (active) {
    const pointerNormX = pointerState.x / Math.max(normalizeDimension(field.width), 1);
    const pointerNormY = pointerState.y / Math.max(normalizeDimension(field.height), 1);
    const pointerViewportDriftX =
      Math.sign(pointerNormX - 0.5) * Math.pow(clamp(Math.abs(pointerNormX - 0.5) * 2, 0, 1), 0.92);
    const pointerViewportDriftY =
      Math.sign(pointerNormY - 0.46) * Math.pow(clamp(Math.abs(pointerNormY - 0.46) * 2, 0, 1), 0.9);
    const horizontalFocus = Math.abs(pointerViewportDriftX);
    const verticalFocus = Math.abs(pointerViewportDriftY);
    const pointerOrbitBlend = clamp(
      0.12 + next.clusterAffinity * 0.76 + ringBias * 0.14 + next.localWeight * 0.08,
      0.12,
      0.94
    );
    const activeOrbitCenterX =
      pointerState.x +
      pointerViewportDriftX * normalizeDimension(field.width) * (field.reducedMotion ? 0.16 : 0.24);
    const activeOrbitCenterY =
      pointerState.y +
      pointerViewportDriftY * normalizeDimension(field.height) * (field.reducedMotion ? 0.06 : 0.08) +
      normalizeDimension(field.height) * (field.reducedMotion ? 0.006 : 0.01);
    const homeAngle = Math.atan2(homeOffsetY, homeOffsetX);
    const orbitDirectionX = Math.cos(homeAngle);
    const orbitDirectionY = Math.sin(homeAngle);
    const pointerRingScaleX =
      normalizeDimension(field.width) *
      (0.092 + clamp(ringRadius, 0.34, 1.6) * 0.084) *
      (0.82 + next.clusterAffinity * 0.2);
    const pointerRingScaleY =
      normalizeDimension(field.height) *
      (0.084 + clamp(ringRadius, 0.34, 1.6) * 0.07) *
      (0.86 + next.clusterAffinity * 0.14);
    const pointerOrbitX =
      activeOrbitCenterX +
      orbitDirectionX * pointerRingScaleX;
    const pointerOrbitY =
      activeOrbitCenterY +
      orbitDirectionY * pointerRingScaleY;

    translatedHomeX = lerp(translatedHomeX, pointerOrbitX, pointerOrbitBlend);
    translatedHomeY = lerp(translatedHomeY, pointerOrbitY, pointerOrbitBlend * 0.94);

    const prevX = pointerState.x - pointerState.vx * 28;
    const prevY = pointerState.y - pointerState.vy * 28;
    const distanceToPointer = Math.hypot(next.position.x - pointerState.x, next.position.y - pointerState.y);
    const homeDistanceToPointer = Math.hypot(
      translatedHomeX - pointerState.x,
      translatedHomeY - pointerState.y
    );
    const distanceToAttractor = Math.hypot(next.position.x - attractor.x, next.position.y - attractor.y);
    const pointerFieldDistance = Math.hypot(
      translatedHomeX - pointerState.x,
      translatedHomeY - pointerState.y
    );
    const distanceToPath = distanceToSegment(
      next.position.x,
      next.position.y,
      prevX,
      prevY,
      pointerState.x,
      pointerState.y
    );
    const motionLength = Math.hypot(pointerState.vx, pointerState.vy);
    const hasTravelDirection = motionLength > 0.0001;
    const travelX = hasTravelDirection ? pointerState.vx / motionLength : 0;
    const travelY = hasTravelDirection ? pointerState.vy / motionLength : 0;
    const signedTrailDistance = hasTravelDirection
      ? (next.position.x - pointerState.x) * travelX +
        (next.position.y - pointerState.y) * travelY
      : 0;

    const proximity = smoothstep(220, 0, distanceToPointer);
    const fieldGather = smoothstep(420, 0, homeDistanceToPointer);
    const attractorGather = smoothstep(520, 0, distanceToAttractor) * next.clusterAffinity;
    const fieldFocus = smoothstep(
      Math.max(normalizeDimension(field.width), normalizeDimension(field.height)) * 0.64,
      Math.max(normalizeDimension(field.width), normalizeDimension(field.height)) * 0.14,
      pointerFieldDistance
    );
    const farFieldFade = Math.pow(1 - fieldFocus, 1.15);
    const lateralOpposition =
      pointerViewportDriftX < 0
        ? clamp(
            (translatedHomeX - pointerState.x) /
              Math.max(normalizeDimension(field.width) * 0.56, 1),
            0,
            1
          )
        : pointerViewportDriftX > 0
          ? clamp(
              (pointerState.x - translatedHomeX) /
                Math.max(normalizeDimension(field.width) * 0.56, 1),
              0,
              1
            )
          : 0;
    const pathLift = smoothstep(140, 0, distanceToPath);
    const directionalMigration = hasTravelDirection
      ? clamp(
          pathLift * 0.68 +
            proximity * 0.22 +
            clamp((signedTrailDistance + 84) / 168, 0, 1) * 0.1,
          0,
          1
        )
      : clamp(pathLift * 0.7 + proximity * 0.3, 0, 1);
    const behindCursor = hasTravelDirection ? clamp((-signedTrailDistance) / 180, 0, 1) : 0;
    const migrateTowardCursor = directionalMigration;
    const repulsionStrength =
      (0.14 +
        next.localWeight * 0.06 +
        ringBias * 0.05 +
        field.shapeBias.rightHeavy * 0.04 +
        stage.sceneStrength * 0.02) *
      proximity *
      dt;

    next.velocity.x +=
      (next.position.x - pointerState.x) / Math.max(distanceToPointer, 1) * repulsionStrength;
    next.velocity.y +=
      (next.position.y - pointerState.y) / Math.max(distanceToPointer, 1) * repulsionStrength;
    next.velocity.x += homeDirectionX * 0.014 * dt;
    next.velocity.y += homeDirectionY * 0.014 * dt;
    next.velocity.x += (attractor.x - next.position.x) * attractorGather * 0.00092 * dt;
    next.velocity.y += (attractor.y - next.position.y) * attractorGather * 0.00064 * dt;
    next.velocity.x += (pointerState.x - next.position.x) * fieldGather * 0.00074 * dt;
    next.velocity.y += (pointerState.y - next.position.y) * fieldGather * 0.00052 * dt;
    next.velocity.x += tangentX * migrateTowardCursor * 0.014 * dt;
    next.velocity.y += tangentY * migrateTowardCursor * 0.014 * dt;

    targetLocalWeight = clamp(
      baselineLocalWeight +
        fieldGather * 0.1 +
        attractorGather * 0.12 +
        migrateTowardCursor * 0.16 -
        behindCursor * 0.08 +
        fieldFocus * (0.16 + horizontalFocus * 0.06 + verticalFocus * 0.02) -
        farFieldFade * (0.12 + horizontalFocus * 0.08) +
        lateralOpposition * horizontalFocus * -0.16 +
        ringBias * 0.08 +
        phasePulse * 0.03,
      0.03,
      1
    );
    presenceTarget = clamp(
      presenceTarget +
        fieldGather * 0.14 +
        attractorGather * 0.18 +
        migrateTowardCursor * 0.18 -
        behindCursor * 0.12 +
        proximity * 0.08 -
        farFieldFade * (0.22 + next.clusterAffinity * 0.14 + horizontalFocus * 0.18) +
        lateralOpposition * horizontalFocus * -(0.32 + next.clusterAffinity * 0.1) +
        fieldFocus * (0.18 + horizontalFocus * 0.08 + verticalFocus * 0.03) -
        (1 - next.clusterAffinity) * 0.06,
      0.01,
      0.96
    );
  } else {
    const idleNormX = translatedHomeX / Math.max(normalizeDimension(field.width), 1);
    const idleNormY = translatedHomeY / Math.max(normalizeDimension(field.height), 1);
    const idleCenterBias =
      gaussian(idleNormX - 0.5, 0.18) * gaussian(idleNormY - 0.46, 0.16) +
      gaussian(idleNormX - 0.6, 0.26) * gaussian(idleNormY - 0.6, 0.24) * 0.26;
    const idleHaloBias =
      gaussian(idleNormX - 0.41, 0.09) * gaussian(idleNormY - 0.48, 0.32) * 0.9 +
      gaussian(idleNormX - 0.64, 0.14) * gaussian(idleNormY - 0.48, 0.36) * 0.36 +
      gaussian(idleNormX - 0.49, 0.2) * gaussian(idleNormY - 0.16, 0.14) * 0.18;
    const idleBloom =
      stage.sceneStrength *
      (0.05 + next.clusterAffinity * 0.03 + next.colorBias * 0.03 + ringBias * 0.024);
    next.velocity.x += homeDirectionX * (0.018 + stage.sceneStrength * 0.004) * dt;
    next.velocity.y += homeDirectionY * (0.018 + stage.sceneStrength * 0.004) * dt;
    targetLocalWeight = clamp(
      targetLocalWeight +
        idleBloom * (0.18 + idleCenterBias * 0.26 + idleHaloBias * 0.52) +
        corridorLift * 0.04,
      0.03,
      1
    );
    presenceTarget = clamp(
      presenceTarget +
        idleBloom * (0.32 + idleCenterBias * 0.48 + idleHaloBias * 0.86) +
        corridorLift * 0.08,
      0.03,
      0.98
    );
  }

  const normalizedX = next.position.x / Math.max(normalizeDimension(field.width), 1);
  const normalizedY = next.position.y / Math.max(normalizeDimension(field.height), 1);
  const titleShield =
    gaussian(normalizedX - 0.5, 0.145) * gaussian(normalizedY - 0.44, 0.076);
  const bodyShield =
    gaussian(normalizedX - 0.5, 0.13) * gaussian(normalizedY - 0.58, 0.108) * 0.42;
  const corridorShield =
    gaussian(normalizedX - 0.5, 0.096 + stage.corridorProgress * 0.028) *
    gaussian(normalizedY - (0.48 - stage.scrollProgress * 0.02), 0.24) *
    (0.072 + stage.sceneStrength * 0.026);
  const copyShieldStrength = active ? 1 : 0.34;
  const copyShield = clamp(titleShield * 0.2 + bodyShield * 0.68 + corridorShield, 0, 0.44);
  const scaledCopyShield = copyShield * copyShieldStrength;
  targetLocalWeight = clamp(targetLocalWeight - scaledCopyShield * 0.02, 0.03, 1);
  presenceTarget = clamp(
    presenceTarget - scaledCopyShield * (0.03 + next.clusterAffinity * 0.03),
    0.01,
    0.96
  );

  const stageNormalizedX = next.position.x / Math.max(normalizeDimension(field.width), 1);
  const stageNormalizedY = next.position.y / Math.max(normalizeDimension(field.height), 1);
  const stageCorridorFade =
    gaussian(stageNormalizedX - 0.5, 0.11 + stage.corridorProgress * 0.03) *
    gaussian(stageNormalizedY - (0.48 - stage.scrollProgress * 0.015), 0.26) *
    stage.corridorProgress;

  targetLocalWeight = clamp(
    targetLocalWeight - stageCorridorFade * 0.015,
    0.03,
    1
  );
  presenceTarget = clamp(
    presenceTarget - stageCorridorFade * 0.025,
    0.01,
    0.96
  );

  const homePull = active ? 0.074 : 0.086;
  next.velocity.x += toHomeX * homePull * dt * (0.42 + next.localWeight * 0.24);
  next.velocity.y += toHomeY * homePull * dt * (0.42 + next.localWeight * 0.24);

  const damping = field.reducedMotion ? (active ? 0.84 : 0.78) : active ? 0.8 : 0.7;
  next.velocity.x *= damping;
  next.velocity.y *= damping;

  next.position.x += next.velocity.x * dt;
  next.position.y += next.velocity.y * dt;
  const positionalReturn = active ? 0.014 : 0.12;
  next.position.x += toHomeX * positionalReturn * dt;
  next.position.y += toHomeY * positionalReturn * dt;
  next.position.x = clamp(next.position.x, 0, normalizeDimension(field.width));
  next.position.y = clamp(next.position.y, 0, normalizeDimension(field.height));

  const phaseAdvance =
    deltaSeconds *
    (field.reducedMotion ? 0.28 + next.localWeight * 0.12 : 0.46 + next.localWeight * 0.18);
  next.presencePhase = (next.presencePhase + phaseAdvance) % TAU;
  next.localWeight = lerp(next.localWeight, targetLocalWeight, 0.18 * dt);
  next.presence = lerp(next.presence, presenceTarget, 0.24 * dt);
  const targetColor = mixColor(
    field.colorBias.cool,
    field.colorBias.warm,
    field.colorBias.accent,
    next.presencePhase + statePhase * 0.03,
    next.presence,
    next.localWeight,
    next.colorBias
  );
  next.currentColor = lerpColor(
    next.currentColor,
    targetColor,
    clamp((active ? 0.04 : 0.03) * dt, 0, 0.18)
  );

  return next;
};

export const createAntigravityHeroSimulationState = ({
  field,
  particleCount,
  seed,
}: AntigravityHeroSimulationInput): AntigravityHeroSimulationState => {
  const total = Math.max(0, Math.floor(particleCount));
  const baseSeed = seed ?? field.seed ?? 1;
  const random = makeSeededRandom(baseSeed);
  const points = sampleAntigravityHeroFieldPoints(field, total);
  const stage = createDefaultStage(field);
  const particles = points.map((point) => {
    const particle = createParticle(field, point, random);
    const stagedPosition = projectHomePositionToStage(field, stage, particle.homePosition);

    return {
      ...particle,
      position: stagedPosition,
    };
  });

  return {
    field,
    particles,
    timeMs: 0,
    phase: random() * TAU,
    seed: baseSeed,
    attractor: {
      x: stage.centerX,
      y: stage.centerY,
    },
    stage,
  };
};

export const stepAntigravityHeroSimulationState = (
  state: AntigravityHeroSimulationState,
  {
    deltaMs,
    pointer,
    scrollProgress = state.stage.scrollProgress,
    corridorProgress = state.stage.corridorProgress,
    sceneStrength = state.stage.sceneStrength,
  }: AntigravityHeroSimulationStepInput
): AntigravityHeroSimulationState => {
  const safeDelta = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
  const nextPhase = (state.phase + safeDelta * 0.001) % TAU;
  const safePointerState = safePointer(pointer);
  const safeScrollProgress = clamp(scrollProgress, 0, 1);
  const safeCorridorProgress = clamp(corridorProgress, 0, 1);
  const safeSceneStrength = clamp(sceneStrength, 0, 1);
  const stageTarget = buildStageTarget(
    state.field,
    safeScrollProgress,
    safeCorridorProgress,
    safeSceneStrength
  );
  const stageLerp = clamp(
    (state.field.reducedMotion ? 0.045 : 0.068) * (safeDelta / 16),
    0,
    0.24
  );
  const nextStage: AntigravityHeroSimulationStage = {
    centerX: lerp(state.stage.centerX, stageTarget.centerX, stageLerp),
    centerY: lerp(state.stage.centerY, stageTarget.centerY, stageLerp),
    compressionX: lerp(state.stage.compressionX, stageTarget.compressionX, stageLerp),
    compressionY: lerp(state.stage.compressionY, stageTarget.compressionY, stageLerp),
    scrollProgress: safeScrollProgress,
    corridorProgress: safeCorridorProgress,
    sceneStrength: safeSceneStrength,
  };
  if (safePointerState.active) {
    const pointerNormX = safePointerState.x / Math.max(normalizeDimension(state.field.width), 1);
    const pointerNormY = safePointerState.y / Math.max(normalizeDimension(state.field.height), 1);
    const horizontalDrift =
      Math.sign(pointerNormX - 0.5) *
      Math.pow(clamp(Math.abs(pointerNormX - 0.5) * 2, 0, 1), 0.92);
    const verticalDrift =
      Math.sign(pointerNormY - 0.46) *
      Math.pow(clamp(Math.abs(pointerNormY - 0.46) * 2, 0, 1), 0.9);
    const activeCenterTargetX = clamp(
      stageTarget.centerX +
        horizontalDrift *
          normalizeDimension(state.field.width) *
          (state.field.reducedMotion ? 0.32 : 0.42),
      0,
      normalizeDimension(state.field.width)
    );
    const activeCenterTargetY = clamp(
      stageTarget.centerY +
        verticalDrift *
          normalizeDimension(state.field.height) *
          (state.field.reducedMotion ? 0.1 : 0.14),
      0,
      normalizeDimension(state.field.height)
    );
    nextStage.centerX = clamp(
      lerp(nextStage.centerX, activeCenterTargetX, state.field.reducedMotion ? 0.34 : 0.48),
      0,
      normalizeDimension(state.field.width)
    );
    nextStage.centerY = clamp(
      lerp(nextStage.centerY, activeCenterTargetY, state.field.reducedMotion ? 0.22 : 0.34),
      0,
      normalizeDimension(state.field.height)
    );
    nextStage.compressionX = clamp(
      nextStage.compressionX + 0.03 + Math.abs(horizontalDrift) * 0.03,
      0.9,
      1.08
    );
    nextStage.compressionY = clamp(
      nextStage.compressionY + 0.015 + Math.abs(verticalDrift) * 0.02,
      0.94,
      1.08
    );
  }
  const attractorTargetX = safePointerState.active
    ? lerp(nextStage.centerX, safePointerState.x, 0.54)
    : nextStage.centerX;
  const attractorTargetY = safePointerState.active
    ? lerp(nextStage.centerY, safePointerState.y, 0.44)
    : nextStage.centerY;
  const attractorLerp = clamp(
    (safePointerState.active ? 0.22 : 0.08) * (safeDelta / 16),
    0,
    0.28
  );
  const nextAttractor = {
    x: clamp(
      lerp(state.attractor.x, attractorTargetX, attractorLerp),
      0,
      normalizeDimension(state.field.width)
    ),
    y: clamp(
      lerp(state.attractor.y, attractorTargetY, attractorLerp),
      0,
      normalizeDimension(state.field.height)
    ),
  };

  return {
    ...state,
    timeMs: state.timeMs + safeDelta,
    phase: nextPhase,
    attractor: nextAttractor,
    stage: nextStage,
    particles: state.particles.map((particle) =>
      updateParticle(
        state.field,
        particle,
        nextPhase,
        safeDelta,
        safePointerState,
        nextAttractor,
        nextStage
      )
    ),
  };
};
