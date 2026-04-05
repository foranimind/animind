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

const gaussian = (delta: number, spread: number): number => {
  const safeSpread = Math.max(spread, 0.0001);
  const scaled = delta / safeSpread;
  return Math.exp(-scaled * scaled);
};

const angularDistance = (angle: number, target: number): number => {
  let delta = (angle - target + Math.PI) % TAU;

  if (delta < 0) {
    delta += TAU;
  }

  return delta - Math.PI;
};

const makeSeededRandom = (seed: number): (() => number) => {
  let state = (seed >>> 0) || 1;

  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
};

const sampleNormal = (random: () => number): number => {
  let u = 0;
  let v = 0;

  while (u === 0) {
    u = random();
  }
  while (v === 0) {
    v = random();
  }

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};

export type AntigravityHeroFieldInput = {
  width: number;
  height: number;
  reducedMotion: boolean;
  seed?: number;
};

export type AntigravityHeroField = {
  id: string;
  seed: number;
  width: number;
  height: number;
  reducedMotion: boolean;
  centerX: number;
  centerY: number;
  occupancy: {
    core: number;
    outer: number;
    falloff: number;
    brokenArc: number;
  };
  shapeBias: {
    rightHeavy: number;
    brokenArc: number;
    cloud: number;
  };
  colorBias: {
    cool: number;
    warm: number;
    accent: number;
  };
  lifecycleAllowance: {
    inner: number;
    mid: number;
    outer: number;
    turnover: number;
  };
};

export type AntigravityHeroFieldPoint = {
  x: number;
  y: number;
  occupancy: number;
  shapeBias: number;
  colorBias: number;
  lifecycleAllowance: number;
  fieldTag: string;
};

const normalizeDimension = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const getFieldCenterNorm = (field: AntigravityHeroField) => ({
  x: field.width > 0 ? field.centerX / field.width : 0.5,
  y: field.height > 0 ? field.centerY / field.height : 0.5,
});

const getFieldAnchorNorm = (field: AntigravityHeroField) => {
  const center = getFieldCenterNorm(field);

  return {
    x: clamp(center.x + (field.reducedMotion ? 0 : 0.004), 0, 1),
    y: clamp(center.y + (field.reducedMotion ? 0.004 : 0.008), 0, 1),
  };
};

const getEllipseRadius = (
  field: AntigravityHeroField,
  xNorm: number,
  yNorm: number
): number => {
  const center = getFieldAnchorNorm(field);
  const ellipseX =
    (xNorm - center.x) /
    (0.42 + field.occupancy.falloff * 0.08 + (field.reducedMotion ? 0.06 : 0.08));
  const ellipseY =
    (yNorm - center.y) /
    (0.46 + field.occupancy.outer * 0.1 + (field.reducedMotion ? 0.05 : 0.08));

  return Math.hypot(ellipseX, ellipseY);
};

