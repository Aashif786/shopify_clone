import * as THREE from "three";
import type { AvatarParams, AvatarRing } from "@calcart/customers";

const CM = 0.01; // avatar params are centimetres, the scene is in metres
const TORSO_SAMPLES = 36;
const TORSO_SEGMENTS = 40;

/** Smoothly lofts the elliptical torso cross-sections (Catmull–Rom through a, y, b). */
export function buildTorsoGeometry(rings: AvatarRing[]): THREE.BufferGeometry {
  const sorted = [...rings].sort((p, q) => p.y - q.y);
  const curve = new THREE.CatmullRomCurve3(
    sorted.map((r) => new THREE.Vector3(r.a * CM, r.y * CM, r.b * CM)),
    false,
    "centripetal",
  );
  const samples = curve.getSpacedPoints(TORSO_SAMPLES);

  const positions: number[] = [];
  const indices: number[] = [];
  for (const p of samples) {
    for (let j = 0; j < TORSO_SEGMENTS; j++) {
      const t = (j / TORSO_SEGMENTS) * Math.PI * 2;
      positions.push(Math.cos(t) * p.x, p.y, Math.sin(t) * p.z);
    }
  }
  for (let i = 0; i < TORSO_SAMPLES; i++) {
    for (let j = 0; j < TORSO_SEGMENTS; j++) {
      const a = i * TORSO_SEGMENTS + j;
      const b = i * TORSO_SEGMENTS + ((j + 1) % TORSO_SEGMENTS);
      const c = (i + 1) * TORSO_SEGMENTS + j;
      const d = (i + 1) * TORSO_SEGMENTS + ((j + 1) % TORSO_SEGMENTS);
      indices.push(a, c, b, b, c, d);
    }
  }

  // Close the bottom and top.
  for (const [ringIndex, flip] of [
    [0, true],
    [TORSO_SAMPLES, false],
  ] as const) {
    const center = positions.length / 3;
    const y = samples[ringIndex]!.y;
    positions.push(0, y, 0);
    for (let j = 0; j < TORSO_SEGMENTS; j++) {
      const a = ringIndex * TORSO_SEGMENTS + j;
      const b = ringIndex * TORSO_SEGMENTS + ((j + 1) % TORSO_SEGMENTS);
      if (flip) indices.push(center, b, a);
      else indices.push(center, a, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface TorsoProfile {
  /** Half-widths (metres) of the avatar's torso cross-section at height y (metres). */
  at(y: number): { a: number; b: number };
  yMin: number;
  yMax: number;
}

/**
 * The exact outline the avatar torso mesh is lofted from, as a lookup by height. Garments use it so
 * they wrap the same shape the customer's avatar has.
 */
export function sampleTorsoProfile(rings: AvatarRing[]): TorsoProfile {
  const sorted = [...rings].sort((p, q) => p.y - q.y);
  const curve = new THREE.CatmullRomCurve3(
    sorted.map((r) => new THREE.Vector3(r.a * CM, r.y * CM, r.b * CM)),
    false,
    "centripetal",
  );
  const pts = curve.getSpacedPoints(200).sort((p, q) => p.y - q.y);
  const yMin = pts[0]!.y;
  const yMax = pts[pts.length - 1]!.y;
  return {
    yMin,
    yMax,
    at(y: number) {
      if (y <= yMin) return { a: pts[0]!.x, b: pts[0]!.z };
      if (y >= yMax) return { a: pts[pts.length - 1]!.x, b: pts[pts.length - 1]!.z };
      let lo = 0;
      let hi = pts.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (pts[mid]!.y <= y) lo = mid;
        else hi = mid;
      }
      const p0 = pts[lo]!;
      const p1 = pts[hi]!;
      const t = p1.y === p0.y ? 0 : (y - p0.y) / (p1.y - p0.y);
      return { a: p0.x + (p1.x - p0.x) * t, b: p0.z + (p1.z - p0.z) * t };
    },
  };
}

function limb(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const dist = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(dist - 2 * radius, 0.001), 6, 14),
    material,
  );
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

/**
 * Builds the mannequin as a Group (feet on y = 0, facing +z) from persisted parameters.
 * The returned group owns its geometries and material; call `disposeObject` to free them.
 */
export function buildAvatarGroup(params: AvatarParams, color = 0xc9ccd1): THREE.Group {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02 });
  const group = new THREE.Group();
  group.name = "avatar";

  group.add(new THREE.Mesh(buildTorsoGeometry(params.torsoRings), material));

  const head = new THREE.Mesh(new THREE.SphereGeometry(params.head.radius * CM, 32, 24), material);
  head.scale.set(0.86, 1.08, 0.95);
  head.position.set(0, params.head.centerY * CM, params.head.radius * CM * 0.05);
  group.add(head);

  const { arm, leg } = params;
  const abduct = (arm.abductionDeg * Math.PI) / 180;
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Vector3(side * arm.shoulderX * CM, arm.shoulderY * CM, 0);
    const dir = new THREE.Vector3(side * Math.sin(abduct), -Math.cos(abduct), 0.02).normalize();
    const elbow = shoulder.clone().addScaledVector(dir, arm.upperLength * CM);
    const wrist = elbow.clone().addScaledVector(dir, arm.lowerLength * CM);
    group.add(limb(shoulder, elbow, arm.upperRadius * CM, material));
    group.add(limb(elbow, wrist, arm.lowerRadius * CM, material));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(arm.handRadius * CM, 16, 12), material);
    hand.scale.set(0.8, 1.35, 0.7);
    hand.position.copy(wrist).addScaledVector(dir, arm.handRadius * CM * 0.9);
    group.add(hand);

    const hip = new THREE.Vector3(side * leg.hipX * CM, leg.hipY * CM, 0);
    const knee = hip.clone().add(new THREE.Vector3(side * 0.01, -leg.thighLength * CM, 0.01));
    const ankle = knee.clone().add(new THREE.Vector3(side * 0.005, -leg.shinLength * CM, -0.005));
    // Start the thigh inside the pelvis so no gap shows at the crotch.
    const hipTop = hip.clone().add(new THREE.Vector3(0, leg.thighRadius * CM * 1.1, 0));
    group.add(limb(hipTop, knee, leg.thighRadius * CM, material));
    group.add(limb(knee, ankle, leg.calfRadius * CM, material));
    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material);
    foot.scale.set(leg.calfRadius * CM * 1.1, leg.footHeight * CM * 0.6, leg.footLength * CM * 0.5);
    foot.position.set(ankle.x, leg.footHeight * CM * 0.55, leg.footLength * CM * 0.22);
    group.add(foot);
  }

  group.userData.heightM = params.heightCm * CM;
  return group;
}

/** Frees GPU resources for everything under `root`. */
export function disposeObject(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => materials.add(m));
    else if (mat) materials.add(mat);
  });
  materials.forEach((m) => m.dispose());
}
