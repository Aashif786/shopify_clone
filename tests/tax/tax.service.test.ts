import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { CheckoutService } from "@calcart/checkout";
import { OrderService, OrderStatusService } from "@calcart/orders";
import { RefundService } from "@calcart/payments";
import { ReturnService } from "@calcart/returns";
import { PaymentService } from "@calcart/payments";
import {
  CheckoutTaxNotCurrentError,
  InvalidGstinError,
  InvalidGstRateError,
  InvalidHsnCodeError,
  InvalidPlaceOfSupplyError,
  TaxDomainError,
  TaxService,
  TaxSettingsIncompleteError,
  buildIssueInvoiceInput,
  computeGstinCheckChar,
  financialYearCode,
} from "@calcart/tax";
import { PaymentOrderIntegration } from "../../modules/payments/src/application/payment-order-integration.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { confirmingRefundProvider } from "../helpers/refund-provider.js";

function makeGstin(stateCode: string, pan: string, entity = "1"): string {
  const first14 = `${stateCode}${pan}${entity}Z`;
  return `${first14}${computeGstinCheckChar(first14)}`;
}

const MH_GSTIN = makeGstin("27", "AAPFU0939F");

const MAHARASHTRA = {
  addressLine1: "5 Lake View",
  city: "Pune",
  state: "Maharashtra",
  postalCode: "411001",
  country: "India",
  firstName: "Alex",
  lastName: "Buyer",
};
const KARNATAKA = { ...MAHARASHTRA, city: "Bengaluru", state: "Karnataka", postalCode: "560001" };

