import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { serializeSessionCookie } from "@shopify-clone/auth";
import { StoreService } from "@shopify-clone/stores";
import { createIsolatedDatabase } from "./helpers/postgres.js";

import {
  POST as postProduct,
} from "../apps/web/app/api/v1/stores/[storeId]/products/route.js";
import {
  GET as getProduct,
  PATCH as patchProduct,
} from "../apps/web/app/api/v1/stores/[storeId]/products/[productId]/route.js";
import {
  GET as getStorefrontProducts,
} from "../apps/web/app/api/v1/storefront/[storeSlug]/products/route.js";
import {
  GET as getStorefrontProductDetail,
} from "../apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/route.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Variant Publishing End-to-End Suite", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = isolated.database;
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createAuthenticatedUser(email: string) {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();

    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );

    const expiresAt = new Date(Date.now() + 86400000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );

    const cookie = serializeSessionCookie(sessionId, { expires: expiresAt });
    return { userId, sessionId, cookie };
  }

  async function createStoreWithOwner(email = "owner-publishing@test.com") {
    const user = await createAuthenticatedUser(email);
    const store = await storeService.createStore(db, user.userId, {
      name: "Apparel Studio",
      slug: `apparel-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "ACTIVE",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    return { user, store };
  }

  it("persists option-level standalone publishing configuration and serves variant listings on storefront", async () => {
    const { user, store } = await createStoreWithOwner();

    // 1. Create a product with initial media, options, and variants
    const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: user.cookie,
      },
      body: JSON.stringify({
        title: "Heavyweight Boxy Tee",
        slug: "heavyweight-boxy-tee",
        status: "ACTIVE",
        media: [
          { url: "https://images.example.com/tee-blue.jpg", altText: "Blue Tee", position: 0 },
          { url: "https://images.example.com/tee-black.jpg", altText: "Black Tee", position: 1 },
        ],
        options: [
          {
            name: "Color",
            position: 0,
            values: ["Blue", "Black"],
            isPublishable: true,
            optionValues: [
              {
                value: "Blue",
                displayTitle: "Heavyweight Boxy Tee - Cobalt Blue",
                isPublished: true,
                mediaIndexes: [0],
              },
              {
                value: "Black",
                displayTitle: "Heavyweight Boxy Tee - Pitch Black",
                isPublished: true,
                mediaIndexes: [1],
              },
            ],
          },
          {
            name: "Size",
            position: 1,
            values: ["S", "M"],
            isPublishable: false,
          },
        ],
        variants: [
          {
            title: "Blue / S",
            option1: "Blue",
            option2: "S",
            price: 4500,
            sku: "TEE-BLU-S",
            inventoryQuantity: 20,
          },
          {
            title: "Blue / M",
            option1: "Blue",
            option2: "M",
            price: 4500,
            sku: "TEE-BLU-M",
            inventoryQuantity: 25,
          },
          {
            title: "Black / S",
            option1: "Black",
            option2: "S",
            price: 4500,
            sku: "TEE-BLK-S",
            inventoryQuantity: 15,
          },
          {
            title: "Black / M",
            option1: "Black",
            option2: "M",
            price: 4500,
            sku: "TEE-BLK-M",
            inventoryQuantity: 30,
          },
        ],
      }),
    });

    const createRes = await postProduct(createReq, {
      params: Promise.resolve({ storeId: store.id }),
    });
    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    const productId = createdData.data.id;
    expect(productId).toBeDefined();

    // 2. Fetch the product as merchant via GET to verify publishing configuration persisted
    const getMerchantReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${productId}`, {
      method: "GET",
      headers: { Cookie: user.cookie },
    });
    const getMerchantRes = await getProduct(getMerchantReq, {
      params: Promise.resolve({ storeId: store.id, productId }),
    });
    expect(getMerchantRes.status).toBe(200);
    const merchantData = await getMerchantRes.json();
    const colorOption = merchantData.data.options.find((o: { name: string }) => o.name === "Color");
    expect(colorOption).toBeDefined();
    expect(colorOption.isPublishable).toBe(true);
    expect(colorOption.optionValues).toHaveLength(2);

    const blueVal = colorOption.optionValues.find((ov: { value: string }) => ov.value === "Blue");
    const blackVal = colorOption.optionValues.find((ov: { value: string }) => ov.value === "Black");
    expect(blueVal.isPublished).toBe(true);
    expect(blueVal.displayTitle).toBe("Heavyweight Boxy Tee - Cobalt Blue");
    expect(blueVal.mediaIds).toHaveLength(1);

    expect(blackVal.isPublished).toBe(true);
    expect(blackVal.displayTitle).toBe("Heavyweight Boxy Tee - Pitch Black");
    expect(blackVal.mediaIds).toHaveLength(1);

    // 3. Update the product via PATCH (simulating merchant saving product edit)
    const patchReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${productId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: user.cookie,
      },
      body: JSON.stringify({
        title: "Heavyweight Boxy Tee Updated",
        options: [
          {
            name: "Color",
            position: 0,
            values: ["Blue", "Black"],
            isPublishable: true,
            optionValues: [
              {
                value: "Blue",
                displayTitle: "Cobalt Blue Oversized Edition",
                isPublished: true,
                mediaIndexes: [0],
              },
              {
                value: "Black",
                displayTitle: "Pitch Black Oversized Edition",
                isPublished: true,
                mediaIndexes: [1],
              },
            ],
          },
          {
            name: "Size",
            position: 1,
            values: ["S", "M"],
            isPublishable: false,
          },
        ],
      }),
    });

    const patchRes = await patchProduct(patchReq, {
      params: Promise.resolve({ storeId: store.id, productId }),
    });
    expect(patchRes.status).toBe(200);

    // Verify persistence after PATCH
    const getAfterPatchRes = await getProduct(getMerchantReq.clone(), {
      params: Promise.resolve({ storeId: store.id, productId }),
    });
    const afterPatchData = await getAfterPatchRes.json();
    const updatedColorOption = afterPatchData.data.options.find((o: { name: string }) => o.name === "Color");
    expect(updatedColorOption.isPublishable).toBe(true);
    const updatedBlueVal = updatedColorOption.optionValues.find((ov: { value: string }) => ov.value === "Blue");
    expect(updatedBlueVal.isPublished).toBe(true);
    expect(updatedBlueVal.displayTitle).toBe("Cobalt Blue Oversized Edition");

    // 4. Verify storefront catalog listing returns standalone variant cards
    const storefrontReq = new Request(`http://localhost:3000/api/v1/storefront/${store.slug}/products`, {
      method: "GET",
    });
    const storefrontRes = await getStorefrontProducts(storefrontReq, {
      params: Promise.resolve({ storeSlug: store.slug }),
    });
    expect(storefrontRes.status).toBe(200);
    const storefrontData = await storefrontRes.json();

    // Must return 2 standalone cards (one for Blue, one for Black)
    expect(storefrontData.data.items).toHaveLength(2);
    const titles = storefrontData.data.items.map((item: { title: string }) => item.title);
    expect(titles).toContain("Cobalt Blue Oversized Edition");
    expect(titles).toContain("Pitch Black Oversized Edition");

    const blueCard = storefrontData.data.items.find((item: { title: string }) => item.title === "Cobalt Blue Oversized Edition");
    expect(blueCard.isStandaloneVariant).toBe(true);
    expect(blueCard.variantId).toBeDefined();
    expect(blueCard.primaryMediaUrl).toBe("https://images.example.com/tee-blue.jpg");

    const blackCard = storefrontData.data.items.find((item: { title: string }) => item.title === "Pitch Black Oversized Edition");
    expect(blackCard.isStandaloneVariant).toBe(true);
    expect(blackCard.variantId).toBeDefined();
    expect(blackCard.primaryMediaUrl).toBe("https://images.example.com/tee-black.jpg");

    // 5. Storefront Product Detail endpoint returns rich options with media for image switching
    const pdpReq = new Request(`http://localhost:3000/api/v1/storefront/${store.slug}/products/heavyweight-boxy-tee`, {
      method: "GET",
    });
    const pdpRes = await getStorefrontProductDetail(pdpReq, {
      params: Promise.resolve({ storeSlug: store.slug, productSlug: "heavyweight-boxy-tee" }),
    });
    expect(pdpRes.status).toBe(200);
    const pdpData = await pdpRes.json();
    const pdpColorOption = pdpData.data.product.options.find((o: { name: string }) => o.name === "Color");
    expect(pdpColorOption.isPublishable).toBe(true);
    expect(pdpColorOption.optionValues).toHaveLength(2);
    expect(pdpColorOption.optionValues[0].media).toHaveLength(1);
    expect(pdpColorOption.optionValues[0].media[0].url).toBe("https://images.example.com/tee-blue.jpg");

    // 6. Test Unpublishing a variant option value: unpublish Black
    const unpublishPatchReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${productId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: user.cookie,
      },
      body: JSON.stringify({
        options: [
          {
            name: "Color",
            position: 0,
            values: ["Blue", "Black"],
            isPublishable: true,
            optionValues: [
              {
                value: "Blue",
                displayTitle: "Cobalt Blue Oversized Edition",
                isPublished: true,
                mediaIndexes: [0],
              },
              {
                value: "Black",
                displayTitle: "Pitch Black Oversized Edition",
                isPublished: false, // Merchant hides Black as standalone listing
                mediaIndexes: [1],
              },
            ],
          },
          {
            name: "Size",
            position: 1,
            values: ["S", "M"],
            isPublishable: false,
          },
        ],
      }),
    });

    const unpublishRes = await patchProduct(unpublishPatchReq, {
      params: Promise.resolve({ storeId: store.id, productId }),
    });
    expect(unpublishRes.status).toBe(200);

    // Verify storefront catalog after unpublishing Black:
    // Standalone Black card must NOT appear!
    const storefrontAfterUnpublishRes = await getStorefrontProducts(storefrontReq.clone(), {
      params: Promise.resolve({ storeSlug: store.slug }),
    });
    const storefrontAfterUnpublishData = await storefrontAfterUnpublishRes.json();

    const standaloneTitles = storefrontAfterUnpublishData.data.items
      .filter((i: { isStandaloneVariant: boolean }) => i.isStandaloneVariant)
      .map((i: { title: string }) => i.title);
    expect(standaloneTitles).toContain("Cobalt Blue Oversized Edition");
    expect(standaloneTitles).not.toContain("Pitch Black Oversized Edition");
  });

  it("supports searching and filtering by variant-specific display title on storefront catalog", async () => {
    const { user, store } = await createStoreWithOwner("search-owner@test.com");

    // Create product with two standalone colors
    const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: user.cookie,
      },
      body: JSON.stringify({
        title: "Japanese Linen Overshirt",
        slug: "japanese-linen-overshirt",
        status: "ACTIVE",
        media: [
          { url: "https://images.example.com/linen-olive.jpg", altText: "Olive Linen", position: 0 },
          { url: "https://images.example.com/linen-ecru.jpg", altText: "Ecru Linen", position: 1 },
        ],
        options: [
          {
            name: "Color",
            position: 0,
            values: ["Olive", "Ecru"],
            isPublishable: true,
            optionValues: [
              {
                value: "Olive",
                displayTitle: "Kyoto Olive Linen Overshirt",
                isPublished: true,
                mediaIndexes: [0],
              },
              {
                value: "Ecru",
                displayTitle: "Natural Ecru Linen Overshirt",
                isPublished: true,
                mediaIndexes: [1],
              },
            ],
          },
        ],
        variants: [
          {
            title: "Olive",
            option1: "Olive",
            price: 12000,
            sku: "LIN-OLV",
            inventoryQuantity: 10,
          },
          {
            title: "Ecru",
            option1: "Ecru",
            price: 12000,
            sku: "LIN-ECR",
            inventoryQuantity: 8,
          },
        ],
      }),
    });

    const createRes = await postProduct(createReq, {
      params: Promise.resolve({ storeId: store.id }),
    });
    expect(createRes.status).toBe(201);

    // Search for "Kyoto" -> only Olive listing returned
    const searchKyotoReq = new Request(
      `http://localhost:3000/api/v1/storefront/${store.slug}/products?search=Kyoto`,
      { method: "GET" },
    );
    const searchKyotoRes = await getStorefrontProducts(searchKyotoReq, {
      params: Promise.resolve({ storeSlug: store.slug }),
    });
    expect(searchKyotoRes.status).toBe(200);
    const kyotoData = await searchKyotoRes.json();
    expect(kyotoData.data.items).toHaveLength(1);
    expect(kyotoData.data.items[0].title).toBe("Kyoto Olive Linen Overshirt");
    expect(kyotoData.data.items[0].primaryMediaUrl).toBe("https://images.example.com/linen-olive.jpg");

    // Search for "Ecru" -> only Ecru listing returned
    const searchEcruReq = new Request(
      `http://localhost:3000/api/v1/storefront/${store.slug}/products?search=Ecru`,
      { method: "GET" },
    );
    const searchEcruRes = await getStorefrontProducts(searchEcruReq, {
      params: Promise.resolve({ storeSlug: store.slug }),
    });
    expect(searchEcruRes.status).toBe(200);
    const ecruData = await searchEcruRes.json();
    expect(ecruData.data.items).toHaveLength(1);
    expect(ecruData.data.items[0].title).toBe("Natural Ecru Linen Overshirt");
    expect(ecruData.data.items[0].primaryMediaUrl).toBe("https://images.example.com/linen-ecru.jpg");
  });
});
