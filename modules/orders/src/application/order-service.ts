import { createHash } from "node:crypto";
import {
  generateUuidV7,
  type Database,
  type DatabaseClient,
  OrderRepository,
  type OrderRow,
  type CustomerOrderSummary,
} from "@shopify-clone/db";
import {
  CrossStoreOrderAccessError,
  InvalidOrderStateError,
  OrderNotFoundError,
} from "../domain/order-errors.js";
import {
  OrderItem,
  validateOrderItemQuantity,
  validateOrderMonetaryAmount,
} from "../domain/order-item.js";
import {
  Order,
  OrderAddress,
  validateOrderCurrency,
} from "../domain/order.js";
import {
  type CreateOrderFromCheckoutInput,
  type ListOrdersQueryDto,
  type ListOrdersResultDto,
  type OrderDTO,
  toOrderDTO,
} from "./dtos.js";

function isDatabase(client: Database | DatabaseClient): client is Database {
  return "withTransaction" in client;
}

export async function runInTransaction<T>(
  clientOrDb: Database | DatabaseClient,
  fn: (tx: DatabaseClient) => Promise<T>,
): Promise<T> {
  if (isDatabase(clientOrDb)) {
    return clientOrDb.withTransaction(fn);
  }
  return fn(clientOrDb);
}

