import { describe, expect, it } from "vitest";

import {
  buildAntigravityHeroField,
  sampleAntigravityHeroFieldPoints,
} from "../components/welcome/antigravityHeroField";

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

describe("antigravityHeroField", () => {
  it("builds a right-leaning broken-arc field with occupancy, shape, color, and lifecycle metadata", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 17,
    });

    expect(field).toMatchObject({
      centerX: expect.any(Number),
      centerY: expect.any(Number),
      occupancy: expect.any(Object),
      shapeBias: expect.any(Object),
      colorBias: expect.any(Object),
      lifecycleAllowance: expect.any(Object),
    });

    expect(field.centerX).toBeGreaterThan(field.width * 0.36);
    expect(field.centerX).toBeLessThan(field.width * 0.44);
    expect(field.centerY).toBeGreaterThan(field.height * 0.4);
    expect(field.centerY).toBeLessThan(field.height * 0.46);
    expect(field.occupancy.core).toBeGreaterThan(field.occupancy.outer);
    expect(field.shapeBias.brokenArc).toBeGreaterThan(field.shapeBias.rightHeavy);
    expect(field.colorBias.warm).toBeGreaterThan(field.colorBias.cool);
    expect(field.lifecycleAllowance.turnover).toBeGreaterThan(field.lifecycleAllowance.inner);
  });

  it("samples a full-screen field with a readable center corridor and a right-leading broken arc", () => {
    const field = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 23,
    });
    const points = sampleAntigravityHeroFieldPoints(field, 320);

    expect(points).toHaveLength(320);

    const centroid = points.reduce(
      (accumulator, point) => {
        accumulator.x += point.x;
        accumulator.y += point.y;
        return accumulator;
      },
      { x: 0, y: 0 }
    );

    centroid.x /= points.length;
    centroid.y /= points.length;

    expect(centroid.x).toBeGreaterThan(field.width * 0.5);
    expect(centroid.x).toBeLessThan(field.width * 0.7);
    expect(centroid.y).toBeGreaterThan(field.height * 0.47);
    expect(centroid.y).toBeLessThan(field.height * 0.55);
    expect(points.every((point) => point.fieldTag === field.id)).toBe(true);
    expect(Math.min(...points.map((point) => point.x))).toBeLessThan(field.width * 0.08);
    expect(Math.max(...points.map((point) => point.x))).toBeGreaterThan(field.width * 0.94);
    expect(Math.min(...points.map((point) => point.y))).toBeLessThan(field.height * 0.06);
    expect(Math.max(...points.map((point) => point.y))).toBeGreaterThan(field.height * 0.92);

    const rounded = (value: number) => value.toFixed(3);
    expect(new Set(points.map((point) => rounded(point.occupancy))).size).toBeGreaterThan(20);
    expect(new Set(points.map((point) => rounded(point.shapeBias))).size).toBeGreaterThan(20);
    expect(new Set(points.map((point) => rounded(point.colorBias))).size).toBeGreaterThan(20);
    expect(new Set(points.map((point) => rounded(point.lifecycleAllowance))).size).toBeGreaterThan(20);

    const centerPocketCount = points.filter(
      (point) =>
        Math.abs(point.x - field.width * 0.5) < field.width * 0.11 &&
        Math.abs(point.y - field.height * 0.5) < field.height * 0.11
    ).length;
    const leftHalfCount = points.filter((point) => point.x < field.width * 0.5).length;
    const rightHalfCount = points.length - leftHalfCount;
    const farRightCount = points.filter((point) => point.x > field.width * 0.8).length;
    const upperRightCount = points.filter(
      (point) => point.x > field.width * 0.55 && point.y < field.height * 0.42
    ).length;
    const lowerRightCount = points.filter(
      (point) => point.x > field.width * 0.55 && point.y > field.height * 0.58
    ).length;

    expect(centerPocketCount).toBeGreaterThan(points.length * 0.045);
    expect(centerPocketCount).toBeLessThan(points.length * 0.075);
    expect(leftHalfCount).toBeGreaterThan(points.length * 0.35);
    expect(rightHalfCount).toBeGreaterThan(leftHalfCount * 1.08);
    expect(farRightCount).toBeGreaterThan(points.length * 0.18);
    expect(upperRightCount).toBeGreaterThan(points.length * 0.15);
    expect(lowerRightCount).toBeGreaterThan(points.length * 0.15);
    expect(points.some((point) => point.colorBias > 0.7)).toBe(true);
    expect(points.some((point) => point.shapeBias > 0.5)).toBe(true);
  });

  it("lets the public reduced-motion path retune the broken arc without collapsing it", () => {
    const relaxed = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: false,
      seed: 31,
    });
    const reduced = buildAntigravityHeroField({
      width: 960,
      height: 640,
      reducedMotion: true,
      seed: 31,
    });

    const averagePointValue = (
      points: ReturnType<typeof sampleAntigravityHeroFieldPoints>,
      key: "occupancy" | "shapeBias" | "lifecycleAllowance"
    ) => points.reduce((sum, point) => sum + point[key], 0) / points.length;

    const averageRadius = (
      field: ReturnType<typeof buildAntigravityHeroField>,
      points: ReturnType<typeof sampleAntigravityHeroFieldPoints>
    ) =>
      average(
        points.map((point) =>
          Math.hypot(
            (point.x - field.centerX) / (field.width * 0.34),
            (point.y - field.centerY) / (field.height * 0.28)
          )
        )
      );

    const relaxedPoints = sampleAntigravityHeroFieldPoints(relaxed, 192);
    const reducedPoints = sampleAntigravityHeroFieldPoints(reduced, 192);
    const relaxedCentroidX = average(relaxedPoints.map((point) => point.x));
    const reducedCentroidX = average(reducedPoints.map((point) => point.x));

    expect(reducedPoints).not.toEqual(relaxedPoints);
    expect(
      Math.abs(
        averagePointValue(reducedPoints, "lifecycleAllowance") -
          averagePointValue(relaxedPoints, "lifecycleAllowance")
      )
    ).toBeGreaterThan(0.001);
    expect(
      Math.abs(
        averagePointValue(reducedPoints, "occupancy") -
          averagePointValue(relaxedPoints, "occupancy")
      )
    ).toBeGreaterThan(0.002);
    expect(
      Math.abs(
        averagePointValue(reducedPoints, "shapeBias") -
          averagePointValue(relaxedPoints, "shapeBias")
      )
    ).toBeGreaterThan(0.005);
    expect(
      Math.abs(averageRadius(reduced, reducedPoints) - averageRadius(relaxed, relaxedPoints))
    ).toBeGreaterThan(0.01);
    expect(reducedCentroidX).toBeGreaterThan(reduced.width * 0.52);
    expect(reducedCentroidX).toBeLessThan(reduced.width * 0.68);
    expect(relaxedCentroidX).toBeGreaterThan(relaxed.width * 0.52);
    expect(relaxedCentroidX).toBeLessThan(relaxed.width * 0.68);
  });
});
