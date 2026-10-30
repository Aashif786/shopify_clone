import type { DatabaseClient } from "@calcart/db";
import { Discount } from "../domain/discount.js";
import {
  DiscountRepository,
} from "../infrastructure/discount-repository.js";
import {
  DiscountAlreadyExistsError,
  DiscountNotFoundError,
} from "../domain/discount-errors.js";
import {
  normalizeDiscountCode,
  evaluateDiscountPolicy,
  type DiscountValidationResult,
  type DiscountEvaluationItem,
} from "../domain/discount-policy.js";
import {
  toDiscountDTO,
  type CreateDiscountDTO,
  type UpdateDiscountDTO,
  type DiscountDTO,
} from "./dtos.js";

export class DiscountService {
  constructor(
    private readonly repository: DiscountRepository = new DiscountRepository(),
  ) {}

  async createDiscount(
    clientOrDb: DatabaseClient,
    storeId: string,
    input: CreateDiscountDTO,
  ): Promise<DiscountDTO> {
    const normalizedCode = normalizeDiscountCode(input.code);

    // Enforce store-scoped code uniqueness
    const existing = await this.repository.findByCode(
      clientOrDb,
      storeId,
      normalizedCode,
    );
    if (existing) {
      throw new DiscountAlreadyExistsError(
        `Discount code '${normalizedCode}' already exists for store '${storeId}'`,
      );
    }

    const discount = Discount.create({
      id: input.id,
      storeId,
      code: normalizedCode,
      name: input.name,
      description: input.description,
      type: input.type,
      value: input.value,
      currency: input.currency,
      status: input.status,
      minimumSubtotal: input.minimumSubtotal,
      maxDiscountAmount: input.maxDiscountAmount,
      usageLimit: input.usageLimit,
      appliesToFirstTimeCustomer: input.appliesToFirstTimeCustomer,
      eligibleProductIds: input.eligibleProductIds,
      eligibleCollectionIds: input.eligibleCollectionIds,
      eligibleCategoryIds: input.eligibleCategoryIds,
      eligibleProductTypeIds: input.eligibleProductTypeIds,
      eligibleTagIds: input.eligibleTagIds,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    });

    const saved = await this.repository.create(clientOrDb, discount);
    return toDiscountDTO(saved);
  }

  async getDiscountById(
    clientOrDb: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<DiscountDTO | null> {
    const discount = await this.repository.findById(clientOrDb, storeId, id);
    if (!discount) return null;
    return toDiscountDTO(discount);
  }

  async getDiscountByCode(
    clientOrDb: DatabaseClient,
    storeId: string,
    rawCode: string,
  ): Promise<DiscountDTO | null> {
    const normalizedCode = normalizeDiscountCode(rawCode);
    if (!normalizedCode) return null;

    const discount = await this.repository.findByCode(
      clientOrDb,
      storeId,
      normalizedCode,
    );
    if (!discount) return null;
    return toDiscountDTO(discount);
  }

  async updateDiscount(
    clientOrDb: DatabaseClient,
    storeId: string,
    id: string,
    input: UpdateDiscountDTO,
  ): Promise<DiscountDTO> {
    const existing = await this.repository.findById(clientOrDb, storeId, id);
    if (!existing) {
      throw new DiscountNotFoundError(`Discount '${id}' not found for store '${storeId}'`);
    }

    const currentData = existing.toData();
    const updatedDiscount = Discount.reconstitute({
      ...currentData,
      name: input.name !== undefined ? input.name.trim() : currentData.name,
      description: input.description !== undefined ? input.description : currentData.description,
      value: input.value !== undefined ? input.value : currentData.value,
      status: input.status !== undefined ? input.status : currentData.status,
      minimumSubtotal: input.minimumSubtotal !== undefined ? input.minimumSubtotal : currentData.minimumSubtotal,
      maxDiscountAmount: input.maxDiscountAmount !== undefined ? input.maxDiscountAmount : currentData.maxDiscountAmount,
      usageLimit: input.usageLimit !== undefined ? input.usageLimit : currentData.usageLimit,
      appliesToFirstTimeCustomer:
        input.appliesToFirstTimeCustomer !== undefined
          ? input.appliesToFirstTimeCustomer
          : currentData.appliesToFirstTimeCustomer,
      eligibleProductIds:
        input.eligibleProductIds !== undefined
          ? input.eligibleProductIds
          : currentData.eligibleProductIds,
      eligibleCollectionIds:
        input.eligibleCollectionIds !== undefined
          ? input.eligibleCollectionIds
          : currentData.eligibleCollectionIds,
      eligibleCategoryIds:
        input.eligibleCategoryIds !== undefined
          ? input.eligibleCategoryIds
          : currentData.eligibleCategoryIds,
      eligibleProductTypeIds:
        input.eligibleProductTypeIds !== undefined
          ? input.eligibleProductTypeIds
          : currentData.eligibleProductTypeIds,
      eligibleTagIds:
        input.eligibleTagIds !== undefined
          ? input.eligibleTagIds
          : currentData.eligibleTagIds,
      startsAt: input.startsAt !== undefined ? (input.startsAt ? new Date(input.startsAt) : null) : currentData.startsAt,
      endsAt: input.endsAt !== undefined ? (input.endsAt ? new Date(input.endsAt) : null) : currentData.endsAt,
      updatedAt: new Date(),
    });

    const saved = await this.repository.update(clientOrDb, updatedDiscount);
    return toDiscountDTO(saved);
  }

  async activateDiscount(
    clientOrDb: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<DiscountDTO> {
    const existing = await this.repository.findById(clientOrDb, storeId, id);
    if (!existing) {
      throw new DiscountNotFoundError(`Discount '${id}' not found for store '${storeId}'`);
    }
    existing.activate();
    const saved = await this.repository.update(clientOrDb, existing);
    return toDiscountDTO(saved);
  }

  async deactivateDiscount(
    clientOrDb: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<DiscountDTO> {
    const deactivated = await this.repository.deactivate(clientOrDb, storeId, id);
    if (!deactivated) {
      throw new DiscountNotFoundError(`Discount '${id}' not found for store '${storeId}'`);
    }
    return toDiscountDTO(deactivated);
  }

  async listDiscounts(
    clientOrDb: DatabaseClient,
    storeId: string,
  ): Promise<DiscountDTO[]> {
    const list = await this.repository.listByStore(clientOrDb, storeId);
    return list.map(toDiscountDTO);
  }

  async evaluateCode(
    clientOrDb: DatabaseClient,
    storeId: string,
    rawCode: string,
    context: {
      subtotal: number;
      currency: string;
      now?: Date;
      isFirstTimeCustomer?: boolean;
      items?: DiscountEvaluationItem[];
    },
  ): Promise<DiscountValidationResult> {
    const normalizedCode = normalizeDiscountCode(rawCode);
    if (!normalizedCode) {
      return {
        isValid: false,
        code: "",
        reason: "INVALID_CODE",
        errorMessage: "Discount code cannot be empty",
      };
    }

    const discount = await this.repository.findByCode(
      clientOrDb,
      storeId,
      normalizedCode,
    );

    if (!discount) {
      return {
        isValid: false,
        code: normalizedCode,
        reason: "DISCOUNT_NOT_FOUND",
        errorMessage: "Discount code not found for this store",
      };
    }

    return evaluateDiscountPolicy(discount.toData(), {
      targetStoreId: storeId,
      subtotal: context.subtotal,
      currency: context.currency,
      now: context.now,
      isFirstTimeCustomer: context.isFirstTimeCustomer,
      items: context.items,
    });
  }
}
