import type { Database, DatabaseClient } from "@calcart/db";
import { InvalidOrderStateError } from "../domain/order-errors.js";
import { isMerchantOrderStatusTarget } from "../domain/order-state.js";
import type {
  OrderDTO,
  TransitionOrderStatusInput,
  UpdateOrderFulfillmentStatusInput,
} from "./dtos.js";
import { OrderStatusService } from "./order-status-service.js";
import { runInTransaction } from "./order-service.js";

/**
 * Port to the inventory module. Defined here so `orders` never imports
 * `inventory`; the web layer supplies `ReservationReleaseService`, exactly as it
 * does for `InventoryReleaseCoordinator` on cancellation.
 */
export interface InventoryCommitCoordinator {
  commitOrderReservations(
    clientOrDb: Database | DatabaseClient,
    input: { storeId: string; orderId: string },
  ): Promise<{ committedCount: number; skippedCount: number }>;
}

/**
 * Merchant-driven order progress: dispatching an order and moving it along its
 * lifecycle.
 *
 * Whenever an order ends up FULFILLED the goods have left, so the stock reserved
 * for it is committed (consumed). The status change and the stock commit share
 * one transaction: an order is never shipped without its stock being consumed,
 * and a failed commit rolls the status change back.
 *
 * Cancellation is a separate workflow (`OrderCancellationCoordinator`).
 */
export class OrderLifecycleCoordinator {
  constructor(
    private readonly orderStatusService: OrderStatusService = new OrderStatusService(),
    private readonly inventoryCommitService?: InventoryCommitCoordinator,
  ) {}

  /** Records fulfillment (and tracking) and commits the order's stock once fulfilled. */
  async fulfill(
    clientOrDb: Database | DatabaseClient,
    input: UpdateOrderFulfillmentStatusInput,
  ): Promise<OrderDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const order = await this.orderStatusService.updateFulfillmentStatus(tx, input);
      await this.commitStockIfFulfilled(tx, order);
      return order;
    });
  }

  /**
   * Moves an order to a merchant-reachable status. The state machine still
   * decides whether the move is legal from the order's current status.
   */
  async transition(
    clientOrDb: Database | DatabaseClient,
    input: TransitionOrderStatusInput,
  ): Promise<OrderDTO> {
    if (!isMerchantOrderStatusTarget(input.toStatus)) {
      throw new InvalidOrderStateError(
        input.toStatus === "CANCELLED"
          ? "Orders are cancelled through the cancellation workflow, not a status change"
          : `Orders cannot be moved to '${input.toStatus}' with a status change`,
      );
    }

    return runInTransaction(clientOrDb, async (tx) => {
      const order = await this.orderStatusService.transitionStatus(tx, input);
      await this.commitStockIfFulfilled(tx, order);
      return order;
    });
  }

  private async commitStockIfFulfilled(tx: DatabaseClient, order: OrderDTO): Promise<void> {
    if (!this.inventoryCommitService || order.fulfillmentStatus !== "FULFILLED") {
      return;
    }
    await this.inventoryCommitService.commitOrderReservations(tx, {
      storeId: order.storeId,
      orderId: order.id,
    });
  }
}
