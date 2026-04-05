import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

let pointRenderCount = 0;

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-r3f-canvas">{children}</div>
  ),
}));

vi.mock("../components/welcome/AntigravityHeroPoints", async () => {
  const actual = await vi.importActual<typeof import("../components/welcome/AntigravityHeroPoints")>(
    "../components/welcome/AntigravityHeroPoints"
  );

  return {
    ...actual,
    AntigravityHeroPoints: () => {
      pointRenderCount += 1;
      return <div data-testid="antigravity-hero-points-stub" />;
    },
  };
});

import { AntigravityHeroStage } from "../components/welcome/AntigravityHeroStage";

describe("AntigravityHeroStage render loop", () => {
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    pointRenderCount = 0;
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
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
  });

  it("keeps the stage wrapper render-stable and delegates animation ownership to the point cloud", async () => {
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

    await waitFor(() =>
      expect(screen.getByTestId("antigravity-hero-points-stub")).toBeInTheDocument()
    );

    expect(pointRenderCount).toBeLessThanOrEqual(2);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
