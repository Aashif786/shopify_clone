import {
  generateUuidV7,
  NotificationOutboxRepository,
  type Database,
  type DatabaseClient,
  type ReturnRequestRow,
} from "@calcart/db";
import { OrderService, type OrderDTO, type OrderItemDTO } from "@calcart/orders";
import type { RefundService } from "@calcart/payments";
import type { PaymentProvider } from "@calcart/payments";
import { GiftCardService } from "@calcart/giftcards";
import { globalEventBus } from "@calcart/event-bus";
import {
  CrossStoreReturnAccessError,
  InvalidReturnItemsError,
  InvalidReturnStatusTransitionError,
  OrderNotEligibleForReturnError,
  ReturnAlreadyOpenError,
  ReturnQuantityExceededError,
  ReturnRequestNotFoundError,
  ReturnWindowExpiredError,
  ReturnsDisabledError,
} from "../domain/return-errors.js";
import {
  assertValidReturnStatusTransition,
  canCustomerCancelReturn,
  canRefundReturn,
  type ReturnRequestActorType,
  type ReturnRequestStatus,
} from "../domain/return-state.js";
import {
  assertValidReturnWindowDays,
  computeLineRefundAmount,
  computeUnitRefundAmount,
  defaultReturnPolicy,
  evaluateReturnEligibility,
  type ReturnPolicy,
} from "../domain/return-policy.js";
import {
  mapReturnPolicyRow,
  mapReturnRequestEventRow,
  mapReturnRequestItemRow,
  mapReturnRequestRow,
  ReturnRepository,
} from "../infrastructure/return-repository.js";
import type {
  CancelReturnRequestInput,
  CreateReturnRequestInput,
  DecideReturnRequestInput,
  ListReturnRequestsInput,
  ListReturnRequestsResult,
  MarkReturnReceivedInput,
  ReturnEligibilityDTO,
  ReturnEligibleItemDTO,
  ReturnPolicyDTO,
  ReturnRequestDTO,
} from "./dtos.js";
import { toReturnEligibilityDTO } from "./dtos.js";

function isDatabase(client: Database | DatabaseClient): client is Database {
  return typeof (client as Database).withTransaction === "function";
}

async function runInTransaction<T>(
  clientOrDb: Database | DatabaseClient,
  fn: (tx: DatabaseClient) => Promise<T>,
): Promise<T> {
  if (isDatabase(clientOrDb)) {
    return clientOrDb.withTransaction(fn);
  }
  return fn(clientOrDb);
}

export function generateReturnNumber(): string {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `RET-${timestampPart}-${randomPart}`;
}

/**
 * Deterministic idempotency key for a return's refund.
 *
 * Derived purely from the return request id, so a retried or concurrent
 * "issue refund" call replays the original refund through the payments
 * idempotency layer instead of charging the merchant twice.
 */
export function returnRefundIdempotencyKey(returnRequestId: string): string {
  return `return-refund:${returnRequestId}`;
}

export type ReturnRefundMethod = "ORIGINAL_PAYMENT" | "STORE_CREDIT";

export interface RefundReturnRequestInput {
  storeId: string;
  returnRequestId: string;
  actorId?: string | null;
  /** Supplied by the API layer, exactly as the merchant refund route does. */
  provider?: PaymentProvider;
  refundMethod?: ReturnRefundMethod;
}

export interface RefundReturnRequestResult {
  returnRequest: ReturnRequestDTO;
  refundStatus: string;
  refundId: string | null;
  error?: string;
}

export interface InventoryRestockPort {
  adjustStock(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    variantId: string,
    input: {
      quantityDelta: number;
      reason: string;
      referenceType?: string | null;
      referenceId?: string | null;
      createdBy?: string | null;
    },
  ): Promise<unknown>;
}

export class ReturnService {
  constructor(
    private readonly returnRepo: ReturnRepository = new ReturnRepository(),
    private readonly orderService: OrderService = new OrderService(),
    private readonly outboxRepo: NotificationOutboxRepository = new NotificationOutboxRepository(),
    private readonly inventoryService?: InventoryRestockPort,
  ) {}

