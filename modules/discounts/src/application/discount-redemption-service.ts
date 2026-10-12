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
} from "../domain/discount-errors.js";
import {
  toRedemptionDTO,
  type DiscountRedemptionDTO,
} from "./dtos.js";

export interface RecordRedemptionInput {
  discountId: string;
  orderId?: string | null;
  checkoutId?: string | null;
  customerId?: string | null;
  amount: number;
  currency: string;
}

export class DiscountRedemptionService {
  constructor(
    private readonly repository: DiscountRepository = new DiscountRepository(),
  ) {}

  async recordRedemption(
    clientOrDb: DatabaseClient,
    storeId: string,
    input: RecordRedemptionInput,
  ): Promise<DiscountRedemptionDTO> {
    // 1. Idempotency Guard: If already redeemed for this specific order, return existing
    if (input.orderId) {
      const existing = await this.repository.findRedemptionByOrder(
        clientOrDb,
        storeId,
        input.discountId,
        input.orderId,
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
      orderId: input.orderId,
      checkoutId: input.checkoutId,
      customerId: input.customerId,
      amount: input.amount,
      currency: input.currency.toUpperCase().trim(),
    });

    return toRedemptionDTO(redemption);
  }

  async revertRedemption(
    clientOrDb: DatabaseClient,
    storeId: string,
    discountId: string,
    orderId: string,
  ): Promise<boolean> {
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
