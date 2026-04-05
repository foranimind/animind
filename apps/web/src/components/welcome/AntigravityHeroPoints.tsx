/* eslint-disable react-refresh/only-export-components */
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import * as THREE from "three";

import type { AntigravityHeroField } from "./antigravityHeroField";
import type {
  AntigravityHeroSimulationParticle,
  AntigravityHeroSimulationPointerState,
  AntigravityHeroSimulationState,
} from "./antigravityHeroSimulation";
import { createAntigravityHeroSimulationState } from "./antigravityHeroSimulation";
import { useAntigravityHeroSimulationLoop } from "./useAntigravityHeroSimulationLoop";

export type AntigravityHeroStageViewport = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type AntigravityHeroPointsProps = {
  active: boolean;
  field: AntigravityHeroField;
  particleCount: number;
  pointerRef: MutableRefObject<AntigravityHeroSimulationPointerState>;
  reducedMotion: boolean;
  runtimeInputsRef: MutableRefObject<AntigravityHeroStageRuntimeInputs>;
  viewport: AntigravityHeroStageViewport;
};

export type AntigravityHeroStageRuntimeInputs = {
  active: boolean;
  corridorProgress: number;
  reducedMotion: boolean;
  scrollProgress: number;
  sceneStrength: number;
};

type PointCloudBuffers = {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  presence: Float32Array;
  orientations: Float32Array;
  stretches: Float32Array;
  opacity: number;
  brightness: number;
};

type PointCloudFrameArrays = Pick<
  PointCloudBuffers,
  "colors" | "orientations" | "positions" | "presence" | "sizes" | "stretches"
>;

type PointCloudVisualState = Pick<PointCloudBuffers, "brightness" | "opacity">;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeAngle = (angle: number): number => {
  const wrapped = angle % (Math.PI * 2);
  return wrapped < 0 ? wrapped + Math.PI * 2 : wrapped;
};

const toWorldX = (x: number, viewport: AntigravityHeroStageViewport): number =>
  viewport.left +
  ((viewport.right - viewport.left) * x) / Math.max(viewport.width, 1);

const toWorldY = (y: number, viewport: AntigravityHeroStageViewport): number =>
  viewport.top +
  ((viewport.bottom - viewport.top) * y) / Math.max(viewport.height, 1);

export const createAntigravityHeroStageViewport = (
  width: number,
  height: number
): AntigravityHeroStageViewport => {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 960;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 640;

  return {
    width: safeWidth,
    height: safeHeight,
    left: -safeWidth / 2,
    right: safeWidth / 2,
    top: safeHeight / 2,
    bottom: -safeHeight / 2,
  };
};

export const createAntigravityHeroPointCloudBuffers = (
  particleCount: number
): PointCloudFrameArrays => ({
  positions: new Float32Array(particleCount * 3),
  colors: new Float32Array(particleCount * 3),
  sizes: new Float32Array(particleCount),
  presence: new Float32Array(particleCount),
  orientations: new Float32Array(particleCount),
  stretches: new Float32Array(particleCount),
});

