import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import {
  GarmentAssetNotFoundError,
  GarmentAssetService,
  InvalidGarmentAssetError,
  ProductNotFoundError,
  VariantNotFoundError,
  inspectGlb,
} from "@calcart/products";
import { createIsolatedDatabase } from "./helpers/postgres.js";

const REF = { heightCm: 175, chestCm: 96, waistCm: 80, hipCm: 98 };

function makeGlb(json: object, opts: { version?: number; lengthDelta?: number } = {}): Uint8Array {
  const text = JSON.stringify(json);
  const padded = text + " ".repeat((4 - (text.length % 4)) % 4);
  const jsonBytes = new TextEncoder().encode(padded);
  const total = 12 + 8 + jsonBytes.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, opts.version ?? 2, true);
  view.setUint32(8, total + (opts.lengthDelta ?? 0), true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  return out;
}

describe("Fit Check garment assets", { timeout: 120_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const garments = new GarmentAssetService();

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
  }, 120_000);

  afterAll(async () => {
    await close?.();
  });

  async function seedStore(slug: string): Promise<string> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [orgId, slug]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, slug, slug],
    );
    return storeId;
  }

  async function seedProduct(
    storeId: string,
    slug: string,
    status = "ACTIVE",
  ): Promise<{ productId: string; variantA: string; variantB: string }> {
    const productId = generateUuidV7();
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status) VALUES ($1, $2, $3, $4, $5)`,
      [productId, storeId, slug, slug, status],
    );
    const ids: string[] = [];
    for (const title of ["S", "M"]) {
      const id = generateUuidV7();
      ids.push(id);
      await db.query(
        `INSERT INTO product_variants (id, product_id, store_id, title, price, currency)
         VALUES ($1, $2, $3, $4, 1000, 'USD')`,
        [id, productId, storeId, title],
      );
    }
    return { productId, variantA: ids[0]!, variantB: ids[1]! };
  }

  const input = (fileName: string, extra: Record<string, unknown> = {}) => ({
    slot: "top" as const,
    fileName,
    originalName: "shirt.glb",
    fileSize: 1234,
    sha256: "a".repeat(64),
    reference: REF,
    ...extra,
  });

  describe("GLB validation", () => {
    it("accepts a self-contained glTF 2.0 binary with meshes", () => {
      expect(inspectGlb(makeGlb({ asset: { version: "2.0" }, meshes: [{}], nodes: [{}, {}] }))).toEqual({
        meshCount: 1,
        nodeCount: 2,
      });
      expect(
        inspectGlb(makeGlb({ meshes: [{}], images: [{ uri: "data:image/png;base64,AAAA" }] })).meshCount,
      ).toBe(1);
    });

    it.each([
      ["not a GLB", new Uint8Array(64)],
      ["wrong version", makeGlb({ meshes: [{}] }, { version: 1 })],
      ["inconsistent length", makeGlb({ meshes: [{}] }, { lengthDelta: 4 })],
      ["no meshes", makeGlb({ nodes: [{}] })],
      ["external buffer", makeGlb({ meshes: [{}], buffers: [{ uri: "https://evil.example/x.bin" }] })],
      ["external image", makeGlb({ meshes: [{}], images: [{ uri: "textures/a.png" }] })],
      ["too small", new Uint8Array(8)],
    ])("rejects %s", (_name, bytes) => {
      expect(() => inspectGlb(bytes)).toThrow(InvalidGarmentAssetError);
    });
  });

  describe("asset management", () => {
    it("stores product-level and variant-level assets and lists them", async () => {
      const storeId = await seedStore("garment-store-1");
      const { productId, variantA } = await seedProduct(storeId, "shirt-1");

      const a = await garments.saveAsset(db, storeId, productId, input("garment_aaaaaaaaaaaaaaaa.glb"));
      const b = await garments.saveAsset(
        db,
        storeId,
        productId,
        input("garment_bbbbbbbbbbbbbbbb.glb", { variantId: variantA }),
      );
      expect(a.asset.variantId).toBeNull();
      expect(b.asset.variantId).toBe(variantA);
      expect((await garments.listForProduct(db, storeId, productId)).map((x) => x.variantId)).toEqual([
        null,
        variantA,
      ]);
    });

    it("replaces the asset for the same scope and reports the old file", async () => {
      const storeId = await seedStore("garment-store-2");
      const { productId } = await seedProduct(storeId, "shirt-2");
      await garments.saveAsset(db, storeId, productId, input("garment_1111111111111111.glb"));
      const second = await garments.saveAsset(db, storeId, productId, input("garment_2222222222222222.glb"));
      expect(second.replacedFileName).toBe("garment_1111111111111111.glb");
      expect(await garments.listForProduct(db, storeId, productId)).toHaveLength(1);
    });

    it("validates slot and reference body", async () => {
      const storeId = await seedStore("garment-store-3");
      const { productId } = await seedProduct(storeId, "shirt-3");
      await expect(
        garments.saveAsset(db, storeId, productId, input("garment_cccccccccccccccc.glb", { slot: "hat" })),
      ).rejects.toBeInstanceOf(InvalidGarmentAssetError);
      const err = await garments
        .saveAsset(
          db,
          storeId,
          productId,
          input("garment_cccccccccccccccc.glb", { reference: { ...REF, heightCm: 20, chestCm: Number.NaN } }),
        )
        .catch((e) => e);
      expect(Object.keys(err.details.fields).sort()).toEqual(["chestCm", "heightCm"]);
    });

    it("rejects products and variants from another store or product", async () => {
      const storeA = await seedStore("garment-store-4a");
      const storeB = await seedStore("garment-store-4b");
      const a = await seedProduct(storeA, "shirt-4a");
      const b = await seedProduct(storeB, "shirt-4b");

      await expect(
        garments.saveAsset(db, storeB, a.productId, input("garment_dddddddddddddddd.glb")),
      ).rejects.toBeInstanceOf(ProductNotFoundError);
      await expect(
        garments.saveAsset(db, storeA, a.productId, input("garment_dddddddddddddddd.glb", { variantId: b.variantA })),
      ).rejects.toBeInstanceOf(VariantNotFoundError);
      await expect(garments.listForProduct(db, storeB, a.productId)).rejects.toBeInstanceOf(
        ProductNotFoundError,
      );
    });

    it("cannot toggle or delete another store's asset", async () => {
      const storeA = await seedStore("garment-store-5a");
      const storeB = await seedStore("garment-store-5b");
      const a = await seedProduct(storeA, "shirt-5");
      const saved = await garments.saveAsset(db, storeA, a.productId, input("garment_eeeeeeeeeeeeeeee.glb"));

      await expect(garments.setEnabled(db, storeB, saved.asset.id, false)).rejects.toBeInstanceOf(
        GarmentAssetNotFoundError,
      );
      await expect(garments.removeAsset(db, storeB, saved.asset.id)).rejects.toBeInstanceOf(
        GarmentAssetNotFoundError,
      );
      expect(await garments.removeAsset(db, storeA, saved.asset.id)).toEqual({
        fileName: "garment_eeeeeeeeeeeeeeee.glb",
      });
    });

    it("removes garments when the product is deleted", async () => {
      const storeId = await seedStore("garment-store-6");
      const { productId } = await seedProduct(storeId, "shirt-6");
      await garments.saveAsset(db, storeId, productId, input("garment_ffffffffffffffff.glb"));
      await db.query(`DELETE FROM products WHERE id = $1`, [productId]);
      const left = await db.query(`SELECT 1 FROM product_garment_assets WHERE product_id = $1`, [productId]);
      expect(left.rows).toHaveLength(0);
    });
  });

  describe("storefront resolution", () => {
    it("prefers the variant garment, falls back to the product one, else reports unsupported", async () => {
      const storeId = await seedStore("garment-store-7");
      const { productId, variantA, variantB } = await seedProduct(storeId, "shirt-7");

      expect(await garments.resolveForStorefront(db, storeId, productId, variantA)).toBeNull();

      const productLevel = await garments.saveAsset(db, storeId, productId, input("garment_0000000000000001.glb"));
      const variantLevel = await garments.saveAsset(
        db,
        storeId,
        productId,
        input("garment_0000000000000002.glb", { variantId: variantA }),
      );

      expect((await garments.resolveForStorefront(db, storeId, productId, variantA))?.id).toBe(
        variantLevel.asset.id,
      );
      expect((await garments.resolveForStorefront(db, storeId, productId, variantB))?.id).toBe(
        productLevel.asset.id,
      );
      expect((await garments.resolveForStorefront(db, storeId, productId, null))?.id).toBe(
        productLevel.asset.id,
      );
    });

    it("only offers enabled garments of ACTIVE products and variants", async () => {
      const storeId = await seedStore("garment-store-8");
      const live = await seedProduct(storeId, "live-shirt");
      const draft = await seedProduct(storeId, "draft-shirt", "DRAFT");
      const off = await seedProduct(storeId, "disabled-shirt");

      const liveAsset = await garments.saveAsset(db, storeId, live.productId, input("garment_0000000000000011.glb"));
      await garments.saveAsset(db, storeId, draft.productId, input("garment_0000000000000012.glb"));
      const offAsset = await garments.saveAsset(db, storeId, off.productId, input("garment_0000000000000013.glb"));
      await garments.setEnabled(db, storeId, offAsset.asset.id, false);

      const catalog = await garments.listStorefrontCatalog(db, storeId);
      expect(catalog.map((c) => c.productId)).toEqual([live.productId]);

      expect(await garments.getStorefrontFileName(db, storeId, liveAsset.asset.id)).toBe(
        "garment_0000000000000011.glb",
      );
      expect(await garments.getStorefrontFileName(db, storeId, offAsset.asset.id)).toBeNull();

      // Inactive variants stop being offered, falling back to nothing for that selection.
      const variantAsset = await garments.saveAsset(
        db,
        storeId,
        live.productId,
        input("garment_0000000000000014.glb", { variantId: live.variantA }),
      );
      await db.query(`UPDATE product_variants SET status = 'INACTIVE' WHERE id = $1`, [live.variantA]);
      expect(await garments.getStorefrontFileName(db, storeId, variantAsset.asset.id)).toBeNull();
    });

    it("never serves another store's garment", async () => {
      const storeA = await seedStore("garment-store-9a");
      const storeB = await seedStore("garment-store-9b");
      const a = await seedProduct(storeA, "shirt-9");
      const asset = await garments.saveAsset(db, storeA, a.productId, input("garment_0000000000000021.glb"));
      expect(await garments.getStorefrontFileName(db, storeB, asset.asset.id)).toBeNull();
      expect(await garments.listStorefrontCatalog(db, storeB)).toEqual([]);
    });
  });

  describe("photo-driven (generated) garments", () => {
    async function addMedia(productId: string, url: string, position = 0): Promise<string> {
      const id = generateUuidV7();
      await db.query(`INSERT INTO product_media (id, product_id, url, position) VALUES ($1, $2, $3, $4)`, [
        id,
        productId,
        url,
        position,
      ]);
      return id;
    }

    it("saves a generated garment with a template, fit and chosen photo", async () => {
      const storeId = await seedStore("gen-store-1");
      const { productId } = await seedProduct(storeId, "gen-shirt");
      await addMedia(productId, "/uploads/first.jpg", 0);
      const second = await addMedia(productId, "/uploads/second.jpg", 1);

      const saved = await garments.saveGeneratedAsset(db, storeId, productId, {
        template: "longsleeve",
        fit: "loose",
        textureMediaId: second,
      });
      expect(saved.asset).toMatchObject({
        source: "generated",
        slot: "top",
        template: "longsleeve",
        fit: "loose",
        reference: null,
        originalName: null,
        textureMediaId: second,
        textureUrl: "/uploads/second.jpg",
      });
      expect(saved.replacedFileName).toBeNull();
    });

    it("maps templates to slots and defaults the photo to the product's first image", async () => {
      const storeId = await seedStore("gen-store-2");
      const { productId, variantA } = await seedProduct(storeId, "gen-trousers");
      await addMedia(productId, "/uploads/b.jpg", 5);
      await addMedia(productId, "/uploads/a.jpg", 1);

      const trousers = await garments.saveGeneratedAsset(db, storeId, productId, {
        template: "trousers",
        fit: "regular",
      });
      expect(trousers.asset.slot).toBe("bottom");
      expect(trousers.asset.textureUrl).toBe("/uploads/a.jpg");

      const jacket = await garments.saveGeneratedAsset(db, storeId, productId, {
        variantId: variantA,
        template: "jacket",
        fit: "slim",
      });
      expect(jacket.asset.slot).toBe("outerwear");
    });

    it("rejects unknown templates/fits and photos from another product or store", async () => {
      const storeA = await seedStore("gen-store-3a");
      const storeB = await seedStore("gen-store-3b");
      const a = await seedProduct(storeA, "gen-a");
      const b = await seedProduct(storeB, "gen-b");
      const foreignMedia = await addMedia(b.productId, "/uploads/foreign.jpg");

      await expect(
        garments.saveGeneratedAsset(db, storeA, a.productId, { template: "cape" as never, fit: "regular" }),
      ).rejects.toBeInstanceOf(InvalidGarmentAssetError);
      await expect(
        garments.saveGeneratedAsset(db, storeA, a.productId, { template: "tshirt", fit: "tight" as never }),
      ).rejects.toBeInstanceOf(InvalidGarmentAssetError);
      await expect(
        garments.saveGeneratedAsset(db, storeA, a.productId, {
          template: "tshirt",
          fit: "regular",
          textureMediaId: foreignMedia,
        }),
      ).rejects.toBeInstanceOf(InvalidGarmentAssetError);
      await expect(
        garments.saveGeneratedAsset(db, storeB, a.productId, { template: "tshirt", fit: "regular" }),
      ).rejects.toBeInstanceOf(ProductNotFoundError);
    });

    it("replaces an uploaded model with a generated garment and reports the file to remove", async () => {
      const storeId = await seedStore("gen-store-4");
      const { productId } = await seedProduct(storeId, "gen-swap");
      await garments.saveAsset(db, storeId, productId, input("garment_00000000000000aa.glb"));
      const swapped = await garments.saveGeneratedAsset(db, storeId, productId, {
        template: "tshirt",
        fit: "regular",
      });
      expect(swapped.replacedFileName).toBe("garment_00000000000000aa.glb");
      expect(await garments.listForProduct(db, storeId, productId)).toHaveLength(1);
    });

    it("offers generated garments on the storefront with their cut, fit and photo, but no model file", async () => {
      const storeId = await seedStore("gen-store-5");
      const { productId, variantA } = await seedProduct(storeId, "gen-front");
      await addMedia(productId, "/uploads/front.jpg");
      const productLevel = await garments.saveGeneratedAsset(db, storeId, productId, {
        template: "tshirt",
        fit: "regular",
      });
      const variantLevel = await garments.saveGeneratedAsset(db, storeId, productId, {
        variantId: variantA,
        template: "jacket",
        fit: "loose",
      });

      const catalog = await garments.listStorefrontCatalog(db, storeId);
      expect(catalog).toHaveLength(1);
      expect(catalog[0]!.assets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: productLevel.asset.id,
            source: "generated",
            template: "tshirt",
            fit: "regular",
            textureUrl: "/uploads/front.jpg",
            reference: null,
          }),
          expect.objectContaining({ id: variantLevel.asset.id, template: "jacket", fit: "loose" }),
        ]),
      );
      // There is no file to serve for a generated garment.
      expect(await garments.getStorefrontFileName(db, storeId, productLevel.asset.id)).toBeNull();
      const resolved = await garments.resolveForStorefront(db, storeId, productId, variantA);
      expect(resolved?.template).toBe("jacket");
    });

    it("keeps the garment when its photo is removed and falls back to the first image", async () => {
      const storeId = await seedStore("gen-store-6");
      const { productId } = await seedProduct(storeId, "gen-media");
      await addMedia(productId, "/uploads/keep.jpg", 0);
      const chosen = await addMedia(productId, "/uploads/chosen.jpg", 3);
      const saved = await garments.saveGeneratedAsset(db, storeId, productId, {
        template: "shorts",
        fit: "slim",
        textureMediaId: chosen,
      });
      await db.query(`DELETE FROM product_media WHERE id = $1`, [chosen]);
      const [after] = await garments.listForProduct(db, storeId, productId);
      expect(after!.id).toBe(saved.asset.id);
      expect(after!.textureMediaId).toBeNull();
      expect(after!.textureUrl).toBe("/uploads/keep.jpg");
    });

    it("the database rejects rows that mix up the two garment sources", async () => {
      const storeId = await seedStore("gen-store-7");
      const { productId } = await seedProduct(storeId, "gen-db");
      const insert = (cols: string, vals: unknown[]) =>
        db.query(
          `INSERT INTO product_garment_assets (id, store_id, product_id, slot, ${cols})
           VALUES ($1, $2, $3, 'top', ${vals.map((_, i) => `$${i + 4}`).join(", ")})`,
          [generateUuidV7(), storeId, productId, ...vals],
        );
      // generated without a template
      await expect(insert("source, fit", ["generated", "regular"])).rejects.toThrow();
      // generated carrying a file
      await expect(
        insert("source, template, fit, file_name", ["generated", "tshirt", "regular", "garment_x.glb"]),
      ).rejects.toThrow();
      // glb without a file / reference body
      await expect(insert("source", ["glb"])).rejects.toThrow();
    });
  });
});
