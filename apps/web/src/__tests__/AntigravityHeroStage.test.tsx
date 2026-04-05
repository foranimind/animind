import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { AntigravityHeroStage } from "../components/welcome/AntigravityHeroStage";
import { AntigravityHeroFallback } from "../components/welcome/AntigravityHeroFallback";
import {
  ANTIGRAVITY_HERO_POINT_FRAGMENT_SHADER,
  ANTIGRAVITY_HERO_POINT_VERTEX_SHADER,
  buildAntigravityHeroPointCloudFrame,
  createAntigravityHeroPointCloudBuffers,
  createAntigravityHeroPointCloudMaterial,
  createAntigravityHeroStageViewport,
} from "../components/welcome/AntigravityHeroPoints";
import * as antigravityHeroField from "../components/welcome/antigravityHeroField";
import * as antigravityHeroSimulation from "../components/welcome/antigravityHeroSimulation";
import * as antigravityHeroSupport from "../components/welcome/antigravityHeroSupport";
import * as particleFieldEngine from "../components/welcome/particleFieldEngine";

let lastCanvasProps: Record<string, unknown> | undefined;

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => {
    lastCanvasProps = props;

    return (
      <div data-testid="mock-r3f-canvas" data-orthographic={String(props.orthographic)}>
        {children}
      </div>
    );
  },
  useFrame: vi.fn(),
  useThree: () => ({
    size: { width: 960, height: 640 },
    viewport: { width: 960, height: 640, factor: 1 },
  }),
}));