export const buildAntigravityHeroPointCloudFrame = (
  particles: AntigravityHeroSimulationParticle[],
  viewport: AntigravityHeroStageViewport,
  active: boolean,
  reducedMotion: boolean,
  fieldCenter = {
    x: viewport.width * 0.66,
    y: viewport.height * 0.51,
  },
  buffers = createAntigravityHeroPointCloudBuffers(particles.length)
): PointCloudBuffers => {
  const { positions, colors, sizes, presence, orientations, stretches } = buffers;
  const activityScale = active ? 1.02 : 0.92;
  const motionScale = reducedMotion ? 0.88 : 1;
  const opacity = clamp((active ? 0.96 : 0.9) * motionScale, 0.38, 1);
  const brightness = clamp((active ? 1.02 : 0.98) * (reducedMotion ? 0.95 : 1.04), 0.82, 1.14);

  particles.forEach((particle, index) => {
    const positionOffset = index * 3;
    const normalizedX = particle.position.x / Math.max(viewport.width, 1);
    const normalizedY = particle.position.y / Math.max(viewport.height, 1);
    const radialAngle = Math.atan2(
      particle.homePosition.y - fieldCenter.y,
      particle.homePosition.x - fieldCenter.x
    );
    const tangentAngle = radialAngle + Math.PI * 0.5;
    const speed = Math.hypot(particle.velocity.x, particle.velocity.y);
    const velocityAngle =
      speed > 0.02 ? Math.atan2(particle.velocity.y, particle.velocity.x) : tangentAngle;
    const velocityBlend = clamp(speed / 1.2, 0, 0.35);
    const calmField = clamp(1 - speed / 2.4, 0, 1);
    const orientation =
      tangentAngle * (1 - velocityBlend) +
      velocityAngle * velocityBlend +
      (particle.orientationSeed - 0.5) * 0.9;
    const stretch = clamp(1.38 + particle.localWeight * 0.52 + particle.sizeSeed * 0.48, 1.26, 2.24);
    const copyCorridorFade =
      Math.exp(-Math.pow((normalizedX - 0.5) / 0.14, 2)) *
      Math.exp(-Math.pow((normalizedY - 0.47) / 0.18, 2));
    const centerHalo =
      Math.exp(-Math.pow((normalizedX - 0.5) / 0.18, 2)) *
      Math.exp(-Math.pow((normalizedY - 0.49) / 0.22, 2));
    const centerCore =
      Math.exp(-Math.pow((normalizedX - 0.5) / 0.065, 2)) *
      Math.exp(-Math.pow((normalizedY - 0.48) / 0.09, 2));
    const corridorRingLift = centerHalo * (1 - centerCore * 0.82) * (0.32 + calmField * 0.68);
    const spatialVisibility = clamp(
      1.028 - copyCorridorFade * 0.018 + corridorRingLift * (active ? 0.11 : 0.17),
      0.9,
      1.18
    );
    const displayPresence = clamp(
      particle.presence *
        (0.84 + particle.clusterAffinity * 0.24 + particle.localWeight * 0.12) *
        spatialVisibility +
        corridorRingLift * (0.04 + particle.localWeight * 0.08),
      0,
      1
    );
    const clusterScale =
      (0.9 + particle.clusterAffinity * 0.3) *
      clamp(0.92 + spatialVisibility * 0.14 + corridorRingLift * 0.05, 0.86, 1.16);

    positions[positionOffset] = toWorldX(particle.position.x, viewport);
    positions[positionOffset + 1] = toWorldY(particle.position.y, viewport);
    positions[positionOffset + 2] = particle.localWeight * 12;

    colors[positionOffset] = clamp(particle.currentColor.r, 0, 1);
    colors[positionOffset + 1] = clamp(particle.currentColor.g, 0, 1);
    colors[positionOffset + 2] = clamp(particle.currentColor.b, 0, 1);

    sizes[index] =
      (1 + particle.sizeSeed * 1.6) *
      (0.36 + Math.pow(displayPresence, 1.02) * 1) *
      clusterScale *
      (1 + corridorRingLift * (active ? 0.14 : 0.22)) *
      activityScale *
      motionScale;
    presence[index] = displayPresence;
    orientations[index] = normalizeAngle(orientation);
    stretches[index] = stretch;
  });

  return {
    positions,
    colors,
    sizes,
    presence,
    orientations,
    stretches,
    opacity,
    brightness,
  };
};