  // -------------------------------------------------------------------------
  // Policy
  // -------------------------------------------------------------------------

  async getReturnPolicy(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
  ): Promise<ReturnPolicyDTO> {
    const row = await this.returnRepo.findPolicyByStoreId(clientOrDb, storeId);
    if (!row) {
      const fallback = defaultReturnPolicy(storeId);
      return {
        storeId,
        isReturnsEnabled: fallback.isReturnsEnabled,
        returnWindowDays: fallback.returnWindowDays,
        isDefault: true,
      };
    }
    return mapReturnPolicyRow(row);
  }

  async updateReturnPolicy(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    input: { isReturnsEnabled?: boolean; returnWindowDays?: number },
  ): Promise<ReturnPolicyDTO> {
    if (input.returnWindowDays !== undefined) {
      assertValidReturnWindowDays(input.returnWindowDays);
    }
    const row = await this.returnRepo.upsertPolicy(clientOrDb, {
      id: generateUuidV7(),
      storeId,
      isReturnsEnabled: input.isReturnsEnabled,
      returnWindowDays: input.returnWindowDays,
    });
    return mapReturnPolicyRow(row);
  }

  private async resolvePolicy(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
  ): Promise<ReturnPolicy> {
    const dto = await this.getReturnPolicy(clientOrDb, storeId);
    return {
      storeId,
      isReturnsEnabled: dto.isReturnsEnabled,
      returnWindowDays: dto.returnWindowDays,
    };
  }

  // -------------------------------------------------------------------------
  // Eligibility
  // -------------------------------------------------------------------------

  /**
   * Evaluates whether `order` can be returned and which lines still have
   * returnable quantity. The caller is responsible for having already
   * authorized the requester against this order.
   */
  async getOrderReturnEligibility(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    order: OrderDTO,
    now: Date = new Date(),
  ): Promise<ReturnEligibilityDTO> {
    const policy = await this.resolvePolicy(clientOrDb, storeId);
    const eligibility = evaluateReturnEligibility(order, policy, now);

    const open = await this.returnRepo.findOpenByOrderId(
      clientOrDb,
      storeId,
      order.id,
    );

    const claimed = await this.returnRepo.sumClaimedQuantitiesByOrder(
      clientOrDb,
      storeId,
      order.id,
    );

    const eligibleItems: ReturnEligibleItemDTO[] = (order.items ?? []).map(
      (item) => {
        const alreadyClaimed = claimed.get(item.id) ?? 0;
        return {
          orderItemId: item.id,
          productNameSnapshot: item.productNameSnapshot,
          variantNameSnapshot: item.variantNameSnapshot ?? null,
          skuSnapshot: item.skuSnapshot ?? null,
          purchasedQuantity: item.quantity,
          returnableQuantity: Math.max(0, item.quantity - alreadyClaimed),
          unitRefundAmount: computeUnitRefundAmount(item),
        };
      },
    );

    return toReturnEligibilityDTO(
      order.id,
      eligibility,
      policy.returnWindowDays,
      eligibleItems,
      open?.id ?? null,
    );
  }

  // -------------------------------------------------------------------------
  // Customer: create / cancel
  // -------------------------------------------------------------------------

