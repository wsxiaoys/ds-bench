import { describe, it, expect } from "vitest";

function roundHalfAway(val: number, decimals: number = 3): number {
  const p = Math.pow(10, decimals);
  const sign = Math.sign(val);
  const absVal = Math.abs(val);
  const rounded = Math.round((absVal + Number.EPSILON) * p);
  return (sign * rounded) / p;
}

describe("roundHalfAway", () => {
  it("rounds positive numbers half away from zero", () => {
    expect(roundHalfAway(1.0005, 3)).toBe(1.001);
    expect(roundHalfAway(1.0004, 3)).toBe(1.000);
    expect(roundHalfAway(0.1425, 3)).toBe(0.143);
    expect(roundHalfAway(0.1424, 3)).toBe(0.142);
    expect(roundHalfAway(0.5, 0)).toBe(1);
    expect(roundHalfAway(1.5, 0)).toBe(2);
  });

  it("rounds negative numbers half away from zero", () => {
    expect(roundHalfAway(-1.0005, 3)).toBe(-1.001);
    expect(roundHalfAway(-1.0004, 3)).toBe(-1.000);
    expect(roundHalfAway(-0.1425, 3)).toBe(-0.143);
    expect(roundHalfAway(-0.1424, 3)).toBe(-0.142);
    expect(roundHalfAway(-0.5, 0)).toBe(-1);
    expect(roundHalfAway(-1.5, 0)).toBe(-2);
  });
});
