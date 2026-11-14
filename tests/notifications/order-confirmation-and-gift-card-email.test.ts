/**
 * Order Confirmation & Gift Card Delivery Emails — Focused, Non-Redundant Tests
 *
 * Covers requirements from user specifications without duplicating existing coverage in
 * `order-lifecycle-notifications.test.ts` or `application-wide-email-system.test.ts`:
 *
 *  1. Order confirmation email content and itemized receipt breakdown (Unit).
 *  2. Gift card email content with redeem code, balance, and instructions (Unit).
 *  3. Gift card delivery to intended recipient email upon issuance (Integration).
 *  4. No gift card delivery email when no recipient email was specified (Integration).
 *  5. Gift card code strictly delivered to recipient and NEVER to the buyer (Integration).
 *  6. Mixed orders (physical products + gift card): buyer gets confirmation, recipient gets gift card (Integration).
 *  7. Idempotency: duplicate gift card delivery prevention on retry (Integration).
 *  8. Security: gift card redeem code is never exposed in buyer order confirmation (Integration).
 *  9. Issuance guarantee: no email dispatched if gift card creation fails before becoming ACTIVE (Integration).
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  NotificationOutboxRepository,
} from "@calcart/db";
import {
  EmailService,
  resetEmailService,
  renderOrderConfirmationEmail,
  renderGiftCardDeliveryEmail,
  type OrderConfirmationProps,
  type GiftCardDeliveryProps,
} from "@calcart/email";
import { NotificationOutboxService } from "@calcart/orders";
import { GiftCardService } from "@calcart/giftcards";
import { NotificationDispatchJob } from "../../apps/worker/src/jobs/notifications/notification-dispatch-job.js";
import { PaymentOrderIntegration } from "@calcart/payments";
import { createIsolatedDatabase } from "../helpers/postgres.js";

// =============================================================================
// A. UNIT TESTS — Fast Template & Formatting (Zero Database Overhead)
// =============================================================================

describe("Order & Gift Card Email Templates (Unit)", () => {
  it("renders order confirmation with all required fields: order number, items, prices, address", () => {
    const props: OrderConfirmationProps = {
      to: "customer@shop.com",
      storeName: "Ceramic Dreams",
      storeSlug: "ceramic-dreams",
      orderNumber: "ORD-20241101",
      orderId: generateUuidV7(),
      orderDate: new Date("2024-11-01T10:00:00Z"),
      recipientName: "Jane Doe",
      currency: "USD",
      items: [
        { name: "Artisan Mug", variantTitle: "Matte Blue", quantity: 2, unitPrice: 2500, lineTotal: 5000 },
        { name: "Ceramic Bowl", quantity: 1, unitPrice: 3500, lineTotal: 3500 },
      ],
      subtotal: 8500,
      discountTotal: 500,
      shippingTotal: 400,
      taxTotal: 300,
      grandTotal: 8700,
      shippingAddress: {
        name: "Jane Doe",
        addressLine1: "10 Commerce St",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "US",
      },
    };

    const rendered = renderOrderConfirmationEmail(props);

    // Subject line
    expect(rendered.subject).toBe("Order Confirmation: ORD-20241101 from Ceramic Dreams");

    // HTML body must contain all required details
    expect(rendered.html).toContain("ORD-20241101");
    expect(rendered.html).toContain("Ceramic Dreams");
    expect(rendered.html).toContain("Jane Doe");
    expect(rendered.html).toContain("Artisan Mug");
    expect(rendered.html).toContain("Matte Blue");
    expect(rendered.html).toContain("Ceramic Bowl");
    expect(rendered.html).toContain("10 Commerce St");
    expect(rendered.html).toContain("Austin");
    expect(rendered.html).toContain("TX");
    expect(rendered.html).toContain("US");
    // Itemized pricing breakdown
    expect(rendered.html).toContain("Subtotal");
    expect(rendered.html).toContain("Discounts");
    expect(rendered.html).toContain("Shipping");
    expect(rendered.html).toContain("Tax");
    expect(rendered.html).toContain("Total");

    // Plain text version
    expect(rendered.text).toContain("#ORD-20241101");
    expect(rendered.text).toContain("Artisan Mug");
    expect(rendered.text).toContain("Ceramic Bowl");
    expect(rendered.text).toContain("Total:");
  });

  it("renders gift card delivery email with code, value, currency and redemption instructions", () => {
    const props: GiftCardDeliveryProps = {
      to: "recipient@example.com",
      storeName: "Bloom & Co",
      storeSlug: "bloom-co",
      recipientName: "Emily",
      code: "GIFT-WXYZ-1234",
      initialBalance: 5000,
      currency: "USD",
      message: "Happy Birthday Emily! Enjoy your gift.",
      storeUrl: "https://bloom-co.calcart.com",
    };

    const rendered = renderGiftCardDeliveryEmail(props);

    expect(rendered.subject).toBe("Your Bloom & Co Gift Card ($50.00)");
    expect(rendered.html).toContain("GIFT-WXYZ-1234");
    expect(rendered.html).toContain("Emily");
    expect(rendered.html).toContain("Bloom &amp; Co");
    expect(rendered.html).toContain("$50.00");
    expect(rendered.html).toContain("Enter this code at checkout to apply your balance.");
    expect(rendered.html).toContain("Happy Birthday Emily! Enjoy your gift.");
    expect(rendered.text).toContain("Happy Birthday Emily! Enjoy your gift.");
    expect(rendered.text).toContain("GIFT-WXYZ-1234");
    expect(rendered.text).toContain("Bloom & Co");
  });
});

// =============================================================================
// B. INTEGRATION TESTS — Database-Backed Workflows (Shared Isolated Database)
// =============================================================================

describe("Order & Gift Card Delivery Workflows (Integration)", { timeout: 120_000 }, () => {
  let closeDb: (() => Promise<void>) | undefined;
  let db: Database;
  let emailService: EmailService;
  let outboxRepo: NotificationOutboxRepository;
  let outboxService: NotificationOutboxService;
  let dispatchJob: NotificationDispatchJob;
  const giftCardService = new GiftCardService();

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    closeDb = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;

    outboxRepo = new NotificationOutboxRepository();
    outboxService = new NotificationOutboxService(outboxRepo);
  }, 120_000);

  afterAll(async () => {
    if (closeDb) {
      await closeDb();
      closeDb = undefined;
    }
  });

  beforeEach(async () => {
    emailService = new EmailService({
      mode: "test",
      appUrl: "https://demo.calcart.com",
      fromEmail: "Cal Cart <orders@calcart.com>",
    });
    resetEmailService(emailService);
    dispatchJob = new NotificationDispatchJob(emailService, outboxRepo);

    if (db) {
      try {
        await db.query("DELETE FROM notification_outbox");
      } catch {
        // Table might not exist yet
      }
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetEmailService();
  });

  // Helpers
  async function seedStore(storeName: string, slug: string): Promise<{ storeId: string; orgId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [orgId, `Org ${storeName}`]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, storeName, `${slug}-${generateUuidV7().slice(-6)}`],
    );
    return { storeId, orgId };
  }

  async function seedOrder(
    storeId: string,
    opts: { email?: string; orderNumber?: string; grandTotal?: number; items?: Array<{ name: string; variant?: string; qty: number; price: number }> } = {},
  ): Promise<{ orderId: string; orderNumber: string; checkoutId: string }> {
    const orderId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const orderNumber = opts.orderNumber ?? `ORD-${Date.now().toString(36).toUpperCase()}-${generateUuidV7().slice(-4)}`;
    const email = opts.email ?? "buyer@example.com";
    const grandTotal = opts.grandTotal ?? 5000;

    await db.query(`INSERT INTO carts (id, store_id, currency, status) VALUES ($1, $2, 'USD', 'ACTIVE')`, [cartId, storeId]);
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, status, payment_status, currency, subtotal, total, email, shipping_address)
       VALUES ($1, $2, $3, 'COMPLETED', 'PAID', 'USD', $4, $4, $5, $6)`,
      [checkoutId, storeId, cartId, grandTotal, email, JSON.stringify({ firstName: "Jane", lastName: "Doe", addressLine1: "10 Commerce St", city: "Austin", state: "TX", postalCode: "78701", country: "US" })],
    );
    await db.query(
      `INSERT INTO orders (id, store_id, checkout_id, order_number, status, payment_status, fulfillment_status, currency, subtotal, discount_total, shipping_total, tax_total, total, grand_total)
       VALUES ($1, $2, $3, $4, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', $5, 0, 0, 0, $5, $5)`,
      [orderId, storeId, checkoutId, orderNumber, grandTotal],
    );

    const lineItems = opts.items ?? [{ name: "Test Product", variant: "Default", qty: 1, price: grandTotal }];
    for (const item of lineItems) {
      await db.query(
        `INSERT INTO order_items (id, order_id, store_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [generateUuidV7(), orderId, storeId, item.name, item.variant ?? "Default", item.qty, item.price, item.price * item.qty],
      );
    }

    return { orderId, orderNumber, checkoutId };
  }

  it("queues GIFT_CARD_DELIVERY in outbox when gift card is created with a recipient email and delivers it", async () => {
    const { storeId } = await seedStore("Gift Shop", "gift-shop");
    const recipientEmail = `friend-${Date.now()}@example.com`;

    const giftCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 5000,
      currency: "USD",
      recipientEmail,
      recipientName: "Taylor",
      personalMessage: "Enjoy your gift!",
    });

    const outboxRows = await outboxRepo.findByReference(db, storeId, "GIFT_CARD", giftCard.id);
    expect(outboxRows.length).toBe(1);
    expect(outboxRows[0]!.notification_type).toBe("GIFT_CARD_DELIVERY");
    expect(outboxRows[0]!.recipient_email).toBe(recipientEmail);
    expect(outboxRows[0]!.status).toBe("PENDING");

    const result = await dispatchJob.run(db);
    expect(result.sentCount).toBeGreaterThanOrEqual(1);

    const sentEmails = emailService.getCapturedEmails();
    const gcEmail = sentEmails.find((e) => e.to === recipientEmail);
    expect(gcEmail).toBeDefined();
    expect(gcEmail!.templateName).toBe("gift_card_delivery");
    expect(gcEmail!.html).toContain(giftCard.code);
    expect(gcEmail!.html).toContain("$50.00");
  });

  it("does NOT queue gift card delivery when no recipient email is provided", async () => {
    const { storeId } = await seedStore("Self Gift Shop", "self-gift-shop");

    const giftCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 2500,
      currency: "USD",
    });

    const outboxRows = await outboxRepo.findByReference(db, storeId, "GIFT_CARD", giftCard.id);
    expect(outboxRows.length).toBe(0);

    const initialCount = emailService.getCapturedEmails().length;
    await dispatchJob.run(db);
    expect(emailService.getCapturedEmails().length).toBe(initialCount);
  });

  it("delivers the gift card code ONLY to the intended recipient, not the buyer", async () => {
    const { storeId } = await seedStore("Boutique", "boutique");
    const buyerEmail = `buyer-${Date.now()}@test.com`;
    const recipientEmail = `lucky-friend-${Date.now()}@test.com`;

    const giftCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 10000,
      currency: "USD",
      recipientEmail,
      recipientName: "Lucky Friend",
      personalMessage: "For you!",
    });

    await dispatchJob.run(db);

    const captured = emailService.getCapturedEmails();
    const recipientDelivery = captured.find((e) => e.to === recipientEmail);
    expect(recipientDelivery).toBeDefined();
    expect(recipientDelivery!.html).toContain(giftCard.code);

    const buyerDelivery = captured.find((e) => e.to === buyerEmail);
    expect(buyerDelivery).toBeUndefined();
  });

  it("sends order confirmation to buyer AND gift card delivery to recipient as separate emails on mixed orders", async () => {
    const { storeId } = await seedStore("Mixed Goods Co", "mixed-goods");
    const buyerEmail = `mixed.buyer-${Date.now()}@example.com`;
    const recipientEmail = `gc.recipient-${Date.now()}@example.com`;

    const { orderId, orderNumber } = await seedOrder(storeId, {
      email: buyerEmail,
      grandTotal: 15000,
      items: [
        { name: "Linen Shirt", variant: "M / White", qty: 1, price: 10000 },
        { name: "Digital Gift Card", variant: "USD 50", qty: 1, price: 5000 },
      ],
    });

    await outboxService.queueOrderConfirmation(db, {
      storeId,
      orderId,
      orderNumber,
      currency: "USD",
      subtotal: 15000,
      grandTotal: 15000,
      recipientEmail: buyerEmail,
      storeName: "Mixed Goods Co",
      storeSlug: "mixed-goods",
      items: [
        { name: "Linen Shirt", variantTitle: "M / White", quantity: 1, unitPrice: 10000, lineTotal: 10000 },
        { name: "Digital Gift Card", variantTitle: "USD 50", quantity: 1, unitPrice: 5000, lineTotal: 5000 },
      ],
    });

    const giftCard = await giftCardService.createGiftCard(db, storeId, {
      initialBalance: 5000,
      currency: "USD",
      recipientEmail,
      recipientName: "Gift Recipient",
      personalMessage: "Enjoy!",
    });

    await dispatchJob.run(db);

    const captured = emailService.getCapturedEmails();

    // 1. Buyer gets order confirmation receipt
    const orderEmail = captured.find((e) => e.to === buyerEmail && e.templateName === "order_confirmation");
    expect(orderEmail).toBeDefined();
    expect(orderEmail!.html).toContain(orderNumber);
    expect(orderEmail!.html).toContain("Linen Shirt");
    expect(orderEmail!.html).toContain("Digital Gift Card");
    expect(orderEmail!.html).not.toContain(giftCard.code);

    // 2. Gift card recipient gets gift card delivery with redeem code
    const gcEmail = captured.find((e) => e.to === recipientEmail && e.templateName === "gift_card_delivery");
    expect(gcEmail).toBeDefined();
    expect(gcEmail!.html).toContain(giftCard.code);
    expect(gcEmail!.html).toContain("$50.00");
  });

  it("prevents duplicate gift card delivery when outbox idempotency key conflicts", async () => {
    const { storeId } = await seedStore("Duplicate GC Store", "dup-gc");
    const giftCardId = generateUuidV7();

    const row1 = await outboxRepo.create(db, {
      storeId,
      notificationType: "GIFT_CARD_DELIVERY",
      recipientEmail: `gc-dup-${Date.now()}@example.com`,
      referenceType: "GIFT_CARD",
      referenceId: giftCardId,
      idempotencyKey: `giftcard:delivery:${giftCardId}`,
      payload: {
        storeName: "Duplicate GC Store",
        storeSlug: "dup-gc",
        code: "TEST-CODE-1234",
        initialBalance: 5000,
        currency: "USD",
      },
    });
    expect(row1).not.toBeNull();

    // Duplicate submission with the same idempotencyKey returns null (ON CONFLICT DO NOTHING)
    const row2 = await outboxRepo.create(db, {
      storeId,
      notificationType: "GIFT_CARD_DELIVERY",
      recipientEmail: `gc-dup-${Date.now()}@example.com`,
      referenceType: "GIFT_CARD",
      referenceId: giftCardId,
      idempotencyKey: `giftcard:delivery:${giftCardId}`,
      payload: {
        storeName: "Duplicate GC Store",
        storeSlug: "dup-gc",
        code: "TEST-CODE-1234",
        initialBalance: 5000,
        currency: "USD",
      },
    });
    expect(row2).toBeNull();

    const initialSent = emailService.getCapturedEmails().length;
    const result = await dispatchJob.run(db);
    expect(result.sentCount).toBe(1);
    expect(emailService.getCapturedEmails().length - initialSent).toBe(1);
  });

  it("does not expose gift card redeem code in order confirmation email body", async () => {
    const { storeId } = await seedStore("Code Security Store", "code-security");
    const buyerEmail = `security.buyer-${Date.now()}@example.com`;
    const { orderId, orderNumber } = await seedOrder(storeId, {
      email: buyerEmail,
      grandTotal: 10000,
      items: [{ name: "Gift Card", variant: "USD 100", qty: 1, price: 10000 }],
    });

    await outboxService.queueOrderConfirmation(db, {
      storeId,
      orderId,
      orderNumber,
      currency: "USD",
      subtotal: 10000,
      grandTotal: 10000,
      recipientEmail: buyerEmail,
      storeName: "Code Security Store",
      storeSlug: "code-security",
      items: [{ name: "Gift Card", variantTitle: "USD 100", quantity: 1, unitPrice: 10000, lineTotal: 10000 }],
    });

    await dispatchJob.run(db);

    const emails = emailService.getCapturedEmails();
    const orderEmail = emails.find((e) => e.to === buyerEmail && e.templateName === "order_confirmation");
    expect(orderEmail).toBeDefined();

    // No gift card code format (e.g., XXXX-XXXX-XXXX) should appear in the buyer's order confirmation
    expect(orderEmail!.html).not.toMatch(/\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/);
  });

  it("does not send gift card delivery email before the gift card is ACTIVE and issued", async () => {
    const { storeId } = await seedStore("Failed Card Store", "failed-card");

    // Attempting to create a gift card with invalid balance (0) throws before outbox queuing
    await expect(
      giftCardService.createGiftCard(db, storeId, {
        initialBalance: 0,
        currency: "USD",
        recipientEmail: `recipient-${Date.now()}@example.com`,
      }),
    ).rejects.toThrow();

    const initialSent = emailService.getCapturedEmails().length;
    await dispatchJob.run(db);
    expect(emailService.getCapturedEmails().length).toBe(initialSent);
  });

  it("delivers gift card to recipient configured in gift_card_recipients upon order payment completion via PaymentOrderIntegration", async () => {
    const { storeId } = await seedStore("E2E Gift Store", "e2e-gift");
    const buyerEmail = `buyer-e2e-${Date.now()}@example.com`;
    const recipientEmail = `alice-recipient-${Date.now()}@example.com`;

    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const paymentId = generateUuidV7();

    // 1. Seed product & gift card variant
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Cal Cart Gift Card', $3, 'ACTIVE')`,
      [productId, storeId, `gift-card-${Date.now().toString(36)}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'USD 50 Gift Card', 'GC-50', 5000, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId],
    );

    // 2. Seed cart, checkout, payment
    await db.query(
      `INSERT INTO carts (id, store_id, currency, status) VALUES ($1, $2, 'USD', 'ACTIVE')`,
      [cartId, storeId],
    );

    const shippingAddress = {
      firstName: "Bob",
      lastName: "Buyer",
      addressLine1: "555 Market St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
    };

    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, email, total, subtotal, discount_total, tax_total, shipping_total,
         status, payment_status, currency, shipping_address, billing_address
       ) VALUES ($1, $2, $3, $4, 5000, 5000, 0, 0, 0, 'PAYMENT_PENDING', 'PENDING', 'USD', $5, $5)`,
      [checkoutId, storeId, cartId, buyerEmail, JSON.stringify(shippingAddress)],
    );

    // Seed recipient details linked to cart and checkout
    await db.query(
      `INSERT INTO gift_card_recipients (
         id, store_id, cart_id, checkout_id, variant_id, recipient_email, recipient_name, message, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        generateUuidV7(),
        storeId,
        cartId,
        checkoutId,
        variantId,
        recipientEmail,
        "Alice Smith",
        "Happy Birthday Alice! Hope you enjoy this gift card.",
      ],
    );

    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Cal Cart Gift Card', 'USD 50 Gift Card', 'GC-50', 5000, 1, 5000)`,
      [generateUuidV7(), checkoutId, storeId, variantId],
    );

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 5000, 'USD', 'CAPTURED', 'razorpay', 5000, 0)`,
      [paymentId, storeId, checkoutId],
    );

    // 3. Complete payment purchase
    const paymentOrderIntegration = new PaymentOrderIntegration();
    const result = await paymentOrderIntegration.finalizeCapturedPurchase(db, {
      storeId,
      paymentId,
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") throw new Error("Expected completed workflow");
    const order = result.workflow.order;
    expect(order).toBeDefined();
    expect(order.orderNumber).toBeDefined();

    // 4. Verify recipient row was updated with order_id
    const recRow = await db.query(
      `SELECT order_id, recipient_email, recipient_name FROM gift_card_recipients WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
    expect(recRow.rows.length).toBe(1);
    expect(recRow.rows[0]?.order_id).toBe(order.id);
    expect(recRow.rows[0]?.recipient_email).toBe(recipientEmail);

    // 5. Verify gift card was created with the recipient's email
    const gcRows = await db.query(
      `SELECT id, code, recipient_email, recipient_name, initial_balance, status FROM gift_cards WHERE store_id = $1`,
      [storeId],
    );
    expect(gcRows.rows.length).toBe(1);
    expect(gcRows.rows[0]?.recipient_email).toBe(recipientEmail);
    expect(gcRows.rows[0]?.recipient_name).toBe("Alice Smith");
    expect(gcRows.rows[0]?.status).toBe("ACTIVE");

    // 6. Verify notification dispatch sends to the recipient
    await dispatchJob.run(db);

    const captured = emailService.getCapturedEmails();
    const recipientEmailDelivery = captured.find(
      (e) => e.to === recipientEmail && e.templateName === "gift_card_delivery",
    );
    expect(recipientEmailDelivery).toBeDefined();
    expect(recipientEmailDelivery!.html).toContain(gcRows.rows[0]?.code);
    expect(recipientEmailDelivery!.html).toContain("Happy Birthday Alice!");

    // Buyer receives order confirmation, NOT gift card delivery
    const buyerEmailDelivery = captured.find(
      (e) => e.to === buyerEmail && e.templateName === "order_confirmation",
    );
    expect(buyerEmailDelivery).toBeDefined();
    expect(buyerEmailDelivery!.html).toContain(order.orderNumber);
    expect(buyerEmailDelivery!.html).not.toContain(gcRows.rows[0]?.code);
  });
});
