import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as particleFieldModel from "../components/welcome/particleFieldModel";
import { startHeroParticleField } from "../components/welcome/particleFieldEngine";

const createMockContext = () =>
  ({
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
  }) as unknown as CanvasRenderingContext2D;

describe("particleFieldEngine", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: originalGetContext,
    });
    vi.restoreAllMocks();
  });

  it("returns a destroy function even when reduced motion is enabled", () => {
    const root = document.createElement("section");
    const boundsElement = document.createElement("div");
    const canvas = document.createElement("canvas");
    const context = createMockContext();
    const frameHandle = 17;

    root.append(boundsElement);
    boundsElement.append(canvas);

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(context),
    });
    Object.defineProperty(boundsElement, "getBoundingClientRect", {
      configurable: true,
      value: vi.fn(() => ({
        bottom: 220,
        height: 200,
        left: 10,
        right: 310,
        toJSON: () => "",
        top: 20,
        width: 300,
        x: 10,
        y: 20,
      })),
    });

    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(frameHandle);
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    const destroy = startHeroParticleField(canvas, {
      boundsElement,
      getScrollProgress: () => 0.35,
      interactionRoot: root,
      reducedMotion: true,
    });

    expect(destroy).toBeTypeOf("function");
    destroy?.();
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(frameHandle);
  });

  it("consumes scroll progress when stepping the model", () => {
    const root = document.createElement("section");
    const boundsElement = document.createElement("div");
    const canvas = document.createElement("canvas");
    const context = createMockContext();
    const stepSpy = vi.spyOn(particleFieldModel, "stepParticleFieldState");
    const getScrollProgress = vi.fn(() => 0.61);
    let nextFrameHandle = 21;
    let frameCallback: ((timestamp: number) => void) | undefined;

    root.append(boundsElement);
    boundsElement.append(canvas);

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(context),
    });
    Object.defineProperty(boundsElement, "getBoundingClientRect", {
      configurable: true,
      value: vi.fn(() => ({
        bottom: 220,
        height: 200,
        left: 10,
        right: 310,
        toJSON: () => "",
        top: 20,
        width: 300,
        x: 10,
        y: 20,
      })),
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      const currentHandle = nextFrameHandle;
      nextFrameHandle += 1;
      return currentHandle;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const destroy = startHeroParticleField(canvas, {
      boundsElement,
      getScrollProgress,
      interactionRoot: root,
      reducedMotion: false,
    });

    if (!frameCallback) {
      throw new Error("Missing animation frame callback");
    }
    frameCallback(1000);

    expect(getScrollProgress).toHaveBeenCalled();
    expect(stepSpy).toHaveBeenCalled();
    const stepInput = stepSpy.mock.calls.at(-1)?.[1];
    expect(stepInput?.scrollProgress).toBeCloseTo(0.61);

    destroy?.();
  });

  it("reads corridor progress inside the render loop", () => {
    const root = document.createElement("section");
    const boundsElement = document.createElement("div");
    const canvas = document.createElement("canvas");
    const context = createMockContext();
    let frameCallback: ((timestamp: number) => void) | undefined;
    const getCorridorProgress = vi.fn(() => 0.62);

    root.append(boundsElement);
    boundsElement.append(canvas);

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(context),
    });
    Object.defineProperty(boundsElement, "getBoundingClientRect", {
      configurable: true,
      value: vi.fn(() => ({
        bottom: 220,
        height: 200,
        left: 10,
        right: 310,
        toJSON: () => "",
        top: 20,
        width: 300,
        x: 10,
        y: 20,
      })),
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 19;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    startHeroParticleField(canvas, {
      boundsElement,
      getScrollProgress: () => 0.35,
      getCorridorProgress,
      interactionRoot: root,
      reducedMotion: false,
    });

    frameCallback?.(1000);
    expect(getCorridorProgress).toHaveBeenCalled();
  });

  it("reads scene strength inside the engine render loop", () => {
    const root = document.createElement("section");
    const boundsElement = document.createElement("div");
    const canvas = document.createElement("canvas");
    const context = createMockContext();
    let frameCallback: ((timestamp: number) => void) | undefined;
    const getSceneStrength = vi.fn(() => 0.25);

    root.append(boundsElement);
    boundsElement.append(canvas);

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(context),
    });
    Object.defineProperty(boundsElement, "getBoundingClientRect", {
      configurable: true,
      value: vi.fn(() => ({
        bottom: 220,
        height: 200,
        left: 10,
        right: 310,
        toJSON: () => "",
        top: 20,
        width: 300,
        x: 10,
        y: 20,
      })),
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 17;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    startHeroParticleField(canvas, {
      boundsElement,
      getScrollProgress: () => 0.4,
      getSceneStrength,
      interactionRoot: root,
      reducedMotion: false,
    });

    frameCallback?.(1000);
    expect(getSceneStrength).toHaveBeenCalled();
  });
});
