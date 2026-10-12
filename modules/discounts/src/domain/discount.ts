import type { DiscountType, DiscountStatus } from "./discount-state.js";
import {
  InvalidDiscountValueError,
  DiscountUsageLimitExceededError,
} from "./discount-errors.js";
import {
  normalizeDiscountCode,
  validateDiscountCodeFormat,
  calculateDiscountAmount,
} from "./discount-policy.js";
import { generateUuidV7 } from "@shopify-clone/db";

export interface CreateDiscountParams {
  id?: string;
  storeId: string;
  code: string;
  name: string;
  description?: string | null;
  type: DiscountType;
  value: number;
  currency?: string | null;
  status?: DiscountStatus;
  minimumSubtotal?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  usageCount?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReconstituteDiscountParams {
  id: string;
  storeId: string;
  code: string;
  name: string;
  description: string | null;
  type: DiscountType;
  value: number;
  currency: string | null;
  status: DiscountStatus;
  minimumSubtotal: number;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  usageCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscountData {
  id: string;
  storeId: string;
  code: string;
  name: string;
  description: string | null;
  type: DiscountType;
  value: number;
  currency: string | null;
  status: DiscountStatus;
  minimumSubtotal: number;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  usageCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Discount {
  readonly id: string;
  readonly storeId: string;
  private _code: string;
  private _name: string;
  private _description: string | null;
  private _type: DiscountType;
  private _value: number;
  private _currency: string | null;
  private _status: DiscountStatus;
  private _minimumSubtotal: number;
  private _maxDiscountAmount: number | null;
  private _usageLimit: number | null;
  private _usageCount: number;
  private _startsAt: Date | null;
  private _endsAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(params: ReconstituteDiscountParams) {
    this.id = params.id;
    this.storeId = params.storeId;
    this._code = normalizeDiscountCode(params.code);
    this._name = params.name.trim();
    this._description = params.description ?? null;
    this._type = params.type;
    this._value = params.value;
    this._currency = params.currency ? params.currency.toUpperCase().trim() : null;
    this._status = params.status;
    this._minimumSubtotal = params.minimumSubtotal;
    this._maxDiscountAmount = params.maxDiscountAmount ?? null;
    this._usageLimit = params.usageLimit ?? null;
    this._usageCount = params.usageCount;
    this._startsAt = params.startsAt ?? null;
    this._endsAt = params.endsAt ?? null;
    this._createdAt = params.createdAt;
    this._updatedAt = params.updatedAt;
  }

  static create(params: CreateDiscountParams): Discount {
    const id = params.id ?? generateUuidV7();
    const code = normalizeDiscountCode(params.code);
    validateDiscountCodeFormat(code);

    const name = params.name.trim();
    if (name.length === 0) {
      throw new InvalidDiscountValueError("Discount name cannot be empty");
    }

    if (params.value <= 0 || !Number.isInteger(params.value)) {
      throw new InvalidDiscountValueError("Discount value must be a positive integer");
    }

    if (params.type === "PERCENTAGE" && params.value > 100) {
      throw new InvalidDiscountValueError("Percentage discount cannot exceed 100%");
    }

    const currency = params.currency ? params.currency.toUpperCase().trim() : null;
    if (params.type === "FIXED_AMOUNT") {
      if (!currency || currency.length !== 3) {
        throw new InvalidDiscountValueError("Fixed amount discount requires a valid 3-letter currency code");
      }
    }

    const minimumSubtotal = params.minimumSubtotal ?? 0;
    if (minimumSubtotal < 0 || !Number.isInteger(minimumSubtotal)) {
      throw new InvalidDiscountValueError("Minimum subtotal must be a non-negative integer");
    }

    const maxDiscountAmount = params.maxDiscountAmount ?? null;
    if (maxDiscountAmount !== null && (maxDiscountAmount <= 0 || !Number.isInteger(maxDiscountAmount))) {
      throw new InvalidDiscountValueError("Max discount amount must be a positive integer");
    }

    const usageLimit = params.usageLimit ?? null;
    if (usageLimit !== null && (usageLimit <= 0 || !Number.isInteger(usageLimit))) {
      throw new InvalidDiscountValueError("Usage limit must be a positive integer");
    }

    const startsAt = params.startsAt ?? null;
    const endsAt = params.endsAt ?? null;
    if (startsAt && endsAt && startsAt > endsAt) {
      throw new InvalidDiscountValueError("Discount starts_at must be before ends_at");
    }

    const now = new Date();
    return new Discount({
      id,
      storeId: params.storeId,
      code,
      name,
      description: params.description ?? null,
      type: params.type,
      value: params.value,
      currency,
      status: params.status ?? "ACTIVE",
      minimumSubtotal,
      maxDiscountAmount,
      usageLimit,
      usageCount: params.usageCount ?? 0,
      startsAt,
      endsAt,
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
    });
  }

  static reconstitute(params: ReconstituteDiscountParams): Discount {
    return new Discount(params);
  }

  get code(): string {
    return this._code;
  }

  get name(): string {
    return this._name;
  }

  get description(): string | null {
    return this._description;
  }

  get type(): DiscountType {
    return this._type;
  }

  get value(): number {
    return this._value;
  }

  get currency(): string | null {
    return this._currency;
  }

  get status(): DiscountStatus {
    return this._status;
  }

  get minimumSubtotal(): number {
    return this._minimumSubtotal;
  }

  get maxDiscountAmount(): number | null {
    return this._maxDiscountAmount;
  }

  get usageLimit(): number | null {
    return this._usageLimit;
  }

  get usageCount(): number {
    return this._usageCount;
  }

  get startsAt(): Date | null {
    return this._startsAt;
  }

  get endsAt(): Date | null {
    return this._endsAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isExpired(now: Date = new Date()): boolean {
    if (this._status === "EXPIRED") return true;
    if (this._endsAt && this._endsAt <= now) return true;
    return false;
  }

  isActive(now: Date = new Date()): boolean {
    if (this._status !== "ACTIVE") return false;
    if (this.isExpired(now)) return false;
    if (this._startsAt && this._startsAt > now) return false;
    return true;
  }

  calculateDiscount(subtotal: number): number {
    return calculateDiscountAmount(this._type, this._value, subtotal, this._maxDiscountAmount);
  }

  hasReachedLimit(): boolean {
    if (this._usageLimit === null || this._usageLimit === undefined) return false;
    return this._usageCount >= this._usageLimit;
  }

  activate(): void {
    this._status = "ACTIVE";
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._status = "DISABLED";
    this._updatedAt = new Date();
  }

  incrementUsage(): void {
    if (this.hasReachedLimit()) {
      throw new DiscountUsageLimitExceededError("Discount usage limit has been reached");
    }
    this._usageCount += 1;
    this._updatedAt = new Date();
  }

  decrementUsage(): void {
    this._usageCount = Math.max(0, this._usageCount - 1);
    this._updatedAt = new Date();
  }

  toData(): DiscountData {
    return {
      id: this.id,
      storeId: this.storeId,
      code: this._code,
      name: this._name,
      description: this._description,
      type: this._type,
      value: this._value,
      currency: this._currency,
      status: this._status,
      minimumSubtotal: this._minimumSubtotal,
      maxDiscountAmount: this._maxDiscountAmount,
      usageLimit: this._usageLimit,
      usageCount: this._usageCount,
      startsAt: this._startsAt,
      endsAt: this._endsAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
