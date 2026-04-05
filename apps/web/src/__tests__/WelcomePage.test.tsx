import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import {
  WelcomePage,
  WELCOME_ENDCAP_SCENE,
  WELCOME_HERO_SCENE,
  WELCOME_STORY_SCENES,
} from "../pages/WelcomePage";
import { buildDefaultSessionDetail } from "../lib/sessionDefaults";
import { saveSessionDetail, setActiveSessionId } from "../lib/storage";

const createMockTimelineState = ({
  activeSceneId = "story-2",
  ctaMode = "docked",
  progress = 0.58,
  signalStageMode = "theater",
  stageTone = 1,
  corridorProgress = 0,
  ctaDockProgress = 1,
  sceneStates,
}: {
  activeSceneId?: "hero" | "story-1" | "story-2" | "story-3" | "endcap";
  ctaMode?: "hero" | "morph" | "docked" | "endcap";
  progress?: number;
  signalStageMode?: "portal" | "corridor" | "theater" | "resolved";
  stageTone?: number;
  corridorProgress?: number;
  ctaDockProgress?: number;
  sceneStates?: {
    hero: {
      phase: "pre-enter" | "enter" | "dwell" | "exit";
      progress: number;
      titleProgress: number;
      detailProgress: number;
      intensity: number;
      primary: boolean;
    };
    "story-1": {
      phase: "pre-enter" | "enter" | "dwell" | "exit";
      progress: number;
      titleProgress: number;
      detailProgress: number;
      intensity: number;
      primary: boolean;
    };
    "story-2": {
      phase: "pre-enter" | "enter" | "dwell" | "exit";
      progress: number;
      titleProgress: number;
      detailProgress: number;
      intensity: number;
      primary: boolean;
    };
    "story-3": {
      phase: "pre-enter" | "enter" | "dwell" | "exit";
      progress: number;
      titleProgress: number;
      detailProgress: number;
      intensity: number;
      primary: boolean;
    };
    endcap: {
      phase: "pre-enter" | "enter" | "dwell" | "exit";
      progress: number;
      titleProgress: number;
      detailProgress: number;
      intensity: number;
      primary: boolean;
    };
  };
}) => ({
  railRef: { current: null },
  railMinHeight: "520vh",
  progress,
  snapshot: {
    activeSceneId,
    incomingSceneId:
      activeSceneId === "hero"
        ? "story-1"
          : activeSceneId === "story-2"
          ? "story-3"
          : undefined,
    ctaMode,
    signalStageMode,
    stageTone,
    corridorProgress,
    ctaDockProgress,
    sceneStates:
      sceneStates ?? {
        hero: {
          phase: "exit",
          progress: 0.8,
          titleProgress: 0.5,
          detailProgress: 0.2,
          intensity: 0.22,
          primary: false,
        },
        "story-1": {
          phase: "exit",
          progress: 0.6,
          titleProgress: 0.4,
          detailProgress: 0.1,
          intensity: 0.24,
          primary: false,
        },
        "story-2": {
          phase: "dwell",
          progress: 0.4,
          titleProgress: 1,
          detailProgress: 0.86,
          intensity: 1,
          primary: true,
        },
        "story-3": {
          phase: "pre-enter",
          progress: 0.25,
          titleProgress: 0.1,
          detailProgress: 0,
          intensity: 0.12,
          primary: false,
        },
        endcap: {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
      },
  },
});

let mockedTimelineState = createMockTimelineState({});
let lastHeroParticleFieldProps: {
  active: boolean;
  corridorProgress?: number;
  reducedMotion: boolean;
  scrollProgress: number;
  sceneStrength: number;
} | null = null;

vi.mock("../components/welcome/HeroParticleField", () => ({
  HeroParticleField: (props: {
    active: boolean;
    corridorProgress?: number;
    reducedMotion: boolean;
    scrollProgress: number;
    sceneStrength: number;
  }) => {
    lastHeroParticleFieldProps = props;
    return <div data-testid="welcome-particle-field" />;
  },
}));

vi.mock("../hooks/useWelcomeStageTimeline", () => ({
  useWelcomeStageTimeline: () => mockedTimelineState,
}));

describe("WelcomePage", () => {
  afterEach(() => {
    localStorage.clear();
    mockedTimelineState = createMockTimelineState({});
    lastHeroParticleFieldProps = null;
  });

  it("reuses module-scope welcome scene groupings", () => {
    expect(WELCOME_HERO_SCENE.id).toBe("hero");
    expect(WELCOME_ENDCAP_SCENE.id).toBe("endcap");
    expect(WELCOME_STORY_SCENES.map((scene) => scene.id)).toEqual([
      "story-1",
      "story-2",
      "story-3",
    ]);
  });

  it("renders five staged scene nodes inside the sticky stage", () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    const rail = container.querySelector(".welcome-stage-rail");
    const stickyStage = container.querySelector(".welcome-stage-sticky");
    const scenes = container.querySelectorAll(".welcome-stage-scene");

    expect(rail).toBeInTheDocument();
    expect(rail).toHaveStyle({ minHeight: "520vh" });
    expect(stickyStage).toBeInTheDocument();
    expect(stickyStage).toHaveAttribute("data-active-scene", "story-2");
    expect(stickyStage).toHaveAttribute("data-progress", "0.580");
    expect(scenes).toHaveLength(5);
    expect(container.querySelector('.welcome-stage-scene[data-scene-id="hero"]')).toHaveAttribute(
      "data-phase",
      "exit"
    );
    expect(
      container.querySelector('.welcome-stage-scene[data-scene-id="story-2"]')
    ).toHaveAttribute("data-primary", "true");
    expect(
      container.querySelector('.welcome-stage-scene[data-scene-id="endcap"]')
    ).toHaveAttribute("data-phase", "pre-enter");
    expect(
      container.querySelector('.welcome-stage-scene[data-scene-id="story-1"]')
    ).toHaveAttribute("data-layout", "gather");
    expect(
      container.querySelector('.welcome-stage-scene[data-scene-id="story-2"]')
    ).toHaveAttribute("data-layout", "engine");
    expect(
      container.querySelector('.welcome-stage-scene[data-scene-id="story-3"]')
    ).toHaveAttribute("data-layout", "delivery");
    expect(container.querySelector(".welcome-stage-visual--gather")).toBeInTheDocument();
    expect(container.querySelector(".welcome-stage-visual--engine")).toBeInTheDocument();
    expect(container.querySelector(".welcome-stage-visual--delivery")).toBeInTheDocument();
    expect(container.querySelector(".welcome-story-screen-layout")).toBeNull();
    expect(container.querySelector(".welcome-story-gather-layout")).toBeInTheDocument();
    expect(container.querySelector(".welcome-story-engine-layout")).toBeInTheDocument();
    expect(container.querySelector(".welcome-story-delivery-layout")).toBeInTheDocument();
    expect(container.querySelector(".welcome-story-gather-support")).toBeInTheDocument();
    expect(container.querySelector(".welcome-story-engine-meta")).toBeInTheDocument();
    expect(container.querySelector(".welcome-story-delivery-surface")).toBeInTheDocument();
    expect(container.querySelector(".welcome-hero-copy")).toHaveAttribute(
      "data-stage-role",
      "portal-copy"
    );
    expect(container.querySelector('.welcome-stage-scene[data-scene-id="endcap"]')).toHaveAttribute(
      "data-layout",
      "resolved"
    );

    const story2Shell = container.querySelector('[data-scene-shell-id="story-2"]');
    const story3Shell = container.querySelector('[data-scene-shell-id="story-3"]');
    const story2Scene = container.querySelector('.welcome-stage-scene[data-scene-id="story-2"]');
    const story2Layout = container.querySelector(".welcome-story-engine-layout");
    const story3Layout = container.querySelector(".welcome-story-delivery-layout");
    const signalStage = container.querySelector(".welcome-signal-stage");

    expect(story2Shell).toHaveStyle("--scene-content-layer: 3");
    expect(story3Shell).toHaveStyle("--scene-content-layer: 2");
    expect(window.getComputedStyle(story2Scene as Element).isolation).not.toBe("isolate");
    expect(story2Layout).not.toHaveAttribute("style");
    expect(story3Layout).not.toHaveAttribute("style");
    expect(container.querySelector(".welcome-story-gather-layout")).not.toHaveAttribute("style");
    expect(signalStage).toHaveAttribute("data-mode", "theater");
  });

  it("renders the shared welcome shell and persistent signal stage", () => {
    mockedTimelineState = createMockTimelineState({
      activeSceneId: "hero",
      ctaMode: "morph",
      progress: 0.31,
      signalStageMode: "corridor",
      stageTone: 0.64,
      corridorProgress: 0.64,
      ctaDockProgress: 0.64,
    });

    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    const shell = container.querySelector(".welcome-page-shell");
    const stage = container.querySelector(".welcome-signal-stage");

    expect(shell).toBeInTheDocument();
    expect(shell).toHaveStyle("--stage-tone: 0.64");
    expect(shell).toHaveStyle("--corridor-progress: 0.64");
    expect(shell).toHaveStyle("--cta-dock-progress: 0.64");
    expect(stage).toBeInTheDocument();
    expect(stage).toHaveStyle("--stage-tone: 0.64");
    expect(stage).toHaveStyle("--corridor-progress: 0.64");
    expect(stage).toHaveStyle("--cta-dock-progress: 0.64");
    expect(stage).toHaveAttribute("data-mode", "corridor");
  });

  it("keeps the corridor beam visible only during the hero-to-story handoff", () => {
    mockedTimelineState = createMockTimelineState({
      activeSceneId: "hero",
      ctaMode: "morph",
      progress: 0.31,
      signalStageMode: "corridor",
      stageTone: 0.64,
      corridorProgress: 0.64,
      ctaDockProgress: 0.64,
    });

    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    const beam = container.querySelector(".welcome-signal-stage__beam");

    expect(beam).toBeInTheDocument();
    expect(Number.parseFloat((beam as HTMLElement).style.opacity)).toBeGreaterThan(0.1);
  });

  it("hides the corridor beam once the story theater takes over", () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    const beam = container.querySelector(".welcome-signal-stage__beam");

    expect(container.querySelector(".welcome-signal-stage")).toHaveAttribute("data-mode", "theater");
    expect(beam).toBeInTheDocument();
    expect((beam as HTMLElement).style.opacity).toBe("0");
  });

  it("keeps the resolved endcap free of the corridor beam", () => {
    mockedTimelineState = createMockTimelineState({
      activeSceneId: "endcap",
      ctaMode: "endcap",
      progress: 0.92,
      signalStageMode: "resolved",
      stageTone: 1,
      corridorProgress: 1,
      ctaDockProgress: 1,
      sceneStates: {
        hero: {
          phase: "exit",
          progress: 1,
          titleProgress: 0.2,
          detailProgress: 0,
          intensity: 0.08,
          primary: false,
        },
        "story-1": {
          phase: "exit",
          progress: 1,
          titleProgress: 0.2,
          detailProgress: 0,
          intensity: 0.08,
          primary: false,
        },
        "story-2": {
          phase: "exit",
          progress: 1,
          titleProgress: 0.2,
          detailProgress: 0,
          intensity: 0.08,
          primary: false,
        },
        "story-3": {
          phase: "exit",
          progress: 1,
          titleProgress: 0.2,
          detailProgress: 0,
          intensity: 0.08,
          primary: false,
        },
        endcap: {
          phase: "dwell",
          progress: 0.6,
          titleProgress: 1,
          detailProgress: 1,
          intensity: 1,
          primary: true,
        },
      },
    });

    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    const beam = container.querySelector(".welcome-signal-stage__beam");

    expect(container.querySelector(".welcome-signal-stage")).toHaveAttribute("data-mode", "resolved");
    expect(beam).toBeInTheDocument();
    expect((beam as HTMLElement).style.opacity).toBe("0");
  });

  it("passes the timeline CTA mode into the sticky CTA shell", () => {
    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId("welcome-sticky-cta")).toHaveAttribute("data-mode", "docked");
    expect(screen.getByTestId("welcome-sticky-cta")).not.toHaveAttribute("data-docked");
  });

  it("keeps only the active scene CTA exposed to the accessibility tree", () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("link", { name: "进入创作台" })).toHaveLength(1);
    expect(container.querySelector('.welcome-stage-scene[data-scene-id="hero"]')).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(container.querySelector('.welcome-stage-scene[data-scene-id="hero"]')).toHaveAttribute(
      "inert"
    );
    expect(
      container.querySelector('.welcome-stage-scene[data-scene-id="story-2"]')
    ).not.toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the welcome page on the document scroller so the sticky stage can pin", () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    expect(container.querySelector("main.welcome-page")).not.toHaveAttribute("style");
  });

  it("preserves the recoverable-session route in the sticky CTA", () => {
    const now = new Date().toISOString();
    const detail = buildDefaultSessionDetail("sess-queued", now);
    detail.status = "queued";
    detail.jobId = "job-123";
    saveSessionDetail(detail);
    setActiveSessionId(detail.id);

    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    const stickyCta = screen.getByTestId("welcome-sticky-cta");

    expect(stickyCta).toHaveAttribute("data-mode", "docked");
    expect(within(stickyCta).getByRole("link", { name: "继续创作" })).toHaveAttribute(
      "href",
      "/jobs/job-123"
    );
    screen
      .getAllByRole("link", { name: "继续创作" })
      .forEach((link) => expect(link).toHaveAttribute("href", "/jobs/job-123"));
  });

  it("keeps untouched pre-enter scenes hidden until their progress advances", () => {
    mockedTimelineState = createMockTimelineState({
      activeSceneId: "hero",
      ctaMode: "hero",
      progress: 0,
      sceneStates: {
        hero: {
          phase: "dwell",
          progress: 0.2,
          titleProgress: 1,
          detailProgress: 0.8,
          intensity: 1,
          primary: true,
        },
        "story-1": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        "story-2": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        "story-3": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        endcap: {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
      },
    });

    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    expect(container.querySelector('.welcome-stage-scene[data-scene-id="hero"]')).toHaveAttribute(
      "data-primary",
      "true"
    );
    expect(
      container.querySelector('.welcome-stage-scene[data-scene-id="story-1"]')
    ).toHaveAttribute("data-scene-progress", "0.000");
    expect(
      container.querySelector('.welcome-stage-scene[data-scene-id="story-1"]')
    ).toHaveStyle("--scene-visibility: 0");
  });

  it("keeps the hero visible on first paint while later scenes stay hidden", () => {
    mockedTimelineState = createMockTimelineState({
      activeSceneId: "hero",
      ctaMode: "hero",
      progress: 0,
      sceneStates: {
        hero: {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: true,
        },
        "story-1": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        "story-2": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        "story-3": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        endcap: {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
      },
    });

    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    expect(container.querySelector('.welcome-stage-scene[data-scene-id="hero"]')).toHaveStyle(
      "--scene-visibility: 1"
    );
    expect(container.querySelector('.welcome-stage-scene[data-scene-id="hero"]')).toHaveStyle(
      "transform: translate3d(0, 0, 0) scale(1)"
    );
    expect(
      container.querySelector('.welcome-stage-scene[data-scene-id="story-1"]')
    ).toHaveStyle("--scene-visibility: 0");
  });

  it("hides the docked CTA shell from assistive tech while the hero owns the primary action", () => {
    mockedTimelineState = createMockTimelineState({
      activeSceneId: "hero",
      ctaMode: "hero",
      progress: 0,
      sceneStates: {
        hero: {
          phase: "dwell",
          progress: 0.2,
          titleProgress: 1,
          detailProgress: 0.8,
          intensity: 1,
          primary: true,
        },
        "story-1": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        "story-2": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        "story-3": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        endcap: {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
      },
    });

    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("link", { name: "进入创作台" })).toHaveLength(1);
    expect(screen.getByTestId("welcome-sticky-cta")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("welcome-sticky-cta")).toHaveAttribute("inert");
    expect(container.querySelector('.welcome-stage-scene[data-scene-id="hero"]')).not.toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("stops driving the hero particle field once the hero exit has fully settled", () => {
    mockedTimelineState = createMockTimelineState({
      activeSceneId: "story-1",
      ctaMode: "docked",
      progress: 0.52,
      sceneStates: {
        hero: {
          phase: "exit",
          progress: 1,
          titleProgress: 0.2,
          detailProgress: 0,
          intensity: 0.08,
          primary: false,
        },
        "story-1": {
          phase: "dwell",
          progress: 0.4,
          titleProgress: 1,
          detailProgress: 0.92,
          intensity: 1,
          primary: true,
        },
        "story-2": {
          phase: "pre-enter",
          progress: 0.08,
          titleProgress: 0.04,
          detailProgress: 0,
          intensity: 0.04,
          primary: false,
        },
        "story-3": {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
        endcap: {
          phase: "pre-enter",
          progress: 0,
          titleProgress: 0,
          detailProgress: 0,
          intensity: 0,
          primary: false,
        },
      },
    });

    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    );

    expect(lastHeroParticleFieldProps).toMatchObject({
      active: false,
      sceneStrength: 0.08,
    });
  });
});
