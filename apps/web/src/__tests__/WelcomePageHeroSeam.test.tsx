import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { WelcomePage } from "../pages/WelcomePage";

const createMockTimelineState = () => ({
  railRef: { current: null },
  railMinHeight: "520vh",
  progress: 0.28,
  snapshot: {
    activeSceneId: "hero",
    incomingSceneId: "story-1" as const,
    ctaMode: "hero" as const,
    signalStageMode: "portal" as const,
    stageTone: 1,
    corridorProgress: 0.2,
    ctaDockProgress: 0,
    sceneStates: {
      hero: {
        phase: "dwell" as const,
        progress: 0.4,
        titleProgress: 1,
        detailProgress: 0.6,
        intensity: 0.84,
        primary: true,
      },
      "story-1": {
        phase: "pre-enter" as const,
        progress: 0,
        titleProgress: 0,
        detailProgress: 0,
        intensity: 0,
        primary: false,
      },
      "story-2": {
        phase: "pre-enter" as const,
        progress: 0,
        titleProgress: 0,
        detailProgress: 0,
        intensity: 0,
        primary: false,
      },
      "story-3": {
        phase: "pre-enter" as const,
        progress: 0,
        titleProgress: 0,
        detailProgress: 0,
        intensity: 0,
        primary: false,
      },
      endcap: {
        phase: "pre-enter" as const,
        progress: 0,
        titleProgress: 0,
        detailProgress: 0,
        intensity: 0,
        primary: false,
      },
    },
  },
});

vi.mock("../components/welcome/AntigravityHeroStage", () => ({
  AntigravityHeroStage: () => <div data-testid="antigravity-hero-stage-stub" />,
}));

vi.mock("../components/welcome/antigravityHeroSupport", () => ({
  supportsAntigravityHeroWebGL: vi.fn(() => false),
}));

vi.mock("../hooks/useWelcomeStageTimeline", () => ({
  useWelcomeStageTimeline: () => createMockTimelineState(),
}));

describe("WelcomePage hero seam", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the real hero particle wrapper inside the sticky stage and preserves the fallback contract", async () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    const stickyStage = container.querySelector(".welcome-stage-sticky");
    const heroShell = container.querySelector('[data-scene-shell-id="hero"]');
    const heroScene = container.querySelector('.welcome-stage-scene[data-scene-id="hero"]');
    const heroParticleField = container.querySelector(".welcome-particle-field");
    const heroLayout = container.querySelector(".welcome-hero-layout");
    const heroCopy = container.querySelector(".welcome-hero-copy");

    expect(stickyStage).toBeInTheDocument();
    expect(heroShell).toBeInTheDocument();
    expect(stickyStage?.contains(heroShell as Node)).toBe(true);
    expect(heroScene).toBeInTheDocument();
    expect(heroParticleField).toBeInTheDocument();
    expect(heroParticleField).toHaveClass("is-fallback");
    expect(heroScene?.firstElementChild).toBe(heroParticleField);
    expect(heroScene?.contains(heroLayout as Node)).toBe(true);
    expect(heroLayout?.contains(heroCopy as Node)).toBe(true);
    await waitFor(() => {
      expect(container.querySelector("[data-testid='antigravity-hero-fallback']")).toBeInTheDocument();
    });
    expect(container.querySelector("[data-testid='antigravity-hero-stage-stub']")).toBeNull();
  });
});
