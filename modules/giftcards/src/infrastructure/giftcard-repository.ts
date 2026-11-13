import type { Database, DatabaseClient } from "@calcart/db";
import type { GiftCardStatus, GiftCardTransactionType, StoreCreditTransactionType } from "../application/dtos.js";

type Client = Database | DatabaseClient;

export interface GiftCardRow {
  id: string;
  store_id: string;
  code: string;
  code_hash: string;
  initial_balance: string | number | bigint;
  current_balance: string | number | bigint;
  currency: string;
  status: GiftCardStatus;
  customer_id: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  message: string | null;
  expires_at: Date | null;
  disabled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface GiftCardTransactionRow {
  id: string;
  store_id: string;
  gift_card_id: string;
  type: GiftCardTransactionType;
  amount: string | number | bigint;
  balance_before: string | number | bigint;
  balance_after: string | number | bigint;
  checkout_id: string | null;
  order_id: string | null;
  idempotency_key: string;
  notes: string | null;
  created_at: Date;
}

export interface StoreCreditRow {
  id: string;
  store_id: string;
  customer_id: string;
  currency: string;
  current_balance: string | number | bigint;
  created_at: Date;
  updated_at: Date;
}

export interface StoreCreditTransactionRow {
  id: string;
  store_id: string;
  store_credit_id: string;
  customer_id: string;
  type: StoreCreditTransactionType;
  amount: string | number | bigint;
  balance_before: string | number | bigint;
  balance_after: string | number | bigint;
  order_id: string | null;
  checkout_id: string | null;
  idempotency_key: string;
  notes: string | null;
  created_at: Date;
}

export interface CheckoutGiftCardRow {
  id: string;
  store_id: string;
  checkout_id: string;
  gift_card_id: string;
  applied_amount: string | number | bigint;
  created_at: Date;
  code?: string;
  currency?: string;
  current_balance?: string | number | bigint;
  status?: GiftCardStatus;
}

export interface OrderGiftCardRow {
  id: string;
  store_id: string;
  order_id: string;
  gift_card_id: string;
  code_last4: string;
  amount: string | number | bigint;
  created_at: Date;
}

export interface CheckoutStoreCreditRow {
  id: string;
  store_id: string;
  checkout_id: string;
  store_credit_id: string;
  customer_id: string;
  applied_amount: string | number | bigint;
  created_at: Date;
  currency?: string;
  current_balance?: string | number | bigint;
}

export interface OrderStoreCreditRow {
  id: string;
  store_id: string;
  order_id: string;
  store_credit_id: string;
  customer_id: string;
  amount: string | number | bigint;
  created_at: Date;
}

export class GiftCardRepository {
  // -------------------------------------------------------------------------
  // Gift Cards
  // -------------------------------------------------------------------------

  async findGiftCardById(
    client: Client,
    storeId: string,
    id: string,
    forUpdate = false,
  ): Promise<GiftCardRow | null> {
    const query = `
      SELECT * FROM gift_cards
      WHERE id = $1 AND store_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const res = await client.query<GiftCardRow>(query, [id, storeId]);
    return res.rows[0] ?? null;
  }

  async findGiftCardByCodeHash(
    client: Client,
    storeId: string,
    codeHash: string,
    forUpdate = false,
  ): Promise<GiftCardRow | null> {
    const query = `
      SELECT * FROM gift_cards
      WHERE store_id = $1 AND code_hash = $2
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const res = await client.query<GiftCardRow>(query, [storeId, codeHash]);
    return res.rows[0] ?? null;
  }

