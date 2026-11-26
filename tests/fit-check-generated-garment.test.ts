import { describe, expect, it } from "vitest";
import * as THREE from "../apps/web/node_modules/three/build/three.module.js";
import { computeAvatarParams } from "@calcart/customers";
import {
  analyzeGarmentPixels,
  composeGarmentPixels,
} from "../apps/web/src/components/storefront/fit-check/garment-image";
import { sampleTorsoProfile } from "../apps/web/src/components/storefront/fit-check/avatar-geometry";
import {
  buildGeneratedGarment,
  type GarmentSkin,
} from "../apps/web/src/components/storefront/fit-check/generated-garment";

type Body = Parameters<typeof computeAvatarParams>[0];
const BODIES: Record<string, Body> = {
  slim: { heightCm: 165, weightKg: 52, chestCm: 84, waistCm: 66, hipCm: 90 },
  average: { heightCm: 176, weightKg: 72, chestCm: 98, waistCm: 82, hipCm: 100 },
  broad: { heightCm: 182, weightKg: 98, chestCm: 118, waistCm: 108, hipCm: 114 },
};

function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y);
      data.set([r, g, b, a], (y * w + x) * 4);
    }
  }
  return data;
}

describe("product photo analysis", () => {
  const inRect = (x: number, y: number) => x >= 20 && x < 80 && y >= 30 && y < 90;

  it("finds a garment on a plain background and its dominant colour", () => {
    const data = image(100, 100, (x, y) => (inRect(x, y) ? [200, 30, 40, 255] : [250, 250, 250, 255]));
    const a = analyzeGarmentPixels(data, 100, 100);
    expect(a.bbox).toEqual({ x0: 20, y0: 30, x1: 80, y1: 90 });
    expect(a.dominant).toEqual([200, 30, 40]);
    expect(a.backgroundFound).toBe(true);
    expect(a.hasAlpha).toBe(false);
    expect(a.coverage).toBeCloseTo(0.36, 2);
  });

  it("uses transparency when the photo has a cut-out background", () => {
    const data = image(100, 100, (x, y) => (inRect(x, y) ? [20, 90, 200, 255] : [0, 0, 0, 0]));
    const a = analyzeGarmentPixels(data, 100, 100);
    expect(a.hasAlpha).toBe(true);
    expect(a.bbox).toEqual({ x0: 20, y0: 30, x1: 80, y1: 90 });
    expect(a.dominant).toEqual([20, 90, 200]);
  });

  it("flags photos without a plain background instead of guessing", () => {
    const data = image(100, 100, (x, y) => [(x * 37) % 256, (y * 91) % 256, ((x + y) * 53) % 256, 255]);
    const a = analyzeGarmentPixels(data, 100, 100);
    expect(a.backgroundFound).toBe(false);
    expect(a.bbox).toEqual({ x0: 0, y0: 0, x1: 100, y1: 100 });
  });

  it("keeps background-coloured details enclosed by the garment (stripes, logos)", () => {
    // Red garment with a white stripe that touches neither edge of the garment.
    const paint = (x: number, y: number): [number, number, number, number] => {
      if (!inRect(x, y)) return [255, 255, 255, 255];
      if (y >= 55 && y < 60 && x >= 30 && x < 70) return [255, 255, 255, 255]; // enclosed white stripe
      return [200, 30, 40, 255];
    };
    const data = image(100, 100, paint);
    const a = analyzeGarmentPixels(data, 100, 100);
    expect(a.bbox).toEqual({ x0: 20, y0: 30, x1: 80, y1: 90 });
    const out = composeGarmentPixels(data, 100, a);
    const at = (x: number, y: number) => [...out.pixels.slice((y * out.width + x) * 4, (y * out.width + x) * 4 + 3)];
    // stripe pixel (garment coords x=30-20, y=57-30) stays white; plain garment stays red
    expect(at(15, 27)).toEqual([255, 255, 255]);
    expect(at(2, 2)).toEqual([200, 30, 40]);
  });

  it("crops to the garment and fills background gaps with the garment colour", () => {
    // A "t-shirt": body rect with a background notch cut into it.
    const paint = (x: number, y: number): [number, number, number, number] => {
      if (!inRect(x, y)) return [255, 255, 255, 255];
      if (x < 30 && y < 40) return [255, 255, 255, 255]; // gap under a sleeve
      return [10, 120, 60, 255];
    };
    const data = image(100, 100, paint);
    const a = analyzeGarmentPixels(data, 100, 100);
    const out = composeGarmentPixels(data, 100, a);
    expect(out.width).toBe(60);
    expect(out.height).toBe(60);
    // top-left corner of the crop was background: now the garment colour, fully opaque
    expect([...out.pixels.slice(0, 4)]).toEqual([10, 120, 60, 255]);
  });
});

