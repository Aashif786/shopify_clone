import type {
  Database,
  DatabaseClient,
  ReturnPolicyRow,
  ReturnRequestEventRow,
  ReturnRequestItemRow,
  ReturnRequestRow,
} from "@calcart/db";
import type {
  ReturnRequestActorType,
  ReturnRequestStatus,
} from "../domain/return-state.js";
import { OPEN_RETURN_REQUEST_STATUSES } from "../domain/return-state.js";
import type {
  ReturnPolicyDTO,
  ReturnRequestDTO,
  ReturnRequestEventDTO,
  ReturnRequestItemDTO,
} from "../application/dtos.js";

type Client = Database | DatabaseClient;

const RETURN_REQUEST_COLUMNS = `
  id, store_id, order_id, customer_id, return_number, status, reason,
  customer_note, merchant_note, currency, requested_amount, refunded_amount,
  refund_id, requested_at, decided_at, decided_by_user_id, received_at,
  refunded_at, cancelled_at, created_at, updated_at
`;

function toNumber(value: string | number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function mapReturnRequestRow(row: ReturnRequestRow): ReturnRequestDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    customerId: row.customer_id ?? null,
    returnNumber: row.return_number,
    status: row.status,
    reason: row.reason,
    customerNote: row.customer_note ?? null,
    merchantNote: row.merchant_note ?? null,
    currency: row.currency,
    requestedAmount: toNumber(row.requested_amount),
    refundedAmount:
      row.refunded_amount === null || row.refunded_amount === undefined
        ? null
        : toNumber(row.refunded_amount),
    refundId: row.refund_id ?? null,
    requestedAt: row.requested_at.toISOString(),
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
    decidedByUserId: row.decided_by_user_id ?? null,
    receivedAt: row.received_at ? row.received_at.toISOString() : null,
    refundedAt: row.refunded_at ? row.refunded_at.toISOString() : null,
    cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapReturnRequestItemRow(
  row: ReturnRequestItemRow,
): ReturnRequestItemDTO {
  return {
    id: row.id,
    returnRequestId: row.return_request_id,
    storeId: row.store_id,
    orderItemId: row.order_item_id,
    quantity: Number(row.quantity),
    unitPriceSnapshot: toNumber(row.unit_price_snapshot),
    lineRefundAmount: toNumber(row.line_refund_amount),
    productNameSnapshot: row.product_name_snapshot,
    variantNameSnapshot: row.variant_name_snapshot ?? null,
    skuSnapshot: row.sku_snapshot ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapReturnRequestEventRow(
  row: ReturnRequestEventRow,
): ReturnRequestEventDTO {
  return {
    id: row.id,
    returnRequestId: row.return_request_id,
    storeId: row.store_id,
    fromStatus: row.from_status ?? null,
    toStatus: row.to_status,
    actorType: row.actor_type,
    actorId: row.actor_id ?? null,
    reason: row.reason ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapReturnPolicyRow(row: ReturnPolicyRow): ReturnPolicyDTO {
  return {
    storeId: row.store_id,
    isReturnsEnabled: Boolean(row.is_returns_enabled),
    returnWindowDays: Number(row.return_window_days),
    isDefault: false,
  };
}

export interface CreateReturnRequestData {
  id: string;
  storeId: string;
  orderId: string;
  customerId: string | null;
  returnNumber: string;
  reason: string;
  customerNote: string | null;
  currency: string;
  requestedAmount: number;
}

export interface CreateReturnRequestItemData {
  id: string;
  returnRequestId: string;
  storeId: string;
  orderItemId: string;
  quantity: number;
  unitPriceSnapshot: number;
  lineRefundAmount: number;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string | null;
}

export interface CreateReturnRequestEventData {
  id: string;
  returnRequestId: string;
  storeId: string;
  fromStatus: ReturnRequestStatus | null;
  toStatus: ReturnRequestStatus;
  actorType: ReturnRequestActorType;
  actorId: string | null;
  reason: string | null;
}

/**
 * All reads and writes are store-scoped. Combined with the composite
 * (id, store_id) foreign keys in migration 0035, a return request can never be
 * read or mutated through another tenant's store id.
 */
export class ReturnRepository {
  async insertReturnRequest(
    client: Client,
    data: CreateReturnRequestData,
  ): Promise<ReturnRequestRow> {
    const res = await client.query<ReturnRequestRow>(
      `INSERT INTO return_requests
         (id, store_id, order_id, customer_id, return_number, status, reason,
          customer_note, currency, requested_amount)
       VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6, $7, $8, $9)
       RETURNING ${RETURN_REQUEST_COLUMNS}`,
      [
        data.id,
        data.storeId,
        data.orderId,
        data.customerId,
        data.returnNumber,
        data.reason,
        data.customerNote,
        data.currency,
        data.requestedAmount,
      ],
    );
    return res.rows[0]!;
  }

  async insertReturnRequestItem(
    client: Client,
    data: CreateReturnRequestItemData,
  ): Promise<ReturnRequestItemRow> {
    const res = await client.query<ReturnRequestItemRow>(
      `INSERT INTO return_request_items
         (id, return_request_id, store_id, order_item_id, quantity,
          unit_price_snapshot, line_refund_amount, product_name_snapshot,
          variant_name_snapshot, sku_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.id,
        data.returnRequestId,
        data.storeId,
        data.orderItemId,
        data.quantity,
        data.unitPriceSnapshot,
        data.lineRefundAmount,
        data.productNameSnapshot,
        data.variantNameSnapshot,
        data.skuSnapshot,
      ],
    );
    return res.rows[0]!;
  }

  async insertReturnRequestEvent(
    client: Client,
    data: CreateReturnRequestEventData,
  ): Promise<ReturnRequestEventRow> {
    const res = await client.query<ReturnRequestEventRow>(
      `INSERT INTO return_request_events
         (id, return_request_id, store_id, from_status, to_status, actor_type, actor_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.id,
        data.returnRequestId,
        data.storeId,
        data.fromStatus,
        data.toStatus,
        data.actorType,
        data.actorId,
        data.reason,
      ],
    );
    return res.rows[0]!;
  }

  async findById(
    client: Client,
    storeId: string,
    returnRequestId: string,
  ): Promise<ReturnRequestRow | null> {
    const res = await client.query<ReturnRequestRow>(
      `SELECT ${RETURN_REQUEST_COLUMNS}
       FROM return_requests
       WHERE id = $1 AND store_id = $2`,
      [returnRequestId, storeId],
    );
    return res.rows[0] ?? null;
  }

  /**
   * Row-level lock used to serialize concurrent merchant decisions on the same
   * return request, mirroring `OrderRepository.findByIdForUpdate`.
   */
  async findByIdForUpdate(
    client: Client,
    storeId: string,
    returnRequestId: string,
  ): Promise<ReturnRequestRow | null> {
    const res = await client.query<ReturnRequestRow>(
      `SELECT ${RETURN_REQUEST_COLUMNS}
       FROM return_requests
       WHERE id = $1 AND store_id = $2
       FOR UPDATE`,
      [returnRequestId, storeId],
    );
    return res.rows[0] ?? null;
  }

  /** Used only to distinguish "not found" from "belongs to another store". */
  async findStoreIdById(
    client: Client,
    returnRequestId: string,
  ): Promise<string | null> {
    const res = await client.query<{ store_id: string }>(
      `SELECT store_id FROM return_requests WHERE id = $1`,
      [returnRequestId],
    );
    return res.rows[0]?.store_id ?? null;
  }

  async findOpenByOrderId(
    client: Client,
    storeId: string,
    orderId: string,
  ): Promise<ReturnRequestRow | null> {
    const res = await client.query<ReturnRequestRow>(
      `SELECT ${RETURN_REQUEST_COLUMNS}
       FROM return_requests
       WHERE store_id = $1 AND order_id = $2 AND status = ANY($3::text[])
       LIMIT 1`,
      [storeId, orderId, OPEN_RETURN_REQUEST_STATUSES as unknown as string[]],
    );
    return res.rows[0] ?? null;
  }

  async findItemsByReturnRequestId(
    client: Client,
    storeId: string,
    returnRequestId: string,
  ): Promise<ReturnRequestItemRow[]> {
    const res = await client.query<ReturnRequestItemRow>(
      `SELECT * FROM return_request_items
       WHERE return_request_id = $1 AND store_id = $2
       ORDER BY created_at ASC, id ASC`,
      [returnRequestId, storeId],
    );
    return res.rows;
  }

  async findEventsByReturnRequestId(
    client: Client,
    storeId: string,
    returnRequestId: string,
  ): Promise<ReturnRequestEventRow[]> {
    const res = await client.query<ReturnRequestEventRow>(
      `SELECT * FROM return_request_events
       WHERE return_request_id = $1 AND store_id = $2
       ORDER BY created_at ASC, id ASC`,
      [returnRequestId, storeId],
    );
    return res.rows;
  }

  /**
   * Quantities already claimed per order line by return requests that are not
   * rejected or cancelled, so a customer cannot return the same unit twice.
   */
  async sumClaimedQuantitiesByOrder(
    client: Client,
    storeId: string,
    orderId: string,
  ): Promise<Map<string, number>> {
    const res = await client.query<{ order_item_id: string; claimed: string }>(
      `SELECT ri.order_item_id, SUM(ri.quantity)::text AS claimed
       FROM return_request_items ri
       JOIN return_requests r
         ON r.id = ri.return_request_id AND r.store_id = ri.store_id
       WHERE r.store_id = $1
         AND r.order_id = $2
         AND r.status NOT IN ('REJECTED', 'CANCELLED')
       GROUP BY ri.order_item_id`,
      [storeId, orderId],
    );

    const claimed = new Map<string, number>();
    for (const row of res.rows) {
      claimed.set(row.order_item_id, Number(row.claimed));
    }
    return claimed;
  }

  async updateStatus(
    client: Client,
    params: {
      storeId: string;
      returnRequestId: string;
      status: ReturnRequestStatus;
      merchantNote?: string | null;
      decidedAt?: Date | null;
      decidedByUserId?: string | null;
      receivedAt?: Date | null;
      refundedAt?: Date | null;
      cancelledAt?: Date | null;
      refundId?: string | null;
      refundedAmount?: number | null;
    },
  ): Promise<ReturnRequestRow> {
    const res = await client.query<ReturnRequestRow>(
      `UPDATE return_requests
       SET status = $3,
           merchant_note = COALESCE($4, merchant_note),
           decided_at = COALESCE($5, decided_at),
           decided_by_user_id = COALESCE($6, decided_by_user_id),
           received_at = COALESCE($7, received_at),
           refunded_at = COALESCE($8, refunded_at),
           cancelled_at = COALESCE($9, cancelled_at),
           refund_id = COALESCE($10, refund_id),
           refunded_amount = COALESCE($11, refunded_amount),
           updated_at = NOW()
       WHERE id = $1 AND store_id = $2
       RETURNING ${RETURN_REQUEST_COLUMNS}`,
      [
        params.returnRequestId,
        params.storeId,
        params.status,
        params.merchantNote ?? null,
        params.decidedAt ?? null,
        params.decidedByUserId ?? null,
        params.receivedAt ?? null,
        params.refundedAt ?? null,
        params.cancelledAt ?? null,
        params.refundId ?? null,
        params.refundedAmount ?? null,
      ],
    );
    return res.rows[0]!;
  }

  async listReturnRequests(
    client: Client,
    params: {
      storeId: string;
      status?: ReturnRequestStatus | null;
      orderId?: string | null;
      customerId?: string | null;
      limit: number;
      offset: number;
    },
  ): Promise<{
    rows: Array<ReturnRequestRow & { order_number?: string | null }>;
    total: number;
  }> {
    // Conditions are written against the `r` alias so the same predicates
    // serve both the count and the joined page query.
    const conditions: string[] = ["r.store_id = $1"];
    const values: unknown[] = [params.storeId];
    let idx = 2;

    if (params.status) {
      conditions.push(`r.status = $${idx++}`);
      values.push(params.status);
    }
    if (params.orderId) {
      conditions.push(`r.order_id = $${idx++}`);
      values.push(params.orderId);
    }
    if (params.customerId) {
      conditions.push(`r.customer_id = $${idx++}`);
      values.push(params.customerId);
    }

    const where = conditions.join(" AND ");

    const countRes = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM return_requests r WHERE ${where}`,
      values,
    );

    // `orders.order_number` is joined read-only purely as a display label for
    // the merchant queue — the same denormalisation NotificationOutboxService
    // performs for email metadata. Returns never writes to `orders`, and the
    // join is store-scoped on both sides so it cannot cross a tenant boundary.
    const rowsRes = await client.query<
      ReturnRequestRow & { order_number: string | null }
    >(
      `SELECT r.id, r.store_id, r.order_id, r.customer_id, r.return_number,
              r.status, r.reason, r.customer_note, r.merchant_note, r.currency,
              r.requested_amount, r.refunded_amount, r.refund_id, r.requested_at,
              r.decided_at, r.decided_by_user_id, r.received_at, r.refunded_at,
              r.cancelled_at, r.created_at, r.updated_at,
              o.order_number
       FROM return_requests r
       LEFT JOIN orders o ON o.id = r.order_id AND o.store_id = r.store_id
       WHERE ${where}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, params.limit, params.offset],
    );

    return {
      rows: rowsRes.rows,
      total: Number(countRes.rows[0]?.total ?? 0),
    };
  }

  /**
   * Batch variant of `findItemsByReturnRequestId` for list endpoints, so
   * rendering a queue of N returns costs one query rather than N.
   */
  async findItemsByReturnRequestIds(
    client: Client,
    storeId: string,
    returnRequestIds: string[],
  ): Promise<Map<string, ReturnRequestItemRow[]>> {
    const grouped = new Map<string, ReturnRequestItemRow[]>();
    if (returnRequestIds.length === 0) return grouped;

    const res = await client.query<ReturnRequestItemRow>(
      `SELECT * FROM return_request_items
       WHERE store_id = $1 AND return_request_id = ANY($2::uuid[])
       ORDER BY created_at ASC, id ASC`,
      [storeId, returnRequestIds],
    );
    for (const row of res.rows) {
      const bucket = grouped.get(row.return_request_id);
      if (bucket) {
        bucket.push(row);
      } else {
        grouped.set(row.return_request_id, [row]);
      }
    }
    return grouped;
  }

  /** Batch variant of `findEventsByReturnRequestId`. */
  async findEventsByReturnRequestIds(
    client: Client,
    storeId: string,
    returnRequestIds: string[],
  ): Promise<Map<string, ReturnRequestEventRow[]>> {
    const grouped = new Map<string, ReturnRequestEventRow[]>();
    if (returnRequestIds.length === 0) return grouped;

    const res = await client.query<ReturnRequestEventRow>(
      `SELECT * FROM return_request_events
       WHERE store_id = $1 AND return_request_id = ANY($2::uuid[])
       ORDER BY created_at ASC, id ASC`,
      [storeId, returnRequestIds],
    );
    for (const row of res.rows) {
      const bucket = grouped.get(row.return_request_id);
      if (bucket) {
        bucket.push(row);
      } else {
        grouped.set(row.return_request_id, [row]);
      }
    }
    return grouped;
  }

  async findPolicyByStoreId(
    client: Client,
    storeId: string,
  ): Promise<ReturnPolicyRow | null> {
    const res = await client.query<ReturnPolicyRow>(
      `SELECT id, store_id, is_returns_enabled, return_window_days, created_at, updated_at
       FROM return_policies
       WHERE store_id = $1`,
      [storeId],
    );
    return res.rows[0] ?? null;
  }

  async upsertPolicy(
    client: Client,
    data: {
      id: string;
      storeId: string;
      isReturnsEnabled?: boolean;
      returnWindowDays?: number;
    },
  ): Promise<ReturnPolicyRow> {
    const res = await client.query<ReturnPolicyRow>(
      `INSERT INTO return_policies (id, store_id, is_returns_enabled, return_window_days)
       VALUES ($1, $2, COALESCE($3, TRUE), COALESCE($4, 14))
       ON CONFLICT (store_id) DO UPDATE
         SET is_returns_enabled = COALESCE($3, return_policies.is_returns_enabled),
             return_window_days = COALESCE($4, return_policies.return_window_days),
             updated_at = NOW()
       RETURNING id, store_id, is_returns_enabled, return_window_days, created_at, updated_at`,
      [
        data.id,
        data.storeId,
        data.isReturnsEnabled ?? null,
        data.returnWindowDays ?? null,
      ],
    );
    return res.rows[0]!;
  }
}