const evaluateFieldDensity = (
  field: AntigravityHeroField,
  xNorm: number,
  yNorm: number
): number => {
  const center = getFieldAnchorNorm(field);
  const dx = xNorm - center.x;
  const dy = yNorm - center.y;
  const safeCenterX = 0.5;
  const safeCenterY = field.reducedMotion ? 0.48 : 0.47;
  const safeDx = xNorm - safeCenterX;
  const safeDy = yNorm - safeCenterY;
  const safeRadius = Math.hypot(safeDx / 0.31, safeDy / 0.44);
  const radius = getEllipseRadius(field, xNorm, yNorm);
  const angle = Math.atan2(dy, dx);
  const safeAngle = Math.atan2(safeDy, safeDx);
  const eastSweep = gaussian(angularDistance(angle, 0), 0.96);
  const upperArcSweep = gaussian(angularDistance(angle, -0.92), 0.52);
  const lowerArcSweep = gaussian(angularDistance(angle, 1.12), 0.68);
  const leftEchoSweep = gaussian(angularDistance(angle, 2.6), 0.64);
  const safeLeftSweep = gaussian(angularDistance(safeAngle, Math.PI), 0.76);
  const safeUpperSweep = gaussian(angularDistance(safeAngle, -Math.PI / 2), 0.68);
  const safeLowerSweep = gaussian(angularDistance(safeAngle, Math.PI / 2), 0.74);
  const safeRightSweep = gaussian(angularDistance(safeAngle, 0), 0.64);
  const leftClosureCut = gaussian(angularDistance(angle, Math.PI), 0.86);
  const topClosureCut = gaussian(angularDistance(angle, -Math.PI / 2), 0.5);
  const verticalSpine = gaussian(dx - 0.14, 0.18) * gaussian(dy, 0.42);
  const upperWarmCap = gaussian(dx - 0.12, 0.24) * gaussian(dy + 0.18, 0.24);
  const lowerBlueTail = gaussian(dx - 0.06, 0.28) * gaussian(dy - 0.22, 0.3);
  const leftWarmArc =
    gaussian(dx + 0.12, 0.26) *
    gaussian(dy + 0.02, 0.44) *
    (0.54 + leftEchoSweep * 0.24);
  const crescentBand =
    gaussian(radius - 0.9, 0.22 + field.occupancy.falloff * 0.04) *
    (eastSweep * 0.42 + upperArcSweep * 0.34 + lowerArcSweep * 0.22 + leftEchoSweep * 0.14);
  const innerWake =
    gaussian(radius - 0.76, 0.34 + field.shapeBias.cloud * 0.04) *
    (eastSweep * 0.18 + lowerArcSweep * 0.1 + upperArcSweep * 0.08 + leftEchoSweep * 0.04) *
    gaussian(dy - 0.04, 0.42);
  const rightPlume = verticalSpine * 0.09 + upperWarmCap * 0.1 + lowerBlueTail * 0.05;
  const outerEcho =
    gaussian(radius - 1.2, 0.4 + field.occupancy.outer * 0.08) *
    (eastSweep * 0.12 + upperArcSweep * 0.1 + lowerArcSweep * 0.08 + leftEchoSweep * 0.08);
  const farContinuity =
    gaussian(radius - 1.48, 0.78) *
    (0.06 + field.occupancy.outer * 0.12) *
    (eastSweep * 0.28 + upperArcSweep * 0.2 + lowerArcSweep * 0.18 + leftEchoSweep * 0.24);
  const fullFieldSpread =
    gaussian(dx - 0.02, 0.84) * gaussian(dy, 0.78) * (0.075 + field.occupancy.outer * 0.13);
  const leftFieldSpread =
    gaussian(dx + 0.16, 0.42) *
    gaussian(dy, 0.74) *
    (0.06 + field.shapeBias.cloud * 0.055);
  const copyHaloBand =
    gaussian(safeRadius - 1.02, 0.15 + field.shapeBias.brokenArc * 0.035) *
    (safeLeftSweep * 0.52 +
      safeUpperSweep * 0.34 +
      safeLowerSweep * 0.3 +
      safeRightSweep * 0.18);
  const copyInteriorMist =
    gaussian(safeRadius - 0.78, 0.24) *
    (safeLeftSweep * 0.08 + safeUpperSweep * 0.07 + safeLowerSweep * 0.05 + safeRightSweep * 0.03);
  const brokenGap =
    gaussian(radius - 0.92, 0.22) * (leftClosureCut * 0.3 + topClosureCut * 0.18);
  const upperMidGap = gaussian(safeDx, 0.22) * gaussian(yNorm - 0.2, 0.12) * 0.08;
  const lowerInsideGap = gaussian(dx + 0.02, 0.18) * gaussian(dy - 0.22, 0.18) * 0.04;
  const leftUpperVoid = gaussian(dx + 0.28, 0.18) * gaussian(dy + 0.12, 0.22) * 0.06;
  const leftBoundaryVoid = gaussian(xNorm - 0.04, 0.12) * 0.01;
  const haloInteriorVoid = gaussian(safeRadius - 0.44, 0.14) * 0.06;
  const centerVoid = gaussian(safeDx, 0.13) * gaussian(safeDy, 0.095) * 0.12;
  const titleVoid = gaussian(safeDx, 0.2) * gaussian(safeDy + 0.005, 0.08) * 0.038;
  const bodyVoid = gaussian(safeDx, 0.18) * gaussian(safeDy + 0.145, 0.1) * 0.022;
  const ctaVoid = gaussian(safeDx, 0.14) * gaussian(safeDy - 0.24, 0.085) * 0.017;
  const topFade = smoothstep(0, 0.05, yNorm) * 0.04;
  const bottomFade = smoothstep(0.94, 1, yNorm) * 0.02;

  return clamp(
    crescentBand * 0.96 +
      innerWake +
      rightPlume +
      outerEcho +
      farContinuity +
      fullFieldSpread +
      leftFieldSpread +
      copyHaloBand * 0.64 +
      copyInteriorMist * 0.34 +
      leftWarmArc * 0.26 +
      leftEchoSweep * gaussian(radius - 1.34, 0.28) * 0.09 -
      brokenGap -
      upperMidGap -
      lowerInsideGap -
      leftUpperVoid -
      leftBoundaryVoid -
      haloInteriorVoid -
      centerVoid -
      titleVoid -
      bodyVoid -
      ctaVoid -
      topFade -
      bottomFade,
    0,
    1
  );
};

