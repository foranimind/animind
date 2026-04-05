import { render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type HeroParticleFieldProps = {
  active: boolean;
  corridorProgress: number;
  reducedMotion: boolean;
  scrollProgress: number;
  sceneStrength: number;
  seed?: number;
  webglSupported: boolean | null;
};

let lastStageProps: HeroParticleFieldProps | null = null;
let mockSupportsWebGL = true;

vi.mock("../components/welcome/AntigravityHeroStage", () => ({
  AntigravityHeroStage: (props: HeroParticleFieldProps) => {
    lastStageProps = props;

    return <div data-testid="antigravity-hero-stage-mock" />;
  },
}));

vi.mock("../components/welcome/antigravityHeroSupport", () => ({
  supportsAntigravityHeroWebGL: vi.fn(() => mockSupportsWebGL),
}));

import {
  HeroParticleField,
  resolveHeroParticleFieldRenderMode,
} from "../components/welcome/HeroParticleField";
import * as particleFieldEngine from "../components/welcome/particleFieldEngine";

describe("HeroParticleField", () => {
  beforeEach(() => {
    lastStageProps = null;
    mockSupportsWebGL = true;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps support detection into one explicit render mode", () => {
    expect(resolveHeroParticleFieldRenderMode(null)).toBe("pending");
    expect(resolveHeroParticleFieldRenderMode(true)).toBe("stage");
    expect(resolveHeroParticleFieldRenderMode(false)).toBe("fallback");
  });

  it("mounts the Antigravity stage wrapper and forwards the current prop contract", async () => {
    const legacyEngineSpy = vi.spyOn(particleFieldEngine, "startHeroParticleField");

    render(
      <HeroParticleField
        active={true}
        corridorProgress={0.12}
        reducedMotion={false}
        scrollProgress={0.18}
        sceneStrength={0.74}
      />
    );

    await waitFor(() => {
      expect(lastStageProps).toEqual({
        active: true,
        corridorProgress: 0.12,
        reducedMotion: false,
        scrollProgress: 0.18,
        sceneStrength: 0.74,
        seed: 41,
        webglSupported: true,
      });
    });
    expect(legacyEngineSpy).not.toHaveBeenCalled();
  });

  it("keeps the shell contract stable after hydration and applies the fallback class when support resolves false", async () => {
    const legacyEngineSpy = vi.spyOn(particleFieldEngine, "startHeroParticleField");
    mockSupportsWebGL = false;

    const { container } = render(
      <HeroParticleField
        active={true}
        corridorProgress={0.12}
        reducedMotion={false}
        scrollProgress={0.18}
        sceneStrength={0.74}
      />
    );

    await waitFor(() => {
      expect(container.querySelector(".welcome-particle-field")).toHaveClass("is-fallback");
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="antigravity-hero-fallback"]')).toBeInTheDocument();
    });
    expect(lastStageProps).toBeNull();
    expect(legacyEngineSpy).not.toHaveBeenCalled();
  });

  it("keeps the shell contract stable when inactive and still avoids the legacy engine path", async () => {
    const legacyEngineSpy = vi.spyOn(particleFieldEngine, "startHeroParticleField");

    render(
      <HeroParticleField
        active={false}
        reducedMotion={true}
        scrollProgress={0.5}
        sceneStrength={0.2}
      />
    );

    await waitFor(() => {
      expect(lastStageProps).toEqual({
        active: false,
        corridorProgress: 0,
        reducedMotion: true,
        scrollProgress: 0.5,
        sceneStrength: 0.2,
        seed: 41,
        webglSupported: true,
      });
    });
    expect(legacyEngineSpy).not.toHaveBeenCalled();
  });

  it("primes the first-screen hero state so the stage is active and visibly present before the timeline intensity ramps", async () => {
    const { container } = render(
      <HeroParticleField
        active={false}
        corridorProgress={0}
        reducedMotion={false}
        scrollProgress={0}
        sceneStrength={0}
      />
    );

    await waitFor(() => {
      expect(lastStageProps).toEqual({
        active: true,
        corridorProgress: 0,
        reducedMotion: false,
        scrollProgress: 0,
        sceneStrength: expect.any(Number),
        seed: 41,
        webglSupported: true,
      });
    });
    expect(lastStageProps?.sceneStrength).toBeGreaterThan(0.6);
    expect(container.querySelector(".welcome-particle-field")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("opacity:0.14");
  });

  it("keeps the hero shell renderable before the stage module resolves", () => {
    const markup = renderToString(
      <HeroParticleField
        active={true}
        corridorProgress={0.12}
        reducedMotion={false}
        scrollProgress={0.18}
        sceneStrength={0.74}
      />
    );

    expect(markup).toContain("welcome-particle-field");
    expect(markup).not.toContain("antigravity-hero-stage-mock");
    expect(lastStageProps).toBeNull();
  });
});
