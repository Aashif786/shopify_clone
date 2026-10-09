import type { DatabaseClient } from "@shopify-clone/db";
import { Checkout, CheckoutItem, type CheckoutAddress } from "../domain/checkout.js";
import type { CheckoutPaymentStatus, CheckoutStatus } from "../domain/checkout-state.js";

interface CheckoutRow {
  id: string;
  store_id: string;
  cart_id: string;
  customer_id: string | null;
  email: string | null;
  status: CheckoutStatus;
  currency: string;
  subtotal: string | number;
  discount_total: string | number;
  tax_total: string | number;
  shipping_total: string | number;
  total: string | number;
  shipping_address: CheckoutAddress | null;
  billing_address: CheckoutAddress | null;
  payment_status: CheckoutPaymentStatus;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface CheckoutItemRow {
  id: string;
  checkout_id: string;
  store_id: string;
  variant_id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  sku_snapshot: string | null;
  unit_price: string | number;
  quantity: number;
  line_total: string | number;
  created_at: Date;
  updated_at: Date;
}

interface ProductVariantRow {
  variant_id: string;
  store_id: string;
  variant_title: string;
  sku: string | null;
  price: string | number;
  currency: string;
  variant_status: string;
  product_id: string;
  product_title: string;
  product_status: string;
}

interface CustomerRow {
  id: string;
  store_id: string;
  status: string;
  email: string;
}

function mapCheckoutItemRow(row: CheckoutItemRow): CheckoutItem {
  return new CheckoutItem({
    id: row.id,
    checkoutId: row.checkout_id,
    storeId: row.store_id,
    variantId: row.variant_id,
    productNameSnapshot: row.product_name_snapshot,
    variantNameSnapshot: row.variant_name_snapshot,
    skuSnapshot: row.sku_snapshot,
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function mapCheckoutRow(row: CheckoutRow, items: CheckoutItem[] = []): Checkout {
  return Checkout.reconstitute({
    id: row.id,
    storeId: row.store_id,
    cartId: row.cart_id,
    customerId: row.customer_id,
    email: row.email,
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total),
    taxTotal: Number(row.tax_total),
    shippingTotal: Number(row.shipping_total),
    total: Number(row.total),
    shippingAddress: row.shipping_address,
    billingAddress: row.billing_address,
    paymentStatus: row.payment_status,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    items,
  });
}

export class CheckoutRepository {
  async findById(
    client: DatabaseClient,
    storeId: string,
    checkoutId: string,
    forUpdate = false,
  ): Promise<Checkout | null> {
    const query = `
      SELECT * FROM checkouts
      WHERE id = $1 AND store_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const res = await client.query<CheckoutRow>(query, [checkoutId, storeId]);
    const row = res.rows[0];
    if (!row) {
      return null;
    }
    return mapCheckoutRow(row, []);
  }

  async findWithItems(
    client: DatabaseClient,
    storeId: string,
    checkoutId: string,
    forUpdate = false,
  ): Promise<Checkout | null> {
    const query = `
      SELECT * FROM checkouts
      WHERE id = $1 AND store_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const checkoutRes = await client.query<CheckoutRow>(query, [checkoutId, storeId]);
    const checkoutRow = checkoutRes.rows[0];
    if (!checkoutRow) {
      return null;
    }

    const itemsRes = await client.query<CheckoutItemRow>(
      `SELECT * FROM checkout_items
       WHERE checkout_id = $1 AND store_id = $2
       ORDER BY created_at ASC`,
      [checkoutId, storeId],
    );

    const items = itemsRes.rows.map(mapCheckoutItemRow);
    return mapCheckoutRow(checkoutRow, items);
  }

  async findByCartId(
    client: DatabaseClient,
    storeId: string,
    cartId: string,
    forUpdate = false,
  ): Promise<Checkout | null> {
    const query = `
      SELECT * FROM checkouts
      WHERE store_id = $1 AND cart_id = $2
      ORDER BY created_at DESC
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const res = await client.query<CheckoutRow>(query, [storeId, cartId]);
    const row = res.rows[0];
    if (!row) {
      return null;
    }

    const itemsRes = await client.query<CheckoutItemRow>(
      `SELECT * FROM checkout_items
       WHERE checkout_id = $1 AND store_id = $2
       ORDER BY created_at ASC`,
      [row.id, storeId],
    );

    return mapCheckoutRow(row, itemsRes.rows.map(mapCheckoutItemRow));
  }

  async findOpenByCartId(
    client: DatabaseClient,
    storeId: string,
    cartId: string,
    forUpdate = false,
  ): Promise<Checkout | null> {
    const query = `
      SELECT * FROM checkouts
      WHERE store_id = $1 AND cart_id = $2 AND status IN ('OPEN', 'PAYMENT_PENDING')
      ORDER BY created_at DESC
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const res = await client.query<CheckoutRow>(query, [storeId, cartId]);
    const row = res.rows[0];
    if (!row) {
      return null;
    }

    const itemsRes = await client.query<CheckoutItemRow>(
      `SELECT * FROM checkout_items
       WHERE checkout_id = $1 AND store_id = $2
       ORDER BY created_at ASC`,
      [row.id, storeId],
    );

    return mapCheckoutRow(row, itemsRes.rows.map(mapCheckoutItemRow));
  }

  async findExpiredCheckouts(
    client: DatabaseClient,
    storeId: string,
    cutoff: Date = new Date(),
    limit = 50,
  ): Promise<Checkout[]> {
    const query = `
      SELECT * FROM checkouts
      WHERE store_id = $1 AND status IN ('OPEN', 'PAYMENT_PENDING') AND expires_at IS NOT NULL AND expires_at <= $2
      ORDER BY expires_at ASC
      LIMIT $3
    `;
    const res = await client.query<CheckoutRow>(query, [storeId, cutoff, limit]);
    const checkouts: Checkout[] = [];

    for (const row of res.rows) {
      const itemsRes = await client.query<CheckoutItemRow>(
        `SELECT * FROM checkout_items
         WHERE checkout_id = $1 AND store_id = $2
         ORDER BY created_at ASC`,
        [row.id, storeId],
      );
      checkouts.push(mapCheckoutRow(row, itemsRes.rows.map(mapCheckoutItemRow)));
    }

    return checkouts;
  }

  async create(client: DatabaseClient, checkout: Checkout): Promise<void> {
    await client.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, customer_id, email, status, currency,
         subtotal, discount_total, tax_total, shipping_total, total,
         shipping_address, billing_address, payment_status,
         expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        checkout.id,
        checkout.storeId,
        checkout.cartId,
        checkout.customerId,
        checkout.email,
        checkout.status,
        checkout.currency,
        checkout.subtotal,
        checkout.discountTotal,
        checkout.taxTotal,
        checkout.shippingTotal,
        checkout.total,
        checkout.shippingAddress ? JSON.stringify(checkout.shippingAddress) : null,
        checkout.billingAddress ? JSON.stringify(checkout.billingAddress) : null,
        checkout.paymentStatus,
        checkout.expiresAt,
        checkout.createdAt,
        checkout.updatedAt,
      ],
    );

    for (const item of checkout.items) {
      await this.saveItem(client, item);
    }
  }

  async update(client: DatabaseClient, checkout: Checkout): Promise<void> {
    await client.query(
      `UPDATE checkouts
       SET customer_id = $3,
           email = $4,
           status = $5,
           currency = $6,
           subtotal = $7,
           discount_total = $8,
           tax_total = $9,
           shipping_total = $10,
           total = $11,
           shipping_address = $12,
           billing_address = $13,
           payment_status = $14,
           expires_at = $15,
           updated_at = $16
       WHERE id = $1 AND store_id = $2`,
      [
        checkout.id,
        checkout.storeId,
        checkout.customerId,
        checkout.email,
        checkout.status,
        checkout.currency,
        checkout.subtotal,
        checkout.discountTotal,
        checkout.taxTotal,
        checkout.shippingTotal,
        checkout.total,
        checkout.shippingAddress ? JSON.stringify(checkout.shippingAddress) : null,
        checkout.billingAddress ? JSON.stringify(checkout.billingAddress) : null,
        checkout.paymentStatus,
        checkout.expiresAt,
        checkout.updatedAt,
      ],
    );
  }

  async saveItem(client: DatabaseClient, item: CheckoutItem): Promise<void> {
    await client.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id,
         product_name_snapshot, variant_name_snapshot, sku_snapshot,
         unit_price, quantity, line_total, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (checkout_id, variant_id) DO UPDATE
       SET quantity = EXCLUDED.quantity,
           line_total = EXCLUDED.line_total,
           updated_at = EXCLUDED.updated_at`,
      [
        item.id,
        item.checkoutId,
        item.storeId,
        item.variantId,
        item.productNameSnapshot,
        item.variantNameSnapshot,
        item.skuSnapshot,
        item.unitPrice,
        item.quantity,
        item.lineTotal,
        item.createdAt,
        item.updatedAt,
      ],
    );
  }

  async deleteItem(
    client: DatabaseClient,
    storeId: string,
    checkoutId: string,
    variantIdOrItemId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM checkout_items
       WHERE store_id = $1 AND checkout_id = $2 AND (id = $3 OR variant_id = $3)`,
      [storeId, checkoutId, variantIdOrItemId],
    );
    return res.rowCount > 0;
  }