  /**
   * Opens a return request. Eligibility, per-line quantities, and refund
   * amounts are all recomputed server-side from the persisted order; the
   * client supplies only which lines and how many units.
   */
  async createReturnRequest(
    clientOrDb: Database | DatabaseClient,
    input: CreateReturnRequestInput,
    now: Date = new Date(),
  ): Promise<ReturnRequestDTO> {
    const { storeId, orderId } = input;

    const reason = input.reason?.trim() ?? "";
    if (reason.length === 0 || reason.length > 500) {
      throw new InvalidReturnItemsError(
        "A return reason of 1 to 500 characters is required",
      );
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new InvalidReturnItemsError(
        "At least one order line item must be selected for return",
      );
    }

    const order = await this.orderService.getOrderById(
      clientOrDb,
      storeId,
      orderId,
    );
    if (!order) {
      throw new OrderNotEligibleForReturnError(
        `Order '${orderId}' not found in store '${storeId}'`,
      );
    }

    const policy = await this.resolvePolicy(clientOrDb, storeId);
    if (!policy.isReturnsEnabled) {
      throw new ReturnsDisabledError();
    }

    const eligibility = evaluateReturnEligibility(order, policy, now);
    if (!eligibility.isEligible) {
      if (eligibility.reason === "RETURN_WINDOW_EXPIRED") {
        throw new ReturnWindowExpiredError(
          `The ${policy.returnWindowDays}-day return window for this order has expired`,
        );
      }
      throw new OrderNotEligibleForReturnError(
        `Order is not eligible for return (${eligibility.reason})`,
      );
    }

    try {
      return await this.insertReturnRequest(clientOrDb, input, order, reason);
    } catch (err: unknown) {
      // Two concurrent requests can both pass the in-transaction check and
      // race to the partial unique index. Translate that collision into the
      // same domain error the sequential path raises, rather than leaking a
      // raw constraint violation as a 500.
      const pgErr = err as { code?: string; constraint?: string };
      if (
        pgErr.code === "23505" &&
        pgErr.constraint?.includes("one_open_per_order")
      ) {
        throw new ReturnAlreadyOpenError(
          "A return request is already open for this order",
        );
      }
      throw err;
    }
  }

  private async insertReturnRequest(
    clientOrDb: Database | DatabaseClient,
    input: CreateReturnRequestInput,
    order: OrderDTO,
    reason: string,
  ): Promise<ReturnRequestDTO> {
    const { storeId, orderId } = input;

    return runInTransaction(clientOrDb, async (tx) => {
      // Re-check inside the transaction; the partial unique index is the
      // ultimate guard, but this yields a clean domain error.
      const open = await this.returnRepo.findOpenByOrderId(tx, storeId, orderId);
      if (open) {
        throw new ReturnAlreadyOpenError(
          `Return request '${open.return_number}' is already open for this order`,
        );
      }

      const claimed = await this.returnRepo.sumClaimedQuantitiesByOrder(
        tx,
        storeId,
        orderId,
      );

      const itemsById = new Map<string, OrderItemDTO>();
      for (const item of order.items ?? []) {
        itemsById.set(item.id, item);
      }

      const seen = new Set<string>();
      let requestedAmount = 0;
      const resolvedItems: Array<{
        orderItem: OrderItemDTO;
        quantity: number;
        lineRefundAmount: number;
      }> = [];

      for (const requested of input.items) {
        const orderItem = itemsById.get(requested.orderItemId);
        if (!orderItem) {
          throw new InvalidReturnItemsError(
            `Order item '${requested.orderItemId}' does not belong to order '${orderId}'`,
          );
        }
        if (seen.has(requested.orderItemId)) {
          throw new InvalidReturnItemsError(
            `Order item '${requested.orderItemId}' was listed more than once`,
          );
        }
        seen.add(requested.orderItemId);

        if (
          !Number.isInteger(requested.quantity) ||
          requested.quantity <= 0
        ) {
          throw new InvalidReturnItemsError(
            `Return quantity for order item '${requested.orderItemId}' must be a positive integer`,
          );
        }

        const alreadyClaimed = claimed.get(orderItem.id) ?? 0;
        const returnable = orderItem.quantity - alreadyClaimed;
        if (requested.quantity > returnable) {
          throw new ReturnQuantityExceededError(
            `Cannot return ${requested.quantity} of '${orderItem.productNameSnapshot}': only ${Math.max(0, returnable)} remain returnable`,
          );
        }

        const lineRefundAmount = computeLineRefundAmount(
          orderItem,
          requested.quantity,
        );
        requestedAmount += lineRefundAmount;
        resolvedItems.push({
          orderItem,
          quantity: requested.quantity,
          lineRefundAmount,
        });
      }

      const returnRequestId = generateUuidV7();
      const row = await this.returnRepo.insertReturnRequest(tx, {
        id: returnRequestId,
        storeId,
        orderId,
        customerId: input.customerId ?? order.customerId ?? null,
        returnNumber: generateReturnNumber(),
        reason,
        customerNote: input.customerNote?.trim() || null,
        currency: order.currency,
        requestedAmount,
      });

      for (const resolved of resolvedItems) {
        await this.returnRepo.insertReturnRequestItem(tx, {
          id: generateUuidV7(),
          returnRequestId,
          storeId,
          orderItemId: resolved.orderItem.id,
          quantity: resolved.quantity,
          unitPriceSnapshot: resolved.orderItem.unitPrice,
          lineRefundAmount: resolved.lineRefundAmount,
          productNameSnapshot: resolved.orderItem.productNameSnapshot,
          variantNameSnapshot: resolved.orderItem.variantNameSnapshot ?? null,
          skuSnapshot: resolved.orderItem.skuSnapshot ?? null,
        });
      }

      await this.returnRepo.insertReturnRequestEvent(tx, {
        id: generateUuidV7(),
        returnRequestId,
        storeId,
        fromStatus: null,
        toStatus: "REQUESTED",
        actorType: input.actorType ?? "CUSTOMER",
        actorId: input.actorId ?? null,
        reason,
      });

      await this.queueReturnNotification(tx, {
        notificationType: "RETURN_REQUESTED",
        storeId,
        returnRequest: row,
        orderNumber: order.orderNumber,
      });

      return this.hydrate(tx, storeId, row, order.orderNumber);
    });
  }