describe("AntigravityHeroStage", () => {
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  const installAnimationFrameQueue = () => {
    let nextFrameId = 0;
    const pendingFrames = new Map<number, FrameRequestCallback>();

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextFrameId + 1;
        nextFrameId = frameId;
        pendingFrames.set(frameId, callback);
        return frameId;
      })
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((frameId: number) => {
        pendingFrames.delete(frameId);
      })
    );

    const flushFrame = async (timestamp: number) => {
      const next = pendingFrames.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined;
      expect(next).toBeDefined();

      const [frameId, callback] = next as [number, FrameRequestCallback];
      pendingFrames.delete(frameId);

      await act(async () => {
        callback(timestamp);
      });
    };

    return {
      flushFrame,
    };
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    lastCanvasProps = undefined;

    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: vi.fn(() => ({
        bottom: 640,
        height: 640,
        left: 0,
        right: 960,
        toJSON: () => "",
        top: 0,
        width: 960,
        x: 0,
        y: 0,
      })),
    });
  });

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: originalGetBoundingClientRect,
    });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("mounts a dedicated hero stage shell and creates unified-field simulation state", () => {
    vi.spyOn(antigravityHeroSupport, "supportsAntigravityHeroWebGL").mockReturnValue(true);
    const fieldSpy = vi.spyOn(antigravityHeroField, "buildAntigravityHeroField");
    const simulationSpy = vi.spyOn(
      antigravityHeroSimulation,
      "createAntigravityHeroSimulationState"
    );
    const legacyEngineSpy = vi.spyOn(particleFieldEngine, "startHeroParticleField");

    render(
      <AntigravityHeroStage
        active={true}
        corridorProgress={0.24}
        reducedMotion={true}
        scrollProgress={0.5}
        sceneStrength={0.8}
      />
    );

    const shell = screen.getByTestId("antigravity-hero-stage");
    expect(shell).toHaveClass("antigravity-hero-stage");
    expect(shell).toHaveAttribute("data-active", "true");
    expect(shell).toHaveAttribute("data-reduced-motion", "true");
    expect(shell).toHaveAttribute("data-coordinate-contract", "orthographic-pixel");
    expect(shell).toHaveAttribute("data-pointer-contract", "window-tracking");

    expect(screen.getByTestId("mock-r3f-canvas")).toHaveAttribute("data-orthographic", "true");
    expect(lastCanvasProps).toMatchObject({
      orthographic: true,
      camera: expect.objectContaining({
        left: -480,
        right: 480,
        top: 320,
        bottom: -320,
        near: 0.1,
        far: 1000,
        zoom: 1,
      }),
      dpr: [1, 2],
    });

    expect(fieldSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 960,
        height: 640,
        reducedMotion: true,
      })
    );
    expect(simulationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        field: expect.objectContaining({
          id: expect.any(String),
          reducedMotion: true,
        }),
        particleCount: expect.any(Number),
      })
    );
    expect(simulationSpy.mock.calls[0]?.[0]?.particleCount).toBeGreaterThanOrEqual(140);
    expect(legacyEngineSpy).not.toHaveBeenCalled();
  });

  it("uses the injected support value immediately on the first render when webglSupported is true", () => {
    const supportSpy = vi.spyOn(antigravityHeroSupport, "supportsAntigravityHeroWebGL");

    render(
      <AntigravityHeroStage
        active={true}
        corridorProgress={0.24}
        reducedMotion={true}
        scrollProgress={0.5}
        sceneStrength={0.8}
        webglSupported={true}
      />
    );

    expect(supportSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("antigravity-hero-stage")).toHaveAttribute(
      "data-webgl-support",
      "true"
    );
    expect(screen.getByTestId("mock-r3f-canvas")).toBeInTheDocument();
    expect(screen.queryByTestId("antigravity-hero-fallback")).toBeNull();
  });

  it("threads an explicit seed through field and simulation construction", () => {
    const fieldSpy = vi.spyOn(antigravityHeroField, "buildAntigravityHeroField");
    const simulationSpy = vi.spyOn(
      antigravityHeroSimulation,
      "createAntigravityHeroSimulationState"
    );

    render(
      <AntigravityHeroStage
        active={true}
        corridorProgress={0.24}
        reducedMotion={false}
        scrollProgress={0.5}
        sceneStrength={0.8}
        seed={41}
        webglSupported={true}
      />
    );

    expect(fieldSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: 41,
      })
    );
    expect(simulationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: 42,
      })
    );
  });

  it("uses the injected support value immediately on the first render when webglSupported is false", () => {
    const supportSpy = vi.spyOn(antigravityHeroSupport, "supportsAntigravityHeroWebGL");

    render(
      <AntigravityHeroStage
        active={true}
        corridorProgress={0.24}
        reducedMotion={true}
        scrollProgress={0.5}
        sceneStrength={0.8}
        webglSupported={false}
      />
    );

    expect(supportSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("antigravity-hero-stage")).toHaveAttribute(
      "data-webgl-support",
      "false"
    );
    expect(screen.queryByTestId("mock-r3f-canvas")).toBeNull();
    expect(screen.getByTestId("antigravity-hero-fallback")).toBeInTheDocument();
  });

  it("treats server-like environments as unsupported WebGL and falls back to the unified field shell", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);

    expect(antigravityHeroSupport.supportsAntigravityHeroWebGL()).toBe(false);
  });

  it("hydrates without mismatch and flips to the WebGL branch after mount when support is available", async () => {
    vi.spyOn(antigravityHeroSupport, "supportsAntigravityHeroWebGL").mockReturnValue(true);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const markup = renderToString(
      <AntigravityHeroStage
        active={true}
        corridorProgress={0.24}
        reducedMotion={true}
        scrollProgress={0.5}
        sceneStrength={0.8}
      />
    );

    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.appendChild(container);

    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(
        container,
        <AntigravityHeroStage
          active={true}
          corridorProgress={0.24}
          reducedMotion={true}
          scrollProgress={0.5}
          sceneStrength={0.8}
        />
      );
    });

    const hydrationWarnings = consoleErrorSpy.mock.calls.filter(([message]) => {
      const text =
        typeof message === "string"
          ? message
          : message instanceof Error
            ? message.message
            : typeof message === "object" && message && "message" in message
              ? String((message as { message?: unknown }).message ?? "")
              : "";

      return /hydration|did not match|server html/i.test(text);
    });
    expect(hydrationWarnings).toEqual([]);
    expect(within(container).queryByTestId("antigravity-hero-fallback")).toBeNull();
    expect(within(container).getByTestId("mock-r3f-canvas")).toBeInTheDocument();
    expect(within(container).getByTestId("antigravity-hero-stage")).toHaveAttribute(
      "data-webgl-support",
      "true"
    );
    expect(within(container).getByTestId("antigravity-hero-stage")).toHaveAttribute(
      "data-coordinate-contract",
      "orthographic-pixel"
    );
    expect(within(container).getByTestId("antigravity-hero-stage")).toHaveAttribute(
      "data-pointer-contract",
      "window-tracking"
    );
    root?.unmount();
    container.remove();
  });

  it("renders the unified fallback shell instead of the canvas engine when WebGL support is unavailable", () => {
    vi.spyOn(antigravityHeroSupport, "supportsAntigravityHeroWebGL").mockReturnValue(false);

    render(
      <AntigravityHeroStage
        active={true}
        corridorProgress={0.24}
        reducedMotion={true}
        scrollProgress={0.5}
        sceneStrength={0.8}
      />
    );

    expect(screen.queryByTestId("mock-r3f-canvas")).toBeNull();
    expect(screen.getByTestId("antigravity-hero-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("antigravity-hero-fallback")).toHaveAttribute(
      "data-macro-silhouette",
      "unified-cloud-broken-arc"
    );
    expect(screen.queryByTestId("antigravity-hero-points")).toBeNull();
  });

  it("keeps the window pointer listeners stable across simulation rerenders", async () => {
    const { flushFrame } = installAnimationFrameQueue();
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const rendered = render(
      <AntigravityHeroStage
        active={true}
        corridorProgress={0.24}
        reducedMotion={false}
        scrollProgress={0.5}
        sceneStrength={0.8}
        webglSupported={true}
      />
    );

    const pointerAdds = addEventListenerSpy.mock.calls.filter(([type]) =>
      ["pointermove", "pointerleave", "blur"].includes(String(type))
    );
    expect(pointerAdds).toHaveLength(3);

    await flushFrame(16);
    await flushFrame(32);

    const pointerAddsAfterFrames = addEventListenerSpy.mock.calls.filter(([type]) =>
      ["pointermove", "pointerleave", "blur"].includes(String(type))
    );
    const pointerRemovesBeforeUnmount = removeEventListenerSpy.mock.calls.filter(([type]) =>
      ["pointermove", "pointerleave", "blur"].includes(String(type))
    );

    expect(pointerAddsAfterFrames).toHaveLength(3);
    expect(pointerRemovesBeforeUnmount).toHaveLength(0);

    rendered.unmount();

    const pointerRemovesAfterUnmount = removeEventListenerSpy.mock.calls.filter(([type]) =>
      ["pointermove", "pointerleave", "blur"].includes(String(type))
    );
    expect(pointerRemovesAfterUnmount).toHaveLength(3);
  });

  it("keeps the fallback silhouette stable under reduced motion", () => {
    const reduced = render(
      <AntigravityHeroFallback
        active={true}
        corridorProgress={0.24}
        reducedMotion={true}
        scrollProgress={0.5}
        sceneStrength={0.8}
      />
    );

    const reducedShell = within(reduced.container).getByTestId("antigravity-hero-fallback");
    const reducedArc = within(reduced.container).getByTestId("antigravity-hero-fallback__arc");

    const normal = render(
      <AntigravityHeroFallback
        active={true}
        corridorProgress={0.24}
        reducedMotion={false}
        scrollProgress={0.5}
        sceneStrength={0.8}
      />
    );

    const normalShell = within(normal.container).getByTestId("antigravity-hero-fallback");
    const normalArc = within(normal.container).getByTestId("antigravity-hero-fallback__arc");

    expect(reducedShell).toHaveAttribute("data-reduced-motion", "true");
    expect(normalShell).toHaveAttribute("data-reduced-motion", "false");
    expect(reducedShell).toHaveAttribute("data-macro-silhouette", "unified-cloud-broken-arc");
    expect(normalShell).toHaveAttribute("data-macro-silhouette", "unified-cloud-broken-arc");
    expect(reducedShell).toHaveAttribute("data-layout-contract", "hero-low-fidelity-unified-field");
    expect(normalShell).toHaveAttribute("data-layout-contract", "hero-low-fidelity-unified-field");
    expect(parseFloat(reducedShell.style.opacity)).toBeLessThan(parseFloat(normalShell.style.opacity));
    expect(parseFloat(reducedArc.getAttribute("opacity") ?? "0")).toBeLessThan(
      parseFloat(normalArc.getAttribute("opacity") ?? "0")
    );
    expect(within(reduced.container).getByTestId("antigravity-hero-fallback__mass")).toBeInTheDocument();
    expect(within(normal.container).getByTestId("antigravity-hero-fallback__mass")).toBeInTheDocument();
    expect(within(reduced.container).queryByTestId("antigravity-hero-fallback__starfield")).toBeNull();
    expect(within(normal.container).queryByTestId("antigravity-hero-fallback__starfield")).toBeNull();
  });

  it("forwards active and reduced-motion inputs and keeps renderer diagnostics off the native point-cloud primitive", () => {
    vi.spyOn(antigravityHeroSupport, "supportsAntigravityHeroWebGL").mockReturnValue(true);
    const stageViewport = createAntigravityHeroStageViewport(960, 640);
    expect(stageViewport).toEqual({
      width: 960,
      height: 640,
      left: -480,
      right: 480,
      top: 320,
      bottom: -320,
    });

    const viewport = {
      width: 960,
      height: 640,
      left: -360,
      right: 600,
      top: 320,
      bottom: -320,
    };
    const frame = buildAntigravityHeroPointCloudFrame(
      [
        {
          homePosition: { x: 0, y: 0 },
          position: { x: 240, y: 120 },
          velocity: { x: 0, y: 0 },
          baseOccupancy: 0.58,
          lifecycleAllowance: 0.42,
          shapeBias: 0.74,
          clusterAffinity: 0.68,
          presence: 0.64,
          presencePhase: 0,
          colorBias: 0.5,
          currentColor: { r: 0.75, g: 0.5, b: 0.25, a: 0.8 },
          sizeSeed: 0.5,
          orientationSeed: 0.25,
          localWeight: 0.7,
        },
      ],
      viewport,
      true,
      false,
      { x: 633.6, y: 326.4 }
    );

    expect(frame.positions[0]).toBeCloseTo(-120);
    expect(frame.positions[1]).toBeCloseTo(200);
    expect(frame.colors[0]).toBeCloseTo(0.75);
    expect(frame.colors[1]).toBeCloseTo(0.5);
    expect(frame.colors[2]).toBeCloseTo(0.25);
    expect(frame.sizes[0]).toBeGreaterThan(0);
    expect(frame.presence[0]).toBeGreaterThan(0.1);
    expect(frame.orientations[0]).toBeGreaterThan(0);
    expect(frame.stretches[0]).toBeGreaterThan(1.8);
    expect(frame.opacity).toBeGreaterThan(0.8);
    expect(frame.brightness).toBeGreaterThan(1);

    const reusableBuffers = createAntigravityHeroPointCloudBuffers(1);
    const reusedFrame = buildAntigravityHeroPointCloudFrame(
      [
        {
          homePosition: { x: 0, y: 0 },
          position: { x: 240, y: 120 },
          velocity: { x: 0, y: 0 },
          baseOccupancy: 0.58,
          lifecycleAllowance: 0.42,
          shapeBias: 0.74,
          clusterAffinity: 0.68,
          presence: 0.64,
          presencePhase: 0,
          colorBias: 0.5,
          currentColor: { r: 0.75, g: 0.5, b: 0.25, a: 0.8 },
          sizeSeed: 0.5,
          orientationSeed: 0.25,
          localWeight: 0.7,
        },
      ],
      viewport,
      true,
      false,
      { x: 633.6, y: 326.4 },
      reusableBuffers
    );

    expect(reusedFrame.positions).toBe(reusableBuffers.positions);
    expect(reusedFrame.colors).toBe(reusableBuffers.colors);
    expect(reusedFrame.sizes).toBe(reusableBuffers.sizes);
    expect(reusedFrame.presence).toBe(reusableBuffers.presence);
    expect(reusedFrame.orientations).toBe(reusableBuffers.orientations);
    expect(reusedFrame.stretches).toBe(reusableBuffers.stretches);

    const material = createAntigravityHeroPointCloudMaterial(frame);
    expect(material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(THREE.NormalBlending);
    expect(material.uniforms.uOpacity.value).toBeCloseTo(frame.opacity);
    expect(material.uniforms.uBrightness.value).toBeCloseTo(frame.brightness);
    expect(material.uniforms.uPointScale.value).toBeCloseTo(1.36);
    expect(ANTIGRAVITY_HERO_POINT_VERTEX_SHADER).toMatch(/attribute float orientation;/);
    expect(ANTIGRAVITY_HERO_POINT_VERTEX_SHADER).toMatch(/attribute float stretch;/);
    expect(ANTIGRAVITY_HERO_POINT_FRAGMENT_SHADER).toMatch(/vOrientation/);
    expect(ANTIGRAVITY_HERO_POINT_FRAGMENT_SHADER).toMatch(/distanceToDash/);
    expect(ANTIGRAVITY_HERO_POINT_VERTEX_SHADER).not.toMatch(/attribute vec3 color;/);
    expect(ANTIGRAVITY_HERO_POINT_VERTEX_SHADER).not.toMatch(/varying vec3 vColor;/);
    expect(ANTIGRAVITY_HERO_POINT_FRAGMENT_SHADER).not.toMatch(/varying vec3 vColor;/);
    material.dispose();

    const denseField = antigravityHeroField.buildAntigravityHeroField({
      width: 1440,
      height: 900,
      reducedMotion: false,
      seed: 41,
    });
    const denseSimulation = antigravityHeroSimulation.createAntigravityHeroSimulationState({
      field: denseField,
      particleCount: 320,
      seed: 41,
    });
    const denseFrame = buildAntigravityHeroPointCloudFrame(
      denseSimulation.particles,
      createAntigravityHeroStageViewport(1440, 900),
      true,
      false
    );
    const denseSizes = Array.from(denseFrame.sizes);
    const averageDenseSize =
      denseSizes.reduce((sum, value) => sum + value, 0) / denseSizes.length;
    const centerReadableCount = denseSimulation.particles.filter((particle, index) => {
      const normalizedX = particle.position.x / denseField.width;
      const normalizedY = particle.position.y / denseField.height;

      return (
        Math.abs(normalizedX - 0.5) < 0.14 &&
        Math.abs(normalizedY - 0.5) < 0.16 &&
        denseFrame.presence[index] > 0.32 &&
        denseFrame.sizes[index] > 1.05
      );
    }).length;

    expect(Math.max(...denseSizes)).toBeGreaterThan(2.4);
    expect(averageDenseSize).toBeGreaterThan(1.2);
    expect(averageDenseSize).toBeLessThan(2.5);
    expect(centerReadableCount).toBeGreaterThan(18);

    render(
      <AntigravityHeroStage
        active={false}
        corridorProgress={0.12}
        reducedMotion={false}
        scrollProgress={0.25}
        sceneStrength={0.9}
      />
    );

    const shell = screen.getByTestId("antigravity-hero-stage");
    expect(shell).toHaveAttribute("data-active", "false");
    expect(shell).toHaveAttribute("data-reduced-motion", "false");
    expect(shell).toHaveAttribute("data-renderer-contract", "shader-point-cloud");
    expect(shell).toHaveAttribute("data-pointer-contract", "window-tracking");
    expect(screen.getByTestId("mock-r3f-canvas")).toBeInTheDocument();
    expect(
      shell.querySelector('points[name="antigravity-hero-points"]')
    ).toBeInTheDocument();
    expect(screen.queryByTestId("antigravity-hero-speckle-fallback")).toBeNull();
  });

  it("tracks window pointer movement into simulation state and zeroes velocity on hero re-entry", async () => {
    const { flushFrame } = installAnimationFrameQueue();
    const stepSimulationSpy = vi.spyOn(
      antigravityHeroSimulation,
      "stepAntigravityHeroSimulationState"
    );

    render(
      <AntigravityHeroStage
        active={true}
        corridorProgress={0.24}
        reducedMotion={false}
        scrollProgress={0.5}
        sceneStrength={0.8}
        webglSupported={true}
      />
    );

    await flushFrame(16);

    fireEvent.pointerMove(window, { clientX: 400, clientY: 300 });
    await flushFrame(32);

    expect(stepSimulationSpy.mock.calls.at(-1)?.[1]?.pointer).toMatchObject({
      active: true,
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
    });
    expect(stepSimulationSpy.mock.calls.at(-1)?.[1]).toMatchObject({
      scrollProgress: 0.5,
      corridorProgress: 0.24,
      sceneStrength: 0.8,
    });

    fireEvent.pointerMove(window, { clientX: 420, clientY: 310 });
    await flushFrame(48);

    expect(stepSimulationSpy.mock.calls.at(-1)?.[1]?.pointer).toMatchObject({
      active: true,
      x: 420,
      y: 310,
      vx: 20,
      vy: 10,
    });
    expect(stepSimulationSpy.mock.calls.at(-1)?.[1]).toMatchObject({
      scrollProgress: 0.5,
      corridorProgress: 0.24,
      sceneStrength: 0.8,
    });

    fireEvent.pointerLeave(window);
    await flushFrame(64);

    expect(stepSimulationSpy.mock.calls.at(-1)?.[1]?.pointer).toMatchObject({
      active: false,
      x: 420,
      y: 310,
      vx: 0,
      vy: 0,
    });

    fireEvent.pointerMove(window, { clientX: 700, clientY: 500 });
    await flushFrame(80);

    expect(stepSimulationSpy.mock.calls.at(-1)?.[1]?.pointer).toMatchObject({
      active: true,
      x: 700,
      y: 500,
      vx: 0,
      vy: 0,
    });
  });
});