  async insertGiftCard(
    client: Client,
    row: {
      id: string;
      storeId: string;
      code: string;
      codeHash: string;
      initialBalance: number;
      currentBalance: number;
      currency: string;
      status: GiftCardStatus;
      customerId?: string | null;
      recipientEmail?: string | null;
      recipientName?: string | null;
      message?: string | null;
      expiresAt?: Date | null;
    },
  ): Promise<GiftCardRow> {
    const query = `
      INSERT INTO gift_cards (
        id, store_id, code, code_hash, initial_balance, current_balance,
        currency, status, customer_id, recipient_email, recipient_name,
        message, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const res = await client.query<GiftCardRow>(query, [
      row.id,
      row.storeId,
      row.code,
      row.codeHash,
      row.initialBalance,
      row.currentBalance,
      row.currency,
      row.status,
      row.customerId ?? null,
      row.recipientEmail ?? null,
      row.recipientName ?? null,
      row.message ?? null,
      row.expiresAt ?? null,
    ]);
    return res.rows[0]!;
  }

  async updateGiftCardBalance(
    client: Client,
    storeId: string,
    id: string,
    newBalance: number,
    status: GiftCardStatus,
  ): Promise<GiftCardRow | null> {
    const query = `
      UPDATE gift_cards
      SET current_balance = $1, status = $2, updated_at = NOW()
      WHERE id = $3 AND store_id = $4
      RETURNING *
    `;
    const res = await client.query<GiftCardRow>(query, [newBalance, status, id, storeId]);
    return res.rows[0] ?? null;
  }

  async disableGiftCard(
    client: Client,
    storeId: string,
    id: string,
  ): Promise<GiftCardRow | null> {
    const query = `
      UPDATE gift_cards
      SET status = 'DISABLED', disabled_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND store_id = $2
      RETURNING *
    `;
    const res = await client.query<GiftCardRow>(query, [id, storeId]);
    return res.rows[0] ?? null;
  }

  async listGiftCards(
    client: Client,
    storeId: string,
    options: { status?: GiftCardStatus; limit?: number; offset?: number } = {},
  ): Promise<GiftCardRow[]> {
    const params: unknown[] = [storeId];
    let query = `SELECT * FROM gift_cards WHERE store_id = $1`;
    if (options.status) {
      params.push(options.status);
      query += ` AND status = $${params.length}`;
    }
    query += ` ORDER BY created_at DESC`;
    if (options.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }
    if (options.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }
    const res = await client.query<GiftCardRow>(query, params);
    return res.rows;
  }

  // -------------------------------------------------------------------------
  // Gift Card Ledger Transactions
  // -------------------------------------------------------------------------

  async findGiftCardTransactionByIdempotencyKey(
    client: Client,
    storeId: string,
    giftCardId: string,
    idempotencyKey: string,
  ): Promise<GiftCardTransactionRow | null> {
    const query = `
      SELECT * FROM gift_card_transactions
      WHERE store_id = $1 AND gift_card_id = $2 AND idempotency_key = $3
    `;
    const res = await client.query<GiftCardTransactionRow>(query, [
      storeId,
      giftCardId,
      idempotencyKey,
    ]);
    return res.rows[0] ?? null;
  }

  async insertGiftCardTransaction(
    client: Client,
    row: {
      id: string;
      storeId: string;
      giftCardId: string;
      type: GiftCardTransactionType;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
      checkoutId?: string | null;
      orderId?: string | null;
      idempotencyKey: string;
      notes?: string | null;
    },
  ): Promise<GiftCardTransactionRow> {
    const query = `
      INSERT INTO gift_card_transactions (
        id, store_id, gift_card_id, type, amount, balance_before,
        balance_after, checkout_id, order_id, idempotency_key, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const res = await client.query<GiftCardTransactionRow>(query, [
      row.id,
      row.storeId,
      row.giftCardId,
      row.type,
      row.amount,
      row.balanceBefore,
      row.balanceAfter,
      row.checkoutId ?? null,
      row.orderId ?? null,
      row.idempotencyKey,
      row.notes ?? null,
    ]);
    return res.rows[0]!;
  }

  async listGiftCardTransactions(
    client: Client,
    storeId: string,
    giftCardId: string,
  ): Promise<GiftCardTransactionRow[]> {
    const query = `
      SELECT * FROM gift_card_transactions
      WHERE store_id = $1 AND gift_card_id = $2
      ORDER BY created_at DESC
    `;
    const res = await client.query<GiftCardTransactionRow>(query, [storeId, giftCardId]);
    return res.rows;
  }

  // -------------------------------------------------------------------------
  // Customer Store Credit
  // -------------------------------------------------------------------------

  async findStoreCredit(
    client: Client,
    storeId: string,
    customerId: string,
    currency = "INR",
    forUpdate = false,
  ): Promise<StoreCreditRow | null> {
    const query = `
      SELECT * FROM store_credits
      WHERE store_id = $1 AND customer_id = $2 AND currency = $3
      ${forUpdate ? "FOR UPDATE" : ""}
    `;
    const res = await client.query<StoreCreditRow>(query, [storeId, customerId, currency]);
    return res.rows[0] ?? null;
  }

  async insertStoreCredit(
    client: Client,
    row: {
      id: string;
      storeId: string;
      customerId: string;
      currency: string;
      currentBalance: number;
    },
  ): Promise<StoreCreditRow> {
    const query = `
      INSERT INTO store_credits (id, store_id, customer_id, currency, current_balance)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await client.query<StoreCreditRow>(query, [
      row.id,
      row.storeId,
      row.customerId,
      row.currency,
      row.currentBalance,
    ]);
    return res.rows[0]!;
  }

  async updateStoreCreditBalance(
    client: Client,
    storeId: string,
    id: string,
    newBalance: number,
  ): Promise<StoreCreditRow | null> {
    const query = `
      UPDATE store_credits
      SET current_balance = $1, updated_at = NOW()
      WHERE id = $2 AND store_id = $3
      RETURNING *
    `;
    const res = await client.query<StoreCreditRow>(query, [newBalance, id, storeId]);
    return res.rows[0] ?? null;
  }

  // -------------------------------------------------------------------------
  // Store Credit Ledger Transactions
  // -------------------------------------------------------------------------

  async findStoreCreditTransactionByIdempotencyKey(
    client: Client,
    storeId: string,
    storeCreditId: string,
    idempotencyKey: string,
  ): Promise<StoreCreditTransactionRow | null> {
    const query = `
      SELECT * FROM store_credit_transactions
      WHERE store_id = $1 AND store_credit_id = $2 AND idempotency_key = $3
    `;
    const res = await client.query<StoreCreditTransactionRow>(query, [
      storeId,
      storeCreditId,
      idempotencyKey,
    ]);
    return res.rows[0] ?? null;
  }

  async insertStoreCreditTransaction(
    client: Client,
    row: {
      id: string;
      storeId: string;
      storeCreditId: string;
      customerId: string;
      type: StoreCreditTransactionType;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
      orderId?: string | null;
      checkoutId?: string | null;
      idempotencyKey: string;
      notes?: string | null;
    },
  ): Promise<StoreCreditTransactionRow> {
    const query = `
      INSERT INTO store_credit_transactions (
        id, store_id, store_credit_id, customer_id, type, amount,
        balance_before, balance_after, order_id, checkout_id, idempotency_key, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const res = await client.query<StoreCreditTransactionRow>(query, [
      row.id,
      row.storeId,
      row.storeCreditId,
      row.customerId,
      row.type,
      row.amount,
      row.balanceBefore,
      row.balanceAfter,
      row.orderId ?? null,
      row.checkoutId ?? null,
      row.idempotencyKey,
      row.notes ?? null,
    ]);
    return res.rows[0]!;
  }

  async listStoreCreditTransactions(
    client: Client,
    storeId: string,
    storeCreditId: string,
  ): Promise<StoreCreditTransactionRow[]> {
    const query = `
      SELECT * FROM store_credit_transactions
      WHERE store_id = $1 AND store_credit_id = $2
      ORDER BY created_at DESC
    `;
    const res = await client.query<StoreCreditTransactionRow>(query, [storeId, storeCreditId]);
    return res.rows;
  }

  // -------------------------------------------------------------------------
  // Checkout & Order Gift Cards
  // -------------------------------------------------------------------------

  async findCheckoutGiftCards(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutGiftCardRow[]> {
    const query = `
      SELECT cgc.*, gc.code, gc.currency, gc.current_balance, gc.status
      FROM checkout_gift_cards cgc
      JOIN gift_cards gc ON gc.id = cgc.gift_card_id AND gc.store_id = cgc.store_id
      WHERE cgc.store_id = $1 AND cgc.checkout_id = $2
      ORDER BY cgc.created_at ASC
    `;
    const res = await client.query<CheckoutGiftCardRow>(query, [storeId, checkoutId]);
    return res.rows;
  }

  async findCheckoutGiftCard(
    client: Client,
    storeId: string,
    checkoutId: string,
    giftCardId: string,
  ): Promise<CheckoutGiftCardRow | null> {
    const query = `
      SELECT cgc.*, gc.code, gc.currency, gc.current_balance, gc.status
      FROM checkout_gift_cards cgc
      JOIN gift_cards gc ON gc.id = cgc.gift_card_id AND gc.store_id = cgc.store_id
      WHERE cgc.store_id = $1 AND cgc.checkout_id = $2 AND cgc.gift_card_id = $3
    `;
    const res = await client.query<CheckoutGiftCardRow>(query, [storeId, checkoutId, giftCardId]);
    return res.rows[0] ?? null;
  }

  async insertCheckoutGiftCard(
    client: Client,
    row: {
      id: string;
      storeId: string;
      checkoutId: string;
      giftCardId: string;
      appliedAmount: number;
    },
  ): Promise<CheckoutGiftCardRow> {
    const query = `
      INSERT INTO checkout_gift_cards (id, store_id, checkout_id, gift_card_id, applied_amount)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (checkout_id, gift_card_id) DO UPDATE
      SET applied_amount = EXCLUDED.applied_amount
      RETURNING *
    `;
    const res = await client.query<CheckoutGiftCardRow>(query, [
      row.id,
      row.storeId,
      row.checkoutId,
      row.giftCardId,
      row.appliedAmount,
    ]);
    return res.rows[0]!;
  }

  async deleteCheckoutGiftCard(
    client: Client,
    storeId: string,
    checkoutId: string,
    giftCardId: string,
  ): Promise<boolean> {
    const query = `
      DELETE FROM checkout_gift_cards
      WHERE store_id = $1 AND checkout_id = $2 AND gift_card_id = $3
    `;
    const res = await client.query(query, [storeId, checkoutId, giftCardId]);
    return (res.rowCount ?? 0) > 0;
  }

  async deleteCheckoutGiftCardsForCheckout(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<number> {
    const query = `
      DELETE FROM checkout_gift_cards
      WHERE store_id = $1 AND checkout_id = $2
    `;
    const res = await client.query(query, [storeId, checkoutId]);
    return res.rowCount ?? 0;
  }

  async insertOrderGiftCard(
    client: Client,
    row: {
      id: string;
      storeId: string;
      orderId: string;
      giftCardId: string;
      codeLast4: string;
      amount: number;
    },
  ): Promise<OrderGiftCardRow | null> {
    const query = `
      INSERT INTO order_gift_cards (id, store_id, order_id, gift_card_id, code_last4, amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (order_id, gift_card_id) DO NOTHING
      RETURNING *
    `;
    const res = await client.query<OrderGiftCardRow>(query, [
      row.id,
      row.storeId,
      row.orderId,
      row.giftCardId,
      row.codeLast4,
      row.amount,
    ]);
    return res.rows[0] ?? null;
  }

  async listOrderGiftCards(
    client: Client,
    storeId: string,
    orderId: string,
  ): Promise<OrderGiftCardRow[]> {
    const query = `
      SELECT * FROM order_gift_cards
      WHERE store_id = $1 AND order_id = $2
      ORDER BY created_at ASC
    `;
    const res = await client.query<OrderGiftCardRow>(query, [storeId, orderId]);
    return res.rows;
  }

  // -------------------------------------------------------------------------
  // Checkout & Order Store Credit
  // -------------------------------------------------------------------------

  async findCheckoutStoreCredit(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutStoreCreditRow | null> {
    const query = `
      SELECT csc.*, sc.currency, sc.current_balance
      FROM checkout_store_credits csc
      JOIN store_credits sc ON sc.id = csc.store_credit_id AND sc.store_id = csc.store_id
      WHERE csc.store_id = $1 AND csc.checkout_id = $2
    `;
    const res = await client.query<CheckoutStoreCreditRow>(query, [storeId, checkoutId]);
    return res.rows[0] ?? null;
  }

  async insertCheckoutStoreCredit(
    client: Client,
    row: {
      id: string;
      storeId: string;
      checkoutId: string;
      storeCreditId: string;
      customerId: string;
      appliedAmount: number;
    },
  ): Promise<CheckoutStoreCreditRow> {
    const query = `
      INSERT INTO checkout_store_credits (id, store_id, checkout_id, store_credit_id, customer_id, applied_amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (checkout_id) DO UPDATE
      SET applied_amount = EXCLUDED.applied_amount,
          store_credit_id = EXCLUDED.store_credit_id,
          customer_id = EXCLUDED.customer_id
      RETURNING *
    `;
    const res = await client.query<CheckoutStoreCreditRow>(query, [
      row.id,
      row.storeId,
      row.checkoutId,
      row.storeCreditId,
      row.customerId,
      row.appliedAmount,
    ]);
    return res.rows[0]!;
  }

  async deleteCheckoutStoreCredit(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<boolean> {
    const query = `
      DELETE FROM checkout_store_credits
      WHERE store_id = $1 AND checkout_id = $2
    `;
    const res = await client.query(query, [storeId, checkoutId]);
    return (res.rowCount ?? 0) > 0;
  }

  async insertOrderStoreCredit(
    client: Client,
    row: {
      id: string;
      storeId: string;
      orderId: string;
      storeCreditId: string;
      customerId: string;
      amount: number;
    },
  ): Promise<OrderStoreCreditRow | null> {
    const query = `
      INSERT INTO order_store_credits (id, store_id, order_id, store_credit_id, customer_id, amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (order_id) DO NOTHING
      RETURNING *
    `;
    const res = await client.query<OrderStoreCreditRow>(query, [
      row.id,
      row.storeId,
      row.orderId,
      row.storeCreditId,
      row.customerId,
      row.amount,
    ]);
    return res.rows[0] ?? null;
  }

  async findOrderStoreCredit(
    client: Client,
    storeId: string,
    orderId: string,
  ): Promise<OrderStoreCreditRow | null> {
    const query = `
      SELECT * FROM order_store_credits
      WHERE store_id = $1 AND order_id = $2
    `;
    const res = await client.query<OrderStoreCreditRow>(query, [storeId, orderId]);
    return res.rows[0] ?? null;
  }
}
