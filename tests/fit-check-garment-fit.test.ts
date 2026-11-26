import { describe, expect, it } from "vitest";
import { computeAvatarParams } from "@calcart/customers";
import { inspectGlb } from "@calcart/products";
import { buildBoxGlb } from "./helpers/glb.js";
import * as THREE from "../apps/web/node_modules/three/build/three.module.js";
import { GLTFLoader } from "../apps/web/node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import {
  avatarGirths,
  computeGarmentFit,
} from "../apps/web/src/components/storefront/fit-check/garment-fit";
import { resolveGarmentAsset } from "../apps/web/src/components/storefront/fit-check/use-fit-check";

const BODY = { heightCm: 175, weightKg: 70, chestCm: 96, waistCm: 80, hipCm: 98 };
const REF = { heightCm: 175, chestCm: 96, waistCm: 80, hipCm: 98 };

describe("garment fitting", () => {
  it("recovers the measured girths from the persisted avatar", () => {
    const g = avatarGirths(computeAvatarParams(BODY));
    expect(g.chestCm).toBeCloseTo(96, 0);
    expect(g.waistCm).toBeCloseTo(80, 0);
    expect(g.hipCm).toBeCloseTo(98, 0);
  });

  it("leaves a garment unscaled on the reference body", () => {
    const fit = computeGarmentFit(computeAvatarParams(BODY), REF, "top");
    expect(fit.scale.x).toBeCloseTo(1, 1);
    expect(fit.scale.y).toBeCloseTo(1, 2);
    expect(fit.scale.z).toBeCloseTo(fit.scale.x, 6);
  });

  it("scales height with stature and width with the covered girth", () => {
    const tall = computeAvatarParams({ ...BODY, heightCm: 192.5 });
    expect(computeGarmentFit(tall, REF, "top").scale.y).toBeCloseTo(1.1, 2);

    const broad = computeAvatarParams({ ...BODY, chestCm: 120, hipCm: 98 });
    expect(computeGarmentFit(broad, REF, "top").scale.x).toBeGreaterThan(1.2);
    // Bottoms follow the hips, which did not change.
    expect(computeGarmentFit(broad, REF, "bottom").scale.x).toBeCloseTo(1, 1);

    const wideHip = computeAvatarParams({ ...BODY, hipCm: 120 });
    expect(computeGarmentFit(wideHip, REF, "bottom").scale.x).toBeGreaterThan(1.2);
    // Dresses blend chest and hip.
    const dress = computeGarmentFit(wideHip, REF, "dress").scale.x;
    expect(dress).toBeGreaterThan(computeGarmentFit(wideHip, REF, "top").scale.x);
    expect(dress).toBeLessThan(computeGarmentFit(wideHip, REF, "bottom").scale.x);
  });

  it("clamps absurd ratios", () => {
    const fit = computeGarmentFit(computeAvatarParams(BODY), { ...REF, chestCm: 50, heightCm: 100 }, "top");
    expect(fit.scale.x).toBeLessThanOrEqual(1.8);
    expect(fit.scale.y).toBeLessThanOrEqual(1.6);
  });

  it("produces a loadable garment whose fitted bounds follow the avatar", async () => {
    const glb = buildBoxGlb({ width: 0.5, depth: 0.28, yMin: 0.9, yMax: 1.4 });
    const info = inspectGlb(glb);
    expect(info.meshCount).toBe(1);

    const buffer = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;
    const gltf = await new GLTFLoader().parseAsync(buffer, "");
    const avatar = computeAvatarParams({ ...BODY, heightCm: 192.5, chestCm: 115 });
    const fit = computeGarmentFit(avatar, REF, "top");
    gltf.scene.scale.set(fit.scale.x, fit.scale.y, fit.scale.z);
    gltf.scene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(gltf.scene);
    expect(box.max.y).toBeCloseTo(1.4 * 1.1, 2);
    expect(box.max.x - box.min.x).toBeCloseTo(0.5 * (115 / 96), 1);
  });
});

describe("garment resolution for the storefront", () => {
  const asset = (id: string, variantId: string | null) => ({
    id,
    variantId,
    source: "glb" as const,
    slot: "top" as const,
    reference: REF,
    template: null,
    fit: null,
    textureUrl: null,
  });

  it("prefers the variant garment, falls back to product level, else null", () => {
    const assets = [asset("p", null), asset("v1", "variant-1")];
    expect(resolveGarmentAsset(assets, "variant-1")?.id).toBe("v1");
    expect(resolveGarmentAsset(assets, "variant-2")?.id).toBe("p");
    expect(resolveGarmentAsset(assets, null)?.id).toBe("p");
    expect(resolveGarmentAsset([asset("v1", "variant-1")], "variant-2")).toBeNull();
    expect(resolveGarmentAsset(undefined, null)).toBeNull();
    expect(resolveGarmentAsset([], null)).toBeNull();
  });
});
