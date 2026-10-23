import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  NotificationOutboxRepository,
  OrderRepository,
} from "@shopify-clone/db";
import {
  EmailService,
  resetEmailService,
  formatCurrency,
} from "@shopify-clone/email";
import {
  NotificationOutboxService,
  OrderCancellationCoordinator,
  OrderStatusService,
} from "@shopify-clone/orders";
import {
  PaymentOrderIntegration,
} from "@shopify-clone/payments";
import { NotificationDispatchJob } from "../../apps/worker/src/jobs/notifications/notification-dispatch-job.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Customer Order Lifecycle Notifications (Milestone M2)", { timeout: 60_000 }, () => {
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
      appUrl: "https://demo.shopifyclone.com",
      fromEmail: "Shopify Clone <orders@shopifyclone.com>",
    });
    resetEmailService(emailService);

    outboxRepo = new NotificationOutboxRepository();
    outboxService = new NotificationOutboxService(outboxRepo);
    dispatchJob = new NotificationDispatchJob(emailService, outboxRepo);
  });

  afterEach(async () => {
    resetEmailService();
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function seedStoreWithProduct(
    storeName: string,
    slug: string,
    priceMinor = 5000,
  ): Promise<{
    orgId: string;
    storeId: string;
    productId: string;
    variantId: string;
    inventoryItemId: string;
  }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const inventoryItemId = generateUuidV7();

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${storeName}`,
    ]);

    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, storeName, slug],
    );

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Artisan Ceramic Mug', $3, 'ACTIVE')`,
      [productId, storeId, `mug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, store_id, product_id, title, price, sku, currency, status)
       VALUES ($1, $2, $3, 'Matte White', $4, $5, 'USD', 'ACTIVE')`,
      [variantId, storeId, productId, priceMinor, `SKU-MUG-${Date.now()}`],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 100, 0)`,
      [inventoryItemId, storeId, variantId],
    );

    return { orgId, storeId, productId, variantId, inventoryItemId };
  }

  async function createTestOrder(
    storeId: string,
    options?: {
      email?: string;
      orderNumber?: string;
      grandTotal?: number;
      paymentStatus?: string;
      fulfillmentStatus?: string;
      status?: string;
    },
  ): Promise<{ orderId: string; orderNumber: string; checkoutId: string }> {
    const orderId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const orderNumber = options?.orderNumber ?? `ORD-${Date.now().toString(36).toUpperCase()}`;
    const email = options?.email ?? "buyer@example.com";
    const grandTotal = options?.grandTotal ?? 5000;
    const paymentStatus = options?.paymentStatus ?? "PAID";
    const fulfillmentStatus = options?.fulfillmentStatus ?? "UNFULFILLED";
    const status = options?.status ?? "CONFIRMED";

    // Create cart row
    await db.query(
      `INSERT INTO carts (id, store_id, currency, status) VALUES ($1, $2, 'USD', 'ACTIVE')`,
      [cartId, storeId],
    );

    // Create checkout row
    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, status, payment_status, currency,
         subtotal, total, email, shipping_address
       ) VALUES ($1, $2, $3, 'COMPLETED', $4, 'USD', $5, $5, $6, $7)`,
      [
        checkoutId,
        storeId,
        cartId,
        paymentStatus,
        grandTotal,
        email,
        JSON.stringify({
          firstName: "Alex",
          lastName: "Smith",
          addressLine1: "123 Main St",
          city: "Portland",
          country: "US",
        }),
      ],
    );

    // Create order row
    await db.query(
      `INSERT INTO orders (
         id, store_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, total, grand_total
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, 'USD', $8, 0, 0,
         0, $8, $8
       )`,
      [
        orderId,
        storeId,
        checkoutId,
        orderNumber,
        status,
        paymentStatus,
        fulfillmentStatus,
        grandTotal,
      ],
    );

    // Add order item
    await db.query(
      `INSERT INTO order_items (
         id, order_id, store_id, product_name_snapshot, variant_name_snapshot,
         quantity, unit_price, line_total
       ) VALUES ($1, $2, $3, 'Artisan Ceramic Mug', 'Matte White', 1, $4, $4)`,
      [generateUuidV7(), orderId, storeId, grandTotal],
    );

    return { orderId, orderNumber, checkoutId };
  }

  // =========================================================================
  // 1. ORDER CONFIRMATION NOTIFICATIONS
  // =========================================================================
  describe("1. Order Confirmation Notifications", () => {
    it("queues and delivers order confirmation email with itemized pricing on successful payment", async () => {
      const { storeId } = await seedStoreWithProduct("Roasters Co", "roasters-co", 5000);
      const { orderId, orderNumber } = await createTestOrder(storeId, {
        email: "coffee.lover@example.com",
        grandTotal: 5000,
        paymentStatus: "PAID",
      });

      // Queue confirmation
      const queued = await outboxService.queueOrderConfirmation(db, {
        storeId,
        orderId,
        orderNumber,
        currency: "USD",
        subtotal: 5000,
        discountTotal: 500,
        shippingTotal: 400,
        taxTotal: 300,
        grandTotal: 5200,
        recipientEmail: "coffee.lover@example.com",
        recipientName: "Alex Smith",
        storeName: "Roasters Co",
        storeSlug: "roasters-co",
        items: [
          {
            name: "Artisan Ceramic Mug",
            variantTitle: "Matte White",
            quantity: 1,
            unitPrice: 5000,
            lineTotal: 5000,
          },
        ],
        shippingAddress: {
          name: "Alex Smith",
          addressLine1: "123 Main St",
          city: "Portland",
          state: "OR",
          postalCode: "97201",
          country: "US",
        },
      });

      expect(queued).not.toBeNull();
      expect(queued?.status).toBe("PENDING");
      expect(queued?.idempotency_key).toBe(`order_confirmed:${orderId}`);

      // Run worker dispatch job
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);
      expect(result.failedCount).toBe(0);

      // Verify email was captured
      const emails = emailService.getCapturedEmails();
      expect(emails.length).toBe(1);
      const email = emails[0];
      expect(email.to).toBe("coffee.lover@example.com");
      expect(email.subject).toContain(`Order Confirmation: ${orderNumber}`);
      expect(email.subject).toContain("Roasters Co");
      expect(email.html).toContain("Artisan Ceramic Mug");
      expect(email.html).toContain("123 Main St");
      expect(email.text).toContain(`Order Confirmation: #${orderNumber}`);
      expect(email.text).toContain(formatCurrency(5200, "USD"));

      // Verify outbox record transitioned to SENT
      const updatedRow = await outboxRepo.findById(db, queued!.id);
      expect(updatedRow?.status).toBe("SENT");
      expect(updatedRow?.attempts).toBe(1);
      expect(updatedRow?.processed_at).not.toBeNull();
      expect(updatedRow?.error_message).toBeNull();
    });

    it("does not queue confirmation when payment is uncaptured or fails", async () => {
      const { storeId } = await seedStoreWithProduct("Boutique Store", "boutique");
      const { checkoutId } = await createTestOrder(storeId, {
        paymentStatus: "FAILED",
        status: "PENDING",
      });
      const pIntegration = new PaymentOrderIntegration();

      // Given a failed payment record linked to the checkout
      const paymentId = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status, provider)
         VALUES ($1, $2, $3, 5000, 'USD', 'FAILED', 'razorpay')`,
        [paymentId, storeId, checkoutId],
      );

      // Attempting to complete purchase workflow on a failed payment throws error
      await expect(
        pIntegration.completePurchaseWorkflow(db, {
          storeId,
          paymentId,
        }),
      ).rejects.toThrow();

      // Ensure outbox remains empty
      const pending = await outboxRepo.claimPending(db);
      expect(pending.length).toBe(0);
    });
  });

  // =========================================================================
  // 2. ORDER FULFILLMENT NOTIFICATIONS
  // =========================================================================
  describe("2. Order Fulfillment Notifications", () => {
    it("delivers full shipment email with carrier tracking information", async () => {
      const { storeId } = await seedStoreWithProduct("Tech Gear", "tech-gear");
      const { orderId, orderNumber } = await createTestOrder(storeId, {
        email: "customer@tech.com",
      });

      // Queue fulfillment
      await outboxService.queueOrderFulfillment(db, {
        storeId,
        orderId,
        orderNumber,
        fulfillmentStatus: "FULFILLED",
        carrier: "FedEx Express",
        trackingNumber: "FX-9988776655",
        trackingUrl: "https://fedex.com/track/FX-9988776655",
        recipientEmail: "customer@tech.com",
        recipientName: "Tech Shopper",
        storeName: "Tech Gear",
      });

      // Run worker dispatch
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);

      const captured = emailService.getLastCapturedEmail();
      expect(captured).toBeDefined();
      expect(captured?.to).toBe("customer@tech.com");
      expect(captured?.subject).toContain(`Your order #${orderNumber} has shipped!`);
      expect(captured?.html).toContain("FedEx Express");
      expect(captured?.html).toContain("FX-9988776655");
      expect(captured?.html).toContain("https://fedex.com/track/FX-9988776655");
      expect(captured?.text).toContain("FedEx Express");
    });

    it("delivers partial shipment notice clarifying remaining items will ship separately", async () => {
      const { storeId } = await seedStoreWithProduct("Book Depot", "book-depot");
      const { orderId, orderNumber } = await createTestOrder(storeId, {
        email: "reader@books.com",
        fulfillmentStatus: "PARTIALLY_FULFILLED",
      });

      await outboxService.queueOrderFulfillment(db, {
        storeId,
        orderId,
        orderNumber,
        fulfillmentStatus: "PARTIALLY_FULFILLED",
        recipientEmail: "reader@books.com",
        storeName: "Book Depot",
      });

      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);

      const captured = emailService.getLastCapturedEmail();
      expect(captured?.subject).toContain("partially shipped");
      expect(captured?.html).toContain("The remaining items in your order will be shipped separately");
      expect(captured?.text).toContain("The remaining items will be shipped separately");
    });
  });

  // =========================================================================
  // 3. ORDER CANCELLATION NOTIFICATIONS
  // =========================================================================
  describe("3. Order Cancellation Notifications", () => {
    it("delivers cancellation email with succeeded refund amount", async () => {
      const { storeId } = await seedStoreWithProduct("Nordic Crafts", "nordic-crafts");
      const { orderId, orderNumber } = await createTestOrder(storeId, {
        email: "buyer@nordic.com",
        grandTotal: 12000,
        paymentStatus: "PAID",
      });

      const orderRepo = new OrderRepository();
      const statusService = new OrderStatusService(orderRepo);
      const coordinator = new OrderCancellationCoordinator(
        statusService,
        orderRepo,
        undefined,
        {
          async processCancellationRefund() {
            return {
              status: "SUCCEEDED",
              refundId: generateUuidV7(),
              amount: 12000,
            };
          },
        },
        outboxService,
      );

      // Cancel order
      await coordinator.cancelOrder(db, {
        storeId,
        orderId,
        reason: "Customer requested cancellation before shipment",
      });

      // Dispatch notification
      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);

      const email = emailService.getLastCapturedEmail();
      expect(email?.to).toBe("buyer@nordic.com");
      expect(email?.subject).toContain(`Order Cancelled: #${orderNumber}`);
      expect(email?.html).toContain("Customer requested cancellation before shipment");
      expect(email?.html).toContain("Refund Issued");
      expect(email?.html).toContain(formatCurrency(12000, "USD"));
      expect(email?.html).toContain("5–10 business days");
    });

    it("delivers cancellation email indicating no charges captured when refund not applicable", async () => {
      const { storeId } = await seedStoreWithProduct("Nordic Crafts 2", "nordic-crafts-2");
      const { orderId, orderNumber } = await createTestOrder(storeId, {
        email: "buyer2@nordic.com",
        grandTotal: 4000,
        paymentStatus: "PENDING", // Unpaid
        status: "PENDING",
      });

      const orderRepo = new OrderRepository();
      const statusService = new OrderStatusService(orderRepo);
      const coordinator = new OrderCancellationCoordinator(
        statusService,
        orderRepo,
        undefined,
        {
          async processCancellationRefund() {
            return {
              status: "NOT_APPLICABLE",
            };
          },
        },
        outboxService,
      );

      await coordinator.cancelOrder(db, {
        storeId,
        orderId,
        reason: "Payment authorization expired",
      });

      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);

      const email = emailService.getLastCapturedEmail();
      expect(email?.subject).toContain(`Order Cancelled: #${orderNumber}`);
      expect(email?.html).toContain("No charges were captured for this order");
    });
  });

  // =========================================================================
  // 4. REFUND CONFIRMATION NOTIFICATIONS
  // =========================================================================
  describe("4. Refund Confirmation Notifications", () => {
    it("delivers refund confirmation email for partial and full refunds", async () => {
      const { storeId } = await seedStoreWithProduct("Apparel Studio", "apparel-studio");
      const { orderId, orderNumber } = await createTestOrder(storeId, {
        email: "shopper@apparel.com",
        grandTotal: 10000,
      });

      const refundId = generateUuidV7();
      await outboxService.queueRefundConfirmation(db, {
        storeId,
        orderId,
        orderNumber,
        refundId,
        amount: 3000,
        currency: "USD",
        isFullRefund: false,
        reason: "Item returned damaged",
        recipientEmail: "shopper@apparel.com",
        storeName: "Apparel Studio",
      });

      const result = await dispatchJob.run(db);
      expect(result.sentCount).toBe(1);

      const email = emailService.getLastCapturedEmail();
      expect(email?.subject).toContain(`Refund Confirmation for Order #${orderNumber}`);
      expect(email?.subject).toContain(formatCurrency(3000, "USD"));
      expect(email?.html).toContain("Partial refund");
      expect(email?.html).toContain("Item returned damaged");
      expect(email?.html).toContain("5 to 10 business days");
    });
  });

  // =========================================================================
  // 5. IDEMPOTENCY & CONCURRENCY RESILIENCY
  // =========================================================================
  describe("5. Idempotency & Concurrency Resiliency", () => {
    it("guarantees strict deduplication on duplicate event submissions", async () => {
      const { storeId } = await seedStoreWithProduct("Idempotent Store", "idemp-store");
      const { orderId, orderNumber } = await createTestOrder(storeId);

      // First queue call
      const row1 = await outboxService.queueOrderConfirmation(db, {
        storeId,
        orderId,
        orderNumber,
        currency: "USD",
        subtotal: 5000,
        grandTotal: 5000,
        recipientEmail: "test@example.com",
      });
      expect(row1).not.toBeNull();

      // Second queue call with identical idempotency key
      const row2 = await outboxService.queueOrderConfirmation(db, {
        storeId,
        orderId,
        orderNumber,
        currency: "USD",
        subtotal: 5000,
        grandTotal: 5000,
        recipientEmail: "test@example.com",
      });
      // ON CONFLICT DO NOTHING returns null
      expect(row2).toBeNull();

      // Only 1 record in outbox
      const pending = await outboxRepo.claimPending(db);
      expect(pending.length).toBe(1);
    });

    it("prevents double-send under concurrent worker execution using FOR UPDATE SKIP LOCKED", async () => {
      const { storeId } = await seedStoreWithProduct("Concurrency Store", "concurrency-store");

      // Queue 5 distinct notifications
      for (let i = 0; i < 5; i++) {
        const { orderId, orderNumber } = await createTestOrder(storeId, {
          email: `concurrent${i}@example.com`,
          orderNumber: `ORD-CONC-${i}`,
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

      // Run two workers simultaneously on the same database
      const workerA = new NotificationDispatchJob(emailService, outboxRepo);
      const workerB = new NotificationDispatchJob(emailService, outboxRepo);

      const [resA, resB] = await Promise.all([
        workerA.run(db, { batchSize: 5 }),
        workerB.run(db, { batchSize: 5 }),
      ]);

      // Together they must process exactly 5 distinct items with no duplicates
      const totalSent = resA.sentCount + resB.sentCount;
      expect(totalSent).toBe(5);

      const setA = new Set(resA.processedIds);
      const setB = new Set(resB.processedIds);
      for (const id of setA) {
        expect(setB.has(id)).toBe(false); // No overlap!
      }

      expect(emailService.getCapturedEmails().length).toBe(5);
    });
  });

  // =========================================================================
  // 6. ERROR RESILIENCE & RETRY BACKOFF
  // =========================================================================
  describe("6. Error Resilience & Retry Backoff", () => {
    it("retries transient provider failure with exponential backoff and preserves PENDING status", async () => {
      const { storeId } = await seedStoreWithProduct("Retry Store", "retry-store");
      const { orderId, orderNumber } = await createTestOrder(storeId);

      const row = await outboxService.queueOrderConfirmation(db, {
        storeId,
        orderId,
        orderNumber,
        currency: "USD",
        subtotal: 5000,
        grandTotal: 5000,
        recipientEmail: "retry@example.com",
      });

      // Mock EmailService to fail transiently
      const failingEmailService = new EmailService({ mode: "test" });
      failingEmailService.sendEmail = async () => ({
        success: false,
        error: "Rate limit exceeded from provider",
        mode: "test",
      });

      const failingJob = new NotificationDispatchJob(failingEmailService, outboxRepo);
      const result = await failingJob.run(db);

      expect(result.sentCount).toBe(0);
      expect(result.failedCount).toBe(1);

      // Verify row is still PENDING with next_retry_at scheduled in future
      const updated = await outboxRepo.findById(db, row!.id);
      expect(updated?.status).toBe("PENDING");
      expect(updated?.attempts).toBe(1);
      expect(updated?.error_message).toContain("Rate limit exceeded");
      expect(new Date(updated!.next_retry_at!).getTime()).toBeGreaterThan(Date.now());
    });

    it("terminates with FAILED immediately on missing or malformed email address", async () => {
      const { storeId } = await seedStoreWithProduct("Invalid Email Store", "invalid-email-store");
      const orderId = generateUuidV7();

      // Insert directly with missing / invalid email
      const row = await outboxRepo.create(db, {
        storeId,
        notificationType: "ORDER_CONFIRMATION",
        recipientEmail: "not-an-email",
        referenceType: "order",
        referenceId: orderId,
        idempotencyKey: `order_confirmed:${orderId}`,
        payload: { orderId, orderNumber: "ORD-BAD" },
      });

      const result = await dispatchJob.run(db);
      expect(result.failedCount).toBe(1);

      const updated = await outboxRepo.findById(db, row!.id);
      expect(updated?.status).toBe("FAILED");
      expect(updated?.next_retry_at).toBeNull();
      expect(updated?.error_message).toContain("invalid");
      expect(emailService.getCapturedEmails().length).toBe(0);
    });
  });

  // =========================================================================
  // 7. TENANT ISOLATION
  // =========================================================================
  describe("7. Strict Tenant Isolation", () => {
    it("prevents store branding or order details leaking across tenants", async () => {
      const storeA = await seedStoreWithProduct("Alpha Artisan", "alpha-artisan");
      const storeB = await seedStoreWithProduct("Beta Boutique", "beta-boutique");

      const orderA = await createTestOrder(storeA.storeId, {
        email: "customerA@alpha.com",
        orderNumber: "ORD-ALPHA-01",
      });
      const orderB = await createTestOrder(storeB.storeId, {
        email: "customerB@beta.com",
        orderNumber: "ORD-BETA-02",
      });

      await outboxService.queueOrderConfirmation(db, {
        storeId: storeA.storeId,
        orderId: orderA.orderId,
        orderNumber: orderA.orderNumber,
        currency: "USD",
        subtotal: 5000,
        grandTotal: 5000,
        recipientEmail: "customerA@alpha.com",
        storeName: "Alpha Artisan",
        storeSlug: "alpha-artisan",
      });

      await outboxService.queueOrderConfirmation(db, {
        storeId: storeB.storeId,
        orderId: orderB.orderId,
        orderNumber: orderB.orderNumber,
        currency: "USD",
        subtotal: 7500,
        grandTotal: 7500,
        recipientEmail: "customerB@beta.com",
        storeName: "Beta Boutique",
        storeSlug: "beta-boutique",
      });

      await dispatchJob.run(db);

      const emails = emailService.getCapturedEmails();
      expect(emails.length).toBe(2);

      const emailA = emails.find((e) => e.to === "customerA@alpha.com");
      const emailB = emails.find((e) => e.to === "customerB@beta.com");

      expect(emailA?.subject).toContain("Alpha Artisan");
      expect(emailA?.html).not.toContain("Beta Boutique");

      expect(emailB?.subject).toContain("Beta Boutique");
      expect(emailB?.html).not.toContain("Alpha Artisan");

      // Verify DB queries by store_id strictly isolate outbox records
      const outboxA = await outboxRepo.findByReference(
        db,
        storeA.storeId,
        "order",
        orderA.orderId,
      );
      expect(outboxA.length).toBe(1);
      expect(outboxA[0].store_id).toBe(storeA.storeId);

      const crossCheck = await outboxRepo.findByReference(
        db,
        storeB.storeId,
        "order",
        orderA.orderId,
      );
      expect(crossCheck.length).toBe(0); // Store B cannot access Store A's notification!
    });
  });
});
