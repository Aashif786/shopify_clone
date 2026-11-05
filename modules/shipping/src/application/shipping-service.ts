import { generateUuidV7, type Database, type DatabaseClient } from "@calcart/db";
import { gstStateName, resolveGstStateCode } from "@calcart/tax";
import {
  computeShippingQuote,
  type RateDefinition,
  type ShippingOption,
} from "../domain/rate-evaluation.js";
import {
  CheckoutShippingNotCurrentError,
  InvalidShippingRateError,
  InvalidShippingWeightError,
  InvalidShippingZoneError,
  ShippingDomainError,
  ShippingRateNotAvailableError,
  ShippingRateNotFoundError,
  ShippingZoneNotFoundError,
} from "../domain/shipping-errors.js";
import { normalizeCountry, normalizePostalCode, type ZoneDefinition } from "../domain/zone-matching.js";
import {
  ShippingRepository,
  type CheckoutShippingQuoteRow,
  type ProductShippingProfileRow,
  type RateData,
  type ShippingRateRow,
  type ShippingSettingsRow,
  type ShippingZoneRow,
  type ZoneData,
} from "../infrastructure/shipping-repository.js";
import type {
  CheckoutShippingQuoteDTO,
  CheckoutShippingResult,
  ProductShippingProfileDTO,
  QuoteCheckoutInput,
  ShippingRateDTO,
  ShippingSettingsDTO,
  ShippingZoneDTO,
  UpdateShippingSettingsInput,
  UpsertShippingRateInput,
  UpsertShippingZoneInput,
} from "./dtos.js";

type Client = Database | DatabaseClient;

const MAX_WEIGHT_GRAMS = 100_000_000;
const MAX_LIST_ENTRIES = 50;
const MAX_PRIORITY = 100_000;
const MAX_DAYS = 365;

function toNumber(value: string | number | bigint | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function toNullableNumber(value: string | number | bigint | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function isNonNegativeInt(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
}

function assertWeight(value: unknown): asserts value is number {
  if (!isNonNegativeInt(value, MAX_WEIGHT_GRAMS)) {
    throw new InvalidShippingWeightError(
      `Weight must be a whole number of grams between 0 and ${MAX_WEIGHT_GRAMS}`,
    );
  }
}

function toSettingsDTO(row: ShippingSettingsRow | null, storeId: string): ShippingSettingsDTO {
  if (!row) {
    return { storeId, isEnabled: false, defaultWeightGrams: 500, isDefault: true, updatedAt: null };
  }
  return {
    storeId: row.store_id,
    isEnabled: row.is_enabled,
    defaultWeightGrams: Number(row.default_weight_grams),
    isDefault: false,
    updatedAt: row.updated_at.toISOString(),
  };
}

function toRateDTO(row: ShippingRateRow): ShippingRateDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    zoneId: row.zone_id,
    name: row.name,
    price: toNumber(row.price),
    minWeightGrams: Number(row.min_weight_grams),
    maxWeightGrams: row.max_weight_grams === null ? null : Number(row.max_weight_grams),
    minSubtotal: toNumber(row.min_subtotal),
    maxSubtotal: toNullableNumber(row.max_subtotal),
    freeOverSubtotal: toNullableNumber(row.free_over_subtotal),
    estimatedDaysMin: row.estimated_days_min === null ? null : Number(row.estimated_days_min),
    estimatedDaysMax: row.estimated_days_max === null ? null : Number(row.estimated_days_max),
    isActive: row.is_active,
  };
}

function toZoneDTO(row: ShippingZoneRow, rates: ShippingRateRow[]): ShippingZoneDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    countryCodes: row.country_codes,
    stateCodes: row.state_codes,
    stateNames: row.state_codes.map((code) => gstStateName(code) ?? code),
    postalPrefixes: row.postal_prefixes,
    priority: Number(row.priority),
    isActive: row.is_active,
    rates: rates.filter((rate) => rate.zone_id === row.id).map(toRateDTO),
  };
}

function toZoneDefinition(row: ShippingZoneRow): ZoneDefinition {
  return {
    id: row.id,
    name: row.name,
    countryCodes: row.country_codes,
    stateCodes: row.state_codes,
    postalPrefixes: row.postal_prefixes,
    priority: Number(row.priority),
    isActive: row.is_active,
  };
}

