import { describe, expect, it } from "vitest";
// three is a dependency of apps/web only, so resolve it from there.
import * as THREE from "../apps/web/node_modules/three/build/three.module.js";
import { computeAvatarParams } from "@calcart/customers";
import {
  buildAvatarGroup,
  buildTorsoGeometry,
  disposeObject,
} from "../apps/web/src/components/storefront/fit-check/avatar-geometry";

const BASE = { heightCm: 170, weightKg: 65, chestCm: 90, waistCm: 74, hipCm: 96 };

describe("Fit Check parametric avatar", () => {
  it("is deterministic for identical measurements", () => {
    expect(computeAvatarParams(BASE)).toEqual(computeAvatarParams({ ...BASE }));
  });

  it("scales with height and circumferences", () => {
    const tall = computeAvatarParams({ ...BASE, heightCm: 190 });
    const short = computeAvatarParams({ ...BASE, heightCm: 150 });
    expect(tall.head.centerY).toBeGreaterThan(short.head.centerY);
    expect(tall.leg.thighLength).toBeGreaterThan(short.leg.thighLength);

    const wide = computeAvatarParams({ ...BASE, waistCm: 110 });
    const narrow = computeAvatarParams({ ...BASE, waistCm: 60 });
    const waistOf = (p: ReturnType<typeof computeAvatarParams>) => p.torsoRings[2]!;
    expect(waistOf(wide).a).toBeGreaterThan(waistOf(narrow).a);
    expect(waistOf(wide).b).toBeGreaterThan(waistOf(narrow).b);
  });

  it("recovers the measured circumference from the ring ellipse", () => {
    const p = computeAvatarParams(BASE);
    const { a, b } = p.torsoRings[3]!; // chest ring
    const circumference =
      Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    expect(circumference).toBeCloseTo(BASE.chestCm, 0);
  });

  it("makes heavier builds thicker in the limbs", () => {
    const light = computeAvatarParams({ ...BASE, weightKg: 50 });
    const heavy = computeAvatarParams({ ...BASE, weightKg: 110 });
    expect(heavy.arm.upperRadius).toBeGreaterThan(light.arm.upperRadius);
    expect(heavy.bmi).toBeGreaterThan(light.bmi);
  });

  it("keeps rings ordered bottom to top and within the body height", () => {
    const p = computeAvatarParams(BASE);
    const ys = p.torsoRings.map((r) => r.y);
    expect([...ys].sort((x, y) => x - y)).toEqual(ys);
    expect(ys[ys.length - 1]!).toBeLessThan(p.heightCm);
  });

  it("builds a valid mannequin whose bounds match the requested height", () => {
    const p = computeAvatarParams(BASE);
    const group = buildAvatarGroup(p);
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.02);
    expect(box.max.y).toBeCloseTo(p.heightCm / 100, 1);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) {
        const pos = mesh.geometry.getAttribute("position");
        for (let i = 0; i < pos.array.length; i++) {
          expect(Number.isFinite(pos.array[i])).toBe(true);
        }
      }
    });
    disposeObject(group);
  });

  it("lofts a closed torso with normals", () => {
    const g = buildTorsoGeometry(computeAvatarParams(BASE).torsoRings);
    expect(g.getAttribute("normal").count).toBe(g.getAttribute("position").count);
    expect(g.getIndex()!.count % 3).toBe(0);
  });
});
