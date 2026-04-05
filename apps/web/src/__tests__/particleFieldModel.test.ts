import { describe, expect, it } from "vitest";

import {
  createParticleFieldState,
  stepParticleFieldState,
} from "../components/welcome/particleFieldModel";

const collectParticleState = (state: ReturnType<typeof createParticleFieldState>) =>
  ({
    cluster: state.cluster,
    ambientParticles: state.ambientParticles.map(({ x, y, size, alpha, driftX, driftY, phase }) => ({
      x,
      y,
      size,
      alpha,
      driftX,
      driftY,
      phase,
    })),
    ringParticles: state.ringParticles.map(
      ({ x, y, angle, orbitOffset, dashLength, size, alpha, hue }) => ({
        x,
        y,
        angle,
        orbitOffset,
        dashLength,
        size,
        alpha,
        hue,
      })
    ),
  });

describe("particleFieldModel", () => {
  it("creates deterministic state for the same seed", () => {
    const stateA = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 42,
    });
    const stateB = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 42,
    });

    expect(collectParticleState(stateA)).toEqual(collectParticleState(stateB));
  });

  it("creates different fields for different seeds", () => {
    const stateA = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 42,
    });
    const stateB = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 43,
    });

    expect(collectParticleState(stateA)).not.toEqual(collectParticleState(stateB));
  });

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
    expect(state.cluster.centerX).toBeGreaterThan(960 * 0.72);
    expect(state.cluster.centerY).toBeGreaterThan(640 * 0.5);
    expect(state.cluster.radius).toBeGreaterThan(Math.min(960, 640) * 0.32);
    expect(state.ringParticles.some(({ x }) => x > 960)).toBe(true);
  });

  it("steers the cluster target toward the latest pointer input", () => {
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
        x: 840,
        y: 220,
        vx: 1.2,
        vy: 0.2,
      },
    });

    expect(next.cluster.targetX).toBeGreaterThan(state.cluster.targetX);
    expect(next.cluster.targetY).toBeLessThan(state.cluster.targetY);
    expect(next.cluster.energy).toBeGreaterThan(state.cluster.energy);
    expect(Math.abs(next.cluster.targetX - 840)).toBeLessThan(
      Math.abs(state.cluster.targetX - 840)
    );
    expect(Math.abs(next.cluster.targetY - 220)).toBeLessThan(
      Math.abs(state.cluster.targetY - 220)
    );
  });

  it("ignores inactive pointer position and velocity", () => {
    const state = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 7,
    });

    const inactiveWithGarbage = stepParticleFieldState(state, {
      deltaMs: 16,
      scrollProgress: 0.2,
      pointer: {
        active: false,
        x: Number.NaN,
        y: Number.POSITIVE_INFINITY,
        vx: Number.POSITIVE_INFINITY,
        vy: Number.NEGATIVE_INFINITY,
      },
    });
    const inactiveBaseline = stepParticleFieldState(state, {
      deltaMs: 16,
      scrollProgress: 0.2,
      pointer: {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      },
    });

    expect(inactiveWithGarbage.cluster.targetX).toBe(inactiveBaseline.cluster.targetX);
    expect(inactiveWithGarbage.cluster.targetY).toBe(inactiveBaseline.cluster.targetY);
    expect(inactiveWithGarbage.cluster.centerX).toBe(inactiveBaseline.cluster.centerX);
    expect(inactiveWithGarbage.cluster.centerY).toBe(inactiveBaseline.cluster.centerY);

    expect(Number.isFinite(inactiveWithGarbage.cluster.targetX)).toBe(true);
    expect(Number.isFinite(inactiveWithGarbage.cluster.targetY)).toBe(true);
    expect(Number.isFinite(inactiveWithGarbage.cluster.centerX)).toBe(true);
    expect(Number.isFinite(inactiveWithGarbage.cluster.centerY)).toBe(true);
  });

  it("uses scroll progress to move the cluster vertically", () => {
    const base = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 11,
    });

    const lowScroll = stepParticleFieldState(base, {
      deltaMs: 16,
      scrollProgress: 0,
      pointer: {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      },
    });
    const highScroll = stepParticleFieldState(base, {
      deltaMs: 16,
      scrollProgress: 1,
      pointer: {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      },
    });

    expect(highScroll.cluster.targetY).toBeGreaterThan(lowScroll.cluster.targetY);
  });

  it("drifts the cluster target while idle when pointer input is inactive", () => {
    const initial = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 5,
    });
    const pointer = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    };

    const first = stepParticleFieldState(initial, {
      deltaMs: 16,
      scrollProgress: 0.35,
      pointer,
    });
    const second = stepParticleFieldState(first, {
      deltaMs: 16,
      scrollProgress: 0.35,
      pointer,
    });

    expect(second.cluster.targetX).not.toBe(first.cluster.targetX);
    expect(second.cluster.targetY).not.toBe(first.cluster.targetY);
  });

  it("keeps ring dash lengths bounded across repeated animation steps", () => {
    let state = createParticleFieldState({
      width: 1280,
      height: 720,
      reducedMotion: false,
      seed: 9,
    });

    const initialMaxDash = Math.max(...state.ringParticles.map(({ dashLength }) => dashLength));

    for (let index = 0; index < 180; index += 1) {
      state = stepParticleFieldState(state, {
        deltaMs: 16,
        scrollProgress: 0.3,
        pointer: {
          active: index % 12 < 6,
          x: 920,
          y: 280,
          vx: 0.8,
          vy: 0.2,
        },
      });
    }

    const finalMaxDash = Math.max(...state.ringParticles.map(({ dashLength }) => dashLength));
    expect(finalMaxDash).toBeLessThan(initialMaxDash * 1.5);
  });

  it("softens movement under reduced motion", () => {
    const base = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 11,
    });
    const reduced = createParticleFieldState({
      width: 960,
      height: 640,
      reducedMotion: true,
      seed: 11,
    });
    const pointer = {
      active: true,
      x: 760,
      y: 460,
      vx: 1.4,
      vy: 0.4,
    };

    const baseline = stepParticleFieldState(base, {
      deltaMs: 16,
      scrollProgress: 0.78,
      pointer,
    });
    const reducedNext = stepParticleFieldState(reduced, {
      deltaMs: 16,
      scrollProgress: 0.78,
      pointer,
    });

    expect(
      Math.abs(baseline.cluster.centerX - base.cluster.centerX)
    ).toBeGreaterThan(
      Math.abs(reducedNext.cluster.centerX - reduced.cluster.centerX)
    );
    expect(
      Math.abs(baseline.cluster.centerY - base.cluster.centerY)
    ).toBeGreaterThan(
      Math.abs(reducedNext.cluster.centerY - reduced.cluster.centerY)
    );
  });

  it("keeps finite particle coordinates for zero-size fields", () => {
    const state = createParticleFieldState({
      width: 0,
      height: 0,
      reducedMotion: false,
      seed: 11,
    });
    const next = stepParticleFieldState(state, {
      deltaMs: 16,
      scrollProgress: 0.5,
      pointer: {
        active: true,
        x: 10,
        y: 10,
        vx: 1,
        vy: 1,
      },
    });

    expect(Number.isFinite(next.cluster.centerX)).toBe(true);
    expect(Number.isFinite(next.cluster.centerY)).toBe(true);
    expect(Number.isFinite(next.cluster.targetX)).toBe(true);
    expect(Number.isFinite(next.cluster.targetY)).toBe(true);

    for (const particle of next.ambientParticles) {
      expect(Number.isFinite(particle.x)).toBe(true);
      expect(Number.isFinite(particle.y)).toBe(true);
      expect(Number.isFinite(particle.phase)).toBe(true);
    }
    for (const particle of next.ringParticles) {
      expect(Number.isFinite(particle.x)).toBe(true);
      expect(Number.isFinite(particle.y)).toBe(true);
      expect(Number.isFinite(particle.angle)).toBe(true);
    }
  });
});

