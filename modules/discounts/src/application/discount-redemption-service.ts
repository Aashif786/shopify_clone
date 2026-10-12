import type { DatabaseClient } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
import {
  DiscountRepository,
} from "../infrastructure/discount-repository.js";
import {
  DiscountNotFoundError,
  DiscountUsageLimitExceededError,
  DiscountExpiredError,
  DiscountInactiveError,
  CrossStoreDiscountAccessError,
} from "../domain/discount-errors.js";
import {
  toRedemptionDTO,
  type DiscountRedemptionDTO,
} from "./dtos.js";

export interface RecordRedemptionInput {
  discountId: string;
  storeId?: string;
  orderId?: string | null;
  checkoutId?: string | null;
  customerId?: string | null;
  amount?: number;
  amountCents?: number;
  currency?: string;
}

export interface RevertRedemptionInput {
  discountId: string;
  storeId: string;
  orderId: string;
}

export class DiscountRedemptionService {
  constructor(
    private readonly repository: DiscountRepository = new DiscountRepository(),
  ) {}

  async recordRedemption(
    clientOrDb: DatabaseClient,
    storeIdOrInput: string | RecordRedemptionInput,
    inputParam?: RecordRedemptionInput,
  ): Promise<DiscountRedemptionDTO> {
    let storeId: string;
    let input: RecordRedemptionInput;

    if (typeof storeIdOrInput === "string") {
      storeId = storeIdOrInput;
      input = inputParam ?? { discountId: "" };
    } else {
      input = storeIdOrInput;
      storeId = input.storeId ?? "";
    }

    const orderId = input.orderId ?? null;
    const checkoutId = input.checkoutId ?? null;
    const customerId = input.customerId ?? null;
    const amount = input.amount ?? input.amountCents ?? 0;
    const currency = (input.currency ?? "USD").toUpperCase().trim();

    // Cross-store isolation check: verify if discount exists across another store
    const checkRow = await clientOrDb.query<{ id: string; store_id: string }>(
      "SELECT id, store_id FROM discounts WHERE id = $1",
      [input.discountId],
    );
    if (checkRow.rows.length > 0 && checkRow.rows[0]?.store_id !== storeId) {
      throw new CrossStoreDiscountAccessError(
        `Discount '${input.discountId}' does not belong to store '${storeId}'`,
      );
    }

    // 1. Idempotency Guard: If already redeemed for this specific order, return existing
    if (orderId) {
      const existing = await this.repository.findRedemptionByOrder(
        clientOrDb,
        storeId,
        input.discountId,
        orderId,
      );
      if (existing) {
        return toRedemptionDTO(existing);
      }
    }

    // 2. Concurrency-safe atomic usage increment
    const updatedDiscount = await this.repository.atomicIncrementUsage(
      clientOrDb,
      storeId,
      input.discountId,
    );

    if (!updatedDiscount) {
      // Investigate why increment failed: not found vs usage limit vs expired
      const existing = await this.repository.findById(clientOrDb, storeId, input.discountId);
      if (!existing) {
        throw new DiscountNotFoundError(`Discount '${input.discountId}' not found for store '${storeId}'`);
      }
      if (existing.status !== "ACTIVE") {
        throw new DiscountInactiveError(`Discount '${input.discountId}' is not active`);
      }
      if (existing.isExpired()) {
        throw new DiscountExpiredError(`Discount '${input.discountId}' has expired`);
      }
      if (existing.usageLimit !== null && existing.usageCount >= existing.usageLimit) {
        throw new DiscountUsageLimitExceededError(
          `Discount '${input.discountId}' usage limit of ${existing.usageLimit} has been reached`,
        );
      }

      throw new DiscountUsageLimitExceededError(
        `Unable to redeem discount '${input.discountId}': eligibility or usage condition not met`,
      );
    }

    // 3. Persist audit redemption record
    const redemptionId = generateUuidV7();
    const redemption = await this.repository.createRedemption(clientOrDb, {
      id: redemptionId,
      discountId: input.discountId,
      storeId,
      orderId,
      checkoutId,
      customerId,
      amount,
      currency,
    });

    return toRedemptionDTO(redemption);
  }

  async revertRedemption(
    clientOrDb: DatabaseClient,
    storeIdOrInput: string | RevertRedemptionInput,
    discountIdParam?: string,
    orderIdParam?: string,
  ): Promise<boolean> {
    let storeId: string;
    let discountId: string;
    let orderId: string;

    if (typeof storeIdOrInput === "string") {
      storeId = storeIdOrInput;
      discountId = discountIdParam!;
      orderId = orderIdParam!;
    } else {
      storeId = storeIdOrInput.storeId;
      discountId = storeIdOrInput.discountId;
      orderId = storeIdOrInput.orderId;
    }

    const existing = await this.repository.findRedemptionByOrder(
      clientOrDb,
      storeId,
      discountId,
      orderId,
    );

    if (!existing) {
      return false;
    }

    // Delete redemption and decrement usage count
    await this.repository.deleteRedemptionByOrder(clientOrDb, storeId, discountId, orderId);
    await this.repository.atomicDecrementUsage(clientOrDb, storeId, discountId);
    return true;
  }
}