const sampleFieldPoint = (
  field: AntigravityHeroField,
  random: () => number
): AntigravityHeroFieldPoint => {
  const width = field.width || 1;
  const height = field.height || 1;
  let bestCandidate = {
    xNorm: 0.5,
    yNorm: 0.5,
    density: -1,
    score: -1,
  };

  const useAmbientScatter = random() < (field.reducedMotion ? 0.28 : 0.34);

  if (useAmbientScatter) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const xNorm = clamp(
        random() + sampleNormal(random) * (field.reducedMotion ? 0.012 : 0.018),
        0,
        1
      );
      const yNorm = clamp(
        random() + sampleNormal(random) * (field.reducedMotion ? 0.012 : 0.018),
        0,
        1
      );
      const centerSafety = gaussian(xNorm - 0.5, 0.18) * gaussian(yNorm - 0.49, 0.16);
      const ambientSpread = gaussian(xNorm - 0.48, 0.6) * gaussian(yNorm - 0.5, 0.72);
      const density = clamp(
        evaluateFieldDensity(field, xNorm, yNorm) * 0.24 + ambientSpread * 0.3,
        0.06,
        0.34
      );
      const score = density - centerSafety * 0.025;

      if (score > bestCandidate.score) {
        bestCandidate = { xNorm, yNorm, density, score };
      }

      if (centerSafety <= 0.74) {
        break;
      }
    }
  } else {
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const xNorm = clamp(
        random() + sampleNormal(random) * (field.reducedMotion ? 0.018 : 0.03),
        0,
        1
      );
      const yNorm = clamp(
        random() + sampleNormal(random) * (field.reducedMotion ? 0.018 : 0.03),
        0,
        1
      );
      const density = evaluateFieldDensity(field, xNorm, yNorm);
      const radius = getEllipseRadius(field, xNorm, yNorm);
      const ringBias = gaussian(radius - 0.98, 0.24);
      const anchor = getFieldAnchorNorm(field);
      const rightDrift = smoothstep(anchor.x - 0.2, 1, xNorm);
      const lowerDrift = smoothstep(anchor.y - 0.12, 1, yNorm);
      const ambientSpread = gaussian(xNorm - 0.46, 0.42) * gaussian(yNorm - 0.5, 0.64);
      const leftPenalty = gaussian(xNorm - 0.04, 0.12) * (0.025 + ringBias * 0.03);
      const edgePenalty = smoothstep(0.995, 1, xNorm) * 0.01;
      const floorPenalty = smoothstep(0.99, 1, yNorm) * 0.004;
      const score =
        density +
        ringBias * 0.018 +
        rightDrift * 0.002 +
        lowerDrift * 0.002 +
        ambientSpread * 0.04 -
        leftPenalty -
        edgePenalty -
        floorPenalty;

      if (score > bestCandidate.score) {
        bestCandidate = { xNorm, yNorm, density, score };
      }

      if (random() < score * (0.88 + field.lifecycleAllowance.turnover * 0.08)) {
        bestCandidate = { xNorm, yNorm, density, score };
        break;
      }
    }
  }

  const { xNorm, yNorm, density } = bestCandidate;
  const center = getFieldAnchorNorm(field);
  const dx = xNorm - center.x;
  const dy = yNorm - center.y;
  const radius = getEllipseRadius(field, xNorm, yNorm);
  const bandBias = gaussian(radius - 0.9, 0.24);
  const angle = Math.atan2(dy, dx);
  const rightDrift = smoothstep(center.x - 0.2, 1, xNorm);
  const lowerDrift = smoothstep(center.y - 0.12, 1, yNorm);
  const leftEcho = gaussian(xNorm - 0.16, 0.18) * gaussian(yNorm - 0.7, 0.18);
  const upperWarmZone =
    gaussian(dx - 0.14, 0.22) *
    gaussian(dy + 0.18, 0.24) *
    (0.74 + gaussian(angularDistance(angle, -0.88), 0.44) * 0.24);
  const leftWarmZone =
    gaussian(dx + 0.14, 0.3) *
    gaussian(dy + 0.02, 0.42) *
    (0.62 + leftEcho * 0.22);
  const upperCoolZone =
    gaussian(dy + 0.14, 0.2) *
    (0.62 + gaussian(dx - 0.06, 0.24) * 0.2 + gaussian(angularDistance(angle, -0.2), 0.42) * 0.12);
  const lowerCoolZone =
    gaussian(dx - 0.1, 0.22) * gaussian(dy - 0.2, 0.22) * (0.66 + rightDrift * 0.18);
  const sideSweep = gaussian(dx - 0.12, 0.28) * gaussian(dy, 0.5);
  const outerContinuity = gaussian(radius - 1.28, 0.48);

  const x = clamp(xNorm * width, 0, width);
  const y = clamp(yNorm * height, 0, height);

  const occupancy = clamp(
    density *
      lerp(
        field.occupancy.outer * 0.74,
        field.occupancy.core,
        0.22 + bandBias * 0.4 + rightDrift * 0.02
      ) *
      lerp(0.86, 0.98, field.occupancy.falloff),
    0,
    1
  );
  const shapeBias = clamp(
    field.shapeBias.brokenArc * (0.14 + bandBias * 0.32 + sideSweep * 0.08 + lowerDrift * 0.03) +
      field.shapeBias.cloud *
        (0.16 + outerContinuity * 0.28 + (1 - bandBias) * 0.22 + leftEcho * 0.1) +
      field.shapeBias.rightHeavy * (0.06 + rightDrift * 0.1 + lowerDrift * 0.02 - leftEcho * 0.015),
    0,
    1
  );
  const colorBias = clamp(
    0.32 +
      upperWarmZone * (0.7 + field.colorBias.warm * 0.48) +
      leftWarmZone * (0.42 + field.colorBias.warm * 0.32) +
      sideSweep * 0.14 -
      lowerCoolZone * (0.03 + field.colorBias.cool * 0.015) -
      upperCoolZone * (0.015 + field.colorBias.cool * 0.008) +
      field.colorBias.accent *
        (0.18 + upperWarmZone * 0.24 + leftWarmZone * 0.18 + sideSweep * 0.1 + leftEcho * 0.05 + outerContinuity * 0.04),
    0.12,
    1
  );
  const lifecycleAllowance = clamp(
    field.lifecycleAllowance.inner * (0.05 + (1 - bandBias) * 0.05) +
      field.lifecycleAllowance.mid * (0.08 + bandBias * 0.12) +
      field.lifecycleAllowance.outer * (0.18 + outerContinuity * 0.28 + leftEcho * 0.12) +
      field.lifecycleAllowance.turnover *
        (0.18 + upperWarmZone * 0.14 + lowerCoolZone * 0.08 + bandBias * 0.08 + rightDrift * 0.06),
    0,
    1
  );

  return {
    x,
    y,
    occupancy,
    shapeBias,
    colorBias,
    lifecycleAllowance,
    fieldTag: field.id,
  };
};

