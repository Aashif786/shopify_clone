import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createHmac } from "node:crypto";
import { StoreService } from "@shopify-clone/stores";
import { ProductService } from "@shopify-clone/products";
import {
  InventoryService,
  ReservationReleaseService,
} from "@shopify-clone/inventory";
import { CustomerService } from "@shopify-clone/customers";
import { DiscountService, DiscountRedemptionService } from "@shopify-clone/discounts";
import {
  PaymentCheckoutCoordinator,
  PaymentOrderIntegration,
  ProviderPaymentService,
  RazorpayPaymentProvider,
  RazorpayClient,
  OrderCancellationRefundService,
  type HttpTransport,
} from "../../../modules/payments/src/index.js";
import {
  OrderService,
  OrderStatusService,
  OrderCancellationCoordinator,
  OrderImmutableError,
  CrossStoreOrderAccessError,
} from "@shopify-clone/orders";
import { CannotRemoveLastOwnerError } from "@shopify-clone/stores";
import { CustomerNotFoundError } from "@shopify-clone/customers";
import {
  InventoryNotFoundError,
  InsufficientStockError,
} from "@shopify-clone/inventory";
import { createIsolatedDatabase } from "../../helpers/postgres.js";

describe("Milestone C4: End-to-End Demo Workflow & Multi-Tenant Validation", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  const keyId = "rzp_test_demoKeyC4";
  const keySecret = "rzp_test_secretDemoC4_98765";

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

  function computeValidCallbackSignature(orderId: string, paymentId: string, secret = keySecret): string {
    return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  }

  function createMockProvider(options?: {
    orderId?: string;
    gatewayAmount?: number;
    gatewayCurrency?: string;
  }): RazorpayPaymentProvider {
    const transport: HttpTransport = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/orders") && init?.method === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const id = options?.orderId ?? `order_RZP_${Date.now().toString(36)}`;
        const orderData = {
          id,
          entity: "order",
          amount: body.amount,
          amount_paid: 0,
          amount_due: body.amount,
          currency: body.currency,
          receipt: body.receipt,
          status: "created",
          attempts: 0,
          created_at: Math.floor(Date.now() / 1000),
        };
        return new Response(JSON.stringify(orderData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/payments/") && init?.method === "GET") {
        const pId = url.split("/payments/")[1] ?? "pay_prov_c4";
        return new Response(
          JSON.stringify({
            id: pId,
            entity: "payment",
            amount: options?.gatewayAmount ?? 6800,
            currency: options?.gatewayCurrency ?? "USD",
            status: "captured",
            order_id: options?.orderId ?? "order_prov_default",
            method: "card",
            captured: true,
            created_at: Math.floor(Date.now() / 1000),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({}), { status: 404 });
    };

    const client = new RazorpayClient({ keyId, keySecret, transport });
    return new RazorpayPaymentProvider({ keyId, keySecret, client });
  }

  it("validates full 11-step end-to-end merchant commerce and customer lifecycle workflow", async () => {
    const db = await setupDb();

    // Instantiate domain services
    const storeService = new StoreService();
    const productService = new ProductService();
    const inventoryService = new InventoryService();
    const customerService = new CustomerService();
    const discountService = new DiscountService();
    const redemptionService = new DiscountRedemptionService();
    const orderService = new OrderService();
    const releaseService = new ReservationReleaseService();
    const refundService = new OrderCancellationRefundService();
    const cancellationCoordinator = new OrderCancellationCoordinator(
      undefined,
      undefined,
      releaseService,
      refundService,
    );

    // =========================================================================
    // STEP 1: Create a store and update its settings
    // =========================================================================
    const ownerUserId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, 'owner@artisanceramics.com', 'Artisan Owner', 'hash123', 'ACTIVE')`,
      [ownerUserId],
    );

    const storeA = await storeService.createStore(db, ownerUserId, {
      name: "Artisan Ceramics Studio",
      slug: "artisan-ceramics",
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
      contactEmail: "contact@artisanceramics.com",
      contactPhone: "+1-555-0100",
      description: "Handcrafted boutique stoneware",
    });
    expect(storeA.id).toBeDefined();
    expect(storeA.slug).toBe("artisan-ceramics");
    expect(storeA.status).toBe("DRAFT");

    // Activate the store
    const activatedStoreA = await storeService.activateStore(db, storeA.id, ownerUserId);
    expect(activatedStoreA.status).toBe("ACTIVE");

    // Update store settings
    const updatedStoreA = await storeService.updateStore(db, storeA.id, ownerUserId, {
      name: "Artisan Ceramics Atelier",
      contactPhone: "+1-555-0199",
      description: "Fine handcrafted studio pottery and porcelain",
    });
    expect(updatedStoreA.name).toBe("Artisan Ceramics Atelier");
    expect(updatedStoreA.settings?.contactPhone).toBe("+1-555-0199");
    expect(updatedStoreA.settings?.description).toBe("Fine handcrafted studio pottery and porcelain");

    // =========================================================================
    // STEP 2: Switch between authorized stores and verify active-store context
    // =========================================================================
    const storeB = await storeService.createStore(db, ownerUserId, {
      name: "Heritage Woodcrafts",
      slug: "heritage-woodcrafts",
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
      contactEmail: "wood@heritage.com",
      description: "Solid hardwood artisanal furniture",
    });
    await storeService.activateStore(db, storeB.id, ownerUserId);

    // List authorized stores for merchant
    const userStores = await storeService.listUserStores(db, ownerUserId);
    expect(userStores.length).toBe(2);
    const storeIds = userStores.map((s) => s.id);
    expect(storeIds).toContain(storeA.id);
    expect(storeIds).toContain(storeB.id);

    // =========================================================================
    // STEP 3: Manage team memberships and confirm role restrictions
    // =========================================================================
    const adminUserId = generateUuidV7();
    const staffUserId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, 'admin@artisanceramics.com', 'Studio Admin', 'hash123', 'ACTIVE'),
              ($2, 'staff@artisanceramics.com', 'Studio Staff', 'hash123', 'ACTIVE')`,
      [adminUserId, staffUserId],
    );

    // Owner adds Admin to Store A
    const adminMembership = await storeService.addStoreMember(db, storeA.id, ownerUserId, {
      userId: adminUserId,
      role: "admin",
    });
    expect(adminMembership.role).toBe("admin");

    // Admin adds Staff to Store A
    const staffMembership = await storeService.addStoreMember(db, storeA.id, adminUserId, {
      userId: staffUserId,
      role: "staff",
    });
    expect(staffMembership.role).toBe("staff");

    // Staff cannot update store settings (role restriction verification)
    await expect(
      storeService.updateStore(db, storeA.id, staffUserId, {
        name: "Unauthorized Rename",
      }),
    ).rejects.toThrow();

    // Staff cannot add store members
    const unauthorizedUser = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, 'other@example.com', 'Other User', 'hash123', 'ACTIVE')`,
      [unauthorizedUser],
    );
    await expect(
      storeService.addStoreMember(db, storeA.id, staffUserId, {
        userId: unauthorizedUser,
        role: "staff",
      }),
    ).rejects.toThrow();

    // Admin cannot remove or demote the sole Owner (owner protection)
    const ownerMembership = (await storeService.listStoreMembers(db, storeA.id, ownerUserId)).find(
      (m) => m.userId === ownerUserId,
    );
    expect(ownerMembership).toBeDefined();

    await expect(
      storeService.updateStoreMember(db, storeA.id, adminUserId, ownerMembership!.id, {
        role: "staff",
      }),
    ).rejects.toThrow(CannotRemoveLastOwnerError);

    // =========================================================================
    // STEP 4: Create a product and variant, then configure and adjust inventory
    // =========================================================================
    const product = await productService.createProduct(db, storeA.id, {
      title: "Artisan Stoneware Vase",
      slug: "artisan-stoneware-vase",
      description: "Hand-thrown stoneware vase with matte glaze finish",
    });
    expect(product.id).toBeDefined();

    const variant = await productService.createVariant(db, storeA.id, product.id, {
      title: "Terracotta Large",
      sku: "VASE-TER-LG",
      price: 8500, // $85.00
      currency: "USD",
    });
    expect(variant.id).toBeDefined();

    // Publish the product
    const published = await productService.publishProduct(db, storeA.id, product.id);
    expect(published.status).toBe("ACTIVE");

    // Initial stock setup: 40 units
    const initialAdjustment = await inventoryService.adjustStock(db, storeA.id, variant.id, {
      quantityDelta: 40,
      reason: "INITIAL_STOCK",
      referenceId: "PO-VASE-INIT",
    });
    expect(initialAdjustment.adjustment.newQuantity).toBe(40);

    let stockAvailability = await inventoryService.getAvailability(db, storeA.id, variant.id);
    expect(stockAvailability.availableQuantity).toBe(40);
    expect(stockAvailability.reservedQuantity).toBe(0);
    expect(stockAvailability.totalQuantity).toBe(40);

    // Inventory adjustment for damaged stock: delta = -5
    const damagedAdjustment = await inventoryService.adjustStock(db, storeA.id, variant.id, {
      quantityDelta: -5,
      reason: "DAMAGED",
      referenceId: "SCRAP-VASE-01",
    });
    expect(damagedAdjustment.adjustment.newQuantity).toBe(35);

    stockAvailability = await inventoryService.getAvailability(db, storeA.id, variant.id);
    expect(stockAvailability.availableQuantity).toBe(35);
    expect(stockAvailability.reservedQuantity).toBe(0);

    // =========================================================================
    // STEP 5: Storefront: Add to cart, apply valid discount
    // =========================================================================
    const discount = await discountService.createDiscount(db, storeA.id, {
      code: "WELCOME20",
      name: "Welcome 20% Promotion",
      type: "PERCENTAGE",
      value: 20,
      currency: "USD",
      minimumSubtotal: 5000, // $50.00 minimum spend
    });
    expect(discount.code).toBe("WELCOME20");

    const cartId = generateUuidV7();
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cartId, storeA.id]);

    const cartItemId = generateUuidV7();
    const unitPrice = 8500;
    await db.query(
      `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
       VALUES ($1, $2, $3, $4, 1, $5, $5)`,
      [cartItemId, cartId, storeA.id, variant.id, unitPrice],
    );

    // Evaluate discount on storefront subtotal ($85.00)
    const discountEvaluation = await discountService.evaluateCode(db, storeA.id, "WELCOME20", {
      subtotal: unitPrice,
      currency: "USD",
    });
    expect(discountEvaluation.isValid).toBe(true);
    expect(discountEvaluation.discount?.amount).toBe(1700); // 20% of 8500 = 1700 ($17.00)

    const finalSubtotal = unitPrice;
    const discountTotal = 1700;
    const finalTotal = finalSubtotal - discountTotal; // 6800 ($68.00)

    // =========================================================================
    // STEP 6: Complete checkout using Razorpay test integration
    // =========================================================================
    // Create customer profile in store A
    const customer = await customerService.createCustomer(db, storeA.id, {
      email: "evelyn.stone@example.com",
      firstName: "Evelyn",
      lastName: "Stone",
      phone: "+1-555-8888",
    });
    expect(customer.id).toBeDefined();
    expect(customer.email).toBe("evelyn.stone@example.com");

    const checkoutId = generateUuidV7();
    const addressSnapshot = JSON.stringify({
      name: "Evelyn Stone",
      firstName: "Evelyn",
      lastName: "Stone",
      addressLine1: "456 Artisan Way",
      city: "Brooklyn",
      province: "NY",
      postalCode: "11201",
      country: "US",
      phone: "+1-555-8888",
    });

    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, customer_id, subtotal, tax_total, shipping_total,
         discount_total, total, status, currency, email, shipping_address, billing_address
       ) VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7, 'OPEN', 'USD', $8, $9, $9)`,
      [
        checkoutId,
        storeA.id,
        cartId,
        customer.id,
        finalSubtotal,
        discountTotal,
        finalTotal,
        customer.email,
        addressSnapshot,
      ],
    );

    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Artisan Stoneware Vase', 'Terracotta Large', 'VASE-TER-LG', $5, 1, $5)`,
      [generateUuidV7(), checkoutId, storeA.id, variant.id, unitPrice],
    );

    // Reserve 1 unit for checkout
    const reservation = await inventoryService.reserve(db, storeA.id, {
      variantId: variant.id,
      quantity: 1,
      referenceType: "checkout",
      referenceId: checkoutId,
    });
    expect(reservation.status).toBe("ACTIVE");

    // Stock check after reservation: available = 34, reserved = 1
    stockAvailability = await inventoryService.getAvailability(db, storeA.id, variant.id);
    expect(stockAvailability.availableQuantity).toBe(34);
    expect(stockAvailability.reservedQuantity).toBe(1);

    // Initialize payment
    const coordinator = new PaymentCheckoutCoordinator();
    const initPayment = await coordinator.initializePaymentForCheckout(db, {
      storeId: storeA.id,
      checkoutId,
      idempotencyKey: "init_payment_c4_01",
    });
    expect(initPayment.payment.status).toBe("CREATED");
    expect(initPayment.payment.amount).toBe(finalTotal);

    // Provider gateway order creation
    const providerOrderId = "order_rzp_demo_c4_001";
    const provider = createMockProvider({
      orderId: providerOrderId,
      gatewayAmount: finalTotal,
      gatewayCurrency: "USD",
    });
    const providerService = new ProviderPaymentService(provider);

    const rzpOrder = await providerService.createProviderOrder(
      db,
      storeA.id,
      initPayment.payment.id,
      initPayment.attempt.id,
    );
    expect(rzpOrder.providerOrderId).toBe(providerOrderId);

    // Payment callback with valid signature
    const providerPaymentId = "pay_rzp_captured_c4_001";
    const signature = computeValidCallbackSignature(providerOrderId, providerPaymentId, keySecret);

    const callbackResult = await providerService.verifyAndProcessCallback(db, {
      storeId: storeA.id,
      paymentId: initPayment.payment.id,
      attemptId: initPayment.attempt.id,
      razorpayOrderId: providerOrderId,
      razorpayPaymentId: providerPaymentId,
      razorpaySignature: signature,
    });
    expect(callbackResult.payment.status).toBe("CAPTURED");

    // Complete purchase workflow to finalize order and complete checkout
    const orderIntegration = new PaymentOrderIntegration();
    const purchaseResult = await orderIntegration.completePurchaseWorkflow(db, {
      storeId: storeA.id,
      paymentId: initPayment.payment.id,
    });
    expect(purchaseResult.order).toBeDefined();
    const order = purchaseResult.order;

    // =========================================================================
    // STEP 7: Verify order creation, payment-state, inventory, customer association
    // =========================================================================
    expect(order.status).toBe("PENDING");
    expect(order.paymentStatus).toBe("PAID");
    expect(order.customerId).toBe(customer.id);
    expect(Number(order.total)).toBe(finalTotal);
    expect(Number(order.discountTotal)).toBe(discountTotal);

    // Merchant confirms order: PENDING -> CONFIRMED
    const orderStatusService = new OrderStatusService();
    const confirmedOrder = await orderStatusService.transitionStatus(db, {
      storeId: storeA.id,
      orderId: order.id,
      toStatus: "CONFIRMED",
      actorType: "MERCHANT",
      actorId: adminUserId,
      reason: "Merchant reviewed and confirmed order",
    });
    expect(confirmedOrder.status).toBe("CONFIRMED");

    // Update reservation reference to order
    await db.query(
      `UPDATE inventory_reservations SET reference_type = 'order', reference_id = $1 WHERE id = $2`,
      [order.id, reservation.id],
    );

    // Record persistent discount redemption
    const redemption = await redemptionService.recordRedemption(db, {
      discountId: discount.id,
      storeId: storeA.id,
      orderId: order.id,
      checkoutId,
      amount: discountTotal,
      currency: "USD",
    });
    expect(redemption.id).toBeDefined();

    const usedDiscount = await discountService.getDiscountById(db, storeA.id, discount.id);
    expect(usedDiscount?.usageCount).toBe(1);

    // =========================================================================
    // STEP 8: Open order in merchant dashboard, test cancellation for supported states
    // =========================================================================
    // Merchant admin queries order
    const fetchedOrder = await orderService.getOrderById(db, storeA.id, order.id);
    expect(fetchedOrder).not.toBeNull();
    expect(fetchedOrder?.id).toBe(order.id);
    expect(fetchedOrder?.customerId).toBe(customer.id);

    // Supported state cancellation: CONFIRMED order can be cancelled
    const cancellationResult = await cancellationCoordinator.cancelOrder(db, {
      storeId: storeA.id,
      orderId: order.id,
      reason: "Customer changed mind before shipping",
      actorType: "MERCHANT",
      actorId: adminUserId,
    });
    expect(cancellationResult.order.status).toBe("CANCELLED");
    expect(cancellationResult.refund.status).toBe("SUCCEEDED");
    expect(cancellationResult.inventory.released).toBe(true);

    const cancelledOrder = await orderService.getOrderById(db, storeA.id, order.id);
    expect(cancelledOrder?.status).toBe("CANCELLED");
    expect(cancelledOrder?.paymentStatus).toBe("REFUNDED");

    // Unsupported state cancellation: attempting to cancel an already CANCELLED order fails
    await expect(
      cancellationCoordinator.cancelOrder(db, {
        storeId: storeA.id,
        orderId: order.id,
        reason: "Repeat cancel attempt",
        actorType: "MERCHANT",
        actorId: adminUserId,
      }),
    ).rejects.toThrow(OrderImmutableError);

    // =========================================================================
    // STEP 9: Verify inventory restoration after cancellation
    // =========================================================================
    stockAvailability = await inventoryService.getAvailability(db, storeA.id, variant.id);
    expect(stockAvailability.availableQuantity).toBe(35); // Restored from 34 back to 35
    expect(stockAvailability.reservedQuantity).toBe(0); // Reservation released
    expect(stockAvailability.totalQuantity).toBe(35);

    // =========================================================================
    // STEP 10: Verify customer profile and associated order history
    // =========================================================================
    const customerProfile = await customerService.getCustomerById(db, storeA.id, customer.id);
    expect(customerProfile.id).toBe(customer.id);
    expect(customerProfile.email).toBe("evelyn.stone@example.com");
    expect(customerProfile.status).toBe("ACTIVE");

    // Merchant views customer's associated order history
    const customerOrders = await orderService.listOrders(db, storeA.id, {
      customerId: customer.id,
    });
    expect(customerOrders.items.length).toBe(1);
    expect(customerOrders.items[0]?.id).toBe(order.id);
    expect(customerOrders.items[0]?.status).toBe("CANCELLED");
    expect(customerOrders.items[0]?.paymentStatus).toBe("REFUNDED");

    // =========================================================================
    // STEP 11: Repeat operations with two stores to test tenant isolation
    // =========================================================================
    // Store B cannot access Store A's orders
    const crossStoreOrder = await orderService.getOrderById(db, storeB.id, order.id);
    expect(crossStoreOrder).toBeNull();

    // Store B cannot access Store A's customer
    await expect(
      customerService.getCustomerById(db, storeB.id, customer.id),
    ).rejects.toThrow(CustomerNotFoundError);

    // Store B cannot access Store A's inventory
    await expect(
      inventoryService.getInventoryItem(db, storeB.id, variant.id),
    ).rejects.toThrow(InventoryNotFoundError);

    // Store B cannot cancel Store A's order
    await expect(
      cancellationCoordinator.cancelOrder(db, {
        storeId: storeB.id,
        orderId: order.id,
        reason: "Malicious cross-tenant cancellation",
        actorType: "MERCHANT",
      }),
    ).rejects.toThrow(CrossStoreOrderAccessError);
  });

  it("strictly prevents inventory overselling when concurrent checkouts compete for scarce stock", async () => {
    const db = await setupDb();
    const inventoryService = new InventoryService();
    const storeService = new StoreService();
    const productService = new ProductService();

    const ownerId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, 'owner@limitedstock.com', 'Stock Merchant', 'hash123', 'ACTIVE')`,
      [ownerId],
    );

    const store = await storeService.createStore(db, ownerId, {
      name: "Limited Edition Boutique",
      slug: "limited-boutique",
      currency: "USD",
    });
    await storeService.activateStore(db, store.id, ownerId);

    const product = await productService.createProduct(db, store.id, {
      title: "Rare Handcrafted Sculpture",
      slug: "rare-sculpture",
    });
    const variant = await productService.createVariant(db, store.id, product.id, {
      title: "Sculpture #1",
      sku: "SCULPT-01",
      price: 25000,
    });

    // Only 1 unit in stock!
    await inventoryService.adjustStock(db, store.id, variant.id, {
      quantityDelta: 1,
      reason: "INITIAL_STOCK",
      referenceId: "PO-SCULPT-01",
    });

    // Two shoppers attempt to reserve the 1 unit simultaneously
    const shopperACheckoutId = generateUuidV7();
    const shopperBCheckoutId = generateUuidV7();

    const [resA, resB] = await Promise.allSettled([
      inventoryService.reserve(db, store.id, {
        variantId: variant.id,
        quantity: 1,
        referenceType: "checkout",
        referenceId: shopperACheckoutId,
      }),
      inventoryService.reserve(db, store.id, {
        variantId: variant.id,
        quantity: 1,
        referenceType: "checkout",
        referenceId: shopperBCheckoutId,
      }),
    ]);

    // Exactly one reservation must succeed, and the other must be rejected with InsufficientStockError
    const fulfilled = [resA, resB].filter((r) => r.status === "fulfilled");
    const rejected = [resA, resB].filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedError).toBeInstanceOf(InsufficientStockError);

    // Final stock check: available = 0, reserved = 1, total = 1 (no overselling)
    const availability = await inventoryService.getAvailability(db, store.id, variant.id);
    expect(availability.availableQuantity).toBe(0);
    expect(availability.reservedQuantity).toBe(1);
    expect(availability.totalQuantity).toBe(1);
  });
});