export const ANTIGRAVITY_HERO_POINT_VERTEX_SHADER = `
  attribute float size;
  attribute float presence;
  attribute float orientation;
  attribute float stretch;
  varying vec3 vParticleColor;
  varying float vPresence;
  varying float vOrientation;
  varying float vStretch;
  uniform float uPointScale;

  void main() {
    vParticleColor = color;
    vPresence = presence;
    vOrientation = orientation;
    vStretch = stretch;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float depthScale = 320.0 / max(1.0, -mvPosition.z);
    float presenceScale = mix(0.28, 1.0, presence);
    float stretchScale = mix(0.95, 1.22, clamp((stretch - 1.24) / 1.0, 0.0, 1.0));
    gl_PointSize = max(1.0, size * stretchScale * presenceScale * uPointScale * depthScale);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const ANTIGRAVITY_HERO_POINT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec3 vParticleColor;
  varying float vPresence;
  varying float vOrientation;
  varying float vStretch;
  uniform float uOpacity;
  uniform float uBrightness;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float cosTheta = cos(vOrientation);
    float sinTheta = sin(vOrientation);
    mat2 rotation = mat2(cosTheta, -sinTheta, sinTheta, cosTheta);
    vec2 oriented = rotation * centered;
    float halfLength = mix(0.19, 0.31, clamp((vStretch - 1.2) / 0.96, 0.0, 1.0));
    float halfWidth = mix(0.032, 0.068, clamp(vPresence, 0.0, 1.0));
    vec2 capsule = vec2(abs(oriented.x) - halfLength, abs(oriented.y) - halfWidth);
    float distanceToDash = length(max(capsule, vec2(0.0))) + min(max(capsule.x, capsule.y), 0.0);
    float core = smoothstep(0.047, -0.01, distanceToDash);
    float halo = smoothstep(0.14, -0.025, distanceToDash);
    float alpha = core * 0.88 + halo * 0.22;
    float visiblePresence = smoothstep(0.02, 0.64, vPresence);
    alpha *= (0.16 + visiblePresence * 0.82) * uOpacity;
    vec3 color = vParticleColor * (uBrightness * mix(1.0, 1.1, clamp(vPresence, 0.0, 1.0)));
    gl_FragColor = vec4(color, alpha);
  }
`;

const createAntigravityHeroPointMaterial = (frame: PointCloudVisualState) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.NormalBlending,
    toneMapped: false,
    uniforms: {
      uOpacity: { value: frame.opacity },
      uBrightness: { value: frame.brightness },
      uPointScale: { value: 1.36 },
    },
    vertexShader: ANTIGRAVITY_HERO_POINT_VERTEX_SHADER,
    fragmentShader: ANTIGRAVITY_HERO_POINT_FRAGMENT_SHADER,
  });

export const createAntigravityHeroPointCloudMaterial = (
  frame: PointCloudVisualState
): THREE.ShaderMaterial => createAntigravityHeroPointMaterial(frame);

const applyPointCloudAttribute = (
  attribute: THREE.BufferAttribute | null,
  values: Float32Array
) => {
  if (!attribute || typeof attribute.copyArray !== "function") {
    return;
  }

  if (attribute.array === values) {
    attribute.needsUpdate = true;
    return;
  }

  attribute.copyArray(values);
  attribute.needsUpdate = true;
};

type PointCloudAttributeRefs = {
  color: MutableRefObject<THREE.BufferAttribute | null>;
  orientation: MutableRefObject<THREE.BufferAttribute | null>;
  position: MutableRefObject<THREE.BufferAttribute | null>;
  presence: MutableRefObject<THREE.BufferAttribute | null>;
  size: MutableRefObject<THREE.BufferAttribute | null>;
  stretch: MutableRefObject<THREE.BufferAttribute | null>;
};

const applyPointCloudFrame = ({
  attributeRefs,
  frame,
  material,
}: {
  attributeRefs: PointCloudAttributeRefs;
  frame: PointCloudBuffers;
  material: THREE.ShaderMaterial;
}) => {
  applyPointCloudAttribute(attributeRefs.position.current, frame.positions);
  applyPointCloudAttribute(attributeRefs.color.current, frame.colors);
  applyPointCloudAttribute(attributeRefs.size.current, frame.sizes);
  applyPointCloudAttribute(attributeRefs.presence.current, frame.presence);
  applyPointCloudAttribute(attributeRefs.orientation.current, frame.orientations);
  applyPointCloudAttribute(attributeRefs.stretch.current, frame.stretches);
  material.uniforms.uOpacity.value = frame.opacity;
  material.uniforms.uBrightness.value = frame.brightness;
};