describe("generated garments conform to the avatar's body", () => {
  const verts = (group: THREE.Group): THREE.Vector3[] => {
    const out: THREE.Vector3[] = [];
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    });
    return out;
  };

  it.each(Object.entries(BODIES))("wraps the torso without intersecting it (%s)", (_name, body) => {
    const avatar = computeAvatarParams(body);
    const profile = sampleTorsoProfile(avatar.torsoRings);
    const H = avatar.heightCm / 100;
    for (const template of ["tshirt", "longsleeve", "jacket"] as const) {
      const garment = buildGeneratedGarment(avatar, template, "regular");
      // Below the armpit (arms are clear of the torso) and, higher up, the front/back of the chest
      // (sleeve tubes legitimately overlap the torso at the shoulder, as the avatar's arms do).
      const torso = verts(garment).filter((v) => {
        if (v.y <= 0.52 * H || v.y >= 0.72 * H) return false;
        if (v.y < 0.64 * H) return true;
        return Math.abs(v.x) < 0.6 * profile.at(v.y).a;
      });
      expect(torso.length).toBeGreaterThan(50);
      for (const v of torso) {
        const { a, b } = profile.at(v.y);
        // Every garment vertex lies outside the avatar's torso cross-section at that height.
        expect((v.x / a) ** 2 + (v.z / b) ** 2).toBeGreaterThan(0.99);
      }
    }
  });

  it("is wider on a broader body and follows height", () => {
    const widthAt = (body: Body) => {
      const avatar = computeAvatarParams(body);
      const g = buildGeneratedGarment(avatar, "tshirt", "regular");
      g.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(g);
    };
    const slim = widthAt(BODIES.slim!);
    const broad = widthAt(BODIES.broad!);
    expect(broad.max.x - broad.min.x).toBeGreaterThan((slim.max.x - slim.min.x) * 1.1);
    expect(broad.max.y).toBeGreaterThan(slim.max.y);
  });

  it("loose fit is bigger than slim fit on the same body", () => {
    const avatar = computeAvatarParams(BODIES.average!);
    const size = (fit: "slim" | "loose") => {
      const b = new THREE.Box3().setFromObject(buildGeneratedGarment(avatar, "tshirt", fit));
      return b.max.z - b.min.z;
    };
    expect(size("loose")).toBeGreaterThan(size("slim"));
  });

  it("builds tops from neck to hem and bottoms from waist to ankle", () => {
    const avatar = computeAvatarParams(BODIES.average!);
    const H = avatar.heightCm / 100;
    const top = new THREE.Box3().setFromObject(buildGeneratedGarment(avatar, "tshirt", "regular"));
    expect(top.max.y).toBeGreaterThan(0.84 * H);
    expect(top.min.y).toBeGreaterThan(0.4 * H);

    const trousers = new THREE.Box3().setFromObject(buildGeneratedGarment(avatar, "trousers", "regular"));
    const shorts = new THREE.Box3().setFromObject(buildGeneratedGarment(avatar, "shorts", "regular"));
    expect(trousers.max.y).toBeLessThan(0.7 * H);
    expect(trousers.min.y).toBeLessThan(0.1 * H);
    expect(shorts.min.y).toBeGreaterThan(0.2 * H);
  });

  it("sleeve length follows the template", () => {
    const avatar = computeAvatarParams(BODIES.average!);
    const lowest = (t: "tshirt" | "longsleeve") => {
      // Outermost vertices only (the sleeves), not the torso.
      const v = verts(buildGeneratedGarment(avatar, t, "regular")).filter(
        (p) => Math.abs(p.x) > avatar.arm.shoulderX / 100 + 0.02,
      );
      return Math.min(...v.map((p) => p.y));
    };
    expect(lowest("longsleeve")).toBeLessThan(lowest("tshirt") - 0.1);
  });

  it("projects the photo on the front and a flat colour on the back", () => {
    const avatar = computeAvatarParams(BODIES.average!);
    const skin: GarmentSkin = { map: null, frontU: 0.9, solidU: 0.95, color: [10, 20, 30] };
    const garment = buildGeneratedGarment(avatar, "tshirt", "regular", skin);
    const mesh = garment.children[0] as THREE.Mesh;
    const pos = mesh.geometry.getAttribute("position");
    const uv = mesh.geometry.getAttribute("uv");
    let front = 0;
    let back = 0;
    for (let tri = 0; tri < pos.count; tri += 3) {
      const cz = (pos.getZ(tri) + pos.getZ(tri + 1) + pos.getZ(tri + 2)) / 3;
      const us = [0, 1, 2].map((k) => uv.getX(tri + k));
      if (cz >= 0) {
        front++;
        expect(Math.max(...us)).toBeLessThanOrEqual(0.9 + 1e-6);
      } else {
        back++;
        expect(us.every((u) => Math.abs(u - 0.95) < 1e-6)).toBe(true);
      }
    }
    expect(front).toBeGreaterThan(100);
    expect(back).toBeGreaterThan(100);
  });

  it("uses a flat colour when no photo skin is available", () => {
    const avatar = computeAvatarParams(BODIES.average!);
    const mesh = buildGeneratedGarment(avatar, "trousers", "slim").children[0] as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.map).toBeNull();
    expect(material.side).toBe(THREE.DoubleSide);
  });
});