function toRateDefinition(row: ShippingRateRow): RateDefinition {
  const dto = toRateDTO(row);
  return {
    id: dto.id,
    zoneId: dto.zoneId,
    name: dto.name,
    price: dto.price,
    minWeightGrams: dto.minWeightGrams,
    maxWeightGrams: dto.maxWeightGrams,
    minSubtotal: dto.minSubtotal,
    maxSubtotal: dto.maxSubtotal,
    freeOverSubtotal: dto.freeOverSubtotal,
    estimatedDaysMin: dto.estimatedDaysMin,
    estimatedDaysMax: dto.estimatedDaysMax,
    isActive: dto.isActive,
  };
}

function toQuoteDTO(row: CheckoutShippingQuoteRow): CheckoutShippingQuoteDTO {
  return {
    checkoutId: row.checkout_id,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    selectedRateId: row.selected_rate_id,
    selectedRateName: row.selected_rate_name,
    shippingPrice: toNumber(row.shipping_price),
    totalWeightGrams: toNumber(row.total_weight_grams),
    goodsSubtotal: toNumber(row.goods_subtotal),
    options: row.options,
    calculatedAt: row.calculated_at.toISOString(),
  };
}

function cleanList(values: readonly string[] | undefined, label: string): string[] {
  const list = values ?? [];
  if (!Array.isArray(list) || list.length > MAX_LIST_ENTRIES) {
    throw new InvalidShippingZoneError(`${label} can have at most ${MAX_LIST_ENTRIES} entries`);
  }
  return list as string[];
}

function normalizeZoneInput(input: UpsertShippingZoneInput): ZoneData {
  const name = (input.name ?? "").trim();
  if (name.length === 0 || name.length > 100) {
    throw new InvalidShippingZoneError("Zone name must be 1 to 100 characters");
  }

  const countryCodes = [
    ...new Set(
      cleanList(input.countryCodes, "Countries").map((c) => {
        const normalized = normalizeCountry(c);
        if (normalized.length === 0 || normalized.length > 100) {
          throw new InvalidShippingZoneError("Each country must be 1 to 100 characters");
        }
        return normalized;
      }),
    ),
  ];

  const stateCodes = [
    ...new Set(
      cleanList(input.stateCodes, "States").map((s) => {
        // Accept a name, alias, abbreviation or numeric code, and store the
        // canonical GST code so matching never depends on how it was typed.
        const code = resolveGstStateCode(String(s));
        if (!code) {
          throw new InvalidShippingZoneError(
            `'${s}' is not a recognised Indian state or union territory`,
          );
        }
        return code;
      }),
    ),
  ];
  if (stateCodes.length > 0 && countryCodes.length > 0 && !countryCodes.includes("IN")) {
    throw new InvalidShippingZoneError("State codes only apply to a zone that includes India");
  }

  const postalPrefixes = [
    ...new Set(
      cleanList(input.postalPrefixes, "Postal prefixes").map((p) => {
        const prefix = normalizePostalCode(p);
        if (!/^[A-Z0-9]{1,10}$/.test(prefix)) {
          throw new InvalidShippingZoneError(
            `'${p}' is not a valid postal prefix (1 to 10 letters or digits)`,
          );
        }
        return prefix;
      }),
    ),
  ];

  const priority = input.priority ?? 100;
  if (!isNonNegativeInt(priority, MAX_PRIORITY)) {
    throw new InvalidShippingZoneError(`Priority must be a whole number from 0 to ${MAX_PRIORITY}`);
  }

  return {
    name,
    countryCodes,
    stateCodes,
    postalPrefixes,
    priority,
    isActive: input.isActive ?? true,
  };
}

