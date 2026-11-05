import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { hashToken, serializeSessionCookie } from "@calcart/auth";
import { CheckoutService } from "@calcart/checkout";
import { StoreService } from "@calcart/stores";
import {
  TaxService,
  computeGstinCheckChar,
} from "@calcart/tax";
import { PaymentOrderIntegration } from "../../modules/payments/src/application/payment-order-integration.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import {
  GET as getSettings,
  PATCH as patchSettings,
} from "../../apps/web/app/api/v1/stores/[storeId]/tax/settings/route.js";
import {
  GET as getProductTax,
  PUT as putProductTax,
  DELETE as deleteProductTax,
} from "../../apps/web/app/api/v1/stores/[storeId]/products/[productId]/tax/route.js";
import { GET as getMerchantInvoice } from "../../apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/invoice/route.js";
import { GET as getStorefrontInvoice } from "../../apps/web/app/api/v1/storefront/[storeSlug]/orders/[orderId]/invoice/route.js";
import { GET as getStorefrontCheckout } from "../../apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/route.js";

declare global {
  var __calcart_web_db: unknown;
}

function makeGstin(stateCode: string, pan: string, entity = "1"): string {
  const first14 = `${stateCode}${pan}${entity}Z`;
  return `${first14}${computeGstinCheckChar(first14)}`;
}

const MH_GSTIN = makeGstin("27", "AAPFU0939F");
const KARNATAKA = {
  addressLine1: "5 Lake View",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560001",
  country: "India",
  firstName: "Alex",
  lastName: "Buyer",
};
const GUEST_TOKEN = "guest-token-for-tax-invoice-test";