const AntigravityHeroPointsComponent = ({
  active,
  field,
  particleCount,
  pointerRef,
  reducedMotion,
  runtimeInputsRef,
  viewport,
}: AntigravityHeroPointsProps) => {
  const initialSimulation = useMemo(
    () =>
      createAntigravityHeroSimulationState({
        field,
        particleCount,
        seed: field.seed + 1,
      }),
    [field, particleCount]
  );
  const pointCloudBuffers = useMemo(
    () => createAntigravityHeroPointCloudBuffers(initialSimulation.particles.length),
    [initialSimulation.particles.length]
  );
  const frame = useMemo(
    () =>
      buildAntigravityHeroPointCloudFrame(
        initialSimulation.particles,
        viewport,
        active,
        reducedMotion,
        {
          x: initialSimulation.stage.centerX,
          y: initialSimulation.stage.centerY,
        },
        pointCloudBuffers
      ),
    [active, initialSimulation, pointCloudBuffers, reducedMotion, viewport]
  );
  const simulationRef = useRef<AntigravityHeroSimulationState>(initialSimulation);
  const positionAttributeRef = useRef<THREE.BufferAttribute | null>(null);
  const colorAttributeRef = useRef<THREE.BufferAttribute | null>(null);
  const sizeAttributeRef = useRef<THREE.BufferAttribute | null>(null);
  const presenceAttributeRef = useRef<THREE.BufferAttribute | null>(null);
  const orientationAttributeRef = useRef<THREE.BufferAttribute | null>(null);
  const stretchAttributeRef = useRef<THREE.BufferAttribute | null>(null);
  const { brightness, opacity } = frame;
  const material = useMemo(
    () => createAntigravityHeroPointMaterial({ brightness, opacity }),
    [brightness, opacity]
  );

  const renderCurrentFrame = useCallback(() => {
    const simulation = simulationRef.current;
    const inputs = runtimeInputsRef.current;
    const nextFrame = buildAntigravityHeroPointCloudFrame(
      simulation.particles,
      viewport,
      inputs.active,
      inputs.reducedMotion,
      {
        x: simulation.stage.centerX,
        y: simulation.stage.centerY,
      },
      pointCloudBuffers
    );

    applyPointCloudFrame({
      attributeRefs: {
        color: colorAttributeRef,
        orientation: orientationAttributeRef,
        position: positionAttributeRef,
        presence: presenceAttributeRef,
        size: sizeAttributeRef,
        stretch: stretchAttributeRef,
      },
      frame: nextFrame,
      material,
    });
  }, [material, pointCloudBuffers, runtimeInputsRef, viewport]);

  useAntigravityHeroSimulationLoop({
    active,
    initialSimulation,
    pointerRef,
    renderCurrentFrame,
    runtimeInputsRef,
    simulationRef,
  });

  useEffect(() => () => material.dispose(), [material]);

  return (
    <points name="antigravity-hero-points" frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          ref={positionAttributeRef}
          attach="attributes-position"
          args={[frame.positions, 3]}
        />
        <bufferAttribute
          ref={colorAttributeRef}
          attach="attributes-color"
          args={[frame.colors, 3]}
        />
        <bufferAttribute
          ref={sizeAttributeRef}
          attach="attributes-size"
          args={[frame.sizes, 1]}
        />
        <bufferAttribute
          ref={presenceAttributeRef}
          attach="attributes-presence"
          args={[frame.presence, 1]}
        />
        <bufferAttribute
          ref={orientationAttributeRef}
          attach="attributes-orientation"
          args={[frame.orientations, 1]}
        />
        <bufferAttribute
          ref={stretchAttributeRef}
          attach="attributes-stretch"
          args={[frame.stretches, 1]}
        />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
};

export const AntigravityHeroPoints = memo(AntigravityHeroPointsComponent);
