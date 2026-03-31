import { describe, expect, it } from "vitest";

import {
  createParticleFieldState,
  stepParticleFieldState,
} from "../components/welcome/particleFieldModel";

describe("particleFieldModel", () => {
  it("creates separate ambient and ring particle collections", () => {
    const state = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 7,
    });

    expect(state.ambientParticles.length).toBeGreaterThan(24);
    expect(state.ringParticles.length).toBeGreaterThan(72);
    expect(state.cluster.radius).toBeGreaterThan(state.cluster.thickness);
  });

  it("steers the cluster toward the latest pointer target", () => {
    const state = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 7,
    });

    const next = stepParticleFieldState(state, {
      deltaMs: 16,
      scrollProgress: 0.2,
      pointer: {
        active: true,
        x: 720,
        y: 280,
        vx: 1.2,
        vy: 0.2,
      },
    });

    expect(next.cluster.targetX).toBeGreaterThan(state.cluster.targetX);
    expect(next.cluster.targetY).toBeGreaterThan(0);
    expect(next.cluster.energy).toBeGreaterThan(state.cluster.energy);
  });

  it("uses scroll progress and reduced motion to soften movement", () => {
    const motionState = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 11,
    });
    const reducedState = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: true,
      seed: 11,
    });

    const pointer = {
      active: true,
      x: 740,
      y: 320,
      vx: 1.4,
      vy: 0.4,
    };

    const motionNext = stepParticleFieldState(motionState, {
      deltaMs: 16,
      scrollProgress: 0.78,
      pointer,
    });
    const reducedNext = stepParticleFieldState(reducedState, {
      deltaMs: 16,
      scrollProgress: 0.78,
      pointer,
    });

    expect(motionNext.cluster.centerY).toBeGreaterThan(motionState.cluster.centerY);
    expect(
      Math.abs(motionNext.cluster.centerX - motionState.cluster.centerX)
    ).toBeGreaterThan(
      Math.abs(reducedNext.cluster.centerX - reducedState.cluster.centerX)
    );
  });
});