describe("Tax service integration (GAP-11)", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const taxService = new TaxService();
  const checkoutService = new CheckoutService();
  const orderService = new OrderService();
  const paymentService = new PaymentService();
  const workflow = new PaymentOrderIntegration();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb(): Promise<Database> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function seedStore(db: Database, slug = `tax-${generateUuidV7().slice(-8)}`) {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return storeId;
  }

  async function seedProduct(db: Database, storeId: string, price = 10_000, title = "Cotton Shirt") {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const suffix = generateUuidV7().slice(-10);
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [productId, storeId, title, `p-${suffix}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Medium', $4, $5, 'INR', 'ACTIVE')`,
      [variantId, productId, storeId, `SKU-${suffix}`, price],
    );
    return { productId, variantId };
  }

  async function enableTax(db: Database, storeId: string, overrides: Record<string, unknown> = {}) {
    return taxService.updateSettings(db, storeId, {
      isEnabled: true,
      legalName: "Acme Traders Pvt Ltd",
      gstin: MH_GSTIN,
      addressLine1: "12 Market Road",
      city: "Mumbai",
      postalCode: "400001",
      defaultGstRateBps: 0,
      ...overrides,
    });
  }

  async function newCheckout(db: Database, storeId: string) {
    const cartId = generateUuidV7();
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [
      cartId,
      storeId,
    ]);
    return checkoutService.createCheckout(db, storeId, { cartId, currency: "INR" });
  }

  async function checkoutWith(
    db: Database,
    storeId: string,
    variantId: string,
    quantity = 1,
    address: Record<string, unknown> | null = MAHARASHTRA,
  ) {
    const checkout = await newCheckout(db, storeId);
    await checkoutService.addItem(db, storeId, checkout.id, { variantId, quantity });
    if (address) {
      await checkoutService.updateAddresses(db, storeId, checkout.id, {
        shippingAddress: address as never,
      });
    }
    return checkoutService.getCheckout(db, storeId, checkout.id);
  }

  async function snapshotOf(db: Database, storeId: string, checkoutId: string) {
    return taxService.getCheckoutTaxSnapshot(db, storeId, checkoutId);
  }

  /** Marks a checkout as awaiting payment and inserts a captured payment for it. */
  async function capture(db: Database, storeId: string, checkoutId: string) {
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
    return paymentId;
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  it("is off by default and reports a default settings object", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const settings = await taxService.getSettings(db, storeId);
    expect(settings.isEnabled).toBe(false);
    expect(settings.isDefault).toBe(true);
    expect(settings.gstin).toBeNull();
  });

  it("refuses to enable tax until the registration is complete", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);

    await expect(
      taxService.updateSettings(db, storeId, { isEnabled: true, legalName: "Acme" }),
    ).rejects.toThrow(TaxSettingsIncompleteError);

    // Nothing was persisted by the failed attempt.
    expect((await taxService.getSettings(db, storeId)).isDefault).toBe(true);
  });

  it("validates the GSTIN checksum and its state prefix", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);

    const badCheck = `${MH_GSTIN.slice(0, 14)}${MH_GSTIN[14] === "A" ? "B" : "A"}`;
    await expect(
      taxService.updateSettings(db, storeId, { gstin: badCheck }),
    ).rejects.toThrow(InvalidGstinError);

    await expect(
      taxService.updateSettings(db, storeId, { gstin: MH_GSTIN, stateCode: "29" }),
    ).rejects.toThrow(InvalidGstinError);
  });

  it("derives the state from the GSTIN and normalises case", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);

    const saved = await enableTax(db, storeId, { gstin: ` ${MH_GSTIN.toLowerCase()} ` });
    expect(saved.gstin).toBe(MH_GSTIN);
    expect(saved.stateCode).toBe("27");
    expect(saved.stateName).toBe("Maharashtra");
    expect(saved.isEnabled).toBe(true);
  });

  it("rejects a malformed PIN code and an out-of-range default rate", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);

    await expect(enableTax(db, storeId, { postalCode: "12" })).rejects.toThrow(TaxDomainError);
    await expect(enableTax(db, storeId, { defaultGstRateBps: 4001 })).rejects.toThrow(
      InvalidGstRateError,
    );
  });

  it("is backed by database constraints, not only application checks", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);

    // Enabled with no registration details.
    await expect(
      db.query(`INSERT INTO tax_settings (id, store_id, is_enabled) VALUES ($1, $2, TRUE)`, [
        generateUuidV7(),
        storeId,
      ]),
    ).rejects.toThrow();

    // GSTIN whose prefix disagrees with the stated state.
    await expect(
      db.query(
        `INSERT INTO tax_settings (id, store_id, gstin, state_code) VALUES ($1, $2, $3, '29')`,
        [generateUuidV7(), storeId, MH_GSTIN],
      ),
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Product tax profiles
  // -------------------------------------------------------------------------

  it("stores, updates and removes a product's HSN code and rate", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { productId } = await seedProduct(db, storeId);

    expect(await taxService.getProductProfile(db, storeId, productId)).toBeNull();

    const created = await taxService.setProductProfile(db, storeId, productId, {
      hsnCode: "6109",
      gstRateBps: 500,
    });
    expect(created.hsnCode).toBe("6109");
    expect(created.gstRateBps).toBe(500);

    const updated = await taxService.setProductProfile(db, storeId, productId, {
      hsnCode: "61091000",
      gstRateBps: 1200,
    });
    expect(updated.hsnCode).toBe("61091000");
    expect(updated.gstRateBps).toBe(1200);

    expect(await taxService.deleteProductProfile(db, storeId, productId)).toBe(true);
    expect(await taxService.getProductProfile(db, storeId, productId)).toBeNull();
    expect(await taxService.deleteProductProfile(db, storeId, productId)).toBe(false);
  });

  it("rejects invalid HSN codes and rates", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { productId } = await seedProduct(db, storeId);

    for (const hsnCode of ["", "123", "123456789", "61A9", " "]) {
      await expect(
        taxService.setProductProfile(db, storeId, productId, { hsnCode, gstRateBps: 500 }),
      ).rejects.toThrow(InvalidHsnCodeError);
    }
    await expect(
      taxService.setProductProfile(db, storeId, productId, { hsnCode: "6109", gstRateBps: -1 }),
    ).rejects.toThrow(InvalidGstRateError);
  });

  it("will not attach a profile to another store's product", async () => {
    const db = await setupDb();
    const storeA = await seedStore(db, "tax-a");
    const storeB = await seedStore(db, "tax-b");
    const { productId } = await seedProduct(db, storeA);

    await expect(
      taxService.setProductProfile(db, storeB, productId, { hsnCode: "6109", gstRateBps: 500 }),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });

    expect(await taxService.getProductProfile(db, storeA, productId)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Checkout calculation
  // -------------------------------------------------------------------------

  it("leaves a tax-disabled store exactly as it was, including a merchant-set tax", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 2);
    expect(checkout.taxTotal).toBe(0);
    expect(checkout.total).toBe(20_000);
    expect(await snapshotOf(db, storeId, checkout.id)).toBeNull();

    // The legacy merchant override keeps working while tax is off.
    const overridden = await checkoutService.updateTotals(db, storeId, checkout.id, {
      taxTotal: 1_500,
    });
    expect(overridden.taxTotal).toBe(1_500);
    expect(overridden.total).toBe(21_500);
  });

  it("splits intra-state GST into CGST and SGST in the checkout total", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId);
    const { productId, variantId } = await seedProduct(db, storeId, 10_000);
    await taxService.setProductProfile(db, storeId, productId, { hsnCode: "6109", gstRateBps: 1800 });

    const checkout = await checkoutWith(db, storeId, variantId, 2, MAHARASHTRA);

    expect(checkout.subtotal).toBe(20_000);
    expect(checkout.taxTotal).toBe(3_600);
    expect(checkout.total).toBe(23_600);

    const snap = await snapshotOf(db, storeId, checkout.id);
    expect(snap?.supplyType).toBe("INTRA_STATE");
    expect(snap?.placeOfSupplyName).toBe("Maharashtra");
    expect(snap?.cgstTotal).toBe(1_800);
    expect(snap?.sgstTotal).toBe(1_800);
    expect(snap?.igstTotal).toBe(0);
    expect(snap?.lines[0]).toMatchObject({
      lineId: variantId,
      hsnCode: "6109",
      rateBps: 1800,
      taxableValue: 20_000,
      cgst: 1_800,
      sgst: 1_800,
      igst: 0,
    });
  });

  it("charges IGST for a different state and flips when the address changes", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId);
    const { productId, variantId } = await seedProduct(db, storeId, 10_000);
    await taxService.setProductProfile(db, storeId, productId, { hsnCode: "6109", gstRateBps: 1800 });

    const checkout = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    let snap = await snapshotOf(db, storeId, checkout.id);
    expect(snap?.supplyType).toBe("INTER_STATE");
    expect(snap?.igstTotal).toBe(1_800);
    expect(snap?.cgstTotal).toBe(0);
    expect(checkout.total).toBe(11_800);

    // Moving the delivery into the seller's own state must re-split the tax.
    const moved = await checkoutService.updateAddresses(db, storeId, checkout.id, {
      shippingAddress: MAHARASHTRA as never,
    });
    snap = await snapshotOf(db, storeId, checkout.id);
    expect(snap?.supplyType).toBe("INTRA_STATE");
    expect(snap?.cgstTotal).toBe(900);
    expect(snap?.sgstTotal).toBe(900);
    expect(snap?.igstTotal).toBe(0);
    expect(moved.taxTotal).toBe(1_800);
    expect(moved.total).toBe(11_800);
  });

  it("recalculates when items change, so a stale tax can never be charged", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId);
    const a = await seedProduct(db, storeId, 10_000, "Shirt");
    const b = await seedProduct(db, storeId, 5_000, "Socks");
    await taxService.setProductProfile(db, storeId, a.productId, { hsnCode: "6109", gstRateBps: 1800 });
    await taxService.setProductProfile(db, storeId, b.productId, { hsnCode: "6115", gstRateBps: 500 });

    const checkout = await checkoutWith(db, storeId, a.variantId, 1, KARNATAKA);
    expect(checkout.taxTotal).toBe(1_800);

    const added = await checkoutService.addItem(db, storeId, checkout.id, {
      variantId: b.variantId,
      quantity: 2,
    });
    expect(added.taxTotal).toBe(1_800 + 500); // 18% of 10000 + 5% of 10000
    expect(added.total).toBe(10_000 + 10_000 + 2_300);

    const resized = await checkoutService.updateItemQuantity(db, storeId, checkout.id, a.variantId, 3);
    expect(resized.taxTotal).toBe(5_400 + 500);

    const removed = await checkoutService.removeItem(db, storeId, checkout.id, a.variantId);
    expect(removed.taxTotal).toBe(500);
    expect(removed.total).toBe(10_000 + 500);

    const cleared = await checkoutService.clearItems(db, storeId, checkout.id);
    expect(cleared.taxTotal).toBe(0);
    expect(cleared.total).toBe(0);
  });

  it("levies tax on the discounted amount and allocates the discount across lines", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId);
    const a = await seedProduct(db, storeId, 6_000, "Shirt");
    const b = await seedProduct(db, storeId, 4_000, "Socks");
    await taxService.setProductProfile(db, storeId, a.productId, { hsnCode: "6109", gstRateBps: 500 });
    await taxService.setProductProfile(db, storeId, b.productId, { hsnCode: "6115", gstRateBps: 1800 });

    const checkout = await checkoutWith(db, storeId, a.variantId, 1, KARNATAKA);
    await checkoutService.addItem(db, storeId, checkout.id, { variantId: b.variantId, quantity: 1 });

    const discounted = await checkoutService.updateTotals(db, storeId, checkout.id, {
      discountTotal: 1_000,
    });

    // 1000 split 600 / 400: taxable 5400 @ 5% and 3600 @ 18%.
    expect(discounted.taxTotal).toBe(270 + 648);
    expect(discounted.total).toBe(10_000 - 1_000 + 918);

    const snap = await snapshotOf(db, storeId, checkout.id);
    const byLine = new Map(snap?.lines.map((l) => [l.lineId, l]));
    expect(byLine.get(a.variantId)?.discountAmount).toBe(600);
    expect(byLine.get(b.variantId)?.discountAmount).toBe(400);
  });

  it("uses the store default rate for a product with no profile", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1200 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    expect(checkout.taxTotal).toBe(1_200);
    const snap = await snapshotOf(db, storeId, checkout.id);
    expect(snap?.lines[0]?.hsnCode).toBeNull();
    expect(snap?.lines[0]?.rateBps).toBe(1200);
  });

  it("treats a delivery outside India as an export with no GST", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, {
      ...MAHARASHTRA,
      state: "California",
      country: "United States",
      postalCode: "94105",
    });
    expect(checkout.taxTotal).toBe(0);
    const snap = await snapshotOf(db, storeId, checkout.id);
    expect(snap?.supplyType).toBe("EXPORT");
    expect(snap?.placeOfSupplyCode).toBeNull();
  });

  it("rejects an unrecognised Indian state and leaves the checkout untouched", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    const before = await checkoutService.getCheckout(db, storeId, checkout.id);

    await expect(
      checkoutService.updateAddresses(db, storeId, checkout.id, {
        shippingAddress: { ...KARNATAKA, state: "Atlantis" } as never,
      }),
    ).rejects.toThrow(InvalidPlaceOfSupplyError);

    const after = await checkoutService.getCheckout(db, storeId, checkout.id);
    expect(after.shippingAddress?.state).toBe("Karnataka");
    expect(after.taxTotal).toBe(before.taxTotal);
    expect(after.total).toBe(before.total);
  });

  it("makes the tax engine authoritative, overriding a manually supplied figure", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    const attempted = await checkoutService.updateTotals(db, storeId, checkout.id, {
      taxTotal: 1,
    });
    expect(attempted.taxTotal).toBe(1_800);
  });

  // -------------------------------------------------------------------------
  // Payment guard
  // -------------------------------------------------------------------------

  it("refuses payment for a tax-enabled checkout that has no address yet", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, null);
    expect(checkout.taxTotal).toBe(0);
    expect(await snapshotOf(db, storeId, checkout.id)).toBeNull();

    await expect(
      paymentService.createPayment(db, {
        storeId,
        checkoutId: checkout.id,
        idempotencyKey: "tax-no-address",
      }),
    ).rejects.toThrow(CheckoutTaxNotCurrentError);

    const payments = await db.query(`SELECT COUNT(*)::int AS c FROM payments WHERE checkout_id = $1`, [
      checkout.id,
    ]);
    expect(payments.rows[0].c).toBe(0);
  });

  it("allows payment once the checkout carries a current tax calculation", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    const result = await paymentService.createPayment(db, {
      storeId,
      checkoutId: checkout.id,
      idempotencyKey: "tax-ok",
    });
    // The customer is charged the taxed amount, not the bare subtotal.
    expect(result.payment.amount).toBe(11_800);
  });

  it("refuses payment when the stored tax has been tampered with", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    await db.query(`UPDATE checkouts SET tax_total = 0, total = 10000 WHERE id = $1`, [checkout.id]);

    await expect(
      paymentService.createPayment(db, {
        storeId,
        checkoutId: checkout.id,
        idempotencyKey: "tax-tamper",
      }),
    ).rejects.toThrow(CheckoutTaxNotCurrentError);
  });

  it("does not interfere with payment for a tax-disabled store", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, null);
    const result = await paymentService.createPayment(db, {
      storeId,
      checkoutId: checkout.id,
      idempotencyKey: "tax-off",
    });
    expect(result.payment.amount).toBe(10_000);
  });

  // -------------------------------------------------------------------------
  // Order handoff and invoices
  // -------------------------------------------------------------------------

  /**
   * Runs the purchase through `finalizeCapturedPurchase`, the entry point the
   * webhook, recovery and payment-verify paths all use. It wraps the whole
   * workflow in ONE transaction, which is exactly the condition under which a
   * failed statement would abort everything in it. Calling
   * `completePurchaseWorkflow` on a pool instead would silently skip that
   * condition and make the isolation tests prove nothing.
   */
  async function finalize(db: Database, storeId: string, paymentId: string) {
    const result = await workflow.finalizeCapturedPurchase(db, { storeId, paymentId });
    if (result.status !== "completed") {
      throw new Error(`Purchase did not complete: ${result.status}`);
    }
    return result.workflow;
  }

  async function paidTaxedOrder(
    db: Database,
    storeId: string,
    variantId: string,
    quantity = 2,
    address: Record<string, unknown> = MAHARASHTRA,
  ) {
    const checkout = await checkoutWith(db, storeId, variantId, quantity, address);
    const paymentId = await capture(db, storeId, checkout.id);
    const result = await finalize(db, storeId, paymentId);
    return { checkout, paymentId, order: result.order };
  }

  it("itemises tax and discount on the order lines and reconciles to the total", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId);
    const a = await seedProduct(db, storeId, 6_000, "Shirt");
    const b = await seedProduct(db, storeId, 4_000, "Socks");
    await taxService.setProductProfile(db, storeId, a.productId, { hsnCode: "6109", gstRateBps: 500 });
    await taxService.setProductProfile(db, storeId, b.productId, { hsnCode: "6115", gstRateBps: 1800 });

    const checkout = await checkoutWith(db, storeId, a.variantId, 1, KARNATAKA);
    await checkoutService.addItem(db, storeId, checkout.id, { variantId: b.variantId, quantity: 1 });
    await checkoutService.updateTotals(db, storeId, checkout.id, { discountTotal: 1_000 });
    const paymentId = await capture(db, storeId, checkout.id);
    const { order } = await finalize(db, storeId, paymentId);

    expect(order.subtotal).toBe(10_000);
    expect(order.discountTotal).toBe(1_000);
    expect(order.taxTotal).toBe(918);
    expect(order.grandTotal).toBe(9_918);

    const items = order.items ?? [];
    expect(items.reduce((s, i) => s + i.discountAmount, 0)).toBe(1_000);
    expect(items.reduce((s, i) => s + i.taxAmount, 0)).toBe(918);
    // Line totals now add up to the order total, so a return can refund a line
    // for exactly what that line was charged.
    expect(items.reduce((s, i) => s + i.lineTotal, 0)).toBe(order.grandTotal - order.shippingTotal);
  });

  it("still allocates the discount per line when tax is not enabled", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const a = await seedProduct(db, storeId, 6_000, "Shirt");
    const b = await seedProduct(db, storeId, 4_000, "Socks");

    const checkout = await checkoutWith(db, storeId, a.variantId, 1, null);
    await checkoutService.addItem(db, storeId, checkout.id, { variantId: b.variantId, quantity: 1 });
    await checkoutService.updateTotals(db, storeId, checkout.id, { discountTotal: 1_000 });
    const paymentId = await capture(db, storeId, checkout.id);
    const { order } = await finalize(db, storeId, paymentId);

    const items = order.items ?? [];
    expect(items.reduce((s, i) => s + i.discountAmount, 0)).toBe(1_000);
    expect(items.every((i) => i.taxAmount === 0)).toBe(true);
    expect(items.reduce((s, i) => s + i.lineTotal, 0)).toBe(order.grandTotal);
    // A tax-disabled store gets no invoice.
    expect(await taxService.getInvoiceByOrderId(db, storeId, order.id)).toBeNull();
  });

  it("issues a numbered GST invoice for a paid order, built from the frozen snapshot", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId);
    const { productId, variantId } = await seedProduct(db, storeId, 10_000);
    await taxService.setProductProfile(db, storeId, productId, { hsnCode: "6109", gstRateBps: 1800 });

    const { order } = await paidTaxedOrder(db, storeId, variantId, 2, MAHARASHTRA);
    const invoice = await taxService.getInvoiceByOrderId(db, storeId, order.id);

    expect(invoice).not.toBeNull();
    expect(invoice?.invoiceNumber).toBe(`INV/${financialYearCode(new Date())}/000001`);
    expect(invoice?.invoiceNumber.length).toBeLessThanOrEqual(16);
    expect(invoice?.supplyType).toBe("INTRA_STATE");
    expect(invoice?.placeOfSupplyName).toBe("Maharashtra");
    expect(invoice?.seller.gstin).toBe(MH_GSTIN);
    expect(invoice?.seller.legalName).toBe("Acme Traders Pvt Ltd");
    expect(invoice?.buyer.name).toBe("Alex Buyer");
    expect(invoice?.cgstTotal).toBe(1_800);
    expect(invoice?.sgstTotal).toBe(1_800);
    expect(invoice?.taxableTotal).toBe(20_000);
    expect(invoice?.grandTotal).toBe(order.grandTotal);
    // Narrow once, so the arithmetic below cannot silently operate on undefined.
    const issued = invoice!;
    expect(issued.taxableTotal + issued.taxTotal + issued.shippingTotal).toBe(
      issued.grandTotal,
    );

    expect(invoice?.lines).toHaveLength(1);
    expect(invoice?.lines[0]).toMatchObject({
      hsnCode: "6109",
      quantity: 2,
      gstRateBps: 1800,
      taxableValue: 20_000,
      cgst: 1_800,
      sgst: 1_800,
      lineTotal: 23_600,
    });
    // The invoice line links back to the order line.
    expect(invoice?.lines[0]?.orderItemId).toBe(order.items?.[0]?.id);
  });

  it("is idempotent: a repeated workflow reuses the invoice and consumes one number", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const { order, paymentId } = await paidTaxedOrder(db, storeId, variantId, 1, KARNATAKA);
    await finalize(db, storeId, paymentId);

    const count = await db.query(`SELECT COUNT(*)::int AS c FROM tax_invoices WHERE store_id = $1`, [
      storeId,
    ]);
    expect(count.rows[0].c).toBe(1);

    const second = await paidTaxedOrder(db, storeId, variantId, 1, KARNATAKA);
    const secondInvoice = await taxService.getInvoiceByOrderId(db, storeId, second.order.id);
    expect(secondInvoice?.invoiceNumber).toMatch(/000002$/);
    expect(order.id).not.toBe(second.order.id);
  });

  it("issues exactly one invoice when two issuers race on the same order", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const { order } = await paidTaxedOrder(db, storeId, variantId, 1, KARNATAKA);

    // Remove the workflow's invoice? It is immutable, so race on a second order
    // whose workflow invoice is suppressed instead.
    const second = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    const paymentId = await capture(db, storeId, second.id);
    await db.query(`ALTER TABLE tax_invoice_sequences RENAME TO tax_invoice_sequences_off`);
    const { order: raced } = await finalize(db, storeId, paymentId);
    await db.query(`ALTER TABLE tax_invoice_sequences_off RENAME TO tax_invoice_sequences`);
    expect(await taxService.getInvoiceByOrderId(db, storeId, raced.id)).toBeNull();

    const full = await orderService.getOrderById(db, storeId, raced.id);
    const input = buildIssueInvoiceInput(full!)!;
    const [a, b] = await Promise.all([
      taxService.issueInvoiceForOrder(db, input),
      taxService.issueInvoiceForOrder(db, input),
    ]);

    expect(a?.id).toBe(b?.id);
    expect(a?.invoiceNumber).toBe(b?.invoiceNumber);
    const rows = await db.query(
      `SELECT COUNT(*)::int AS c FROM tax_invoices WHERE order_id = $1`,
      [raced.id],
    );
    expect(rows.rows[0].c).toBe(1);

    // The two issuers consumed one number between them: no gap.
    const numbers = await db.query(
      `SELECT sequence_number FROM tax_invoices WHERE store_id = $1 ORDER BY sequence_number`,
      [storeId],
    );
    expect(numbers.rows.map((r) => r.sequence_number)).toEqual([1, 2]);
    expect(order.id).not.toBe(raced.id);
  });

  it("never lets an invoice failure abort the purchase, and issues it later", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    // Break invoice numbering with a real SQL error. The database layer latches
    // the first error in a transaction and rejects everything after it, so had
    // invoicing run inside the purchase transaction this would have rolled back
    // a paid order. Invoicing runs after the purchase commits instead.
    await db.query(`ALTER TABLE tax_invoice_sequences RENAME TO tax_invoice_sequences_off`);
    let order;
    try {
      ({ order } = await paidTaxedOrder(db, storeId, variantId, 1, KARNATAKA));
    } finally {
      await db.query(`ALTER TABLE tax_invoice_sequences_off RENAME TO tax_invoice_sequences`);
    }

    // The order and its payment survived.
    const orderRow = await db.query(`SELECT payment_status FROM orders WHERE id = $1`, [order!.id]);
    expect(orderRow.rows[0].payment_status).toBe("PAID");
    const checkoutRow = await db.query(`SELECT status FROM checkouts WHERE id = $1`, [
      order!.checkoutId,
    ]);
    expect(checkoutRow.rows[0].status).toBe("COMPLETED");
    expect(await taxService.getInvoiceByOrderId(db, storeId, order!.id)).toBeNull();

    // Lazy issuance recovers it with the first number, so nothing was skipped.
    const full = await orderService.getOrderById(db, storeId, order!.id);
    const issued = await taxService.issueInvoiceForOrder(db, buildIssueInvoiceInput(full!)!);
    expect(issued?.invoiceNumber).toMatch(/000001$/);
  });

  it("does not consume an invoice number when issuance fails", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const { order } = await paidTaxedOrder(db, storeId, variantId, 1, KARNATAKA);

    // Already invoiced; use a second order for a clean failure.
    const second = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    const paymentId = await capture(db, storeId, second.id);
    await db.query(`ALTER TABLE tax_invoice_sequences RENAME TO tax_invoice_sequences_off`);
    const { order: next } = await finalize(db, storeId, paymentId);
    await db.query(`ALTER TABLE tax_invoice_sequences_off RENAME TO tax_invoice_sequences`);

    const full = await orderService.getOrderById(db, storeId, next.id);
    const input = buildIssueInvoiceInput(full!)!;

    // A total that does not reconcile is refused, loudly.
    await expect(
      taxService.issueInvoiceForOrder(db, { ...input, grandTotal: input.grandTotal + 1 }),
    ).rejects.toMatchObject({ code: "INVOICE_TOTAL_MISMATCH" });

    // The failed attempt rolled its number back, so the next invoice is 2, not 3.
    const issued = await taxService.issueInvoiceForOrder(db, input);
    expect(issued?.invoiceNumber).toMatch(/000002$/);
    expect(order.id).not.toBe(next.id);
  });

  it("numbers each financial year independently", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const first = await paidTaxedOrder(db, storeId, variantId, 1, KARNATAKA);
    const base = (await orderService.getOrderById(db, storeId, first.order.id))!;

    // A different order in a later financial year starts again at 1.
    const second = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    const paymentId = await capture(db, storeId, second.id);
    await db.query(`ALTER TABLE tax_invoice_sequences RENAME TO tax_invoice_sequences_off`);
    const { order } = await finalize(db, storeId, paymentId);
    await db.query(`ALTER TABLE tax_invoice_sequences_off RENAME TO tax_invoice_sequences`);
    const full = (await orderService.getOrderById(db, storeId, order.id))!;

    const nextYear = new Date("2099-06-01T00:00:00.000Z");
    const issued = await taxService.issueInvoiceForOrder(db, {
      ...buildIssueInvoiceInput(full)!,
      issuedAt: nextYear,
    });
    expect(issued?.invoiceNumber).toBe("INV/9900/000001");
    expect(issued?.financialYear).toBe("9900");
    expect(base.id).not.toBe(full.id);
  });

  it("makes issued invoices immutable at the database level", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const { order } = await paidTaxedOrder(db, storeId, variantId, 1, KARNATAKA);

    await expect(
      db.query(`UPDATE tax_invoices SET grand_total = 1 WHERE order_id = $1`, [order.id]),
    ).rejects.toThrow(/immutable/i);
    await expect(
      db.query(`DELETE FROM tax_invoices WHERE order_id = $1`, [order.id]),
    ).rejects.toThrow(/immutable/i);
    await expect(
      db.query(`UPDATE tax_invoice_lines SET taxable_value = 1 WHERE store_id = $1`, [storeId]),
    ).rejects.toThrow(/immutable/i);
    await expect(
      db.query(`DELETE FROM tax_invoice_lines WHERE store_id = $1`, [storeId]),
    ).rejects.toThrow(/immutable/i);
  });

  it("is unaffected by a later rate change: the invoice uses the frozen snapshot", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId);
    const { productId, variantId } = await seedProduct(db, storeId, 10_000);
    await taxService.setProductProfile(db, storeId, productId, { hsnCode: "6109", gstRateBps: 500 });

    const { order } = await paidTaxedOrder(db, storeId, variantId, 1, KARNATAKA);
    await taxService.setProductProfile(db, storeId, productId, { hsnCode: "6109", gstRateBps: 2800 });
    await taxService.updateSettings(db, storeId, { legalName: "Renamed Traders Ltd" });

    const invoice = await taxService.getInvoiceByOrderId(db, storeId, order.id);
    expect(invoice?.igstTotal).toBe(500); // 5% as charged, not the new 28%
    expect(invoice?.lines[0]?.gstRateBps).toBe(500);
    expect(invoice?.seller.legalName).toBe("Acme Traders Pvt Ltd");
  });


  // -------------------------------------------------------------------------
  // Returns now refund the tax the customer actually paid
  // -------------------------------------------------------------------------

  it("refunds a returned taxed, discounted line for exactly what it was charged", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId);
    const { productId, variantId } = await seedProduct(db, storeId, 10_000);
    await taxService.setProductProfile(db, storeId, productId, { hsnCode: "6109", gstRateBps: 1800 });

    // 2 x 10000, 2000 discount => taxable 18000, GST 3240, charged 21240.
    const checkout = await checkoutWith(db, storeId, variantId, 2, KARNATAKA);
    await checkoutService.updateTotals(db, storeId, checkout.id, { discountTotal: 2_000 });
    const paymentId = await capture(db, storeId, checkout.id);
    const { order } = await finalize(db, storeId, paymentId);
    expect(order.grandTotal).toBe(21_240);

    const line = order.items![0]!;
    expect(line.discountAmount).toBe(2_000);
    expect(line.taxAmount).toBe(3_240);
    expect(line.lineTotal).toBe(21_240);

    await new OrderStatusService().updateFulfillmentStatus(db, {
      storeId,
      orderId: order.id,
      fulfillmentStatus: "FULFILLED",
      actorType: "MERCHANT",
    });

    const returns = new ReturnService();
    const refunds = new RefundService();

    // Return one of the two units: half the line's charge, GST included.
    const first = await returns.createReturnRequest(db, {
      storeId,
      orderId: order.id,
      reason: "Faulty",
      items: [{ orderItemId: line.id, quantity: 1 }],
    });
    expect(first.requestedAmount).toBe(10_620);

    await returns.approveReturnRequest(db, { storeId, returnRequestId: first.id });
    await returns.markReturnReceived(db, { storeId, returnRequestId: first.id });
    const done = await returns.refundReturnRequest(db, refunds, {
      storeId,
      returnRequestId: first.id,
      provider: confirmingRefundProvider(),
    });
    expect(done.returnRequest.status).toBe("REFUNDED");
    expect(done.returnRequest.refundedAmount).toBe(10_620);

    // Return the other unit: together they refund the full charge, no more.
    const second = await returns.createReturnRequest(db, {
      storeId,
      orderId: order.id,
      reason: "Faulty too",
      items: [{ orderItemId: line.id, quantity: 1 }],
    });
    expect(second.requestedAmount).toBe(10_620);
    await returns.approveReturnRequest(db, { storeId, returnRequestId: second.id });
    await returns.markReturnReceived(db, { storeId, returnRequestId: second.id });
    await returns.refundReturnRequest(db, refunds, {
      storeId,
      returnRequestId: second.id,
      provider: confirmingRefundProvider(),
    });

    const refunded = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM refunds
       WHERE order_id = $1 AND status = 'SUCCEEDED'`,
      [order.id],
    );
    expect(Number(refunded.rows[0].total)).toBe(21_240);
  });

  it("no longer over-refunds a discounted order whose store charges no tax", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { variantId } = await seedProduct(db, storeId, 10_000);

    // 2 x 10000 with 4000 off: the customer paid 16000, not 20000.
    const checkout = await checkoutWith(db, storeId, variantId, 2, null);
    await checkoutService.updateTotals(db, storeId, checkout.id, { discountTotal: 4_000 });
    const paymentId = await capture(db, storeId, checkout.id);
    const { order } = await finalize(db, storeId, paymentId);
    expect(order.grandTotal).toBe(16_000);

    await new OrderStatusService().updateFulfillmentStatus(db, {
      storeId,
      orderId: order.id,
      fulfillmentStatus: "FULFILLED",
      actorType: "MERCHANT",
    });

    const returns = new ReturnService();
    const whole = await returns.createReturnRequest(db, {
      storeId,
      orderId: order.id,
      reason: "Changed mind",
      items: [{ orderItemId: order.items![0]!.id, quantity: 2 }],
    });
    // Before the discount was itemised this requested 20000: more than was paid.
    expect(whole.requestedAmount).toBe(16_000);
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it("keeps snapshots, invoices and settings invisible across stores", async () => {
    const db = await setupDb();
    const storeA = await seedStore(db, "iso-a");
    const storeB = await seedStore(db, "iso-b");
    await enableTax(db, storeA, { defaultGstRateBps: 1800 });
    const { variantId } = await seedProduct(db, storeA, 10_000);
    const { order, checkout } = await paidTaxedOrder(db, storeA, variantId, 1, KARNATAKA);

    expect(await taxService.getCheckoutTaxSnapshot(db, storeB, checkout.id)).toBeNull();
    expect(await taxService.getInvoiceByOrderId(db, storeB, order.id)).toBeNull();
    expect((await taxService.getSettings(db, storeB)).isEnabled).toBe(false);

    // The other store's invoice cannot be issued through a foreign store id.
    const full = (await orderService.getOrderById(db, storeA, order.id))!;
    const input = { ...buildIssueInvoiceInput(full)!, storeId: storeB };
    expect(await taxService.issueInvoiceForOrder(db, input).catch(() => null)).toBeNull();
    const leaked = await db.query(`SELECT COUNT(*)::int AS c FROM tax_invoices WHERE store_id = $1`, [
      storeB,
    ]);
    expect(leaked.rows[0].c).toBe(0);
  });
});
