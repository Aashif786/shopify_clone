import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { CheckoutService } from "@calcart/checkout";
import { PaymentService } from "@calcart/payments";
import {
  CheckoutShippingNotCurrentError,
  InvalidShippingRateError,
  InvalidShippingWeightError,
  InvalidShippingZoneError,
  ShippingRateNotAvailableError,
  ShippingRateNotFoundError,
  ShippingService,
  ShippingZoneNotFoundError,
} from "@calcart/shipping";
import {
  CheckoutTaxNotCurrentError,
  SHIPPING_LINE_ID,
  TaxService,
  computeGstinCheckChar,
} from "@calcart/tax";
import { PaymentOrderIntegration } from "../../modules/payments/src/application/payment-order-integration.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

function makeGstin(stateCode: string, pan: string, entity = "1"): string {
  const first14 = `${stateCode}${pan}${entity}Z`;
  return `${first14}${computeGstinCheckChar(first14)}`;
}

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
const NEW_YORK = {
  ...MAHARASHTRA,
  city: "New York",
  state: "New York",
  postalCode: "10001",
  country: "United States",
};

describe("Shipping rate engine integration (GAP-12 / M6a)", { timeout: 120_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const shipping = new ShippingService();
  const taxService = new TaxService();
  const checkoutService = new CheckoutService();
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

  async function seedStore(db: Database, slug = `ship-${generateUuidV7().slice(-8)}`) {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${slug}`,
    ]);
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

  async function enableShipping(db: Database, storeId: string, defaultWeightGrams = 500) {
    return shipping.updateSettings(db, storeId, { isEnabled: true, defaultWeightGrams });
  }

  /** An all-India zone with a standard and an express rate. */
  async function standardSetup(db: Database, storeId: string) {
    await enableShipping(db, storeId);
    const zone = await shipping.createZone(db, storeId, { name: "India", countryCodes: ["India"] });
    const standard = await shipping.createRate(db, storeId, zone.id, {
      name: "Standard",
      price: 5_000,
      estimatedDaysMin: 4,
      estimatedDaysMax: 7,
    });
    const express = await shipping.createRate(db, storeId, zone.id, {
      name: "Express",
      price: 12_000,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
    });
    return { zone, standard, express };
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

  async function pay(db: Database, storeId: string, checkoutId: string) {
    return paymentService.createPayment(db, {
      storeId,
      checkoutId,
      idempotencyKey: `k-${generateUuidV7()}`,
    });
  }

  // -------------------------------------------------------------------------
  // Settings, zones, rates: validation and isolation
  // -------------------------------------------------------------------------

  it("is off by default and leaves a merchant-set shipping total alone", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const settings = await shipping.getSettings(db, storeId);
    expect(settings.isEnabled).toBe(false);
    expect(settings.isDefault).toBe(true);

    const checkout = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    expect(checkout.shippingTotal).toBe(0);
    expect(await shipping.getCheckoutQuote(db, storeId, checkout.id)).toBeNull();

    // The legacy merchant override keeps working while shipping is off.
    const manual = await checkoutService.updateTotals(db, storeId, checkout.id, { shippingTotal: 4_500 });
    expect(manual.shippingTotal).toBe(4_500);
    expect(manual.total).toBe(14_500);
  });

  it("validates zones before storing them", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);

    for (const input of [
      { name: "" },
      { name: "x".repeat(101) },
      { name: "Bad state", stateCodes: ["99"] },
      { name: "Bad prefix", postalPrefixes: ["!!"] },
      { name: "Bad prefix length", postalPrefixes: ["12345678901"] },
      { name: "State in a foreign zone", countryCodes: ["FR"], stateCodes: ["27"] },
      { name: "Bad priority", priority: -1 },
      { name: "Too many", countryCodes: Array.from({ length: 51 }, (_, i) => `C${i}`) },
    ]) {
      await expect(shipping.createZone(db, storeId, input as never)).rejects.toThrow(
        InvalidShippingZoneError,
      );
    }
    expect(await shipping.listZones(db, storeId)).toEqual([]);
  });

  it("normalises zone input so matching is predictable", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const zone = await shipping.createZone(db, storeId, {
      name: "  South India  ",
      countryCodes: ["india", "IN", "Bharat"],
      stateCodes: ["29", "29", "33"],
      postalPrefixes: ["560 0", "5600", "6-0"],
    });
    expect(zone.name).toBe("South India");
    expect(zone.countryCodes).toEqual(["IN"]);
    expect(zone.stateCodes).toEqual(["29", "33"]);
    expect(zone.postalPrefixes).toEqual(["5600", "60"]);
  });

  it("validates rate bands", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const zone = await shipping.createZone(db, storeId, { name: "India" });

    for (const input of [
      { name: "", price: 1 },
      { name: "Neg", price: -1 },
      { name: "Frac", price: 1.5 },
      { name: "Inverted weight", price: 1, minWeightGrams: 500, maxWeightGrams: 100 },
      { name: "Inverted value", price: 1, minSubtotal: 500, maxSubtotal: 100 },
      { name: "Bad free", price: 1, freeOverSubtotal: -5 },
      { name: "Inverted days", price: 1, estimatedDaysMin: 5, estimatedDaysMax: 2 },
      { name: "Absurd days", price: 1, estimatedDaysMax: 9_999 },
    ]) {
      await expect(shipping.createRate(db, storeId, zone.id, input)).rejects.toThrow(
        InvalidShippingRateError,
      );
    }
  });

  it("deletes a zone's rates with the zone and 404s on unknown ids", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { zone } = await standardSetup(db, storeId);

    await shipping.deleteZone(db, storeId, zone.id);
    const left = await db.query(`SELECT COUNT(*)::int AS c FROM shipping_rates WHERE store_id = $1`, [storeId]);
    expect(left.rows[0].c).toBe(0);

    await expect(shipping.deleteZone(db, storeId, zone.id)).rejects.toThrow(ShippingZoneNotFoundError);
    await expect(shipping.deleteRate(db, storeId, generateUuidV7())).rejects.toThrow(ShippingRateNotFoundError);
    await expect(
      shipping.updateRate(db, storeId, generateUuidV7(), { name: "x", price: 1 }),
    ).rejects.toThrow(ShippingRateNotFoundError);
  });

  it("will not attach a rate to, edit, or delete another store's zone or rate", async () => {
    const db = await setupDb();
    const storeA = await seedStore(db, "ship-a");
    const storeB = await seedStore(db, "ship-b");
    const { zone, standard } = await standardSetup(db, storeA);

    await expect(
      shipping.createRate(db, storeB, zone.id, { name: "Hijack", price: 1 }),
    ).rejects.toThrow(ShippingZoneNotFoundError);
    await expect(
      shipping.updateZone(db, storeB, zone.id, { name: "Renamed by B" }),
    ).rejects.toThrow(ShippingZoneNotFoundError);
    await expect(shipping.deleteZone(db, storeB, zone.id)).rejects.toThrow(ShippingZoneNotFoundError);
    await expect(shipping.deleteRate(db, storeB, standard.id)).rejects.toThrow(ShippingRateNotFoundError);

    expect((await shipping.listZones(db, storeB))).toEqual([]);
    expect((await shipping.listZones(db, storeA))[0]?.rates).toHaveLength(2);
  });

  it("stores product weights, rejects bad ones, and refuses another store's product", async () => {
    const db = await setupDb();
    const storeA = await seedStore(db, "w-a");
    const storeB = await seedStore(db, "w-b");
    const { productId } = await seedProduct(db, storeA);

    expect((await shipping.setProductWeight(db, storeA, productId, 750)).weightGrams).toBe(750);
    expect((await shipping.setProductWeight(db, storeA, productId, 900)).weightGrams).toBe(900);
    for (const bad of [-1, 1.5, 100_000_001]) {
      await expect(shipping.setProductWeight(db, storeA, productId, bad)).rejects.toThrow(
        InvalidShippingWeightError,
      );
    }
    await expect(shipping.setProductWeight(db, storeB, productId, 100)).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
    expect(await shipping.getProductProfile(db, storeB, productId)).toBeNull();
    expect(await shipping.deleteProductWeight(db, storeA, productId)).toBe(true);
    expect(await shipping.deleteProductWeight(db, storeA, productId)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Checkout pricing
  // -------------------------------------------------------------------------

  it("prices shipping into the checkout total from the cheapest option", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await standardSetup(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 2, KARNATAKA);
    expect(checkout.shippingTotal).toBe(5_000);
    expect(checkout.total).toBe(20_000 + 5_000);

    const quote = await shipping.getCheckoutQuote(db, storeId, checkout.id);
    expect(quote?.selectedRateName).toBe("Standard");
    expect(quote?.zoneName).toBe("India");
    expect(quote?.options.map((o) => o.name)).toEqual(["Standard", "Express"]);
    // 2 units at the 500g default.
    expect(quote?.totalWeightGrams).toBe(1_000);
  });

  it("weighs the parcel from product weights and falls back to the default", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableShipping(db, storeId, 300);
    const zone = await shipping.createZone(db, storeId, { name: "India", countryCodes: ["IN"] });
    await shipping.createRate(db, storeId, zone.id, { name: "Light", price: 4_000, maxWeightGrams: 2_000 });
    await shipping.createRate(db, storeId, zone.id, { name: "Heavy", price: 9_000, minWeightGrams: 2_001 });

    const heavy = await seedProduct(db, storeId, 5_000, "Anvil");
    const plain = await seedProduct(db, storeId, 5_000, "Feather");
    await shipping.setProductWeight(db, storeId, heavy.productId, 1_800);

    // 1 anvil (1800g) + 1 feather (300g default) = 2100g, which only Heavy fits.
    const checkout = await checkoutWith(db, storeId, heavy.variantId, 1, MAHARASHTRA);
    expect(checkout.shippingTotal).toBe(4_000);
    const withFeather = await checkoutService.addItem(db, storeId, checkout.id, {
      variantId: plain.variantId,
      quantity: 1,
    });
    const quote = await shipping.getCheckoutQuote(db, storeId, checkout.id);
    expect(quote?.totalWeightGrams).toBe(2_100);
    expect(withFeather.shippingTotal).toBe(9_000);
    expect(quote?.selectedRateName).toBe("Heavy");
  });

  it("re-zones when the address changes", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableShipping(db, storeId);
    const india = await shipping.createZone(db, storeId, { name: "India", countryCodes: ["IN"], priority: 100 });
    const local = await shipping.createZone(db, storeId, {
      name: "Maharashtra", countryCodes: ["IN"], stateCodes: ["27"], priority: 10,
    });
    await shipping.createRate(db, storeId, india.id, { name: "National", price: 8_000 });
    await shipping.createRate(db, storeId, local.id, { name: "Local", price: 2_000 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);
    expect(checkout.shippingTotal).toBe(2_000);

    const moved = await checkoutService.updateAddresses(db, storeId, checkout.id, {
      shippingAddress: KARNATAKA as never,
    });
    expect(moved.shippingTotal).toBe(8_000);
    expect((await shipping.getCheckoutQuote(db, storeId, checkout.id))?.zoneName).toBe("India");
  });

  it("re-prices when the basket changes, and bands on the discounted goods value", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableShipping(db, storeId);
    const zone = await shipping.createZone(db, storeId, { name: "India", countryCodes: ["IN"] });
    await shipping.createRate(db, storeId, zone.id, { name: "Small order", price: 6_000, maxSubtotal: 9_999 });
    await shipping.createRate(db, storeId, zone.id, { name: "Big order", price: 1_000, minSubtotal: 10_000 });
    const { variantId } = await seedProduct(db, storeId, 6_000);

    const one = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);
    expect(one.shippingTotal).toBe(6_000);

    const two = await checkoutService.updateItemQuantity(db, storeId, one.id, variantId, 2);
    expect(two.shippingTotal).toBe(1_000); // 12000 goods

    // A discount drops the goods value back under the band.
    const discounted = await checkoutService.updateTotals(db, storeId, one.id, { discountTotal: 3_000 });
    expect(discounted.shippingTotal).toBe(6_000); // 9000 after discount
  });

  it("makes shipping free at the threshold", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableShipping(db, storeId);
    const zone = await shipping.createZone(db, storeId, { name: "India", countryCodes: ["IN"] });
    await shipping.createRate(db, storeId, zone.id, { name: "Standard", price: 5_000, freeOverSubtotal: 20_000 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const below = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);
    expect(below.shippingTotal).toBe(5_000);
    const at = await checkoutService.updateItemQuantity(db, storeId, below.id, variantId, 2);
    expect(at.shippingTotal).toBe(0);
    expect(at.total).toBe(20_000);
    const quote = await shipping.getCheckoutQuote(db, storeId, below.id);
    expect(quote?.options[0]).toMatchObject({ isFree: true, price: 0 });
  });

  // -------------------------------------------------------------------------
  // Choosing an option
  // -------------------------------------------------------------------------

  it("lets the customer pick an option and keeps it through later changes", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { express } = await standardSetup(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);

    const picked = await checkoutService.selectShippingRate(db, storeId, checkout.id, express.id);
    expect(picked.shippingTotal).toBe(12_000);
    expect(picked.total).toBe(22_000);

    // Changing the basket re-prices but keeps the customer on Express.
    const more = await checkoutService.updateItemQuantity(db, storeId, checkout.id, variantId, 3);
    expect(more.shippingTotal).toBe(12_000);
    expect((await shipping.getCheckoutQuote(db, storeId, checkout.id))?.selectedRateName).toBe("Express");
  });

  it("rejects an option that is not on offer and leaves the checkout unchanged", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await standardSetup(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);

    for (const rateId of [generateUuidV7()]) {
      await expect(
        checkoutService.selectShippingRate(db, storeId, checkout.id, rateId),
      ).rejects.toThrow(ShippingRateNotAvailableError);
    }
    const after = await checkoutService.getCheckout(db, storeId, checkout.id);
    expect(after.shippingTotal).toBe(5_000);
  });

  it("rejects another store's rate id", async () => {
    const db = await setupDb();
    const storeA = await seedStore(db, "sel-a");
    const storeB = await seedStore(db, "sel-b");
    await standardSetup(db, storeA);
    const other = await standardSetup(db, storeB);
    const { variantId } = await seedProduct(db, storeA, 10_000);
    const checkout = await checkoutWith(db, storeA, variantId, 1, MAHARASHTRA);

    await expect(
      checkoutService.selectShippingRate(db, storeA, checkout.id, other.express.id),
    ).rejects.toThrow(ShippingRateNotAvailableError);
  });

  it("falls back to the cheapest option if the chosen rate is deleted", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { express } = await standardSetup(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);
    await checkoutService.selectShippingRate(db, storeId, checkout.id, express.id);

    await shipping.deleteRate(db, storeId, express.id);
    const next = await checkoutService.updateItemQuantity(db, storeId, checkout.id, variantId, 2);
    expect(next.shippingTotal).toBe(5_000);
    expect((await shipping.getCheckoutQuote(db, storeId, checkout.id))?.selectedRateName).toBe("Standard");
  });

  it("lets the engine, not a manual figure, set the shipping total", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await standardSetup(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);

    const attempted = await checkoutService.updateTotals(db, storeId, checkout.id, { shippingTotal: 1 });
    expect(attempted.shippingTotal).toBe(5_000);
  });

  // -------------------------------------------------------------------------
  // Payment guard
  // -------------------------------------------------------------------------

  it("charges goods plus the quoted shipping at payment", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await standardSetup(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const checkout = await checkoutWith(db, storeId, variantId, 2, MAHARASHTRA);

    const result = await pay(db, storeId, checkout.id);
    expect(result.payment.amount).toBe(25_000);
  });

  it("refuses payment with no address, and for an address nothing ships to", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableShipping(db, storeId);
    const zone = await shipping.createZone(db, storeId, { name: "India", countryCodes: ["IN"] });
    await shipping.createRate(db, storeId, zone.id, { name: "Standard", price: 5_000 });
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const noAddress = await checkoutWith(db, storeId, variantId, 1, null);
    await expect(pay(db, storeId, noAddress.id)).rejects.toThrow(CheckoutShippingNotCurrentError);

    const abroad = await checkoutWith(db, storeId, variantId, 1, NEW_YORK);
    expect(abroad.shippingTotal).toBe(0);
    const quote = await shipping.getCheckoutQuote(db, storeId, abroad.id);
    expect(quote?.selectedRateId).toBeNull();
    expect(quote?.options).toEqual([]);
    await expect(pay(db, storeId, abroad.id)).rejects.toThrow(/cannot ship/);

    // Fixing the address makes it payable.
    await checkoutService.updateAddresses(db, storeId, abroad.id, { shippingAddress: KARNATAKA as never });
    expect((await pay(db, storeId, abroad.id)).payment.amount).toBe(15_000);

    const payments = await db.query(`SELECT COUNT(*)::int AS c FROM payments WHERE checkout_id = $1`, [
      noAddress.id,
    ]);
    expect(payments.rows[0].c).toBe(0);
  });

  it("refuses payment when the stored shipping total has been tampered with", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await standardSetup(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);

    await db.query(`UPDATE checkouts SET shipping_total = 0, total = 10000 WHERE id = $1`, [checkout.id]);
    await expect(pay(db, storeId, checkout.id)).rejects.toThrow(CheckoutShippingNotCurrentError);
  });

  it("does not interfere with payment for a store with shipping off", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const checkout = await checkoutWith(db, storeId, variantId, 1, null);
    expect((await pay(db, storeId, checkout.id)).payment.amount).toBe(10_000);
  });

  it("keeps a frozen quote when a rate is edited afterwards", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    const { standard } = await standardSetup(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);

    await shipping.updateRate(db, storeId, standard.id, { name: "Standard", price: 99_000 });
    // No recalculation has happened, so the customer pays what they were shown.
    expect((await pay(db, storeId, checkout.id)).payment.amount).toBe(15_000);
  });

  it("keeps one store's quotes invisible to another", async () => {
    const db = await setupDb();
    const storeA = await seedStore(db, "iso-a");
    const storeB = await seedStore(db, "iso-b");
    await standardSetup(db, storeA);
    const { variantId } = await seedProduct(db, storeA, 10_000);
    const checkout = await checkoutWith(db, storeA, variantId, 1, MAHARASHTRA);

    expect(await shipping.getCheckoutQuote(db, storeB, checkout.id)).toBeNull();
    expect((await shipping.getSettings(db, storeB)).isEnabled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // GST on shipping and the invoice
  // -------------------------------------------------------------------------

  const MH_GSTIN = makeGstin("27", "AAPFU0939F");

  async function enableTax(db: Database, storeId: string) {
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
    const result = await workflow.finalizeCapturedPurchase(db, { storeId, paymentId });
    if (result.status !== "completed") throw new Error(`not completed: ${result.status}`);
    return result.workflow.order;
  }

  it("charges GST on shipping at the highest goods rate, intra-state as CGST and SGST", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await standardSetup(db, storeId);
    await enableTax(db, storeId);
    const a = await seedProduct(db, storeId, 10_000, "Shirt");
    const b = await seedProduct(db, storeId, 10_000, "Book");
    await taxService.setProductProfile(db, storeId, a.productId, { hsnCode: "6109", gstRateBps: 1800 });
    await taxService.setProductProfile(db, storeId, b.productId, { hsnCode: "4901", gstRateBps: 500 });

    const checkout = await checkoutWith(db, storeId, a.variantId, 1, MAHARASHTRA);
    const full = await checkoutService.addItem(db, storeId, checkout.id, { variantId: b.variantId, quantity: 1 });

    // Goods tax: 1800 + 500. Shipping 5000 at the highest rate (18%) = 900.
    expect(full.shippingTotal).toBe(5_000);
    expect(full.taxTotal).toBe(1_800 + 500 + 900);
    expect(full.total).toBe(20_000 + 5_000 + 3_200);

    const snap = await taxService.getCheckoutTaxSnapshot(db, storeId, checkout.id);
    const line = snap?.lines.find((l) => l.lineId === SHIPPING_LINE_ID);
    expect(line).toMatchObject({
      description: "Shipping charges",
      hsnCode: "9968",
      rateBps: 1800,
      taxableValue: 5_000,
      cgst: 450,
      sgst: 450,
      igst: 0,
    });
    expect(snap?.cgstTotal).toBe(snap?.sgstTotal);
  });

  it("charges IGST on shipping across states and nothing on an export", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableShipping(db, storeId);
    const zone = await shipping.createZone(db, storeId, { name: "Anywhere" });
    await shipping.createRate(db, storeId, zone.id, { name: "Standard", price: 5_000 });
    await enableTax(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const inter = await checkoutWith(db, storeId, variantId, 1, KARNATAKA);
    expect(inter.taxTotal).toBe(1_800 + 900);
    const snap = await taxService.getCheckoutTaxSnapshot(db, storeId, inter.id);
    expect(snap?.igstTotal).toBe(2_700);
    expect(snap?.cgstTotal).toBe(0);

    const abroad = await checkoutWith(db, storeId, variantId, 1, NEW_YORK);
    expect(abroad.shippingTotal).toBe(5_000);
    expect(abroad.taxTotal).toBe(0);
  });

  it("does not tax a zero shipping charge or add a line for it", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableShipping(db, storeId);
    const zone = await shipping.createZone(db, storeId, { name: "India", countryCodes: ["IN"] });
    await shipping.createRate(db, storeId, zone.id, { name: "Free", price: 0 });
    await enableTax(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);
    const snap = await taxService.getCheckoutTaxSnapshot(db, storeId, checkout.id);
    expect(snap?.lines.some((l) => l.lineId === SHIPPING_LINE_ID)).toBe(false);
    expect(checkout.taxTotal).toBe(1_800);
  });

  it("refuses payment if shipping and the tax snapshot disagree", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await standardSetup(db, storeId);
    await enableTax(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);
    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);

    // Move shipping and the quote together so the shipping guard passes, but
    // leave the tax snapshot behind. The tax guard must still catch it.
    await db.query(
      `UPDATE checkout_shipping_quotes SET shipping_price = 7000 WHERE checkout_id = $1`,
      [checkout.id],
    );
    await db.query(`UPDATE checkouts SET shipping_total = 7000, total = total + 2000 WHERE id = $1`, [
      checkout.id,
    ]);
    await expect(pay(db, storeId, checkout.id)).rejects.toThrow(CheckoutTaxNotCurrentError);
  });

  it("issues an invoice that itemises shipping as a taxed line and reconciles to the total", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await standardSetup(db, storeId);
    await enableTax(db, storeId);
    const { productId, variantId } = await seedProduct(db, storeId, 10_000);
    await taxService.setProductProfile(db, storeId, productId, { hsnCode: "6109", gstRateBps: 1800 });

    const checkout = await checkoutWith(db, storeId, variantId, 2, MAHARASHTRA);
    const order = await capture(db, storeId, checkout.id);

    // 20000 goods + 5000 shipping + 3600 + 900 tax.
    expect(order.shippingTotal).toBe(5_000);
    expect(order.taxTotal).toBe(4_500);
    expect(order.grandTotal).toBe(29_500);

    const invoice = await taxService.getInvoiceByOrderId(db, storeId, order.id);
    expect(invoice).not.toBeNull();
    expect(invoice?.grandTotal).toBe(29_500);
    expect(invoice?.taxableTotal).toBe(25_000); // goods + shipping
    expect(invoice?.taxTotal).toBe(4_500);
    // Shipping is itemised, so none is left over to print separately.
    expect(invoice?.shippingTotal).toBe(0);
    expect(invoice?.taxableTotal! + invoice?.taxTotal! + invoice?.shippingTotal!).toBe(29_500);

    const lines = invoice!.lines;
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({
      description: "Shipping charges",
      hsnCode: "9968",
      taxableValue: 5_000,
      cgst: 450,
      sgst: 450,
      lineTotal: 5_900,
    });
    expect(lines.reduce((s, l) => s + l.cgst, 0)).toBe(invoice?.cgstTotal);
    expect(lines.reduce((s, l) => s + l.lineTotal, 0)).toBe(invoice?.grandTotal);
  });

  it("still reconciles a manually set shipping total on a tax-only store", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db);
    await enableTax(db, storeId);
    const { variantId } = await seedProduct(db, storeId, 10_000);

    const checkout = await checkoutWith(db, storeId, variantId, 1, MAHARASHTRA);
    // Shipping engine is off, so the legacy manual figure applies and is taxed.
    const manual = await checkoutService.updateTotals(db, storeId, checkout.id, { shippingTotal: 1_000 });
    expect(manual.taxTotal).toBe(1_800 + 180);
    const order = await capture(db, storeId, checkout.id);

    const invoice = await taxService.getInvoiceByOrderId(db, storeId, order.id);
    expect(invoice?.grandTotal).toBe(order.grandTotal);
    expect(invoice?.shippingTotal).toBe(0);
    expect(invoice?.lines.some((l) => l.description === "Shipping charges")).toBe(true);
  });
});
