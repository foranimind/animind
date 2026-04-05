import { describe, expect, it } from "vitest";

import {
  buildAntigravityHeroField,
} from "../components/welcome/antigravityHeroField";
import {
  createAntigravityHeroSimulationState,
  stepAntigravityHeroSimulationState,
} from "../components/welcome/antigravityHeroSimulation";

const pointer = (x: number, y: number, vx = 0, vy = 0) => ({
  active: true,
  x,
  y,
  vx,
  vy,
});

const idlePointer = {
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
};

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const colorDistance = (
  before: { r: number; g: number; b: number },
  after: { r: number; g: number; b: number }
) => Math.hypot(after.r - before.r, after.g - before.g, after.b - before.b);

describe("antigravityHeroSimulation", () => {
  it("preserves the macro envelope while keeping the idle-visible set stable", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 11,
    });
    const initial = createAntigravityHeroSimulationState({
      field,
      particleCount: 180,
      seed: 11,
    });

    const beforeCentroidX = average(initial.particles.map((particle) => particle.position.x));
    const beforeCentroidY = average(initial.particles.map((particle) => particle.position.y));
    const visibleThreshold = 0.2;

    let next = initial;
    const visibleCounts = [next.particles.filter((particle) => particle.presence >= visibleThreshold).length];
    const visibleSnapshots: Array<Set<number>> = [
      new Set(
        next.particles
          .map((particle, index) => ({ particle, index }))
          .filter(({ particle }) => particle.presence >= visibleThreshold)
          .map(({ index }) => index)
      ),
    ];
    expect(visibleCounts[0]).toBeLessThanOrEqual(initial.particles.length);
    expect(visibleCounts[0]).toBeGreaterThan(initial.particles.length * 0.95);

    for (let step = 0; step < 10; step += 1) {
      next = stepAntigravityHeroSimulationState(next, {
        deltaMs: 16,
        pointer: idlePointer,
      });

      visibleCounts.push(
        next.particles.filter((particle) => particle.presence >= visibleThreshold).length
      );
      visibleSnapshots.push(
        new Set(
          next.particles
            .map((particle, index) => ({ particle, index }))
            .filter(({ particle }) => particle.presence >= visibleThreshold)
            .map(({ index }) => index)
        )
      );

    }

    const afterCentroidX = average(next.particles.map((particle) => particle.position.x));
    const afterCentroidY = average(next.particles.map((particle) => particle.position.y));

    expect(Math.abs(afterCentroidX - beforeCentroidX)).toBeLessThan(1.2);
    expect(Math.abs(afterCentroidY - beforeCentroidY)).toBeLessThan(1.2);
    expect(Math.max(...visibleCounts) - Math.min(...visibleCounts)).toBeLessThanOrEqual(6);
    expect(visibleCounts.at(-1)).toBeGreaterThan(initial.particles.length * 0.96);
    const initialVisibleSnapshot = visibleSnapshots[0];
    const addedVisibleMembers = visibleSnapshots
      .slice(1)
      .flatMap((snapshot) => [...snapshot].filter((value) => !initialVisibleSnapshot.has(value)));

    expect(addedVisibleMembers).toHaveLength(0);
  });

  it("lowers presence behind the cursor path and raises it near the moving cursor trail", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 17,
    });
    const state = createAntigravityHeroSimulationState({
      field,
      particleCount: 220,
      seed: 17,
    });
    const pointerState = pointer(708, 264, 1.4, -0.4);

    const next = stepAntigravityHeroSimulationState(state, {
      deltaMs: 16,
      pointer: pointerState,
    });

    const motionLength = Math.hypot(pointerState.vx, pointerState.vy) || 1;
    const directionX = pointerState.vx / motionLength;
    const directionY = pointerState.vy / motionLength;

    const behindCursor = next.particles
      .filter((particle) => {
        const offsetX = particle.position.x - pointerState.x;
        const offsetY = particle.position.y - pointerState.y;
        const projection = offsetX * directionX + offsetY * directionY;
        const trailDistance = Math.abs(offsetX * -directionY + offsetY * directionX);
        return projection < -36 && trailDistance < 180;
      })
      .map((particle) => particle.presence);
    const nearPath = next.particles
      .filter(
        (particle) => {
          const offsetX = particle.position.x - pointerState.x;
          const offsetY = particle.position.y - pointerState.y;
          const projection = offsetX * directionX + offsetY * directionY;
          const trailDistance = Math.abs(offsetX * -directionY + offsetY * directionX);

          return Math.abs(projection) < 84 && trailDistance < 140;
        }
      )
      .map((particle) => particle.presence);
    const beforeBehindCursor = state.particles
      .filter((particle) => {
        const offsetX = particle.position.x - pointerState.x;
        const offsetY = particle.position.y - pointerState.y;
        const projection = offsetX * directionX + offsetY * directionY;
        const trailDistance = Math.abs(offsetX * -directionY + offsetY * directionX);
        return projection < -36 && trailDistance < 180;
      })
      .map((particle) => particle.presence);
    const beforeNearPath = state.particles
      .filter(
        (particle) => {
          const offsetX = particle.position.x - pointerState.x;
          const offsetY = particle.position.y - pointerState.y;
          const projection = offsetX * directionX + offsetY * directionY;
          const trailDistance = Math.abs(offsetX * -directionY + offsetY * directionX);

          return Math.abs(projection) < 84 && trailDistance < 140;
        }
      )
      .map((particle) => particle.presence);

    expect(behindCursor.length).toBeGreaterThan(0);
    expect(nearPath.length).toBeGreaterThan(0);
    expect(average(nearPath) - average(beforeNearPath)).toBeGreaterThan(
      average(behindCursor) - average(beforeBehindCursor)
    );
  });

  it("pushes repelled particles away from the pointer while keeping a route back home", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 21,
    });
    const state = createAntigravityHeroSimulationState({
      field,
      particleCount: 200,
      seed: 21,
    });
    const pointerState = pointer(field.centerX + 84, field.centerY - 28, 0.9, -0.2);

    const next = stepAntigravityHeroSimulationState(state, {
      deltaMs: 16,
      pointer: pointerState,
    });

    const displaced = next.particles
      .map((particle, index) => {
        const before = state.particles[index];
        const beforePointerDistance = Math.hypot(
          before.position.x - pointerState.x,
          before.position.y - pointerState.y
        );
        const afterPointerDistance = Math.hypot(
          particle.position.x - pointerState.x,
          particle.position.y - pointerState.y
        );

        return {
          index,
          pointerDisplacement: afterPointerDistance - beforePointerDistance,
          pointerDistance: beforePointerDistance,
        };
      })
      .filter(({ pointerDistance }) => pointerDistance < 220)
      .sort((left, right) => right.pointerDisplacement - left.pointerDisplacement)
      .slice(0, 16)
      .filter(({ pointerDisplacement }) => pointerDisplacement > 0.02);

    expect(displaced.length).toBeGreaterThan(0);

    const idleRecovery = stepAntigravityHeroSimulationState(next, {
      deltaMs: 16,
      pointer: idlePointer,
    });

    const beforeAttractorDistance = Math.hypot(
      next.attractor.x - next.stage.centerX,
      next.attractor.y - next.stage.centerY
    );
    const afterAttractorDistance = Math.hypot(
      idleRecovery.attractor.x - idleRecovery.stage.centerX,
      idleRecovery.attractor.y - idleRecovery.stage.centerY
    );

    expect(beforeAttractorDistance).toBeGreaterThan(afterAttractorDistance);
  });

  it("shifts the dominant mass toward a far-left pointer and then relaxes back toward the default envelope", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 37,
    });
    let state = createAntigravityHeroSimulationState({
      field,
      particleCount: 220,
      seed: 37,
    });

    const visibleCentroidX = (particles: typeof state.particles) => {
      const visible = particles.filter((particle) => particle.presence >= 0.2);
      const basis = visible.length > 0 ? visible : particles;
      return (
        basis.reduce((sum, particle) => sum + particle.position.x, 0) /
        basis.length
      );
    };

    const before = visibleCentroidX(state.particles);

    for (let index = 0; index < 18; index += 1) {
      state = stepAntigravityHeroSimulationState(state, {
        deltaMs: 16,
        pointer: pointer(120, 340, -1.5, 0),
        scrollProgress: 0.18,
        corridorProgress: 0.1,
        sceneStrength: 0.92,
      });
    }

    const during = visibleCentroidX(state.particles);

    for (let index = 0; index < 24; index += 1) {
      state = stepAntigravityHeroSimulationState(state, {
        deltaMs: 16,
        pointer: idlePointer,
        scrollProgress: 0.18,
        corridorProgress: 0.1,
        sceneStrength: 0.92,
      });
    }

    const after = visibleCentroidX(state.particles);

    expect(before).toBeGreaterThan(field.width * 0.55);
    expect(during).toBeLessThan(before - 250);
    expect(after).toBeGreaterThan(during + 180);
    expect(after).toBeLessThan(before - 60);
  });

  it("uses scroll, corridor, and scene inputs to morph the stage-centered envelope", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 41,
    });

    const createState = () =>
      createAntigravityHeroSimulationState({
        field,
        particleCount: 220,
        seed: 41,
      });

    const averageVisibleY = (particles: ReturnType<typeof createState>["particles"]) => {
      const visible = particles.filter((particle) => particle.presence >= 0.4);
      const basis = visible.length > 0 ? visible : particles;
      return average(basis.map((particle) => particle.position.y));
    };

    const averageVisibleRadius = (
      particles: ReturnType<typeof createState>["particles"],
      centerX: number,
      centerY: number
    ) => {
      const visible = particles.filter((particle) => particle.presence >= 0.2);
      const basis = visible.length > 0 ? visible : particles;
      return average(
        basis.map((particle) =>
          Math.hypot(particle.position.x - centerX, particle.position.y - centerY)
        )
      );
    };

    let neutral = createState();
    let staged = createState();

    for (let index = 0; index < 18; index += 1) {
      neutral = stepAntigravityHeroSimulationState(neutral, {
        deltaMs: 16,
        pointer: idlePointer,
        scrollProgress: 0.06,
        corridorProgress: 0.02,
        sceneStrength: 0.2,
      });
      staged = stepAntigravityHeroSimulationState(staged, {
        deltaMs: 16,
        pointer: idlePointer,
        scrollProgress: 0.74,
        corridorProgress: 0.68,
        sceneStrength: 0.94,
      });
    }

    expect(Math.abs(staged.stage.centerY - neutral.stage.centerY)).toBeGreaterThan(5);
    expect(Math.abs(staged.stage.centerX - neutral.stage.centerX)).toBeGreaterThan(8);
    expect(
      Math.abs(staged.stage.compressionX - neutral.stage.compressionX)
    ).toBeGreaterThan(0.012);
    expect(
      Math.abs(
        averageVisibleRadius(
          staged.particles,
          staged.stage.centerX,
          staged.stage.centerY
        ) -
          averageVisibleRadius(
            neutral.particles,
            neutral.stage.centerX,
            neutral.stage.centerY
          )
      )
    ).toBeGreaterThan(0.5);
    expect(
      Math.abs(averageVisibleY(staged.particles) - averageVisibleY(neutral.particles))
    ).toBeGreaterThan(3.5);
  });

  it("damps the return motion toward the staged home envelope without uncontrolled oscillation", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 29,
    });
    let state = createAntigravityHeroSimulationState({
      field,
      particleCount: 160,
      seed: 29,
    });

    state = stepAntigravityHeroSimulationState(state, {
      deltaMs: 16,
      pointer: pointer(field.centerX + 80, field.centerY - 24, 1.1, 0),
      scrollProgress: 0.22,
      corridorProgress: 0.1,
      sceneStrength: 0.9,
    });

    const distanceToStagedHome = (simulation: typeof state) =>
      average(
        simulation.particles.map((particle) => {
          const stagedHomeX =
            simulation.stage.centerX +
            (particle.homePosition.x - field.centerX) * simulation.stage.compressionX;
          const stagedHomeY =
            simulation.stage.centerY +
            (particle.homePosition.y - field.centerY) * simulation.stage.compressionY;

          return Math.hypot(
            particle.position.x - stagedHomeX,
            particle.position.y - stagedHomeY
          );
        })
      );

    let previousDistance = distanceToStagedHome(state);
    let sawOvershoot = false;

    for (let index = 0; index < 24; index += 1) {
      state = stepAntigravityHeroSimulationState(state, {
        deltaMs: 16,
        pointer: idlePointer,
        scrollProgress: 0.22,
        corridorProgress: 0.1,
        sceneStrength: 0.9,
      });

      const currentDistance = distanceToStagedHome(state);

      if (currentDistance > previousDistance + 6) {
        sawOvershoot = true;
      }

      previousDistance = currentDistance;
    }

    expect(previousDistance).toBeLessThan(40);
    expect(sawOvershoot).toBe(false);
    expect(
      state.particles.every((particle) => Math.hypot(particle.velocity.x, particle.velocity.y) < 16)
    ).toBe(true);
  });

  it("keeps a minority of warm-accent particles inside the dominant cool field", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 37,
    });
    const state = createAntigravityHeroSimulationState({
      field,
      particleCount: 220,
      seed: 37,
    });

    const warmAccent = state.particles.filter(
      (particle) =>
        particle.currentColor.r > 0.34 && particle.currentColor.b < 0.56
    );
    const coolDominant = state.particles.filter(
      (particle) =>
        particle.currentColor.b >= 0.56 || particle.currentColor.b >= particle.currentColor.r
    );

    expect(warmAccent.length).toBeGreaterThan(60);
    expect(coolDominant.length).toBeGreaterThan(100);
    expect(coolDominant.length).toBeGreaterThan(warmAccent.length * 1.12);
  });

  it("advances lifecycle color turnover slowly enough to avoid frame-rate flicker", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 13,
    });
    const state = createAntigravityHeroSimulationState({
      field,
      particleCount: 180,
      seed: 13,
    });

    const next = stepAntigravityHeroSimulationState(state, {
      deltaMs: 16,
      pointer: idlePointer,
    });

    const phaseDeltas = next.particles.map((particle, index) => {
      const before = state.particles[index];
      const rawDelta = particle.presencePhase - before.presencePhase;

      return rawDelta >= 0 ? rawDelta : rawDelta + Math.PI * 2;
    });
    const colorDeltas = next.particles.map((particle, index) =>
      colorDistance(state.particles[index].currentColor, particle.currentColor)
    );

    expect(Math.max(...phaseDeltas)).toBeLessThan(0.02);
    expect(average(colorDeltas)).toBeLessThan(0.001);
    expect(Math.max(...colorDeltas)).toBeLessThan(0.01);
  });
});
