import { CustomerDomainError } from "./errors.js";
import type { BodyProfileMeasurements } from "./body-profile.js";

/**
 * Parametric mannequin specification.
 *
 * IMPORTANT — accuracy: this is a *proportional approximation*, not a scan or an
 * anatomical model. Height, weight and three circumferences cannot determine a
 * person's real shape (posture, muscle/fat distribution, shoulder width, limb
 * lengths are all inferred from population-average ratios). The avatar is meant
 * to give a plausible relative size for garment fitting, nothing more.
 *
 * All lengths are centimetres. Torso rings are elliptical cross-sections
 * (a = half width left-right, b = half depth front-back) lofted bottom to top.
 */
export const AVATAR_GENERATOR_VERSION = 1;

export interface AvatarRing {
  /** Height above the floor. */
  y: number;
  a: number;
  b: number;
}

export interface AvatarParams {
  generatorVersion: number;
  heightCm: number;
  bmi: number;
  head: { radius: number; centerY: number };
  /** Bottom-to-top torso cross-sections (crotch → neck). */
  torsoRings: AvatarRing[];
  arm: {
    shoulderX: number;
    shoulderY: number;
    upperLength: number;
    lowerLength: number;
    upperRadius: number;
    lowerRadius: number;
    handRadius: number;
    /** Outward angle from vertical in degrees (A-pose). */
    abductionDeg: number;
  };
  leg: {
    hipX: number;
    hipY: number;
    thighLength: number;
    shinLength: number;
    thighRadius: number;
    calfRadius: number;
    footLength: number;
    footHeight: number;
  };
}

export interface AvatarDTO {
  params: AvatarParams;
  generatorVersion: number;
  generatedAt: string;
  updatedAt: string;
}

export class AvatarNotFoundError extends CustomerDomainError {
  constructor() {
    super("No avatar found", "AVATAR_NOT_FOUND", 404);
  }
}

export class AvatarGenerationError extends CustomerDomainError {
  constructor(message: string = "Avatar generation failed") {
    super(message, "AVATAR_GENERATION_FAILED", 500);
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Semi-axis `a` of an ellipse with circumference `c` and depth/width ratio `r`
 * (b = r·a), using Ramanujan's circumference approximation.
 */
function semiAxisFromCircumference(c: number, r: number): number {
  const k = Math.PI * (3 * (1 + r) - Math.sqrt((3 + r) * (1 + 3 * r)));
  return c / k;
}

/** Deterministic: the same measurements always produce the same parameters. */
export function computeAvatarParams(m: BodyProfileMeasurements): AvatarParams {
  const H = m.heightCm;
  const bmi = m.weightKg / Math.pow(H / 100, 2);
  // Build factor: −0.4 (slim) … +0.6 (heavy) around BMI 22.
  const build = clamp((bmi - 22) / 10, -0.4, 0.6);
  const s = H / 170; // scale of fixed-size features relative to a 170 cm adult

  // Torso cross-sections from measured circumferences.
  const hipA = semiAxisFromCircumference(m.hipCm, 0.72);
  const waistA = semiAxisFromCircumference(m.waistCm, 0.74);
  const chestA = semiAxisFromCircumference(m.chestCm, 0.7);
  const hip = { a: hipA, b: hipA * 0.72 };
  const waist = { a: waistA, b: waistA * 0.74 };
  const chest = { a: chestA, b: chestA * 0.7 };
  // Shoulders are not measured; inferred from chest.
  const shoulder = { a: chest.a * 1.12, b: chest.b * 0.78 };
  const neckR = (5 + build * 1.5) * s;

  const torsoRings: AvatarRing[] = [
    { y: 0.47 * H, a: hip.a * 0.98, b: hip.b * 0.98 },
    { y: 0.52 * H, a: hip.a, b: hip.b },
    { y: 0.62 * H, a: waist.a, b: waist.b },
    { y: 0.72 * H, a: chest.a, b: chest.b },
    { y: 0.8 * H, a: shoulder.a, b: shoulder.b },
    { y: 0.84 * H, a: shoulder.a * 0.45, b: shoulder.b * 0.7 },
    { y: 0.865 * H, a: neckR, b: neckR },
  ].map((r) => ({ y: round1(r.y), a: round1(r.a), b: round1(r.b) }));

  const headRadius = 0.065 * H;

  return {
    generatorVersion: AVATAR_GENERATOR_VERSION,
    heightCm: round1(H),
    bmi: round1(bmi),
    head: { radius: round1(headRadius), centerY: round1(H - headRadius) },
    torsoRings,
    arm: {
      shoulderX: round1(shoulder.a * 0.92),
      shoulderY: round1(0.8 * H),
      upperLength: round1(0.17 * H),
      lowerLength: round1(0.15 * H),
      upperRadius: round1(3.6 * s * (1 + 0.5 * build)),
      lowerRadius: round1(2.8 * s * (1 + 0.45 * build)),
      handRadius: round1(2.6 * s),
      abductionDeg: 12,
    },
    leg: {
      hipX: round1(hip.a * 0.52),
      hipY: round1(0.47 * H),
      thighLength: round1(0.23 * H),
      shinLength: round1(0.2 * H),
      thighRadius: round1(clamp(hip.a * 0.5, 5, 14)),
      calfRadius: round1(clamp(hip.a * 0.34, 3.5, 9)),
      footLength: round1(0.15 * H),
      footHeight: round1(0.04 * H),
    },
  };
}
