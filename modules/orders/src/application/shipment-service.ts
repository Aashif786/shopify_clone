import {
  generateUuidV7,
  type Database,
  type DatabaseClient,
} from "@calcart/db";
import { InvalidOrderStateError, OrderNotFoundError } from "../domain/order-errors.js";
import type { OrderDTO } from "./dtos.js";
import { OrderLifecycleCoordinator } from "./order-lifecycle-coordinator.js";
import { OrderService, runInTransaction } from "./order-service.js";

/**
 * Structural port onto a carrier. `orders` does not import `shipping`; the web
 * layer supplies `ManualCarrierProvider` (or, later, a provider that uses the
 * merchant's own credentials).
 */
export interface CarrierDispatchPort {
  dispatch(input: {
    carrierName: string;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    carrierStatus?: string | null;
  }): Promise<{
    providerCode: string;
    carrierName: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    carrierStatus: string | null;
  }>;
}

export type ShipmentStatus = "DISPATCHED" | "DELIVERED" | "DELIVERY_FAILED";

export interface ShipmentDTO {
  id: string;
  storeId: string;
  orderId: string;
  providerCode: string;
  status: ShipmentStatus;
  carrierName: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrierStatus: string | null;
  dispatchedAt: string;
  deliveredAt: string | null;
  failedAt: string | null;
}

export interface DispatchOrderInput {
  storeId: string;
  orderId: string;
  carrierName: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrierStatus?: string | null;
  actorType: "MERCHANT";
  actorId: string;
  reason?: string | null;
}

export interface DispatchOrderResult {
  shipment: ShipmentDTO;
  order: OrderDTO;
  /** False when this order was already dispatched and the existing shipment is returned. */
  created: boolean;
}

interface ShipmentRow {
  id: string;
  store_id: string;
  order_id: string;
  provider_code: string;
  status: ShipmentStatus;
  carrier_name: string;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier_status: string | null;
  dispatched_at: Date | string;
  delivered_at: Date | string | null;
  failed_at: Date | string | null;
}

function iso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toShipmentDTO(row: ShipmentRow): ShipmentDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    providerCode: row.provider_code,
    status: row.status,
    carrierName: row.carrier_name,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    carrierStatus: row.carrier_status,
    dispatchedAt: iso(row.dispatched_at) ?? new Date(0).toISOString(),
    deliveredAt: iso(row.delivered_at),
    failedAt: iso(row.failed_at),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

const SHIPMENT_COLUMNS = `
  id, store_id, order_id, provider_code, status, carrier_name,
  tracking_number, tracking_url, carrier_status,
  dispatched_at, delivered_at, failed_at
`;

/**
 * Opens the single shipment for an order and moves the order to SHIPPED.
 *
 * There is one shipment per order (no partial shipments). The carrier port
 * decides the tracking that is stored; the manual provider echoes what the
 * merchant typed. Stock reserved for the order is committed by the lifecycle
 * coordinator in the same transaction, because shipping sets fulfillment to
 * FULFILLED.
 */
export class ShipmentService {
  constructor(
    private readonly carrier: CarrierDispatchPort,
    private readonly lifecycle: OrderLifecycleCoordinator = new OrderLifecycleCoordinator(),
    private readonly orders: OrderService = new OrderService(),
  ) {}

  async findByOrder(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<ShipmentDTO | null> {
    const result = await clientOrDb.query<ShipmentRow>(
      `SELECT ${SHIPMENT_COLUMNS} FROM shipments WHERE store_id = $1 AND order_id = $2`,
      [storeId, orderId],
    );
    const row = result.rows[0];
    return row ? toShipmentDTO(row) : null;
  }

  async dispatch(
    clientOrDb: Database | DatabaseClient,
    input: DispatchOrderInput,
  ): Promise<DispatchOrderResult> {
    try {
      return await runInTransaction(clientOrDb, (tx) => this.dispatchInTransaction(tx, input));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // A concurrent dispatch inserted the row first and committed. Return that shipment.
      const shipment = await this.findByOrder(clientOrDb, input.storeId, input.orderId);
      const order = await this.orders.getOrderById(clientOrDb, input.storeId, input.orderId);
      if (!shipment || !order) throw error;
      return { shipment, order, created: false };
    }
  }

  private async dispatchInTransaction(
    tx: DatabaseClient,
    input: DispatchOrderInput,
  ): Promise<DispatchOrderResult> {
    const existing = await tx.query<ShipmentRow>(
      `SELECT ${SHIPMENT_COLUMNS}
         FROM shipments
        WHERE store_id = $1 AND order_id = $2
        FOR UPDATE`,
      [input.storeId, input.orderId],
    );
    const existingRow = existing.rows[0];
    if (existingRow) {
      const order = await this.orders.getOrderById(tx, input.storeId, input.orderId);
      if (!order) throw new OrderNotFoundError(input.orderId, input.storeId);
      return { shipment: toShipmentDTO(existingRow), order, created: false };
    }

    const current = await this.orders.getOrderById(tx, input.storeId, input.orderId);
    if (!current) throw new OrderNotFoundError(input.orderId, input.storeId);
    if (current.status !== "PROCESSING" && current.status !== "SHIPPED") {
      throw new InvalidOrderStateError(
        "An order can be dispatched only while it is being processed",
      );
    }

    const dispatched = await this.carrier.dispatch({
      carrierName: input.carrierName,
      trackingNumber: input.trackingNumber,
      trackingUrl: input.trackingUrl,
      carrierStatus: input.carrierStatus,
    });
    if (!dispatched.providerCode || !dispatched.carrierName) {
      throw new InvalidOrderStateError("The carrier did not return a shipment");
    }

    // Idempotent when the order is already SHIPPED. Locks the order row.
    await this.lifecycle.transition(tx, {
      storeId: input.storeId,
      orderId: input.orderId,
      toStatus: "SHIPPED",
      actorType: input.actorType,
      actorId: input.actorId,
      reason: input.reason?.trim() || `Dispatched with ${dispatched.carrierName}`,
    });

    await tx.query(
      `UPDATE orders
          SET tracking_carrier = $3,
              tracking_number = $4,
              tracking_url = $5,
              updated_at = NOW()
        WHERE id = $1 AND store_id = $2`,
      [
        input.orderId,
        input.storeId,
        dispatched.carrierName,
        dispatched.trackingNumber,
        dispatched.trackingUrl,
      ],
    );

    const inserted = await tx.query<ShipmentRow>(
      `INSERT INTO shipments (
         id, store_id, order_id, provider_code, status, carrier_name,
         tracking_number, tracking_url, carrier_status
       ) VALUES ($1, $2, $3, $4, 'DISPATCHED', $5, $6, $7, $8)
       RETURNING ${SHIPMENT_COLUMNS}`,
      [
        generateUuidV7(),
        input.storeId,
        input.orderId,
        dispatched.providerCode,
        dispatched.carrierName,
        dispatched.trackingNumber,
        dispatched.trackingUrl,
        dispatched.carrierStatus,
      ],
    );
    const insertedRow = inserted.rows[0];
    if (!insertedRow) {
      throw new InvalidOrderStateError("The shipment could not be recorded");
    }

    const order = await this.orders.getOrderById(tx, input.storeId, input.orderId);
    if (!order) throw new OrderNotFoundError(input.orderId, input.storeId);
    return { shipment: toShipmentDTO(insertedRow), order, created: true };
  }
}