function normalizeRateInput(input: UpsertShippingRateInput): RateData {
  const name = (input.name ?? "").trim();
  if (name.length === 0 || name.length > 100) {
    throw new InvalidShippingRateError("Rate name must be 1 to 100 characters");
  }
  if (!isNonNegativeInt(input.price)) {
    throw new InvalidShippingRateError("Price must be a whole number of minor units, 0 or more");
  }

  const minWeightGrams = input.minWeightGrams ?? 0;
  const maxWeightGrams = input.maxWeightGrams ?? null;
  if (!isNonNegativeInt(minWeightGrams, MAX_WEIGHT_GRAMS)) {
    throw new InvalidShippingRateError("Minimum weight must be a whole number of grams");
  }
  if (maxWeightGrams !== null && !isNonNegativeInt(maxWeightGrams, MAX_WEIGHT_GRAMS)) {
    throw new InvalidShippingRateError("Maximum weight must be a whole number of grams");
  }
  if (maxWeightGrams !== null && maxWeightGrams < minWeightGrams) {
    throw new InvalidShippingRateError("Maximum weight cannot be below the minimum weight");
  }

  const minSubtotal = input.minSubtotal ?? 0;
  const maxSubtotal = input.maxSubtotal ?? null;
  if (!isNonNegativeInt(minSubtotal)) {
    throw new InvalidShippingRateError("Minimum order value must be a whole number, 0 or more");
  }
  if (maxSubtotal !== null && !isNonNegativeInt(maxSubtotal)) {
    throw new InvalidShippingRateError("Maximum order value must be a whole number, 0 or more");
  }
  if (maxSubtotal !== null && maxSubtotal < minSubtotal) {
    throw new InvalidShippingRateError("Maximum order value cannot be below the minimum");
  }

  const freeOverSubtotal = input.freeOverSubtotal ?? null;
  if (freeOverSubtotal !== null && !isNonNegativeInt(freeOverSubtotal)) {
    throw new InvalidShippingRateError("Free-shipping threshold must be a whole number, 0 or more");
  }

  const estimatedDaysMin = input.estimatedDaysMin ?? null;
  const estimatedDaysMax = input.estimatedDaysMax ?? null;
  for (const days of [estimatedDaysMin, estimatedDaysMax]) {
    if (days !== null && !isNonNegativeInt(days, MAX_DAYS)) {
      throw new InvalidShippingRateError(`Delivery days must be a whole number from 0 to ${MAX_DAYS}`);
    }
  }
  if (estimatedDaysMin !== null && estimatedDaysMax !== null && estimatedDaysMax < estimatedDaysMin) {
    throw new InvalidShippingRateError("Maximum delivery days cannot be below the minimum");
  }

  return {
    name,
    price: input.price,
    minWeightGrams,
    maxWeightGrams,
    minSubtotal,
    maxSubtotal,
    freeOverSubtotal,
    estimatedDaysMin,
    estimatedDaysMax,
    isActive: input.isActive ?? true,
  };
}

export class ShippingService {
  constructor(private readonly repo: ShippingRepository = new ShippingRepository()) {}

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async getSettings(client: Client, storeId: string): Promise<ShippingSettingsDTO> {
    return toSettingsDTO(await this.repo.findSettings(client, storeId), storeId);
  }

  async updateSettings(
    client: Client,
    storeId: string,
    input: UpdateShippingSettingsInput,
  ): Promise<ShippingSettingsDTO> {
    const existing = await this.repo.findSettings(client, storeId);
    const defaultWeightGrams =
      input.defaultWeightGrams ?? (existing ? Number(existing.default_weight_grams) : 500);
    assertWeight(defaultWeightGrams);

    const row = await this.repo.upsertSettings(client, {
      id: generateUuidV7(),
      storeId,
      isEnabled: input.isEnabled ?? existing?.is_enabled ?? false,
      defaultWeightGrams,
    });
    return toSettingsDTO(row, storeId);
  }

  // -------------------------------------------------------------------------
  // Zones and rates
  // -------------------------------------------------------------------------

  async listZones(client: Client, storeId: string): Promise<ShippingZoneDTO[]> {
    const [zones, rates] = await Promise.all([
      this.repo.listZones(client, storeId),
      this.repo.listRates(client, storeId),
    ]);
    return zones.map((zone) => toZoneDTO(zone, rates));
  }

  async createZone(
    client: Client,
    storeId: string,
    input: UpsertShippingZoneInput,
  ): Promise<ShippingZoneDTO> {
    const row = await this.repo.insertZone(client, {
      id: generateUuidV7(),
      storeId,
      ...normalizeZoneInput(input),
    });
    return toZoneDTO(row, []);
  }

  async updateZone(
    client: Client,
    storeId: string,
    zoneId: string,
    input: UpsertShippingZoneInput,
  ): Promise<ShippingZoneDTO> {
    const row = await this.repo.updateZone(client, storeId, zoneId, normalizeZoneInput(input));
    if (!row) throw new ShippingZoneNotFoundError();
    return toZoneDTO(row, await this.repo.listRates(client, storeId));
  }