  /** Customer withdraws a return request before the merchant decides. */
  async cancelReturnRequest(
    clientOrDb: Database | DatabaseClient,
    input: CancelReturnRequestInput,
  ): Promise<ReturnRequestDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const current = await this.loadForUpdate(
        tx,
        input.storeId,
        input.returnRequestId,
      );

      if (current.status === "CANCELLED") {
        return this.hydrate(tx, input.storeId, current);
      }

      // A merchant decision has already been made, so the customer can no
      // longer withdraw the request.
      if (!canCustomerCancelReturn(current.status)) {
        throw new InvalidReturnStatusTransitionError(current.status, "CANCELLED");
      }

      assertValidReturnStatusTransition(current.status, "CANCELLED");

      const updated = await this.returnRepo.updateStatus(tx, {
        storeId: input.storeId,
        returnRequestId: input.returnRequestId,
        status: "CANCELLED",
        cancelledAt: new Date(),
      });

      await this.returnRepo.insertReturnRequestEvent(tx, {
        id: generateUuidV7(),
        returnRequestId: input.returnRequestId,
        storeId: input.storeId,
        fromStatus: current.status,
        toStatus: "CANCELLED",
        actorType: "CUSTOMER",
        actorId: input.actorId ?? null,
        reason: input.reason?.trim() || "Withdrawn by customer",
      });

