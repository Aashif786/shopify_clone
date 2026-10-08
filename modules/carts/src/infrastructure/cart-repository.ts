import type { DatabaseClient } from "@shopify-clone/db";
import { Cart } from "../domain/cart.js";
import type { CartItem } from "../domain/cart-item.js";
import type { CartStatus } from "../domain/cart-state.js";

interface CartRow {
  id: string;
  store_id: string;
  customer_id: string | null;
  guest_identifier: string | null;
  status: CartStatus;
  currency: string;
  subtotal: string | number;
  discount_total: string | number;
  tax_total: string | number;
  shipping_total: string | number;
  grand_total: string | number;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface CartItemRow {
  id: string;
  cart_id: string;
  store_id: string;
  variant_id: string;
  quantity: number;
  unit_price: string | number;
  line_subtotal: string | number;
  created_at: Date;
  updated_at: Date;
}

interface ProductVariantRow {
  id: string;
  store_id: string;
  price: string | number;
  currency: string;
  status: string;
}

interface CustomerRow {
  id: string;
  store_id: string;
  status: string;
}

function mapItemRow(row: CartItemRow): CartItem {
  return {
    id: row.id,
    cartId: row.cart_id,
    storeId: row.store_id,
    variantId: row.variant_id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineSubtotal: Number(row.line_subtotal),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapCartRow(row: CartRow, items: CartItem[] = []): Cart {
  return Cart.reconstitute({
    id: row.id,
    storeId: row.store_id,
    customerId: row.customer_id,
    guestIdentifier: row.guest_identifier,
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total),
    taxTotal: Number(row.tax_total),
    shippingTotal: Number(row.shipping_total),
    grandTotal: Number(row.grand_total),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    items,
  });
}

export class CartRepository {
  async findById(
    client: DatabaseClient,
    storeId: string,
    cartId: string,
    forUpdate = false,
  ): Promise<Cart | null> {
    const query = `
      SELECT * FROM carts
      WHERE id = $1 AND store_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const res = await client.query<CartRow>(query, [cartId, storeId]);
    const row = res.rows[0];
    if (!row) {
      return null;
    }
    return mapCartRow(row, []);
  }

  async findWithItems(
    client: DatabaseClient,
    storeId: string,
    cartId: string,
    forUpdate = false,
  ): Promise<Cart | null> {
    const cartQuery = `
      SELECT * FROM carts
      WHERE id = $1 AND store_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const cartRes = await client.query<CartRow>(cartQuery, [cartId, storeId]);
    const cartRow = cartRes.rows[0];
    if (!cartRow) {
      return null;
    }

    const itemsRes = await client.query<CartItemRow>(
      `SELECT * FROM cart_items
       WHERE cart_id = $1 AND store_id = $2
       ORDER BY created_at ASC`,
      [cartId, storeId],
    );

    const items = itemsRes.rows.map(mapItemRow);
    return mapCartRow(cartRow, items);
  }

  async findActiveByCustomerId(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    forUpdate = false,
  ): Promise<Cart | null> {
    const query = `
      SELECT * FROM carts
      WHERE store_id = $1 AND customer_id = $2 AND status = 'ACTIVE'
      ORDER BY updated_at DESC
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const res = await client.query<CartRow>(query, [storeId, customerId]);
    const row = res.rows[0];
    if (!row) {
      return null;
    }

    const itemsRes = await client.query<CartItemRow>(
      `SELECT * FROM cart_items
       WHERE cart_id = $1 AND store_id = $2
       ORDER BY created_at ASC`,
      [row.id, storeId],
    );

    return mapCartRow(row, itemsRes.rows.map(mapItemRow));
  }

  async findActiveByGuestIdentifier(
    client: DatabaseClient,
    storeId: string,
    guestIdentifier: string,
    forUpdate = false,
  ): Promise<Cart | null> {
    const query = `
      SELECT * FROM carts
      WHERE store_id = $1 AND guest_identifier = $2 AND status = 'ACTIVE'
      ORDER BY updated_at DESC
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const res = await client.query<CartRow>(query, [storeId, guestIdentifier]);
    const row = res.rows[0];
    if (!row) {
      return null;
    }

    const itemsRes = await client.query<CartItemRow>(
      `SELECT * FROM cart_items
       WHERE cart_id = $1 AND store_id = $2
       ORDER BY created_at ASC`,
      [row.id, storeId],
    );

    return mapCartRow(row, itemsRes.rows.map(mapItemRow));
  }

  async create(client: DatabaseClient, cart: Cart): Promise<void> {
    await client.query(
      `INSERT INTO carts (
         id, store_id, customer_id, guest_identifier, status, currency,
         subtotal, discount_total, tax_total, shipping_total, grand_total,
         expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        cart.id,
        cart.storeId,
        cart.customerId,
        cart.guestIdentifier,
        cart.status,
        cart.currency,
        cart.subtotal,
        cart.discountTotal,
        cart.taxTotal,
        cart.shippingTotal,
        cart.grandTotal,
        cart.expiresAt,
        cart.createdAt,
        cart.updatedAt,
      ],
    );
  }

  async update(client: DatabaseClient, cart: Cart): Promise<void> {
    await client.query(
      `UPDATE carts
       SET customer_id = $3,
           guest_identifier = $4,
           status = $5,
           currency = $6,
           subtotal = $7,
           discount_total = $8,
           tax_total = $9,
           shipping_total = $10,
           grand_total = $11,
           expires_at = $12,
           updated_at = $13
       WHERE id = $1 AND store_id = $2`,
      [
        cart.id,
        cart.storeId,
        cart.customerId,
        cart.guestIdentifier,
        cart.status,
        cart.currency,
        cart.subtotal,
        cart.discountTotal,
        cart.taxTotal,
        cart.shippingTotal,
        cart.grandTotal,
        cart.expiresAt,
        cart.updatedAt,
      ],
    );
  }

  async saveItem(client: DatabaseClient, item: CartItem): Promise<void> {
    await client.query(
      `INSERT INTO cart_items (
         id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (cart_id, variant_id) DO UPDATE
       SET quantity = EXCLUDED.quantity,
           unit_price = EXCLUDED.unit_price,
           line_subtotal = EXCLUDED.line_subtotal,
           updated_at = EXCLUDED.updated_at`,
      [
        item.id,
        item.cartId,
        item.storeId,
        item.variantId,
        item.quantity,
        item.unitPrice,
        item.lineSubtotal,
        item.createdAt,
        item.updatedAt,
      ],
    );
  }

  async deleteItem(
    client: DatabaseClient,
    storeId: string,
    cartId: string,
    variantIdOrItemId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM cart_items
       WHERE store_id = $1 AND cart_id = $2 AND (id = $3 OR variant_id = $3)`,
      [storeId, cartId, variantIdOrItemId],
    );
    return res.rowCount > 0;
  }

  async clearItems(
    client: DatabaseClient,
    storeId: string,
    cartId: string,
  ): Promise<void> {
    await client.query(
      `DELETE FROM cart_items
       WHERE store_id = $1 AND cart_id = $2`,
      [storeId, cartId],
    );
  }

  async listItems(
    client: DatabaseClient,
    storeId: string,
    cartId: string,
  ): Promise<CartItem[]> {
    const res = await client.query<CartItemRow>(
      `SELECT * FROM cart_items
       WHERE store_id = $1 AND cart_id = $2
       ORDER BY created_at ASC`,
      [storeId, cartId],
    );
    return res.rows.map(mapItemRow);
  }

  async getItem(
    client: DatabaseClient,
    storeId: string,
    cartId: string,
    itemIdOrVariantId: string,
  ): Promise<CartItem | null> {
    const res = await client.query<CartItemRow>(
      `SELECT * FROM cart_items
       WHERE store_id = $1 AND cart_id = $2 AND (id = $3 OR variant_id = $3)`,
      [storeId, cartId, itemIdOrVariantId],
    );
    const row = res.rows[0];
    if (!row) {
      return null;
    }
    return mapItemRow(row);
  }

  async findVariant(
    client: DatabaseClient,
    variantId: string,
  ): Promise<{
    id: string;
    storeId: string;
    price: number;
    currency: string;
    status: string;
    productStatus: string;
  } | null> {
    const res = await client.query<ProductVariantRow & { product_status: string }>(
      `SELECT pv.id, pv.store_id, pv.price, pv.currency, pv.status, p.status AS product_status
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
      id: row.id,
      storeId: row.store_id,
      price: Number(row.price),
      currency: row.currency,
      status: row.status,
      productStatus: row.product_status,
    };
  }

  async findCustomer(
    client: DatabaseClient,
    customerId: string,
  ): Promise<{ id: string; storeId: string; status: string } | null> {
    const res = await client.query<CustomerRow>(
      `SELECT id, store_id, status
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
    };
  }
}
