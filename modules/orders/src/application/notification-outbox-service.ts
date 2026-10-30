import {
  generateUuidV7,
  type Database,
  type DatabaseClient,
  type NotificationOutboxRow,
  NotificationOutboxRepository,
} from "@calcart/db";

export interface QueueOrderConfirmationParams {
  storeId: string;
  orderId: string;
  orderNumber: string;
  currency: string;
  subtotal: number;
  discountTotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  grandTotal: number;
  recipientEmail?: string | null;
  recipientName?: string | null;
  storeName?: string;
  storeSlug?: string;
  items?: Array<{
    name: string;
    variantTitle?: string | null;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  shippingAddress?: {
    name?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
}

export interface QueueOrderFulfillmentParams {
  storeId: string;
  orderId: string;
  orderNumber: string;
  fulfillmentStatus: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  storeName?: string;
  storeSlug?: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  items?: Array<{
    name: string;
    variantTitle?: string | null;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export interface QueueOrderCancellationParams {
  storeId: string;
  orderId: string;
  orderNumber: string;
  cancelReason?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  storeName?: string;
  storeSlug?: string;
  refundStatus?: string;
  refundAmount?: number;
  currency?: string;
}

export interface QueueRefundConfirmationParams {
  storeId: string;
  orderId: string;
  orderNumber?: string;
  refundId: string;
  amount: number;
  currency: string;
  isFullRefund: boolean;
  reason?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  storeName?: string;
  storeSlug?: string;
}

export interface QueueMerchantNewOrderParams {
  storeId: string;
  orderId: string;
  orderNumber: string;
  currency: string;
  subtotal: number;
  discountTotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  grandTotal: number;
  customerEmail?: string | null;
  customerName?: string | null;
  merchantEmail?: string | null;
  storeName?: string;
  storeSlug?: string;
  items?: Array<{
    name: string;
    variantTitle?: string | null;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  shippingAddress?: {
    name?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  dashboardOrderUrl?: string;
}

export interface QueueLowStockAlertParams {
  storeId: string;
  variantId: string;
  productTitle: string;
  variantTitle?: string | null;
  sku?: string | null;
  availableQuantity: number;
  lowStockThreshold: number;
  isOutOfStock: boolean;
  merchantEmail?: string | null;
  storeName?: string;
  storeSlug?: string;
  dashboardInventoryUrl?: string;
}

interface StoreMeta {
  name: string;
  slug: string;
}

interface CustomerMeta {
  email: string | null;
  name: string | null;
}

export class NotificationOutboxService {
  constructor(
    private readonly outboxRepo: NotificationOutboxRepository = new NotificationOutboxRepository(),
  ) {}

  private async fetchStoreMeta(
    client: DatabaseClient,
    storeId: string,
  ): Promise<StoreMeta> {
    try {
      const res = await client.query<{ name: string; slug: string }>(
        `SELECT name, slug FROM stores WHERE id = $1`,
        [storeId],
      );
      if (res.rows[0]) {
        return { name: res.rows[0].name, slug: res.rows[0].slug };
      }
    } catch {
      // Fallback
    }
    return { name: "Store", slug: "" };
  }

  private async fetchCustomerMetaForOrder(
    client: DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<CustomerMeta> {
    try {
      const res = await client.query<{
        customer_email: string | null;
        checkout_email: string | null;
        customer_first_name: string | null;
        customer_last_name: string | null;
        address_name: string | null;
      }>(
        `SELECT
           c.email as customer_email,
           ch.email as checkout_email,
           c.first_name as customer_first_name,
           c.last_name as customer_last_name,
           oa.name as address_name
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         LEFT JOIN checkouts ch ON ch.id = o.checkout_id
         LEFT JOIN order_addresses oa ON oa.order_id = o.id AND oa.type = 'SHIPPING'
         WHERE o.id = $1 AND o.store_id = $2
         LIMIT 1`,
        [orderId, storeId],
      );

      const row = res.rows[0];
      if (row) {
        const email = row.customer_email || row.checkout_email || null;
        const name =
          row.address_name ||
          [row.customer_first_name, row.customer_last_name].filter(Boolean).join(" ") ||
          null;
        return { email, name };
      }
    } catch {
      // Fallback
    }
    return { email: null, name: null };
  }

  private async fetchOrderItems(
    client: DatabaseClient,
    orderId: string,
  ): Promise<
    Array<{
      name: string;
      variantTitle?: string | null;
      sku?: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>
  > {
    try {
      const res = await client.query<{
        product_name_snapshot: string;
        variant_name_snapshot: string;
        sku_snapshot: string | null;
        quantity: number;
        unit_price: string;
        line_total: string;
      }>(
        `SELECT product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total
         FROM order_items
         WHERE order_id = $1`,
        [orderId],
      );

      return res.rows.map((r) => ({
        name: r.product_name_snapshot,
        variantTitle: r.variant_name_snapshot,
        sku: r.sku_snapshot,
        quantity: Number(r.quantity),
        unitPrice: Number(r.unit_price),
        lineTotal: Number(r.line_total),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Queue Order Confirmation notification into outbox.
   * Fail-open: failures never throw to caller, ensuring checkout/payment never fails.
   */
  async queueOrderConfirmation(
    clientOrDb: Database | DatabaseClient,
    params: QueueOrderConfirmationParams,
  ): Promise<NotificationOutboxRow | null> {
    try {
      const client = "query" in clientOrDb ? clientOrDb : clientOrDb;
      const idempotencyKey = `order_confirmed:${params.orderId}`;

      let storeName = params.storeName;
      let storeSlug = params.storeSlug;
      if (!storeName || !storeSlug) {
        const storeMeta = await this.fetchStoreMeta(client, params.storeId);
        storeName = storeName || storeMeta.name;
        storeSlug = storeSlug || storeMeta.slug;
      }

      let recipientEmail = params.recipientEmail;
      let recipientName = params.recipientName;
      if (!recipientEmail) {
        const customerMeta = await this.fetchCustomerMetaForOrder(
          client,
          params.storeId,
          params.orderId,
        );
        recipientEmail = customerMeta.email;
        recipientName = recipientName || customerMeta.name;
      }

      let items = params.items;
      if (!items || items.length === 0) {
        items = await this.fetchOrderItems(client, params.orderId);
      }

      const payload = {
        storeId: params.storeId,
        storeName,
        storeSlug,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        currency: params.currency,
        subtotal: params.subtotal,
        discountTotal: params.discountTotal ?? 0,
        shippingTotal: params.shippingTotal ?? 0,
        taxTotal: params.taxTotal ?? 0,
        grandTotal: params.grandTotal,
        recipientEmail,
        recipientName,
        items,
        shippingAddress: params.shippingAddress ?? null,
      };

      return await this.outboxRepo.create(client, {
        id: generateUuidV7(),
        storeId: params.storeId,
        notificationType: "ORDER_CONFIRMATION",
        recipientEmail: recipientEmail ?? null,
        referenceType: "order",
        referenceId: params.orderId,
        idempotencyKey,
        payload,
      });
    } catch (err) {
      console.error(
        `[NotificationOutboxService] Failed to queue ORDER_CONFIRMATION for order ${params.orderId}:`,
        err,
      );
      return null;
    }
  }

  /**
   * Queue Order Fulfillment notification into outbox.
   */
  async queueOrderFulfillment(
    clientOrDb: Database | DatabaseClient,
    params: QueueOrderFulfillmentParams,
  ): Promise<NotificationOutboxRow | null> {
    try {
      const client = "query" in clientOrDb ? clientOrDb : clientOrDb;
      const idempotencyKey = `order_fulfilled:${params.orderId}:${params.fulfillmentStatus}`;

      let storeName = params.storeName;
      let storeSlug = params.storeSlug;
      if (!storeName || !storeSlug) {
        const storeMeta = await this.fetchStoreMeta(client, params.storeId);
        storeName = storeName || storeMeta.name;
        storeSlug = storeSlug || storeMeta.slug;
      }

      let recipientEmail = params.recipientEmail;
      let recipientName = params.recipientName;
      if (!recipientEmail) {
        const customerMeta = await this.fetchCustomerMetaForOrder(
          client,
          params.storeId,
          params.orderId,
        );
        recipientEmail = customerMeta.email;
        recipientName = recipientName || customerMeta.name;
      }

      const payload = {
        storeId: params.storeId,
        storeName,
        storeSlug,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        fulfillmentStatus: params.fulfillmentStatus,
        carrier: params.carrier ?? null,
        trackingNumber: params.trackingNumber ?? null,
        trackingUrl: params.trackingUrl ?? null,
        recipientEmail,
        recipientName,
        items: params.items ?? [],
      };

      return await this.outboxRepo.create(client, {
        id: generateUuidV7(),
        storeId: params.storeId,
        notificationType: "ORDER_FULFILLMENT",
        recipientEmail: recipientEmail ?? null,
        referenceType: "order",
        referenceId: params.orderId,
        idempotencyKey,
        payload,
      });
    } catch (err) {
      console.error(
        `[NotificationOutboxService] Failed to queue ORDER_FULFILLMENT for order ${params.orderId}:`,
        err,
      );
      return null;
    }
  }

  /**
   * Queue Order Cancellation notification into outbox.
   */
  async queueOrderCancellation(
    clientOrDb: Database | DatabaseClient,
    params: QueueOrderCancellationParams,
  ): Promise<NotificationOutboxRow | null> {
    try {
      const client = "query" in clientOrDb ? clientOrDb : clientOrDb;
      const idempotencyKey = `order_cancelled:${params.orderId}`;

      let storeName = params.storeName;
      let storeSlug = params.storeSlug;
      if (!storeName || !storeSlug) {
        const storeMeta = await this.fetchStoreMeta(client, params.storeId);
        storeName = storeName || storeMeta.name;
        storeSlug = storeSlug || storeMeta.slug;
      }

      let recipientEmail = params.recipientEmail;
      let recipientName = params.recipientName;
      if (!recipientEmail) {
        const customerMeta = await this.fetchCustomerMetaForOrder(
          client,
          params.storeId,
          params.orderId,
        );
        recipientEmail = customerMeta.email;
        recipientName = recipientName || customerMeta.name;
      }

      const payload = {
        storeId: params.storeId,
        storeName,
        storeSlug,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        cancelReason: params.cancelReason ?? null,
        refundStatus: params.refundStatus ?? "NOT_APPLICABLE",
        refundAmount: params.refundAmount ?? 0,
        currency: params.currency ?? "USD",
        recipientEmail,
        recipientName,
      };

      return await this.outboxRepo.create(client, {
        id: generateUuidV7(),
        storeId: params.storeId,
        notificationType: "ORDER_CANCELLED",
        recipientEmail: recipientEmail ?? null,
        referenceType: "order",
        referenceId: params.orderId,
        idempotencyKey,
        payload,
      });
    } catch (err) {
      console.error(
        `[NotificationOutboxService] Failed to queue ORDER_CANCELLED for order ${params.orderId}:`,
        err,
      );
      return null;
    }
  }

  /**
   * Queue Refund Confirmation notification into outbox.
   */
  async queueRefundConfirmation(
    clientOrDb: Database | DatabaseClient,
    params: QueueRefundConfirmationParams,
  ): Promise<NotificationOutboxRow | null> {
    try {
      const client = "query" in clientOrDb ? clientOrDb : clientOrDb;
      const idempotencyKey = `refund_succeeded:${params.refundId}`;

      let storeName = params.storeName;
      let storeSlug = params.storeSlug;
      if (!storeName || !storeSlug) {
        const storeMeta = await this.fetchStoreMeta(client, params.storeId);
        storeName = storeName || storeMeta.name;
        storeSlug = storeSlug || storeMeta.slug;
      }

      let recipientEmail = params.recipientEmail;
      let recipientName = params.recipientName;
      if (!recipientEmail) {
        const customerMeta = await this.fetchCustomerMetaForOrder(
          client,
          params.storeId,
          params.orderId,
        );
        recipientEmail = customerMeta.email;
        recipientName = recipientName || customerMeta.name;
      }

      let orderNumber = params.orderNumber;
      if (!orderNumber) {
        try {
          const ordRes = await client.query<{ order_number: string }>(
            `SELECT order_number FROM orders WHERE id = $1`,
            [params.orderId],
          );
          orderNumber = ordRes.rows[0]?.order_number || params.orderId;
        } catch {
          orderNumber = params.orderId;
        }
      }

      const payload = {
        storeId: params.storeId,
        storeName,
        storeSlug,
        orderId: params.orderId,
        orderNumber,
        refundId: params.refundId,
        amount: params.amount,
        currency: params.currency,
        isFullRefund: params.isFullRefund,
        reason: params.reason ?? null,
        recipientEmail,
        recipientName,
      };

      return await this.outboxRepo.create(client, {
        id: generateUuidV7(),
        storeId: params.storeId,
        notificationType: "REFUND_CONFIRMATION",
        recipientEmail: recipientEmail ?? null,
        referenceType: "refund",
        referenceId: params.refundId,
        idempotencyKey,
        payload,
      });
    } catch (err) {
      console.error(
        `[NotificationOutboxService] Failed to queue REFUND_CONFIRMATION for refund ${params.refundId}:`,
        err,
      );
      return null;
    }
  }

  private async fetchMerchantRecipientForStore(
    client: DatabaseClient,
    storeId: string,
  ): Promise<{ email: string; name: string } | null> {
    try {
      // 1. Try store members (owner first, then admin)
      const memberRes = await client.query<{ email: string; name: string }>(
        `SELECT u.email, u.name
         FROM store_memberships sm
         JOIN users u ON u.id = sm.user_id
         WHERE sm.store_id = $1 AND sm.role IN ('owner', 'admin') AND sm.status = 'ACTIVE'
         ORDER BY CASE WHEN sm.role = 'owner' THEN 1 ELSE 2 END ASC
         LIMIT 1`,
        [storeId],
      );
      if (memberRes.rows[0]) {
        return memberRes.rows[0];
      }

      // 2. Fallback to organization owner
      const orgRes = await client.query<{ email: string; name: string }>(
        `SELECT u.email, u.name
         FROM stores s
         JOIN organizations o ON o.id = s.organization_id
         JOIN organization_memberships om ON om.organization_id = o.id AND om.role = 'owner'
         JOIN users u ON u.id = om.user_id
         WHERE s.id = $1
         LIMIT 1`,
        [storeId],
      );
      if (orgRes.rows[0]) {
        return orgRes.rows[0];
      }
    } catch {
      // Fallback
    }
    return null;
  }

  /**
   * Queue Merchant New Order notification into outbox.
   * Fail-open: failures never throw to caller, ensuring checkout/payment never fails.
   */
  async queueMerchantNewOrder(
    clientOrDb: Database | DatabaseClient,
    params: QueueMerchantNewOrderParams,
  ): Promise<NotificationOutboxRow | null> {
    try {
      const client = "query" in clientOrDb ? clientOrDb : clientOrDb;
      const idempotencyKey = `merchant_order_alert:${params.orderId}`;

      let storeName = params.storeName;
      let storeSlug = params.storeSlug;
      if (!storeName || !storeSlug) {
        const storeMeta = await this.fetchStoreMeta(client, params.storeId);
        storeName = storeName || storeMeta.name;
        storeSlug = storeSlug || storeMeta.slug;
      }

      let recipientEmail = params.merchantEmail;
      if (!recipientEmail) {
        const merchantMeta = await this.fetchMerchantRecipientForStore(client, params.storeId);
        recipientEmail = merchantMeta?.email;
      }

      let items = params.items;
      if (!items || items.length === 0) {
        items = await this.fetchOrderItems(client, params.orderId);
      }

      const payload = {
        storeId: params.storeId,
        storeName,
        storeSlug,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        currency: params.currency,
        subtotal: params.subtotal,
        discountTotal: params.discountTotal ?? 0,
        shippingTotal: params.shippingTotal ?? 0,
        taxTotal: params.taxTotal ?? 0,
        grandTotal: params.grandTotal,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        recipientEmail,
        items,
        shippingAddress: params.shippingAddress ?? null,
        dashboardOrderUrl: params.dashboardOrderUrl,
      };

      return await this.outboxRepo.create(client, {
        id: generateUuidV7(),
        storeId: params.storeId,
        notificationType: "MERCHANT_NEW_ORDER",
        recipientEmail: recipientEmail ?? null,
        referenceType: "order",
        referenceId: params.orderId,
        idempotencyKey,
        payload,
      });
    } catch (err) {
      console.error(
        `[NotificationOutboxService] Failed to queue MERCHANT_NEW_ORDER for order ${params.orderId}:`,
        err,
      );
      return null;
    }
  }

  /**
   * Queue Low-Stock Alert notification into outbox.
   * Fail-open: failures never throw to caller, ensuring inventory transitions never fail.
   */
  async queueLowStockAlert(
    clientOrDb: Database | DatabaseClient,
    params: QueueLowStockAlertParams,
  ): Promise<NotificationOutboxRow | null> {
    try {
      const client = "query" in clientOrDb ? clientOrDb : clientOrDb;
      // Idempotency key binds store, variant, and the specific quantity snapshot
      const idempotencyKey = `low_stock:${params.storeId}:${params.variantId}:${params.availableQuantity}`;

      let storeName = params.storeName;
      let storeSlug = params.storeSlug;
      if (!storeName || !storeSlug) {
        const storeMeta = await this.fetchStoreMeta(client, params.storeId);
        storeName = storeName || storeMeta.name;
        storeSlug = storeSlug || storeMeta.slug;
      }

      let recipientEmail = params.merchantEmail;
      if (!recipientEmail) {
        const merchantMeta = await this.fetchMerchantRecipientForStore(client, params.storeId);
        recipientEmail = merchantMeta?.email;
      }

      const payload = {
        storeId: params.storeId,
        storeName,
        storeSlug,
        variantId: params.variantId,
        productTitle: params.productTitle,
        variantTitle: params.variantTitle ?? null,
        sku: params.sku ?? null,
        availableQuantity: params.availableQuantity,
        lowStockThreshold: params.lowStockThreshold,
        isOutOfStock: params.isOutOfStock,
        recipientEmail,
        dashboardInventoryUrl: params.dashboardInventoryUrl,
      };

      return await this.outboxRepo.create(client, {
        id: generateUuidV7(),
        storeId: params.storeId,
        notificationType: "LOW_STOCK_ALERT",
        recipientEmail: recipientEmail ?? null,
        referenceType: "inventory",
        referenceId: params.variantId,
        idempotencyKey,
        payload,
      });
    } catch (err) {
      console.error(
        `[NotificationOutboxService] Failed to queue LOW_STOCK_ALERT for variant ${params.variantId}:`,
        err,
      );
      return null;
    }
  }
}