      return this.hydrate(tx, input.storeId, updated);
    });
  }

  // -------------------------------------------------------------------------
  // Merchant: approve / reject / receive / refund
  // -------------------------------------------------------------------------

  async approveReturnRequest(
    clientOrDb: Database | DatabaseClient,
    input: DecideReturnRequestInput,
  ): Promise<ReturnRequestDTO> {
    return this.transition(clientOrDb, {
      ...input,
      toStatus: "APPROVED",
      actorType: "MERCHANT",
      notificationType: "RETURN_APPROVED",
      stamp: { decidedAt: new Date(), decidedByUserId: input.actorId ?? null },
      defaultReason: "Return approved by merchant",
    });
  }

  async rejectReturnRequest(
    clientOrDb: Database | DatabaseClient,
    input: DecideReturnRequestInput,
  ): Promise<ReturnRequestDTO> {
    return this.transition(clientOrDb, {
      ...input,
      toStatus: "REJECTED",
      actorType: "MERCHANT",
      notificationType: "RETURN_REJECTED",
      stamp: { decidedAt: new Date(), decidedByUserId: input.actorId ?? null },
      defaultReason: "Return rejected by merchant",
    });
  }

  /** Merchant confirms the goods are physically back. */
  async markReturnReceived(
    clientOrDb: Database | DatabaseClient,
    input: MarkReturnReceivedInput,
  ): Promise<ReturnRequestDTO> {
    return this.transition(clientOrDb, {
      ...input,
      toStatus: "RECEIVED",
      actorType: "MERCHANT",
      notificationType: null,
      stamp: { receivedAt: new Date() },
      defaultReason: "Returned goods received by merchant",
      restockItems: input.restockItems,
    });
  }

  /**
   * Issues the refund for a received return and closes it out.
   *
   * The refund is dispatched through `RefundService.executeMerchantRefund`,
   * which owns idempotency, provider dispatch, order payment-status updates and
   * the REFUND_CONFIRMATION email. It is deliberately called *outside* a
   * transaction of ours: it talks to an external payment provider, and rolling
   * back around a completed provider refund would erase the record of money
   * that actually moved.
   *
   * Ordering is therefore refund-then-record. If recording fails, the return
   * stays RECEIVED and re-running replays the same refund via the deterministic
   * idempotency key, so the merchant is never charged twice and the system
   * never claims a refund that did not happen.
   */
  async refundReturnRequest(
    clientOrDb: Database | DatabaseClient,
    refundService: RefundService,
    input: RefundReturnRequestInput,
    giftCardService: GiftCardService = new GiftCardService(),
  ): Promise<RefundReturnRequestResult> {
    const { storeId, returnRequestId } = input;

    const current = await this.returnRepo.findById(
      clientOrDb,
      storeId,
      returnRequestId,
    );
    if (!current) {
      await this.assertNotCrossStore(clientOrDb, storeId, returnRequestId);
      throw new ReturnRequestNotFoundError(
        `Return request '${returnRequestId}' not found in store '${storeId}'`,
      );
    }

    if (current.status === "REFUNDED") {
      // Already closed out; return the existing state rather than re-refunding.
      return {
        returnRequest: await this.hydrate(clientOrDb, storeId, current),
        refundStatus: "SUCCEEDED",
        refundId: current.refund_id ?? null,
      };
    }

    // A refund may only follow physical receipt of the goods.
    if (!canRefundReturn(current.status)) {
      throw new InvalidReturnStatusTransitionError(current.status, "REFUNDED");
    }

    const amount = Number(current.requested_amount);

    if (input.refundMethod === "STORE_CREDIT") {
      if (!current.customer_id) {
        throw new TypeError(
          "Cannot issue store credit for a return request without an associated customer account",
        );
      }

      const { closed } = await runInTransaction(
        clientOrDb,
        async (tx) => {
          const locked = await this.returnRepo.findByIdForUpdate(
            tx,
            storeId,
            returnRequestId,
          );
          if (!locked) {
            throw new ReturnRequestNotFoundError(
              `Return request '${returnRequestId}' not found in store '${storeId}'`,
            );
          }
          if (locked.status === "REFUNDED") {
            return { closed: locked };
          }

          // Atomically issue store credit inside the transaction
          const creditResult = await giftCardService.issueStoreCredit(
            tx,
            storeId,
            current.customer_id!,
            {
              amount,
              currency: current.currency,
              orderId: current.order_id,
              idempotencyKey: `return-store-credit:${returnRequestId}`,
              notes: `Store credit issued for return ${locked.return_number}`,
            },
          );

          const updated = await this.returnRepo.updateStatus(tx, {
            storeId,
            returnRequestId,
            status: "REFUNDED",
            refundedAt: new Date(),
            // Deliberately no refundId: `return_requests.refund_id` references `refunds`, and a
            // store-credit ledger row is not a refund. The credit is linked via its ledger
            // idempotency key `return-store-credit:<returnRequestId>` instead.
            refundedAmount: amount,
          });

          await this.returnRepo.insertReturnRequestEvent(tx, {
            id: generateUuidV7(),
            returnRequestId,
            storeId,
            fromStatus: locked.status,
            toStatus: "REFUNDED",
            actorType: "MERCHANT",
            actorId: input.actorId ?? null,
            reason: `Store credit ${creditResult.storeCredit.id} issued for return ${locked.return_number}`.trim(),
          });

          return { closed: updated };
        },
      );

      return {
        returnRequest: await this.hydrate(clientOrDb, storeId, closed),
        refundStatus: "SUCCEEDED",
        refundId: null,
      };
    }

    const result = await refundService.executeMerchantRefund(clientOrDb, {
      storeId,
      orderId: current.order_id,
      amount: amount > 0 ? amount : undefined,
      reason: `Return ${current.return_number}: ${current.reason}`,
      idempotencyKey: returnRefundIdempotencyKey(returnRequestId),
      actorType: "MERCHANT",
      actorId: input.actorId ?? undefined,
      provider: input.provider,
    });

    if (result.status !== "SUCCEEDED") {
      // Leave the return in RECEIVED so the merchant can retry.
      return {
        returnRequest: await this.hydrate(clientOrDb, storeId, current),
        refundStatus: result.status,
        refundId: result.refund?.id ?? null,
        error: result.error,
      };
    }

    const closed = await runInTransaction(clientOrDb, async (tx) => {
      const locked = await this.returnRepo.findByIdForUpdate(
        tx,
        storeId,
        returnRequestId,
      );
      if (!locked) {
        throw new ReturnRequestNotFoundError(
          `Return request '${returnRequestId}' not found in store '${storeId}'`,
        );
      }
      if (locked.status === "REFUNDED") {
        return locked;
      }

      const updated = await this.returnRepo.updateStatus(tx, {
        storeId,
        returnRequestId,
        status: "REFUNDED",
        refundedAt: new Date(),
        refundId: result.refund?.id ?? null,
        refundedAmount: Number(result.refund?.amount ?? amount),
      });

      await this.returnRepo.insertReturnRequestEvent(tx, {
        id: generateUuidV7(),
        returnRequestId,
        storeId,
        fromStatus: locked.status,
        toStatus: "REFUNDED",
        actorType: "MERCHANT",
        actorId: input.actorId ?? null,
        reason: `Refund ${result.refund?.id ?? ""} issued for return ${locked.return_number}`.trim(),
      });

      return updated;
    });

    return {
      returnRequest: await this.hydrate(clientOrDb, storeId, closed),
      refundStatus: result.status,
      refundId: result.refund?.id ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async getReturnRequest(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    returnRequestId: string,
  ): Promise<ReturnRequestDTO | null> {
    const row = await this.returnRepo.findById(
      clientOrDb,
      storeId,
      returnRequestId,
    );
    if (!row) return null;
    return this.hydrate(clientOrDb, storeId, row);
  }

  async listReturnRequests(
    clientOrDb: Database | DatabaseClient,
    input: ListReturnRequestsInput,
  ): Promise<ListReturnRequestsResult> {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);

    const { rows, total } = await this.returnRepo.listReturnRequests(
      clientOrDb,
      {
        storeId: input.storeId,
        status: input.status ?? null,
        orderId: input.orderId ?? null,
        customerId: input.customerId ?? null,
        limit,
        offset,
      },
    );

    // Batch-load children so a queue of N returns costs two extra queries
    // rather than 2N.
    const ids = rows.map((row) => row.id);
    const [itemsById, eventsById] = await Promise.all([
      this.returnRepo.findItemsByReturnRequestIds(
        clientOrDb,
        input.storeId,
        ids,
      ),
      this.returnRepo.findEventsByReturnRequestIds(
        clientOrDb,
        input.storeId,
        ids,
      ),
    ]);

    const returns: ReturnRequestDTO[] = rows.map((row) => ({
      ...mapReturnRequestRow(row),
      orderNumber: row.order_number ?? null,
      items: (itemsById.get(row.id) ?? []).map(mapReturnRequestItemRow),
      events: (eventsById.get(row.id) ?? []).map(mapReturnRequestEventRow),
    }));

    return { returns, total, limit, offset };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async transition(
    clientOrDb: Database | DatabaseClient,
    params: {
      storeId: string;
      returnRequestId: string;
      toStatus: ReturnRequestStatus;
      actorType: ReturnRequestActorType;
      actorId?: string | null;
      merchantNote?: string | null;
      notificationType:
        | "RETURN_REQUESTED"
        | "RETURN_APPROVED"
        | "RETURN_REJECTED"
        | null;
      stamp: {
        decidedAt?: Date;
        decidedByUserId?: string | null;
        receivedAt?: Date;
      };
      defaultReason: string;
      restockItems?: boolean;
    },
  ): Promise<ReturnRequestDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const current = await this.loadForUpdate(
        tx,
        params.storeId,
        params.returnRequestId,
      );

      assertValidReturnStatusTransition(current.status, params.toStatus);

      if (current.status === params.toStatus) {
        return this.hydrate(tx, params.storeId, current);
      }

      const updated = await this.returnRepo.updateStatus(tx, {
        storeId: params.storeId,
        returnRequestId: params.returnRequestId,
        status: params.toStatus,
        merchantNote: params.merchantNote?.trim() || null,
        decidedAt: params.stamp.decidedAt ?? null,
        decidedByUserId: params.stamp.decidedByUserId ?? null,
        receivedAt: params.stamp.receivedAt ?? null,
      });

      // Restock returned items to warehouse inventory upon physical receipt
      if (
        params.toStatus === "RECEIVED" &&
        this.inventoryService &&
        params.restockItems !== false
      ) {
        const returnItems = await this.returnRepo.findItemsByReturnRequestId(
          tx,
          params.storeId,
          params.returnRequestId,
        );
        for (const item of returnItems) {
          const orderItemRes = await tx.query<{ variant_id: string | null }>(
            `SELECT variant_id FROM order_items WHERE id = $1 AND store_id = $2`,
            [item.order_item_id, params.storeId],
          );
          const variantId = orderItemRes.rows[0]?.variant_id;
          if (variantId) {
            await this.inventoryService.adjustStock(
              tx,
              params.storeId,
              variantId,
              {
                quantityDelta: item.quantity,
                reason: `Restocked from return request ${params.returnRequestId}`,
                referenceType: "return",
                referenceId: item.id,
                createdBy: params.actorId ?? null,
              },
            );
          }
        }
      }

      await this.returnRepo.insertReturnRequestEvent(tx, {
        id: generateUuidV7(),
        returnRequestId: params.returnRequestId,
        storeId: params.storeId,
        fromStatus: current.status,
        toStatus: params.toStatus,
        actorType: params.actorType,
        actorId: params.actorId ?? null,
        reason: params.merchantNote?.trim() || params.defaultReason,
      });

      if (params.toStatus === "RECEIVED") {
        void globalEventBus.publish({
          eventId: generateUuidV7(),
          eventType: "return.received",
          occurredAt: new Date(),
          payload: {
            storeId: params.storeId,
            returnId: params.returnRequestId,
            orderId: current.order_id,
            restocked: params.restockItems !== false,
          },
        });
      }

      if (params.notificationType) {
        await this.queueReturnNotification(tx, {
          notificationType: params.notificationType,
          storeId: params.storeId,
          returnRequest: updated,
        });
      }

      return this.hydrate(tx, params.storeId, updated);
    });
  }

  private async loadForUpdate(
    tx: DatabaseClient,
    storeId: string,
    returnRequestId: string,
  ): Promise<ReturnRequestRow> {
    const current = await this.returnRepo.findByIdForUpdate(
      tx,
      storeId,
      returnRequestId,
    );
    if (!current) {
      await this.assertNotCrossStore(tx, storeId, returnRequestId);
      throw new ReturnRequestNotFoundError(
        `Return request '${returnRequestId}' not found in store '${storeId}'`,
      );
    }
    return current;
  }

  private async assertNotCrossStore(
    client: Database | DatabaseClient,
    storeId: string,
    returnRequestId: string,
  ): Promise<void> {
    const ownerStoreId = await this.returnRepo.findStoreIdById(
      client,
      returnRequestId,
    );
    if (ownerStoreId && ownerStoreId !== storeId) {
      throw new CrossStoreReturnAccessError(
        `Return request '${returnRequestId}' does not belong to store '${storeId}'`,
      );
    }
  }

  private async hydrate(
    client: Database | DatabaseClient,
    storeId: string,
    row: ReturnRequestRow,
    orderNumber?: string | null,
  ): Promise<ReturnRequestDTO> {
    const [items, events] = await Promise.all([
      this.returnRepo.findItemsByReturnRequestId(client, storeId, row.id),
      this.returnRepo.findEventsByReturnRequestId(client, storeId, row.id),
    ]);

    return {
      ...mapReturnRequestRow(row),
      orderNumber: orderNumber ?? null,
      items: items.map(mapReturnRequestItemRow),
      events: events.map(mapReturnRequestEventRow),
    };
  }

  /**
   * Enqueues a return lifecycle email on the shared notification outbox.
   * Fail-open: a notification problem must never roll back the return
   * transition itself, matching `NotificationOutboxService` in `modules/orders`.
   */
  private async queueReturnNotification(
    client: Database | DatabaseClient,
    params: {
      notificationType:
        | "RETURN_REQUESTED"
        | "RETURN_APPROVED"
        | "RETURN_REJECTED";
      storeId: string;
      returnRequest: ReturnRequestRow;
      orderNumber?: string | null;
    },
  ): Promise<void> {
    try {
      const { returnRequest } = params;
      const meta = await this.fetchNotificationMeta(
        client,
        params.storeId,
        returnRequest.order_id,
      );

      // Merchant-facing alerts go to the store contact; customer-facing
      // lifecycle mail goes to the buyer.
      const recipientEmail =
        params.notificationType === "RETURN_REQUESTED"
          ? meta.storeContactEmail
          : meta.customerEmail;

      await this.outboxRepo.create(client, {
        id: generateUuidV7(),
        storeId: params.storeId,
        notificationType: params.notificationType,
        recipientEmail: recipientEmail ?? null,
        referenceType: "return_request",
        referenceId: returnRequest.id,
        idempotencyKey: `${params.notificationType.toLowerCase()}:${returnRequest.id}`,
        payload: {
          storeId: params.storeId,
          storeName: meta.storeName,
          storeSlug: meta.storeSlug,
          returnRequestId: returnRequest.id,
          returnNumber: returnRequest.return_number,
          orderId: returnRequest.order_id,
          orderNumber: params.orderNumber ?? meta.orderNumber,
          status: returnRequest.status,
          reason: returnRequest.reason,
          merchantNote: returnRequest.merchant_note,
          currency: returnRequest.currency,
          requestedAmount: Number(returnRequest.requested_amount),
          recipientEmail,
          recipientName: meta.customerName,
        },
      });
    } catch (err) {
      console.error(
        `[ReturnService] Failed to queue ${params.notificationType} for return ${params.returnRequest.id}:`,
        err,
      );
    }
  }

  private async fetchNotificationMeta(
    client: Database | DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<{
    storeName: string;
    storeSlug: string;
    storeContactEmail: string | null;
    orderNumber: string | null;
    customerEmail: string | null;
    customerName: string | null;
  }> {
    const res = await client.query<{
      store_name: string;
      store_slug: string;
      contact_email: string | null;
      order_number: string | null;
      customer_email: string | null;
      customer_first_name: string | null;
      customer_last_name: string | null;
    }>(
      `SELECT s.name  AS store_name,
              s.slug  AS store_slug,
              ss.contact_email,
              o.order_number,
              c.email AS customer_email,
              c.first_name AS customer_first_name,
              c.last_name  AS customer_last_name
       FROM stores s
       LEFT JOIN store_settings ss ON ss.store_id = s.id
       LEFT JOIN orders o ON o.id = $2 AND o.store_id = s.id
       LEFT JOIN customers c ON c.id = o.customer_id AND c.store_id = s.id
       WHERE s.id = $1`,
      [storeId, orderId],
    );

    const row = res.rows[0];
    const name = [row?.customer_first_name, row?.customer_last_name]
      .filter((part) => part && part.trim().length > 0)
      .join(" ");

    return {
      storeName: row?.store_name ?? "Store",
      storeSlug: row?.store_slug ?? "",
      storeContactEmail: row?.contact_email ?? null,
      orderNumber: row?.order_number ?? null,
      customerEmail: row?.customer_email ?? null,
      customerName: name.length > 0 ? name : null,
    };
  }
}