export function generateOrderNumber(): string {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${timestampPart}-${randomPart}`;
}

export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository = new OrderRepository(),
  ) {}

  async createOrderFromCheckout(
    clientOrDb: Database | DatabaseClient,
    input: CreateOrderFromCheckoutInput,
  ): Promise<OrderDTO> {
    const { storeId, checkout } = input;

    // 1. Tenancy validation
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new InvalidOrderStateError("storeId is required to create an order");
    }
    if (checkout.storeId !== storeId) {
      throw new CrossStoreOrderAccessError(
        `Checkout store '${checkout.storeId}' does not match target store '${storeId}'`,
      );
    }

    if (!checkout.id || typeof checkout.id !== "string" || checkout.id.trim().length === 0) {
      throw new InvalidOrderStateError("checkout.id is required to create an order");
    }

    if (!Array.isArray(checkout.items) || checkout.items.length === 0) {
      throw new InvalidOrderStateError("Cannot create an order without items");
    }

    // 2. Fast idempotent check before transaction
    const quickExisting = await this.orderRepo.findByCheckoutId(
      clientOrDb,
      storeId,
      checkout.id,
    );
    if (quickExisting) {
      return this.hydrateOrderDTO(clientOrDb, storeId, quickExisting);
    }

    // 3. Domain validation and preparation
    const currency = validateOrderCurrency(checkout.currency);
    const orderId = generateUuidV7();
    const orderNumber = generateOrderNumber();
    const initialStatus = input.initialStatus ?? "PENDING";

    let calculatedSubtotal = 0;
    const domainItems: OrderItem[] = [];

    for (const item of checkout.items) {
      const quantity = validateOrderItemQuantity(item.quantity);
      const unitPrice = validateOrderMonetaryAmount(item.unitPrice, "Unit price", true);
      const discountAmount = validateOrderMonetaryAmount(
        item.discountAmount ?? 0,
        "Item discount amount",
        true,
      );
      const taxAmount = validateOrderMonetaryAmount(
        item.taxAmount ?? 0,
        "Item tax amount",
        true,
      );

      calculatedSubtotal += quantity * unitPrice;

      const domainItem = new OrderItem({
        id: generateUuidV7(),
        orderId,
        storeId,
        productId: item.productId ?? null,
        variantId: item.variantId ?? null,
        productNameSnapshot: item.productNameSnapshot,
        variantNameSnapshot: item.variantNameSnapshot,
        skuSnapshot: item.skuSnapshot ?? null,
        quantity,
        unitPrice,
        discountAmount,
        taxAmount,
      });

      domainItems.push(domainItem);
    }

    // Never trust client-supplied totals! Calculate authoritatively:
    const discountTotal = validateOrderMonetaryAmount(
      checkout.discountTotal ?? 0,
      "Discount total",
      true,
    );
    const shippingTotal = validateOrderMonetaryAmount(
      checkout.shippingTotal ?? 0,
      "Shipping total",
      true,
    );
    const taxTotal = validateOrderMonetaryAmount(
      checkout.taxTotal ?? 0,
      "Tax total",
      true,
    );

    const calculatedTotal =
      calculatedSubtotal - discountTotal + shippingTotal + taxTotal;
    if (calculatedTotal < 0) {
      throw new InvalidOrderStateError("Calculated order total cannot be negative");
    }

    const domainAddresses: OrderAddress[] = [];

    if (checkout.shippingAddress) {
      const shippingAddr = checkout.shippingAddress;
      const shippingName =
        shippingAddr.name ||
        [shippingAddr.firstName, shippingAddr.lastName].filter(Boolean).join(" ").trim() ||
        "Customer";

      domainAddresses.push(
        new OrderAddress({
          id: generateUuidV7(),
          orderId,
          storeId,
          type: "SHIPPING",
          name: shippingName,
          addressLine1: shippingAddr.addressLine1,
          addressLine2: shippingAddr.addressLine2,
          city: shippingAddr.city,
          state: shippingAddr.state,
          postalCode: shippingAddr.postalCode,
          country: shippingAddr.country,
          phone: shippingAddr.phone,
        }),
      );
    }

    if (checkout.billingAddress) {
      const billingAddr = checkout.billingAddress;
      const billingName =
        billingAddr.name ||
        [billingAddr.firstName, billingAddr.lastName].filter(Boolean).join(" ").trim() ||
        "Customer";

      domainAddresses.push(
        new OrderAddress({
          id: generateUuidV7(),
          orderId,
          storeId,
          type: "BILLING",
          name: billingName,
          addressLine1: billingAddr.addressLine1,
          addressLine2: billingAddr.addressLine2,
          city: billingAddr.city,
          state: billingAddr.state,
          postalCode: billingAddr.postalCode,
          country: billingAddr.country,
          phone: billingAddr.phone,
        }),
      );
    }

    const domainOrder = new Order({
      id: orderId,
      storeId,
      orderNumber,
      customerId: checkout.customerId ?? null,
      checkoutId: checkout.id,
      paymentId: input.paymentId ?? checkout.paymentId ?? null,
      guestTokenHash: checkout.guestTokenHash ?? null,
      status: initialStatus,
      paymentStatus: "PENDING",
      fulfillmentStatus: "UNFULFILLED",
      currency,
      subtotal: calculatedSubtotal,
      discountTotal,
      shippingTotal,
      taxTotal,
      total: calculatedTotal,
      grandTotal: calculatedTotal,
      items: domainItems,
      addresses: domainAddresses,
    });

    // 4. Transactional persistence with concurrency-safe collision handling
    try {
      return await runInTransaction(clientOrDb, async (tx) => {
        // In-transaction idempotent check
        const inTxExisting = await this.orderRepo.findByCheckoutId(
          tx,
          storeId,
          checkout.id,
        );
        if (inTxExisting) {
          return this.hydrateOrderDTO(tx, storeId, inTxExisting);
        }

        // A. Insert order
        await this.orderRepo.create(tx, {
          id: domainOrder.id,
          storeId: domainOrder.storeId,
          customerId: domainOrder.customerId,
          checkoutId: domainOrder.checkoutId,
          paymentId: domainOrder.paymentId,
          guestTokenHash: domainOrder.guestTokenHash,
          orderNumber: domainOrder.orderNumber,
          status: domainOrder.status,
          paymentStatus: domainOrder.paymentStatus,
          fulfillmentStatus: domainOrder.fulfillmentStatus,
          currency: domainOrder.currency,
          subtotal: domainOrder.subtotal,
          discountTotal: domainOrder.discountTotal,
          shippingTotal: domainOrder.shippingTotal,
          taxTotal: domainOrder.taxTotal,
          total: domainOrder.total,
          grandTotal: domainOrder.grandTotal,
        });

        // B. Insert order items
        for (const item of domainItems) {
          await this.orderRepo.createItem(tx, {
            id: item.id,
            orderId: item.orderId,
            storeId: item.storeId,
            productId: item.productId,
            variantId: item.variantId,
            productNameSnapshot: item.productNameSnapshot,
            variantNameSnapshot: item.variantNameSnapshot,
            skuSnapshot: item.skuSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
          });
        }

        // C. Insert addresses
        for (const address of domainAddresses) {
          await this.orderRepo.createAddress(tx, {
            id: address.id,
            orderId: address.orderId,
            storeId: address.storeId,
            type: address.type,
            name: address.name,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            phone: address.phone,
          });
        }

        // D. Insert initial status history
        const historyId = generateUuidV7();
        await this.orderRepo.createStatusHistory(tx, {
          id: historyId,
          orderId: domainOrder.id,
          storeId: domainOrder.storeId,
          fromStatus: null,
          toStatus: initialStatus,
          reason: "Order created from checkout",
          actorType: input.actorType ?? "SYSTEM",
          actorId: input.actorId ?? null,
        });

        return toOrderDTO(domainOrder, domainItems, domainAddresses, [
          {
            id: historyId,
            orderId: domainOrder.id,
            storeId: domainOrder.storeId,
            fromStatus: null,
            toStatus: initialStatus,
            reason: "Order created from checkout",
            actorType: input.actorType ?? "SYSTEM",
            actorId: input.actorId ?? null,
            createdAt: new Date(),
          },
        ]);
      });
    } catch (err: unknown) {
      // 5. Catch concurrent uniqueness conflict on (store_id, checkout_id)
      const pgErr = err as { code?: string; constraint?: string };
      if (
        pgErr.code === "23505" &&
        (pgErr.constraint?.includes("checkout") ||
          pgErr.constraint === "orders_store_checkout_idx")
      ) {
        const concurrentExisting = await this.orderRepo.findByCheckoutId(
          clientOrDb,
          storeId,
          checkout.id,
        );
        if (concurrentExisting) {
          return this.hydrateOrderDTO(clientOrDb, storeId, concurrentExisting);
        }
      }
      throw err;
    }
  }

  async listOrders(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    query: ListOrdersQueryDto = {},
  ): Promise<ListOrdersResultDto> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new InvalidOrderStateError("storeId is required to list orders");
    }

    let decodedCursor: { createdAt: string; id: string } | undefined;
    if (query.cursor) {
      try {
        const json = Buffer.from(query.cursor, "base64url").toString("utf-8");
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed.id === "string" && typeof parsed.createdAt === "string") {
          decodedCursor = parsed;
        }
      } catch {
        // Ignored or invalid cursor
      }
    }

    const repoResult = await this.orderRepo.list(clientOrDb, {
      storeId,
      status: query.status,
      paymentStatus: query.paymentStatus,
      fulfillmentStatus: query.fulfillmentStatus,
      customerId: query.customerId,
      orderNumber: query.orderNumber,
      limit: query.limit,
      cursor: decodedCursor,
    });

    const items: OrderDTO[] = repoResult.items.map((row) => ({
      id: row.id,
      storeId: row.store_id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      checkoutId: row.checkout_id,
      paymentId: row.payment_id,
      status: row.status,
      paymentStatus: row.payment_status,
      fulfillmentStatus: row.fulfillment_status,
      currency: row.currency,
      subtotal: Number(row.subtotal),
      discountTotal: Number(row.discount_total),
      shippingTotal: Number(row.shipping_total),
      taxTotal: Number(row.tax_total),
      total: Number(row.total),
      grandTotal: Number(row.grand_total),
      cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
      cancelReason: row.cancel_reason,
      completedAt: row.completed_at ? row.completed_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    let nextCursor: string | undefined;
    if (repoResult.nextCursor) {
      nextCursor = Buffer.from(JSON.stringify(repoResult.nextCursor), "utf-8").toString("base64url");
    }

    return {
      items,
      hasMore: repoResult.hasMore,
      nextCursor,
    };
  }

  async getOrderById(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<OrderDTO | null> {
    const row = await this.orderRepo.findById(clientOrDb, storeId, orderId);
    if (!row) return null;
    return this.hydrateOrderDTO(clientOrDb, storeId, row);
  }

  async getOrderByCheckoutId(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<OrderDTO | null> {
    const row = await this.orderRepo.findByCheckoutId(
      clientOrDb,
      storeId,
      checkoutId,
    );
    if (!row) return null;
    return this.hydrateOrderDTO(clientOrDb, storeId, row);
  }

  async getOrderByOrderNumber(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    orderNumber: string,
  ): Promise<OrderDTO | null> {
    const row = await this.orderRepo.findByOrderNumber(
      clientOrDb,
      storeId,
      orderNumber,
    );
    if (!row) return null;
    return this.hydrateOrderDTO(clientOrDb, storeId, row);
  }

  private async hydrateOrderDTO(
    client: Database | DatabaseClient,
    storeId: string,
    orderRow: OrderRow,
  ): Promise<OrderDTO> {
    const items = await this.orderRepo.findItemsByOrderId(client, storeId, orderRow.id);
    const addresses = await this.orderRepo.findAddressesByOrderId(client, storeId, orderRow.id);
    const history = await this.orderRepo.findStatusHistoryByOrderId(client, storeId, orderRow.id);

    return {
      id: orderRow.id,
      storeId: orderRow.store_id,
      orderNumber: orderRow.order_number,
      customerId: orderRow.customer_id,
      checkoutId: orderRow.checkout_id,
      paymentId: orderRow.payment_id,
      status: orderRow.status,
      paymentStatus: orderRow.payment_status,
      fulfillmentStatus: orderRow.fulfillment_status,
      currency: orderRow.currency,
      subtotal: Number(orderRow.subtotal),
      discountTotal: Number(orderRow.discount_total),
      shippingTotal: Number(orderRow.shipping_total),
      taxTotal: Number(orderRow.tax_total),
      total: Number(orderRow.total),
      grandTotal: Number(orderRow.grand_total),
      cancelledAt: orderRow.cancelled_at
        ? orderRow.cancelled_at.toISOString()
        : null,
      cancelReason: orderRow.cancel_reason,
      completedAt: orderRow.completed_at
        ? orderRow.completed_at.toISOString()
        : null,
      guestTokenHash: orderRow.guest_token_hash ?? null,
      createdAt: orderRow.created_at.toISOString(),
      updatedAt: orderRow.updated_at.toISOString(),
      items: items.map((i) => ({
        id: i.id,
        orderId: i.order_id,
        storeId: i.store_id,
        productId: i.product_id,
        variantId: i.variant_id,
        productNameSnapshot: i.product_name_snapshot,
        variantNameSnapshot: i.variant_name_snapshot,
        skuSnapshot: i.sku_snapshot,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        discountAmount: Number(i.discount_amount),
        taxAmount: Number(i.tax_amount),
        lineTotal: Number(i.line_total),
        createdAt: i.created_at.toISOString(),
        updatedAt: i.updated_at.toISOString(),
      })),
      addresses: addresses.map((a) => ({
        id: a.id,
        orderId: a.order_id,
        storeId: a.store_id,
        type: a.type,
        name: a.name,
        addressLine1: a.address_line_1,
        addressLine2: a.address_line_2,
        city: a.city,
        state: a.state,
        postalCode: a.postal_code,
        country: a.country,
        phone: a.phone,
        createdAt: a.created_at.toISOString(),
        updatedAt: a.updated_at.toISOString(),
      })),
      statusHistory: history.map((h) => ({
        id: h.id,
        orderId: h.order_id,
        storeId: h.store_id,
        fromStatus: h.from_status,
        toStatus: h.to_status,
        reason: h.reason,
        actorType: h.actor_type,
        actorId: h.actor_id,
        createdAt: h.created_at.toISOString(),
      })),
    };
  }

  assertOrderOwnership(
    order: OrderDTO,
    caller: {
      customerId?: string | null;
      guestToken?: string | null;
    },
  ): void {
    if (order.customerId && caller.customerId && order.customerId === caller.customerId) {
      return;
    }
    if (order.guestTokenHash && caller.guestToken) {
      const callerHash = createHash("sha256").update(caller.guestToken.trim()).digest("hex");
      if (callerHash === order.guestTokenHash) {
        return;
      }
    }
    throw new OrderNotFoundError(order.id, order.storeId);
  }

  async getCustomerOrderSummary(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerOrderSummary> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new InvalidOrderStateError("storeId is required to get customer order summary");
    }
    if (!customerId || typeof customerId !== "string" || customerId.trim().length === 0) {
      throw new InvalidOrderStateError("customerId is required to get customer order summary");
    }
    return runInTransaction(clientOrDb, async (tx) => {
      return this.orderRepo.getCustomerOrderSummary(tx, storeId.trim(), customerId.trim());
    });
  }

  async getCustomerOrderSummaries(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerIds: string[],
  ): Promise<Record<string, CustomerOrderSummary>> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new InvalidOrderStateError("storeId is required to get customer order summaries");
    }
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return {};
    }
    return runInTransaction(clientOrDb, async (tx) => {
      return this.orderRepo.getCustomerOrderSummaries(tx, storeId.trim(), customerIds);
    });
  }
}