  async deleteZone(client: Client, storeId: string, zoneId: string): Promise<void> {
    if (!(await this.repo.deleteZone(client, storeId, zoneId))) {
      throw new ShippingZoneNotFoundError();
    }
  }

  async createRate(
    client: Client,
    storeId: string,
    zoneId: string,
    input: UpsertShippingRateInput,
  ): Promise<ShippingRateDTO> {
    const data = normalizeRateInput(input);
    if (!(await this.repo.findZone(client, storeId, zoneId))) {
      throw new ShippingZoneNotFoundError();
    }
    return toRateDTO(
      await this.repo.insertRate(client, { id: generateUuidV7(), storeId, zoneId, ...data }),
    );
  }

  async updateRate(
    client: Client,
    storeId: string,
    rateId: string,
    input: UpsertShippingRateInput,
  ): Promise<ShippingRateDTO> {
    const row = await this.repo.updateRate(client, storeId, rateId, normalizeRateInput(input));
    if (!row) throw new ShippingRateNotFoundError();
    return toRateDTO(row);
  }

  async deleteRate(client: Client, storeId: string, rateId: string): Promise<void> {
    if (!(await this.repo.deleteRate(client, storeId, rateId))) {
      throw new ShippingRateNotFoundError();
    }
  }

  // -------------------------------------------------------------------------
  // Product weights
  // -------------------------------------------------------------------------

  async getProductProfile(
    client: Client,
    storeId: string,
    productId: string,
  ): Promise<ProductShippingProfileDTO | null> {
    const row = await this.repo.findProfile(client, storeId, productId);
    return row ? this.toProfileDTO(row) : null;
  }

  async listProductProfiles(
    client: Client,
    storeId: string,
    productIds: string[],
  ): Promise<ProductShippingProfileDTO[]> {
    const rows = await this.repo.findProfilesByProductIds(client, storeId, productIds);
    return rows.map((row) => this.toProfileDTO(row));
  }

  /**
   * Sets a product's unit weight. The caller must already have confirmed
   * through the products module that the product belongs to the store; the
   * composite foreign key is the database-level backstop.
   */
  async setProductWeight(
    client: Client,
    storeId: string,
    productId: string,
    weightGrams: number,
  ): Promise<ProductShippingProfileDTO> {
    assertWeight(weightGrams);
    try {
      const row = await this.repo.upsertProfile(client, {
        id: generateUuidV7(),
        storeId,
        productId,
        weightGrams,
      });
      if (!row) throw new ShippingDomainError("Product not found", "PRODUCT_NOT_FOUND", 404);
      return this.toProfileDTO(row);
    } catch (error) {
      if ((error as { code?: string }).code === "23503") {
        throw new ShippingDomainError("Product not found", "PRODUCT_NOT_FOUND", 404);
      }
      throw error;
    }
  }

  async deleteProductWeight(client: Client, storeId: string, productId: string): Promise<boolean> {
    return this.repo.deleteProfile(client, storeId, productId);
  }

