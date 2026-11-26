import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AvatarParams } from "@calcart/customers";
import { sampleTorsoProfile, type TorsoProfile } from "./avatar-geometry";

export type GeneratedTemplate = "tshirt" | "longsleeve" | "jacket" | "trousers" | "shorts";
export type GeneratedFit = "slim" | "regular" | "loose";

const CM = 0.01;
const SEGMENTS = 40;

/** Looseness (cm of clearance around the body) per fit. */
const FIT_EASE_CM: Record<GeneratedFit, number> = { slim: 0.7, regular: 1.6, loose: 3.2 };
/** Extra clearance so layered garments never z-fight with the body or each other. */
const LAYER_CM: Record<GeneratedTemplate, number> = {
  tshirt: 0.6,
  longsleeve: 0.6,
  jacket: 1.6,
  trousers: 0.2,
  shorts: 0.2,
};

/**
 * How a garment's photo and colour are applied. `frontU` is the right edge (0–1) of the photo region
 * in the texture; `solidU` is a u coordinate inside the flat-colour strip used for the back.
 */
export interface GarmentSkin {
  map: THREE.Texture | null;
  frontU: number;
  solidU: number;
  color: [number, number, number];
}

export const DEFAULT_SKIN: GarmentSkin = { map: null, frontU: 1, solidU: 1, color: [107, 122, 153] };

