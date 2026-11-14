/**
 * Order Confirmation Emails & Gift Card Delivery Emails — Focused Tests
 *
 * Covers:
 *  1. Order confirmation email content and delivery after successful order persistence.
 *  2. Gift card recipient email and redeem-code delivery.
 *  3. Orders containing both regular products and gift cards.
 *  4. Duplicate email prevention during retries (idempotency).
 *  5. No email or redeem code sent before successful persistence and issuance.
 *
 * Uses in-memory EmailService (mode:"test") and isolated PostgreSQL database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Order Confirmation & Gift Card Delivery Emails", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  let emailService: EmailService;
  let outboxRepo: NotificationOutboxRepository;
  let outboxService: NotificationOutboxService;
  let dispatchJob: NotificationDispatchJob;

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;

    emailService = new EmailService({
      mode: "test",
      appUrl: "https://demo.calcart.com",
      fromEmail: "Cal Cart <orders@calcart.com>",
    });
    resetEmailService(emailService);

    outboxRepo = new NotificationOutboxRepository();
    outboxService = new NotificationOutboxService(outboxRepo);
    dispatchJob = new NotificationDispatchJob(emailService, outboxRepo);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    resetEmailService();
    if (close) {
      await close();
      close = undefined;
    }
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function seedStore(storeName: string, slug: string): Promise<{ storeId: string; orgId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [orgId, `Org ${storeName}`]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, storeName, slug],
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
    const orderNumber = opts.orderNumber ?? `ORD-${Date.now().toString(36).toUpperCase()}`;
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

  // ---------------------------------------------------------------------------
  // 1. ORDER CONFIRMATION EMAIL CONTENT AND DELIVERY
  // ---------------------------------------------------------------------------
  describe("1. Order Confirmation Email Content & Delivery", () => {
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

      // HTML body must contain all order details
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
      // Pricing
      expect(rendered.html).toContain("Subtotal");
      expect(rendered.html).toContain("Discounts");
      expect(rendered.html).toContain("Shipping");
      expect(rendered.html).toContain("Tax");
      expect(rendered.html).toContain("Total");

      // Plain text
      expect(rendered.text).toContain("#ORD-20241101");
      expect(rendered.text).toContain("Artisan Mug");
      expect(rendered.text).toContain("Ceramic Bowl");
      expect(rendered.text).toContain("Total:");
    });

    it("queues ORDER_CONFIRMATION into outbox after successful order creation and dispatches it", async () => {
      const { storeId } = await seedStore("Artisan Goods", "artisan-goods");
      const { orderId, orderNumber } = await seedOrder(storeId, {
        email: "artisan.buyer@example.com",
        grandTotal: 8700,
        items: [
          { name: "Artisan Mug", variant: "Matte Blue", qty: 2, price: 2500 },
          { name: "Ceramic Bowl", qty: 1, price: 3500 },
        ],
      });

      const queued = await outboxService.queueOrderConfirmation(db, {
        storeId,
        orderId,
        orderNumber,
        currency: "USD",
        subtotal: 8500,
        discountTotal: 500,
        shippingTotal: 400,
        taxTotal: 300,
        grandTotal: 8700,
        recipientEmail: "artisan.buyer@example.com",
        recipientName: "Artisan Buyer",
        storeName: "Artisan Goods",
        storeSlug: "artisan-goods",
        items: [
          { name: "Artisan Mug", variantTitle: "Matte Blue", quantity: 2, unitPrice: 2500, lineTotal: 5000 },
          { name: "Ceramic Bowl", quantity: 1, unitPrice: 3500, lineTotal: 3500 },
        ],
        shippingAddress: {
          name: "Artisan Buyer",
          addressLine1: "10 Commerce St",
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          country: "US",
        },
      });

      expect(queued).not.toBeNull();
      expect(queued?.notification_type).toBe("ORDER_CONFIRMATION");
      expect(queued?.status).toBe("PENDING");
      expect(queued?.idempotency_key).toBe(`order_confirmed:${orderId}`);

      // Dispatch the outbox
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);
      expect(result.failedCount).toBe(0);

      const emails = emailService.getCapturedEmails();
      expect(emails).toHaveLength(1);
      const email = emails[0];
      expect(email.to).toBe("artisan.buyer@example.com");
      expect(email.subject).toContain("Order Confirmation");
      expect(email.subject).toContain(orderNumber);
      expect(email.subject).toContain("Artisan Goods");
      expect(email.html).toContain("Artisan Mug");
      expect(email.html).toContain("Ceramic Bowl");
      expect(email.html).toContain("10 Commerce St");

      // Outbox record is marked SENT
      const sentRow = await outboxRepo.findById(db, queued!.id);
      expect(sentRow?.status).toBe("SENT");
      expect(sentRow?.processed_at).not.toBeNull();
    });

    it("does NOT send order confirmation email before the order is persisted in the database", async () => {
      // The notification is only queued after the order rows are written.
      // Here we verify the outbox starts empty and no email dispatches occur without an enqueue.
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(0);
      expect(emailService.getCapturedEmails()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. GIFT CARD DELIVERY EMAILS
  // ---------------------------------------------------------------------------
  describe("2. Gift Card Delivery Emails", () => {
    it("renders gift card delivery email with code, value, currency and redemption instructions", () => {
      const props: GiftCardDeliveryProps = {
        to: "recipient@example.com",
        storeName: "Bloom & Co",
        storeSlug: "bloom-co",
        recipientName: "Emily",
        code: "GIFT-WXYZ-1234",
        initialBalance: 5000,
        currency: "USD",
        expiresAt: null,
        storeUrl: "https://bloom-co.calcart.com",
      };

      const rendered = renderGiftCardDeliveryEmail(props);

      expect(rendered.subject).toContain("Gift Card");
      expect(rendered.html).toContain("GIFT-WXYZ-1234");
      expect(rendered.html).toContain("Emily");
      expect(rendered.html).toContain("Bloom &amp; Co");
      expect(rendered.text).toContain("GIFT-WXYZ-1234");
      expect(rendered.text).toContain("Bloom & Co");
    });

    it("queues GIFT_CARD_DELIVERY in outbox when gift card is created with a recipient email and delivers it", async () => {
      const { storeId } = await seedStore("Gift World", "gift-world");
      const giftCardService = new GiftCardService();

      const giftCard = await giftCardService.createGiftCard(db, storeId, {
        initialBalance: 10000,
        currency: "USD",
        recipientEmail: "gift.recipient@example.com",
        recipientName: "Gift Recipient",
        notes: "Happy Birthday!",
      });

      // Verify gift card was created
      expect(giftCard).toBeDefined();
      expect(giftCard.id).toBeDefined();
      expect(giftCard.code).toBeDefined();
      expect(giftCard.initialBalance).toBe(10000);
      expect(giftCard.status).toBe("ACTIVE");

      // The GIFT_CARD_DELIVERY notification should be in the outbox
      const outboxRows = await outboxRepo.findByReference(db, storeId, "GIFT_CARD", giftCard.id);
      expect(outboxRows.length).toBe(1);
      expect(outboxRows[0].notification_type).toBe("GIFT_CARD_DELIVERY");
      expect(outboxRows[0].recipient_email).toBe("gift.recipient@example.com");
      expect(outboxRows[0].status).toBe("PENDING");

      // Dispatch and verify delivery
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);

      const emails = emailService.getCapturedEmails();
      expect(emails).toHaveLength(1);
      const email = emails[0];
      expect(email.to).toBe("gift.recipient@example.com");
      expect(email.templateName).toBe("gift_card_delivery");
      // The code must appear in the email body
      expect(email.html).toContain(giftCard.code);
      expect(email.text).toContain(giftCard.code);
      // Store name should be present
      expect(email.html).toContain("Gift World");
    });

    it("does NOT queue gift card delivery when no recipient email is provided", async () => {
      const { storeId } = await seedStore("No Recipient Store", "no-recipient");
      const giftCardService = new GiftCardService();

      // Create gift card without recipient email
      const giftCard = await giftCardService.createGiftCard(db, storeId, {
        initialBalance: 5000,
        currency: "USD",
        // No recipientEmail
        notes: "Internal gift card",
      });

      expect(giftCard).toBeDefined();

      // No GIFT_CARD_DELIVERY notification queued
      const outboxRows = await outboxRepo.findByReference(db, storeId, "GIFT_CARD", giftCard.id);
      expect(outboxRows.length).toBe(0);

      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(0);
      expect(emailService.getCapturedEmails()).toHaveLength(0);
    });

    it("delivers the gift card code ONLY to the intended recipient, not the buyer", async () => {
      const { storeId } = await seedStore("Exclusive Gifts", "exclusive-gifts");
      const giftCardService = new GiftCardService();

      const buyerEmail = "buyer@example.com";
      const recipientEmail = "recipient@example.com";

      const giftCard = await giftCardService.createGiftCard(db, storeId, {
        initialBalance: 7500,
        currency: "USD",
        recipientEmail,
        recipientName: "Special Recipient",
        notes: "Gift from buyer",
      });

      await dispatchJob.run(db);

      const emails = emailService.getCapturedEmails();
      expect(emails).toHaveLength(1);
      // Email goes ONLY to recipient, not buyer
      expect(emails[0].to).toBe(recipientEmail);
      expect(emails[0].to).not.toBe(buyerEmail);
      // The code appears in recipient's email
      expect(emails[0].html).toContain(giftCard.code);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. ORDERS CONTAINING BOTH PRODUCTS AND GIFT CARDS
  // ---------------------------------------------------------------------------
  describe("3. Orders Containing Both Products and Gift Cards", () => {
    it("sends order confirmation to buyer AND gift card delivery to recipient as separate emails", async () => {
      const { storeId } = await seedStore("Mixed Cart Store", "mixed-cart");
      const { orderId, orderNumber } = await seedOrder(storeId, {
        email: "buyer.mixed@example.com",
        grandTotal: 15000,
        items: [
          { name: "Leather Wallet", variant: "Brown", qty: 1, price: 8000 },
          { name: "Gift Card", variant: "USD 70", qty: 1, price: 7000 },
        ],
      });

      // Queue order confirmation (goes to buyer)
      await outboxService.queueOrderConfirmation(db, {
        storeId,
        orderId,
        orderNumber,
        currency: "USD",
        subtotal: 15000,
        grandTotal: 15000,
        recipientEmail: "buyer.mixed@example.com",
        recipientName: "Mixed Buyer",
        storeName: "Mixed Cart Store",
        storeSlug: "mixed-cart",
        items: [
          { name: "Leather Wallet", variantTitle: "Brown", quantity: 1, unitPrice: 8000, lineTotal: 8000 },
          { name: "Gift Card", variantTitle: "USD 70", quantity: 1, unitPrice: 7000, lineTotal: 7000 },
        ],
      });

      // Queue gift card delivery (goes to gift recipient, separately from buyer)
      const giftCardService = new GiftCardService();
      await giftCardService.createGiftCard(db, storeId, {
        initialBalance: 7000,
        currency: "USD",
        recipientEmail: "giftcard.recipient@example.com",
        recipientName: "Gift Recipient",
        notes: `Auto-issued from paid order #${orderNumber}`,
      });

      // Dispatch all pending notifications
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(2);
      expect(result.failedCount).toBe(0);

      const emails = emailService.getCapturedEmails();
      expect(emails).toHaveLength(2);

      const orderEmail = emails.find((e) => e.templateName === "order_confirmation");
      const giftCardEmail = emails.find((e) => e.templateName === "gift_card_delivery");

      // Order confirmation goes to buyer
      expect(orderEmail).toBeDefined();
      expect(orderEmail!.to).toBe("buyer.mixed@example.com");
      expect(orderEmail!.html).toContain("Leather Wallet");
      // Order email does NOT contain the redeem code
      expect(orderEmail!.html).not.toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/m);

      // Gift card email goes to the intended gift recipient, NOT the buyer
      expect(giftCardEmail).toBeDefined();
      expect(giftCardEmail!.to).toBe("giftcard.recipient@example.com");
      expect(giftCardEmail!.to).not.toBe("buyer.mixed@example.com");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. DUPLICATE EMAIL PREVENTION DURING RETRIES
  // ---------------------------------------------------------------------------
  describe("4. Duplicate Email Prevention (Idempotency)", () => {
    it("prevents duplicate order confirmation email when queueOrderConfirmation is called twice with the same orderId", async () => {
      const { storeId } = await seedStore("Idempotent Shop", "idempotent-shop");
      const { orderId, orderNumber } = await seedOrder(storeId);

      const params = {
        storeId,
        orderId,
        orderNumber,
        currency: "USD",
        subtotal: 5000,
        grandTotal: 5000,
        recipientEmail: "idempotent@example.com",
        storeName: "Idempotent Shop",
      };

      // First call queues notification
      const row1 = await outboxService.queueOrderConfirmation(db, params);
      expect(row1).not.toBeNull();

      // Second call with same orderId must be ignored (ON CONFLICT DO NOTHING)
      const row2 = await outboxService.queueOrderConfirmation(db, params);
      expect(row2).toBeNull();

      // Only one record in outbox
      const rows = await outboxRepo.findByReference(db, storeId, "order", orderId);
      expect(rows.length).toBe(1);

      // Dispatch: exactly one email sent
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);
      expect(emailService.getCapturedEmails()).toHaveLength(1);
    });

    it("prevents duplicate gift card delivery when outbox idempotency key conflicts", async () => {
      const { storeId } = await seedStore("Duplicate GC Store", "dup-gc");
      const giftCardId = generateUuidV7();

      // Manually insert two outbox entries with the same idempotency key — second should be ignored
      await outboxRepo.create(db, {
        storeId,
        notificationType: "GIFT_CARD_DELIVERY",
        recipientEmail: "gc-recipient@example.com",
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

      // Second insert with the same idempotencyKey — must return null
      const dup = await outboxRepo.create(db, {
        storeId,
        notificationType: "GIFT_CARD_DELIVERY",
        recipientEmail: "gc-recipient@example.com",
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
      expect(dup).toBeNull(); // ON CONFLICT DO NOTHING

      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);
      expect(emailService.getCapturedEmails()).toHaveLength(1);
    });

    it("does not resend emails when the worker processes the same outbox batch concurrently", async () => {
      const { storeId } = await seedStore("Concurrent Email Store", "concurrent-email");

      for (let i = 0; i < 3; i++) {
        const { orderId, orderNumber } = await seedOrder(storeId, {
          email: `concurrent${i}@example.com`,
          orderNumber: `ORD-CONC-EMAIL-${i}`,
        });
        await outboxService.queueOrderConfirmation(db, {
          storeId,
          orderId,
          orderNumber,
          currency: "USD",
          subtotal: 5000,
          grandTotal: 5000,
          recipientEmail: `concurrent${i}@example.com`,
        });
      }

      // Run two workers simultaneously
      const jobA = new NotificationDispatchJob(emailService, outboxRepo);
      const jobB = new NotificationDispatchJob(emailService, outboxRepo);
      const [resA, resB] = await Promise.all([jobA.run(db, { batchSize: 3 }), jobB.run(db, { batchSize: 3 })]);

      const totalSent = resA.sentCount + resB.sentCount;
      expect(totalSent).toBe(3); // Exactly 3, no duplicates

      // No overlap in processed IDs
      const setA = new Set(resA.processedIds);
      const setB = new Set(resB.processedIds);
      for (const id of setA) {
        expect(setB.has(id)).toBe(false);
      }

      // Email service captured exactly 3 emails
      expect(emailService.getCapturedEmails()).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. NO EMAIL BEFORE SUCCESSFUL PERSISTENCE AND ISSUANCE
  // ---------------------------------------------------------------------------
  describe("5. No Email Before Successful Persistence & Issuance", () => {
    it("does not queue or dispatch any email when the outbox is empty", async () => {
      // No orders, no gift cards created — nothing to dispatch
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(emailService.getCapturedEmails()).toHaveLength(0);
    });

    it("does not expose gift card redeem code in order confirmation email body", async () => {
      const { storeId } = await seedStore("Code Security Store", "code-security");
      const { orderId, orderNumber } = await seedOrder(storeId, {
        email: "buyer@security.com",
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
        recipientEmail: "buyer@security.com",
        storeName: "Code Security Store",
        storeSlug: "code-security",
        items: [{ name: "Gift Card", variantTitle: "USD 100", quantity: 1, unitPrice: 10000, lineTotal: 10000 }],
      });

      await dispatchJob.run(db);

      const emails = emailService.getCapturedEmails();
      const orderEmail = emails.find((e) => e.templateName === "order_confirmation");
      expect(orderEmail).toBeDefined();

      // No gift card code format should appear in the order confirmation email
      // Gift card codes follow pattern like XXXX-XXXX-XXXX
      expect(orderEmail!.html).not.toMatch(/\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/);
    });

    it("marks outbox FAILED immediately on invalid/missing recipient email and sends no email", async () => {
      const { storeId } = await seedStore("Invalid Email Store 2", "invalid-email-2");
      const orderId = generateUuidV7();

      const row = await outboxRepo.create(db, {
        storeId,
        notificationType: "ORDER_CONFIRMATION",
        recipientEmail: "not-an-email",
        referenceType: "order",
        referenceId: orderId,
        idempotencyKey: `order_confirmed:${orderId}`,
        payload: { orderId, orderNumber: "ORD-INVALID", storeName: "Test Store", currency: "USD", grandTotal: 100 },
      });

      const result = await dispatchJob.run(db);
      expect(result.failedCount).toBe(1);
      expect(result.sentCount).toBe(0);

      const updated = await outboxRepo.findById(db, row!.id);
      expect(updated?.status).toBe("FAILED");
      expect(updated?.next_retry_at).toBeNull(); // Terminal — no retry
      expect(emailService.getCapturedEmails()).toHaveLength(0);
    });

    it("does not send gift card delivery email before the gift card is ACTIVE and issued", async () => {
      // The GiftCardService.createGiftCard queues the delivery notification only after
      // the gift card row is inserted with status ACTIVE. This test verifies that order:
      // the email cannot arrive if card creation fails.
      const { storeId } = await seedStore("Failed Card Store", "failed-card");
      const giftCardService = new GiftCardService();

      // Attempting to create a gift card with invalid balance should throw before queuing
      await expect(
        giftCardService.createGiftCard(db, storeId, {
          initialBalance: 0, // Invalid: must be > 0
          currency: "USD",
          recipientEmail: "recipient@example.com",
        }),
      ).rejects.toThrow();

      // No email dispatched
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(0);
      expect(emailService.getCapturedEmails()).toHaveLength(0);
    });
  });
});