describe("Tax API endpoints (GAP-11)", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const taxService = new TaxService();
  const checkoutService = new CheckoutService();
  const workflow = new PaymentOrderIntegration();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = isolated.database;
  });

  afterEach(async () => {
    global.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createUser(email: string) {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Test User', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    const expiresAt = new Date(Date.now() + 86_400_000);
    await db.query(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`, [
      sessionId,
      userId,
      expiresAt,
    ]);
    return { userId, cookie: serializeSessionCookie(sessionId, { expires: expiresAt }) };
  }

  async function createStoreWithOwner(email: string) {
    const user = await createUser(email);
    const slug = `tax-${generateUuidV7().slice(-10)}`;
    const store = await storeService.createStore(db, user.userId, {
      name: "Tax Test Store",
      slug,
      currency: "INR",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
    });
    // New stores start as DRAFT, and the storefront refuses a store that is not
    // ACTIVE. Without this every storefront request would 404 for that reason,
    // which would make the ownership-denial tests below pass for the wrong one.
    await db.query(`UPDATE stores SET status = 'ACTIVE' WHERE id = $1`, [store.id]);
    return { user, store, slug };
  }

  async function addMember(storeId: string, email: string, role: "admin" | "staff") {
    const user = await createUser(email);
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())`,
      [generateUuidV7(), storeId, user.userId, role],
    );
    return user;
  }

  async function seedProduct(storeId: string, price = 10_000) {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const suffix = generateUuidV7().slice(-10);
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status) VALUES ($1, $2, 'Cotton Shirt', $3, 'ACTIVE')`,
      [productId, storeId, `p-${suffix}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Medium', $4, $5, 'INR', 'ACTIVE')`,
      [variantId, productId, storeId, `SKU-${suffix}`, price],
    );
    return { productId, variantId };
  }

  async function enableTax(storeId: string) {
    await taxService.updateSettings(db, storeId, {
      isEnabled: true,
      legalName: "Acme Traders Pvt Ltd",
      gstin: MH_GSTIN,
      addressLine1: "12 Market Road",
      city: "Mumbai",
      postalCode: "400001",
      defaultGstRateBps: 1800,
    });
  }

  /** A checkout that the guest token owns, ready to be paid. */
  async function guestCheckout(storeId: string, variantId: string) {
    const cartId = generateUuidV7();
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [
      cartId,
      storeId,
    ]);
    const created = await checkoutService.createCheckout(db, storeId, {
      cartId,
      currency: "INR",
    });
    await checkoutService.addItem(db, storeId, created.id, { variantId, quantity: 1 });
    await checkoutService.updateAddresses(db, storeId, created.id, {
      shippingAddress: KARNATAKA as never,
    });
    await db.query(`UPDATE checkouts SET guest_token_hash = $1 WHERE id = $2`, [
      hashToken(GUEST_TOKEN),
      created.id,
    ]);
    return created.id;
  }

  async function payOrder(storeId: string, checkoutId: string) {
    const row = await db.query(`SELECT total FROM checkouts WHERE id = $1`, [checkoutId]);
    const amount = Number(row.rows[0].total);
    await db.query(
      `UPDATE checkouts SET status = 'PAYMENT_PENDING', payment_status = 'PENDING' WHERE id = $1`,
      [checkoutId],
    );
    const paymentId = generateUuidV7();
    await db.query(
      `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status, provider,
                             captured_amount, refunded_amount)
       VALUES ($1, $2, $3, $4, 'INR', 'CAPTURED', 'razorpay', $4, 0)`,
      [paymentId, storeId, checkoutId, amount],
    );
    const result = await workflow.finalizeCapturedPurchase(db, { storeId, paymentId });
    if (result.status !== "completed") throw new Error(`not completed: ${result.status}`);
    return result.workflow.order;
  }

  function req(
    url: string,
    init?: { cookie?: string; method?: string; body?: unknown; headers?: Record<string, string> },
  ): Request {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    };
    if (init?.cookie) headers.cookie = init.cookie;
    return new Request(url, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  }

  const storeCtx = (storeId: string) => ({ params: Promise.resolve({ storeId }) });

  // -------------------------------------------------------------------------
  // Settings: authentication and roles
  // -------------------------------------------------------------------------

  it("rejects unauthenticated access to tax settings", async () => {
    const { store } = await createStoreWithOwner("owner-unauth@test.com");

    const read = await getSettings(req(`https://app.test/api/v1/stores/${store.id}/tax/settings`), storeCtx(store.id));
    expect(read.status).toBe(401);

    const write = await patchSettings(
      req(`https://app.test/api/v1/stores/${store.id}/tax/settings`, {
        method: "PATCH",
        body: { isEnabled: false },
      }),
      storeCtx(store.id),
    );
    expect(write.status).toBe(401);
  });

  it("lets staff read settings but only admin change them", async () => {
    const { store, user } = await createStoreWithOwner("owner-roles@test.com");
    const staff = await addMember(store.id, "staff-roles@test.com", "staff");
    const admin = await addMember(store.id, "admin-roles@test.com", "admin");
    const url = `https://app.test/api/v1/stores/${store.id}/tax/settings`;

    const staffRead = await getSettings(req(url, { cookie: staff.cookie }), storeCtx(store.id));
    expect(staffRead.status).toBe(200);
    expect((await staffRead.json()).data.isEnabled).toBe(false);

    const staffWrite = await patchSettings(
      req(url, { method: "PATCH", cookie: staff.cookie, body: { defaultGstRateBps: 500 } }),
      storeCtx(store.id),
    );
    expect(staffWrite.status).toBe(403);

    const adminWrite = await patchSettings(
      req(url, { method: "PATCH", cookie: admin.cookie, body: { defaultGstRateBps: 500 } }),
      storeCtx(store.id),
    );
    expect(adminWrite.status).toBe(200);
    expect((await adminWrite.json()).data.defaultGstRateBps).toBe(500);

    const ownerWrite = await patchSettings(
      req(url, { method: "PATCH", cookie: user.cookie, body: { defaultGstRateBps: 1200 } }),
      storeCtx(store.id),
    );
    expect(ownerWrite.status).toBe(200);
  });

  it("enables tax end to end through the API and reports domain errors as 400s", async () => {
    const { store, user } = await createStoreWithOwner("owner-enable@test.com");
    const url = `https://app.test/api/v1/stores/${store.id}/tax/settings`;

    // Incomplete registration.
    const incomplete = await patchSettings(
      req(url, { method: "PATCH", cookie: user.cookie, body: { isEnabled: true, legalName: "Acme" } }),
      storeCtx(store.id),
    );
    expect(incomplete.status).toBe(400);
    expect((await incomplete.json()).error.code).toBe("TAX_SETTINGS_INCOMPLETE");

    // A GSTIN with a bad check character.
    const badGstin = `${MH_GSTIN.slice(0, 14)}${MH_GSTIN[14] === "A" ? "B" : "A"}`;
    const invalid = await patchSettings(
      req(url, { method: "PATCH", cookie: user.cookie, body: { gstin: badGstin } }),
      storeCtx(store.id),
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("INVALID_GSTIN");

    const ok = await patchSettings(
      req(url, {
        method: "PATCH",
        cookie: user.cookie,
        body: {
          isEnabled: true,
          legalName: "Acme Traders Pvt Ltd",
          gstin: MH_GSTIN,
          addressLine1: "12 Market Road",
          city: "Mumbai",
          postalCode: "400001",
        },
      }),
      storeCtx(store.id),
    );
    expect(ok.status).toBe(200);
    const body = (await ok.json()).data;
    expect(body.isEnabled).toBe(true);
    expect(body.stateName).toBe("Maharashtra");
  });

  it("rejects a malformed settings body at the boundary", async () => {
    const { store, user } = await createStoreWithOwner("owner-shape@test.com");
    const url = `https://app.test/api/v1/stores/${store.id}/tax/settings`;

    for (const body of [{}, { isEnabled: "yes" }, { defaultGstRateBps: 99_999 }, { gstin: 5 }, []]) {
      const res = await patchSettings(
        req(url, { method: "PATCH", cookie: user.cookie, body }),
        storeCtx(store.id),
      );
      expect(res.status).toBe(400);
    }
  });

  it("keeps one store's tax settings out of reach of another store's members", async () => {
    const victim = await createStoreWithOwner("victim@test.com");
    const attacker = await createStoreWithOwner("attacker@test.com");
    await enableTax(victim.store.id);

    const read = await getSettings(
      req(`https://app.test/api/v1/stores/${victim.store.id}/tax/settings`, {
        cookie: attacker.user.cookie,
      }),
      storeCtx(victim.store.id),
    );
    expect(read.status).toBe(404);

    const write = await patchSettings(
      req(`https://app.test/api/v1/stores/${victim.store.id}/tax/settings`, {
        method: "PATCH",
        cookie: attacker.user.cookie,
        body: { isEnabled: false },
      }),
      storeCtx(victim.store.id),
    );
    expect(write.status).toBe(404);
    expect((await taxService.getSettings(db, victim.store.id)).isEnabled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Product tax profile
  // -------------------------------------------------------------------------

  it("sets, reads and clears a product's HSN code with the right roles", async () => {
    const { store, user } = await createStoreWithOwner("owner-product@test.com");
    const staff = await addMember(store.id, "staff-product@test.com", "staff");
    const { productId } = await seedProduct(store.id);
    const url = `https://app.test/api/v1/stores/${store.id}/products/${productId}/tax`;
    const ctx = { params: Promise.resolve({ storeId: store.id, productId }) };

    const staffPut = await putProductTax(
      req(url, { method: "PUT", cookie: staff.cookie, body: { hsnCode: "6109", gstRateBps: 500 } }),
      ctx,
    );
    expect(staffPut.status).toBe(403);

    const put = await putProductTax(
      req(url, { method: "PUT", cookie: user.cookie, body: { hsnCode: "6109", gstRateBps: 500 } }),
      ctx,
    );
    expect(put.status).toBe(200);
    expect((await put.json()).data.profile).toMatchObject({ hsnCode: "6109", gstRateBps: 500 });

    const get = await getProductTax(req(url, { cookie: staff.cookie }), ctx);
    expect(get.status).toBe(200);
    expect((await get.json()).data.profile.hsnCode).toBe("6109");

    const del = await deleteProductTax(req(url, { method: "DELETE", cookie: user.cookie }), ctx);
    expect(del.status).toBe(200);
    const after = await getProductTax(req(url, { cookie: user.cookie }), ctx);
    expect((await after.json()).data.profile).toBeNull();
  });

  it("rejects an invalid HSN code and a product from another store", async () => {
    const mine = await createStoreWithOwner("owner-hsn@test.com");
    const other = await createStoreWithOwner("owner-other@test.com");
    const own = await seedProduct(mine.store.id);
    const foreign = await seedProduct(other.store.id);

    const badHsn = await putProductTax(
      req(`https://app.test/api/v1/stores/${mine.store.id}/products/${own.productId}/tax`, {
        method: "PUT",
        cookie: mine.user.cookie,
        body: { hsnCode: "12", gstRateBps: 500 },
      }),
      { params: Promise.resolve({ storeId: mine.store.id, productId: own.productId }) },
    );
    expect(badHsn.status).toBe(400);

    // The foreign product id, addressed through my own store, is simply not found.
    const cross = await putProductTax(
      req(`https://app.test/api/v1/stores/${mine.store.id}/products/${foreign.productId}/tax`, {
        method: "PUT",
        cookie: mine.user.cookie,
        body: { hsnCode: "6109", gstRateBps: 500 },
      }),
      { params: Promise.resolve({ storeId: mine.store.id, productId: foreign.productId }) },
    );
    expect(cross.status).toBe(404);
    expect(await taxService.getProductProfile(db, other.store.id, foreign.productId)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Storefront checkout breakdown
  // -------------------------------------------------------------------------

  it("shows the customer the per-line GST split their payment will charge", async () => {
    const { store, slug } = await createStoreWithOwner("owner-checkout@test.com");
    await enableTax(store.id);
    const { productId, variantId } = await seedProduct(store.id, 10_000);
    await taxService.setProductProfile(db, store.id, productId, { hsnCode: "6109", gstRateBps: 1800 });
    const checkoutId = await guestCheckout(store.id, variantId);

    const res = await getStorefrontCheckout(
      req(`https://app.test/api/v1/storefront/${slug}/checkout/${checkoutId}`, {
        headers: { "x-guest-token": GUEST_TOKEN },
      }),
      { params: Promise.resolve({ storeSlug: slug, checkoutId }) },
    );
    expect(res.status).toBe(200);
    const checkout = (await res.json()).data.checkout;

    expect(checkout.taxEnabled).toBe(true);
    expect(checkout.taxTotal).toBe(1_800);
    expect(checkout.total).toBe(11_800);
    expect(checkout.tax.supplyType).toBe("INTER_STATE");
    expect(checkout.tax.placeOfSupplyName).toBe("Karnataka");
    expect(checkout.tax.igstTotal).toBe(1_800);
    expect(checkout.tax.lines[0]).toMatchObject({
      lineId: variantId,
      hsnCode: "6109",
      rateBps: 1800,
      taxableValue: 10_000,
      igst: 1_800,
    });
    // The breakdown agrees with the total the payment will charge.
    expect(checkout.tax.taxTotal).toBe(checkout.taxTotal);
  });

  it("reports taxEnabled false and no breakdown for a store that charges no tax", async () => {
    const { store, slug } = await createStoreWithOwner("owner-notax@test.com");
    const { variantId } = await seedProduct(store.id, 10_000);
    const checkoutId = await guestCheckout(store.id, variantId);

    const res = await getStorefrontCheckout(
      req(`https://app.test/api/v1/storefront/${slug}/checkout/${checkoutId}`, {
        headers: { "x-guest-token": GUEST_TOKEN },
      }),
      { params: Promise.resolve({ storeSlug: slug, checkoutId }) },
    );
    const checkout = (await res.json()).data.checkout;
    expect(checkout.taxEnabled).toBe(false);
    expect(checkout.tax).toBeNull();
    expect(checkout.total).toBe(10_000);
  });

  // -------------------------------------------------------------------------
  // Invoices
  // -------------------------------------------------------------------------

  async function paidOrderForStore(email: string) {
    const ctx = await createStoreWithOwner(email);
    await enableTax(ctx.store.id);
    const { variantId } = await seedProduct(ctx.store.id, 10_000);
    const checkoutId = await guestCheckout(ctx.store.id, variantId);
    const order = await payOrder(ctx.store.id, checkoutId);
    return { ...ctx, order };
  }

  it("serves the merchant a hardened, print-ready HTML invoice", async () => {
    const { store, user, order } = await paidOrderForStore("owner-invoice@test.com");
    const url = `https://app.test/api/v1/stores/${store.id}/orders/${order.id}/invoice`;
    const ctx = { params: Promise.resolve({ storeId: store.id, orderId: order.id }) };

    const res = await getMerchantInvoice(req(url, { cookie: user.cookie }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");

    const html = await res.text();
    expect(html).toContain("TAX INVOICE");
    expect(html).toMatch(/INV\/\d{4}\/000001/);
    expect(html).toContain(MH_GSTIN);
    expect(html).toContain("Karnataka (29)");
    expect(html).toContain("IGST");
    expect(html).toContain("Alex Buyer");
  });

  it("offers the invoice as JSON and as a file download", async () => {
    const { store, user, order } = await paidOrderForStore("owner-formats@test.com");
    const base = `https://app.test/api/v1/stores/${store.id}/orders/${order.id}/invoice`;
    const ctx = { params: Promise.resolve({ storeId: store.id, orderId: order.id }) };

    const json = await getMerchantInvoice(req(`${base}?format=json`, { cookie: user.cookie }), ctx);
    expect(json.status).toBe(200);
    const data = (await json.json()).data;
    expect(data.invoiceNumber).toMatch(/^INV\/\d{4}\/000001$/);
    expect(data.igstTotal).toBe(1_800);

    const file = await getMerchantInvoice(req(`${base}?download=1`, { cookie: user.cookie }), ctx);
    expect(file.headers.get("content-disposition")).toMatch(
      /^attachment; filename="tax-invoice-INV_\d{4}_000001\.html"$/,
    );
  });

  it("issues a missing invoice on first request and returns the same one afterwards", async () => {
    const ctx = await createStoreWithOwner("owner-lazy@test.com");
    await enableTax(ctx.store.id);
    const { variantId } = await seedProduct(ctx.store.id, 10_000);
    const checkoutId = await guestCheckout(ctx.store.id, variantId);

    // Simulate invoicing failing at purchase time.
    await db.query(`ALTER TABLE tax_invoice_sequences RENAME TO tax_invoice_sequences_off`);
    const order = await payOrder(ctx.store.id, checkoutId);
    await db.query(`ALTER TABLE tax_invoice_sequences_off RENAME TO tax_invoice_sequences`);
    expect(await taxService.getInvoiceByOrderId(db, ctx.store.id, order.id)).toBeNull();

    const url = `https://app.test/api/v1/stores/${ctx.store.id}/orders/${order.id}/invoice?format=json`;
    const route = { params: Promise.resolve({ storeId: ctx.store.id, orderId: order.id }) };

    const first = await getMerchantInvoice(req(url, { cookie: ctx.user.cookie }), route);
    expect(first.status).toBe(200);
    const issued = (await first.json()).data;
    expect(issued.invoiceNumber).toMatch(/000001$/);

    const second = await getMerchantInvoice(req(url, { cookie: ctx.user.cookie }), route);
    expect((await second.json()).data.id).toBe(issued.id);
  });

  it("has no invoice for an unpaid order or a store that charges no tax", async () => {
    const taxed = await createStoreWithOwner("owner-unpaid@test.com");
    await enableTax(taxed.store.id);
    const a = await seedProduct(taxed.store.id, 10_000);
    const checkoutId = await guestCheckout(taxed.store.id, a.variantId);
    // An order that exists but has not been paid.
    const unpaidId = generateUuidV7();
    await db.query(
      `INSERT INTO orders (id, store_id, checkout_id, order_number, status, payment_status,
                           fulfillment_status, currency, subtotal, total, grand_total)
       VALUES ($1, $2, $3, 'ORD-UNPAID', 'PENDING', 'PENDING', 'UNFULFILLED', 'INR', 10000, 10000, 10000)`,
      [unpaidId, taxed.store.id, checkoutId],
    );
    const unpaid = await getMerchantInvoice(
      req(`https://app.test/api/v1/stores/${taxed.store.id}/orders/${unpaidId}/invoice`, {
        cookie: taxed.user.cookie,
      }),
      { params: Promise.resolve({ storeId: taxed.store.id, orderId: unpaidId }) },
    );
    expect(unpaid.status).toBe(404);
    expect((await unpaid.json()).error.code).toBe("INVOICE_NOT_AVAILABLE");

    const plain = await createStoreWithOwner("owner-plain@test.com");
    const b = await seedProduct(plain.store.id, 10_000);
    const plainCheckout = await guestCheckout(plain.store.id, b.variantId);
    const plainOrder = await payOrder(plain.store.id, plainCheckout);
    const none = await getMerchantInvoice(
      req(`https://app.test/api/v1/stores/${plain.store.id}/orders/${plainOrder.id}/invoice`, {
        cookie: plain.user.cookie,
      }),
      { params: Promise.resolve({ storeId: plain.store.id, orderId: plainOrder.id }) },
    );
    expect(none.status).toBe(404);
    expect((await none.json()).error.code).toBe("INVOICE_NOT_AVAILABLE");
  });

  it("hides a store's invoices from another store's members and from anonymous callers", async () => {
    const { store, order } = await paidOrderForStore("owner-hide@test.com");
    const attacker = await createStoreWithOwner("attacker-invoice@test.com");
    const url = `https://app.test/api/v1/stores/${store.id}/orders/${order.id}/invoice`;
    const ctx = { params: Promise.resolve({ storeId: store.id, orderId: order.id }) };

    expect((await getMerchantInvoice(req(url), ctx)).status).toBe(401);
    expect(
      (await getMerchantInvoice(req(url, { cookie: attacker.user.cookie }), ctx)).status,
    ).toBe(404);

    // Reaching the order through the attacker's own store finds nothing.
    const wrongStore = await getMerchantInvoice(
      req(`https://app.test/api/v1/stores/${attacker.store.id}/orders/${order.id}/invoice`, {
        cookie: attacker.user.cookie,
      }),
      { params: Promise.resolve({ storeId: attacker.store.id, orderId: order.id }) },
    );
    expect(wrongStore.status).toBe(404);
  });

  it("gives the order's guest owner the invoice, and everyone else the same 404", async () => {
    const { slug, order } = await paidOrderForStore("owner-guest@test.com");
    const url = `https://app.test/api/v1/storefront/${slug}/orders/${order.id}/invoice`;
    const ctx = { params: Promise.resolve({ storeSlug: slug, orderId: order.id }) };

    // The ownership token works as a header...
    const viaHeader = await getStorefrontInvoice(
      req(url, { headers: { "x-guest-token": GUEST_TOKEN } }),
      ctx,
    );
    expect(viaHeader.status).toBe(200);
    expect(await viaHeader.text()).toContain("TAX INVOICE");

    // ...and as a query parameter, which is what a download link uses.
    const viaQuery = await getStorefrontInvoice(
      req(`${url}?guestToken=${GUEST_TOKEN}&download=1`),
      ctx,
    );
    expect(viaQuery.status).toBe(200);
    expect(viaQuery.headers.get("content-disposition")).toContain("attachment");

    // A wrong token and no token are indistinguishable from a missing order.
    const wrong = await getStorefrontInvoice(
      req(url, { headers: { "x-guest-token": "not-the-token" } }),
      ctx,
    );
    const anonymous = await getStorefrontInvoice(req(url), ctx);
    expect(wrong.status).toBe(404);
    expect(anonymous.status).toBe(404);
    expect((await wrong.json()).error.code).toBe("ORDER_NOT_FOUND");
    expect((await anonymous.json()).error.code).toBe("ORDER_NOT_FOUND");
  });

  it("will not hand one store's order invoice out through another store's slug", async () => {
    const { order } = await paidOrderForStore("owner-slug@test.com");
    const other = await createStoreWithOwner("owner-slug-other@test.com");

    const res = await getStorefrontInvoice(
      req(`https://app.test/api/v1/storefront/${other.slug}/orders/${order.id}/invoice`, {
        headers: { "x-guest-token": GUEST_TOKEN },
      }),
      { params: Promise.resolve({ storeSlug: other.slug, orderId: order.id }) },
    );
    expect(res.status).toBe(404);
    // Specifically an ownership failure, not "store not found": the other store
    // is active and the order simply is not in it.
    expect((await res.json()).error.code).toBe("ORDER_NOT_FOUND");
  });

  it("escapes hostile text in the buyer's address when rendering the invoice", async () => {
    const ctx = await createStoreWithOwner("owner-xss@test.com");
    await enableTax(ctx.store.id);
    const { variantId } = await seedProduct(ctx.store.id, 10_000);
    const cartId = generateUuidV7();
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [
      cartId,
      ctx.store.id,
    ]);
    const created = await checkoutService.createCheckout(db, ctx.store.id, {
      cartId,
      currency: "INR",
    });
    await checkoutService.addItem(db, ctx.store.id, created.id, { variantId, quantity: 1 });
    await checkoutService.updateAddresses(db, ctx.store.id, created.id, {
      shippingAddress: {
        ...KARNATAKA,
        firstName: `<script>alert(1)</script>`,
        lastName: `"><img src=x onerror=alert(2)>`,
      } as never,
    });
    const order = await payOrder(ctx.store.id, created.id);

    const res = await getMerchantInvoice(
      req(`https://app.test/api/v1/stores/${ctx.store.id}/orders/${order.id}/invoice`, {
        cookie: ctx.user.cookie,
      }),
      { params: Promise.resolve({ storeId: ctx.store.id, orderId: order.id }) },
    );
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });
});