/** Open, tapered tube between two points, radius given as a function of t ∈ [0, 1]. */
function taperedTube(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radiusAt: (t: number) => number,
  rings = 8,
): THREE.BufferGeometry {
  const axis = new THREE.Vector3().subVectors(to, from);
  const length = axis.length();
  const dir = axis.clone().normalize();
  const helper = Math.abs(dir.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, helper).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();

  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const center = from.clone().addScaledVector(dir, length * t);
    const r = radiusAt(t);
    for (let j = 0; j < SEGMENTS; j++) {
      const ang = (j / SEGMENTS) * Math.PI * 2;
      const p = center.clone().addScaledVector(u, Math.cos(ang) * r).addScaledVector(v, Math.sin(ang) * r);
      positions.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = i * SEGMENTS + j;
      const b = i * SEGMENTS + ((j + 1) % SEGMENTS);
      const c = (i + 1) * SEGMENTS + j;
      const d = (i + 1) * SEGMENTS + ((j + 1) % SEGMENTS);
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Open shell following the avatar torso outline from y0 up to y1, offset outward by `off`. */
function torsoShell(
  profile: TorsoProfile,
  y0: number,
  y1: number,
  off: number,
  topScale = 1,
  rows = 30,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const y = y0 + (y1 - y0) * t;
    const { a, b } = profile.at(y);
    // Narrow slightly towards the neckline so the collar hugs the neck.
    const k = i === rows ? topScale : 1;
    for (let j = 0; j < SEGMENTS; j++) {
      const ang = (j / SEGMENTS) * Math.PI * 2;
      positions.push(Math.cos(ang) * (a * k + off), y, Math.sin(ang) * (b * k + off));
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a0 = i * SEGMENTS + j;
      const b0 = i * SEGMENTS + ((j + 1) % SEGMENTS);
      const c0 = (i + 1) * SEGMENTS + j;
      const d0 = (i + 1) * SEGMENTS + ((j + 1) % SEGMENTS);
      indices.push(a0, c0, b0, b0, c0, d0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * Builds a garment that wraps this specific avatar. Every dimension is derived from the avatar's own
 * cross-sections and limb sizes, so the garment follows whatever body shape the customer entered —
 * it is not scaled from a fixed model. Feet at y = 0, facing +z, like the avatar.
 *
 * The cut (collar, hem, sleeve length) comes from the template; the look comes from the skin built
 * from the merchant's product photo. Colour/print appear only where the photo shows them on the front.
 */
export function buildGeneratedGarment(
  avatar: AvatarParams,
  template: GeneratedTemplate,
  fit: GeneratedFit,
  skin: GarmentSkin = DEFAULT_SKIN,
): THREE.Group {
  const profile = sampleTorsoProfile(avatar.torsoRings);
  const H = avatar.heightCm * CM;
  const off = (FIT_EASE_CM[fit] + LAYER_CM[template] + (template === "jacket" ? 0.8 : 0)) * CM;
  const { arm, leg } = avatar;
  const parts: THREE.BufferGeometry[] = [];

  const isTop = template === "tshirt" || template === "longsleeve" || template === "jacket";

  if (isTop) {
    const hemY = (template === "jacket" ? 0.45 : 0.5) * H;
    const neckY = profile.yMax;
    parts.push(torsoShell(profile, hemY, neckY, off, 1.05));

    const abduct = (arm.abductionDeg * Math.PI) / 180;
    const longSleeve = template !== "tshirt";
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Vector3(side * arm.shoulderX * CM, arm.shoulderY * CM, 0);
      const dir = new THREE.Vector3(side * Math.sin(abduct), -Math.cos(abduct), 0.02).normalize();
      const upper = arm.upperLength * CM;
      const lower = arm.lowerLength * CM;
      const upperR = arm.upperRadius * CM;
      const lowerR = arm.lowerRadius * CM;
      // Start inside the shoulder so no seam shows between torso shell and sleeve.
      const start = shoulder.clone().addScaledVector(dir, -upperR * 0.9);
      const length = longSleeve ? upper + lower * 0.97 : upper * 0.55;
      const end = shoulder.clone().addScaledVector(dir, length);
      const startOffset = shoulder.distanceTo(start);
      const span = startOffset + length;
      // Upper-arm radius easing into the forearm radius along the sleeve.
      const radiusAt = (t: number) => {
        const along = Math.max(0, t * span - startOffset);
        const k = Math.min(Math.max((along - upper * 0.5) / (upper * 0.5 + lower * 0.5), 0), 1);
        return upperR + (lowerR - upperR) * k + off;
      };
      parts.push(taperedTube(start, end, radiusAt, longSleeve ? 14 : 8));
    }
  } else {
    const waistY = 0.6 * H;
    parts.push(torsoShell(profile, leg.hipY * CM - 0.02, waistY, off, 1));

    for (const side of [-1, 1]) {
      const hip = new THREE.Vector3(side * leg.hipX * CM, leg.hipY * CM, 0);
      const thigh = leg.thighLength * CM;
      const shin = leg.shinLength * CM;
      const thighR = leg.thighRadius * CM;
      const calfR = leg.calfRadius * CM;
      const knee = hip.clone().add(new THREE.Vector3(side * 0.01, -thigh, 0.01));
      const ankle = knee.clone().add(new THREE.Vector3(side * 0.005, -shin, -0.005));
      const top = hip.clone().add(new THREE.Vector3(0, thighR * 1.1, 0));

      if (template === "shorts") {
        const end = hip.clone().lerp(knee, 0.55);
        parts.push(taperedTube(top, end, (t) => thighR * (1 - 0.1 * t) + off, 8));
      } else {
        parts.push(taperedTube(top, knee, (t) => thighR * (1 - 0.22 * t) + off, 10));
        parts.push(taperedTube(knee, ankle, (t) => calfR * (1.02 - 0.2 * t) + off, 10));
      }
    }
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("Could not build garment geometry");

  const geometry = applyPlanarSkin(merged, skin);
  const material = new THREE.MeshStandardMaterial({
    map: skin.map ?? null,
    color: skin.map ? 0xffffff : new THREE.Color(skin.color[0] / 255, skin.color[1] / 255, skin.color[2] / 255),
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.name = "garment";
  group.add(mesh);
  return group;
}

/**
 * Front-projects the photo over the garment's bounding box. Triangles on the front of the body get the
 * photo; the rest get the flat colour strip. UVs are assigned per triangle (non-indexed) so the photo
 * never smears across the front/back boundary.
 */
function applyPlanarSkin(indexed: THREE.BufferGeometry, skin: GarmentSkin): THREE.BufferGeometry {
  indexed.computeBoundingBox();
  const box = indexed.boundingBox!;
  const width = Math.max(box.max.x - box.min.x, 1e-6);
  const height = Math.max(box.max.y - box.min.y, 1e-6);

  const g = indexed.toNonIndexed();
  indexed.dispose();
  const pos = g.getAttribute("position");
  const uvs = new Float32Array(pos.count * 2);
  for (let tri = 0; tri < pos.count; tri += 3) {
    const cz = (pos.getZ(tri) + pos.getZ(tri + 1) + pos.getZ(tri + 2)) / 3;
    const front = cz >= 0;
    for (let k = 0; k < 3; k++) {
      const i = tri + k;
      if (front) {
        uvs[i * 2] = ((pos.getX(i) - box.min.x) / width) * skin.frontU;
        uvs[i * 2 + 1] = (pos.getY(i) - box.min.y) / height;
      } else {
        uvs[i * 2] = skin.solidU;
        uvs[i * 2 + 1] = 0.5;
      }
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return g;
}