export const buildAntigravityHeroField = ({
  width,
  height,
  reducedMotion,
  seed,
}: AntigravityHeroFieldInput): AntigravityHeroField => {
  const safeWidth = normalizeDimension(width);
  const safeHeight = normalizeDimension(height);

  return {
    id: `antigravity-hero-field:${seed ?? 0}:${safeWidth}x${safeHeight}:${reducedMotion ? 1 : 0}`,
    seed: seed ?? 0,
    width: safeWidth,
    height: safeHeight,
    reducedMotion,
    centerX: safeWidth * (reducedMotion ? 0.4 : 0.385),
    centerY: safeHeight * (reducedMotion ? 0.44 : 0.425),
    occupancy: {
      core: reducedMotion ? 0.56 : 0.62,
      outer: reducedMotion ? 0.16 : 0.2,
      falloff: reducedMotion ? 0.58 : 0.68,
      brokenArc: reducedMotion ? 0.66 : 0.78,
    },
    shapeBias: {
      rightHeavy: reducedMotion ? 0.08 : 0.11,
      brokenArc: reducedMotion ? 0.6 : 0.68,
      cloud: reducedMotion ? 0.58 : 0.68,
    },
    colorBias: {
      cool: reducedMotion ? 0.54 : 0.62,
      warm: reducedMotion ? 0.66 : 0.78,
      accent: reducedMotion ? 0.48 : 0.64,
    },
    lifecycleAllowance: {
      inner: reducedMotion ? 0.14 : 0.12,
      mid: reducedMotion ? 0.34 : 0.3,
      outer: reducedMotion ? 0.82 : 0.88,
      turnover: reducedMotion ? 0.64 : 0.74,
    },
  };
};

export const sampleAntigravityHeroFieldPoints = (
  field: AntigravityHeroField,
  count: number
): AntigravityHeroFieldPoint[] => {
  const total = Math.max(0, Math.floor(count));
  const random = makeSeededRandom(field.seed || 1);

  return Array.from({ length: total }, () => sampleFieldPoint(field, random));
};