  private toProfileDTO(row: ProductShippingProfileRow): ProductShippingProfileDTO {
    return {
      storeId: row.store_id,
      productId: row.product_id,
      weightGrams: Number(row.weight_grams),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Checkout quote
  // -------------------------------------------------------------------------

  /**
   * Quotes shipping for a checkout and freezes the result.
   *
   * - Shipping off for the store: nothing is stored and `isEnabled` is false, so
   *   the caller leaves the checkout's shipping total completely alone.
   * - No address yet: any stale quote is removed and the payment guard will
   *   refuse payment until one exists.
   * - Otherwise zones and rates are evaluated against the parcel weight and the
   *   goods value, and the outcome is upserted. An address no zone can ship to
   *   is stored with no selection, which is also refused at payment.
   *
   * The customer's earlier choice survives recalculation while it is still on
   * offer. An explicit `requestedRateId` that is not on offer is rejected.
   */
  async quoteForCheckout(client: Client, input: QuoteCheckoutInput): Promise<CheckoutShippingResult> {
    const settings = await this.repo.findSettings(client, input.storeId);
    if (!settings || !settings.is_enabled) {
      await this.repo.deleteQuote(client, input.storeId, input.checkoutId);
      return {
        isEnabled: false,
        isAwaitingDestination: false,
        isServiceable: false,
        shippingTotal: 0,
        quote: null,
      };
    }

    if (!input.destination) {
      await this.repo.deleteQuote(client, input.storeId, input.checkoutId);
      return {
        isEnabled: true,
        isAwaitingDestination: true,
        isServiceable: false,
        shippingTotal: 0,
        quote: null,
      };
    }

    const [zones, rates] = await Promise.all([
      this.repo.listZones(client, input.storeId),
      this.repo.listRates(client, input.storeId),
    ]);

    const productIds = [
      ...new Set(input.lines.map((l) => l.productId).filter((id): id is string => id !== null)),
    ];
    const profiles = await this.repo.findProfilesByProductIds(client, input.storeId, productIds);
    const weightByProduct = new Map(profiles.map((p) => [p.product_id, Number(p.weight_grams)]));
    const defaultWeight = Number(settings.default_weight_grams);
    const totalWeightGrams = input.lines.reduce((sum, line) => {
      const unit = line.productId ? (weightByProduct.get(line.productId) ?? defaultWeight) : defaultWeight;
      return sum + unit * line.quantity;
    }, 0);

    const previous = await this.repo.findQuote(client, input.storeId, input.checkoutId);
    const quote = computeShippingQuote({
      zones: zones.map(toZoneDefinition),
      rates: rates.map(toRateDefinition),
      destination: input.destination,
      totalWeightGrams,
      goodsSubtotal: input.goodsSubtotal,
      selectedRateId: input.requestedRateId ?? previous?.selected_rate_id ?? null,
    });

    if (
      input.requestedRateId &&
      !quote.options.some((option) => option.rateId === input.requestedRateId)
    ) {
      throw new ShippingRateNotAvailableError();
    }

    const saved = await this.repo.upsertQuote(client, {
      id: generateUuidV7(),
      storeId: input.storeId,
      checkoutId: input.checkoutId,
      zoneId: quote.zoneId,
      zoneName: quote.zoneName,
      selectedRateId: quote.selected?.rateId ?? null,
      selectedRateName: quote.selected?.name ?? null,
      shippingPrice: quote.selected?.price ?? 0,
      totalWeightGrams,
      goodsSubtotal: quote.goodsSubtotal,
      options: quote.options,
      destination: { ...input.destination },
    });
    if (!saved) {
      throw new ShippingDomainError(
        "Checkout shipping quote belongs to a different store",
        "CHECKOUT_SHIPPING_STORE_MISMATCH",
        404,
      );
    }

    return {
      isEnabled: true,
      isAwaitingDestination: false,
      isServiceable: quote.selected !== null,
      shippingTotal: quote.selected?.price ?? 0,
      quote: toQuoteDTO(saved),
    };
  }

  async getCheckoutQuote(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutShippingQuoteDTO | null> {
    const row = await this.repo.findQuote(client, storeId, checkoutId);
    return row ? toQuoteDTO(row) : null;
  }

  /**
   * Payment guard. For a shipping-enabled store, refuses to proceed unless the
   * checkout has a quote with a selected option whose price and goods value
   * match what checkout is about to charge. That catches a missing address, an
   * address nothing ships to, a stale quote, and a tampered shipping total.
   *
   * A store with shipping off is unaffected.
   */
  async assertCheckoutShippingCurrent(
    client: Client,
    storeId: string,
    checkout: { id: string; shippingTotal: number; goodsSubtotal: number },
  ): Promise<void> {
    const settings = await this.repo.findSettings(client, storeId);
    if (!settings || !settings.is_enabled) return;

    const quote = await this.repo.findQuote(client, storeId, checkout.id);
    if (!quote) {
      throw new CheckoutShippingNotCurrentError(
        "Shipping has not been calculated for this checkout. Enter a shipping address before paying.",
      );
    }
    if (quote.selected_rate_id === null) {
      throw new CheckoutShippingNotCurrentError(
        "We cannot ship this order to that address. Choose a different address.",
      );
    }
    if (
      toNumber(quote.shipping_price) !== checkout.shippingTotal ||
      toNumber(quote.goods_subtotal) !== Math.max(0, checkout.goodsSubtotal)
    ) {
      throw new CheckoutShippingNotCurrentError(
        "The shipping on this checkout is out of date. Review your order and try again.",
      );
    }
  }
}

export type { ShippingOption };