  async clearItems(
    client: DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<void> {
    await client.query(
      `DELETE FROM checkout_items
       WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
  }

  async listItems(
    client: DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutItem[]> {
    const res = await client.query<CheckoutItemRow>(
      `SELECT * FROM checkout_items
       WHERE store_id = $1 AND checkout_id = $2
       ORDER BY created_at ASC`,
      [storeId, checkoutId],
    );
    return res.rows.map(mapCheckoutItemRow);
  }

  async getItem(
    client: DatabaseClient,
    storeId: string,
    checkoutId: string,
    itemIdOrVariantId: string,
  ): Promise<CheckoutItem | null> {
    const res = await client.query<CheckoutItemRow>(
      `SELECT * FROM checkout_items
       WHERE store_id = $1 AND checkout_id = $2 AND (id = $3 OR variant_id = $3)`,
      [storeId, checkoutId, itemIdOrVariantId],
    );
    const row = res.rows[0];
    if (!row) {
      return null;
    }
    return mapCheckoutItemRow(row);
  }

  async findVariantWithProduct(
    client: DatabaseClient,
    variantId: string,
  ): Promise<{
    variantId: string;
    storeId: string;
    variantTitle: string;
    sku: string | null;
    price: number;
    currency: string;
    variantStatus: string;
    productId: string;
    productTitle: string;
    productStatus: string;
  } | null> {
    const res = await client.query<ProductVariantRow>(
      `SELECT
         pv.id AS variant_id,
         pv.store_id,
         pv.title AS variant_title,
         pv.sku,
         pv.price,
         pv.currency,
         pv.status AS variant_status,
         p.id AS product_id,
         p.title AS product_title,
         p.status AS product_status
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id AND p.store_id = pv.store_id
       WHERE pv.id = $1`,
      [variantId],
    );
    const row = res.rows[0];
    if (!row) {
      return null;
    }
    return {
      variantId: row.variant_id,
      storeId: row.store_id,
      variantTitle: row.variant_title,
      sku: row.sku,
      price: Number(row.price),
      currency: row.currency,
      variantStatus: row.variant_status,
      productId: row.product_id,
      productTitle: row.product_title,
      productStatus: row.product_status,
    };
  }

  async findCustomer(
    client: DatabaseClient,
    customerId: string,
  ): Promise<{ id: string; storeId: string; status: string; email: string } | null> {
    const res = await client.query<CustomerRow>(
      `SELECT id, store_id, status, email
       FROM customers
       WHERE id = $1`,
      [customerId],
    );
    const row = res.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      storeId: row.store_id,
      status: row.status,
      email: row.email,
    };
  }
}
