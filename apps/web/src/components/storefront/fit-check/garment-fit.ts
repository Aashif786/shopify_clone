import type { AvatarParams } from "@calcart/customers";

export type GarmentSlot = "top" | "bottom" | "outerwear" | "dress";

export interface GarmentReference {
  heightCm: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
}

export interface GarmentFit {
  /** Scale applied to the garment about the floor point under the body centre (x, y, z). */
  scale: { x: number; y: number; z: number };
}

/** Ramanujan circumference of an ellipse with semi-axes a and b (cm). */
function ellipseCircumference(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/** Girths (cm) recovered from the persisted torso rings: [hip, waist, chest] = rings 1, 2, 3. */
export function avatarGirths(params: AvatarParams): { chestCm: number; waistCm: number; hipCm: number } {
  const ring = (i: number) => {
    const r = params.torsoRings[i]!;
    return ellipseCircumference(r.a, r.b);
  };
  return { hipCm: ring(1), waistCm: ring(2), chestCm: ring(3) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Scales a garment modelled on `reference` (feet at y = 0, centred on x/z = 0) to an avatar.
 *
 * - Vertical scale follows the height ratio.
 * - Width/depth scale follows the girth the garment mainly covers: chest for tops and
 *   outerwear, hips for bottoms, and the average of both for dresses.
 *
 * This is proportional scaling of a rigid model, not cloth simulation or per-region
 * deformation; ratios are clamped so extreme inputs cannot produce absurd garments.
 */
export function computeGarmentFit(
  avatar: AvatarParams,
  reference: GarmentReference,
  slot: GarmentSlot,
): GarmentFit {
  const girths = avatarGirths(avatar);
  const chest = girths.chestCm / reference.chestCm;
  const hip = girths.hipCm / reference.hipCm;
  const width = slot === "bottom" ? hip : slot === "dress" ? (chest + hip) / 2 : chest;

  const y = clamp(avatar.heightCm / reference.heightCm, 0.6, 1.6);
  const xz = clamp(width, 0.6, 1.8);
  return { scale: { x: xz, y, z: xz } };
}
