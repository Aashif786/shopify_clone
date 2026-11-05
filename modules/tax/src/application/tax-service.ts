import { generateUuidV7, type Database, type DatabaseClient } from "@calcart/db";
import {
  SHIPPING_LINE_ID,
  assertValidGstRateBps,
  calculateGst,
  type GstLineInput,
} from "../domain/gst-calculation.js";
import { gstStateName, isValidGstStateCode } from "../domain/gst-states.js";
import {
  gstinStateCode,
  isValidGstin,
  normalizeGstin,
} from "../domain/gstin.js";
import {
  financialYearCode,
  formatInvoiceNumber,
} from "../domain/invoice-number.js";
import {
  CheckoutTaxNotCurrentError,
  InvalidGstinError,
  InvalidHsnCodeError,
  TaxDomainError,
  TaxSettingsIncompleteError,
} from "../domain/tax-errors.js";
import {
  TaxRepository,
  type CheckoutTaxSnapshotRow,
  type ProductTaxProfileRow,
  type TaxInvoiceLineRow,
  type TaxInvoiceRow,
  type TaxSettingsRow,
} from "../infrastructure/tax-repository.js";
import type {
  CalculateCheckoutTaxInput,
  CheckoutTaxResult,
  CheckoutTaxSnapshotDTO,
  InvoiceParty,
  IssueInvoiceInput,
  ProductTaxProfileDTO,
  SetProductTaxProfileInput,
  SnapshotSeller,
  TaxInvoiceDTO,
  TaxInvoiceLineDTO,
  TaxSettingsDTO,
  UpdateTaxSettingsInput,
} from "./dtos.js";

type Client = Database | DatabaseClient;

const HSN_PATTERN = /^[0-9]{4,8}$/;
const INDIAN_POSTAL_CODE = /^[1-9][0-9]{5}$/;

function isDatabase(client: Client): client is Database {
  return typeof (client as Database).withTransaction === "function";
}

/**
 * Runs `fn` atomically.
 *
 * Given a pool it opens its own transaction, so a failure rolls back every
 * statement it made, including the invoice number it took, which is what keeps
 * numbering gapless.
 *
 * Given a client that is already inside a caller's transaction it simply runs
 * within it. It does NOT try to contain failures with a SAVEPOINT: the
 * database layer latches the first error in a transaction and rejects every
 * later statement, so a savepoint cannot recover and would only give a false
 * sense of isolation. Callers that need a failure contained, such as the
 * purchase workflow, must pass a pool and call this after their own
 * transaction has committed.
 */
async function runAtomically<T>(
  client: Client,
  fn: (tx: DatabaseClient) => Promise<T>,
): Promise<T> {
  if (isDatabase(client)) {
    return client.withTransaction(fn);
  }
  return fn(client);
}

function toNumber(value: string | number | bigint | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function blankToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toSettingsDTO(row: TaxSettingsRow | null, storeId: string): TaxSettingsDTO {
  if (!row) {
    return {
      storeId,
      isEnabled: false,
      legalName: null,
      gstin: null,
      stateCode: null,
      stateName: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      defaultGstRateBps: 0,
      isDefault: true,
      updatedAt: null,
    };
  }
  return {
    storeId: row.store_id,
    isEnabled: row.is_enabled,
    legalName: row.legal_name,
    gstin: row.gstin,
    stateCode: row.state_code,
    stateName: gstStateName(row.state_code),
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    postalCode: row.postal_code,
    defaultGstRateBps: Number(row.default_gst_rate_bps),
    isDefault: false,
    updatedAt: row.updated_at.toISOString(),
  };
}

function toProfileDTO(row: ProductTaxProfileRow): ProductTaxProfileDTO {
  return {
    storeId: row.store_id,
    productId: row.product_id,
    hsnCode: row.hsn_code,
    gstRateBps: Number(row.gst_rate_bps),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toSnapshotDTO(row: CheckoutTaxSnapshotRow): CheckoutTaxSnapshotDTO {
  return {
    checkoutId: row.checkout_id,
    storeId: row.store_id,
    supplyType: row.supply_type,
    sellerStateCode: row.seller_state_code,
    placeOfSupplyCode: row.place_of_supply_code,
    placeOfSupplyName: gstStateName(row.place_of_supply_code),
    subtotal: toNumber(row.subtotal),
    discountTotal: toNumber(row.discount_total),
    taxableTotal: toNumber(row.taxable_total),
    cgstTotal: toNumber(row.cgst_total),
    sgstTotal: toNumber(row.sgst_total),
    igstTotal: toNumber(row.igst_total),
    taxTotal: toNumber(row.tax_total),
    lines: row.lines,
    seller: row.seller,
    calculatedAt: row.calculated_at.toISOString(),
  };
}

function toInvoiceDTO(row: TaxInvoiceRow, lines: TaxInvoiceLineRow[]): TaxInvoiceDTO {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    invoiceNumber: row.invoice_number,
    financialYear: row.financial_year,
    issuedAt: row.issued_at.toISOString(),
    currency: row.currency,
    supplyType: row.supply_type,
    placeOfSupplyCode: row.place_of_supply_code,
    placeOfSupplyName: row.place_of_supply_name,
    seller: row.seller,
    buyer: row.buyer,
    subtotal: toNumber(row.subtotal),
    discountTotal: toNumber(row.discount_total),
    taxableTotal: toNumber(row.taxable_total),
    cgstTotal: toNumber(row.cgst_total),
    sgstTotal: toNumber(row.sgst_total),
    igstTotal: toNumber(row.igst_total),
    taxTotal: toNumber(row.tax_total),
    shippingTotal: toNumber(row.shipping_total),
    grandTotal: toNumber(row.grand_total),
    lines: lines.map(
      (line): TaxInvoiceLineDTO => ({
        id: line.id,
        lineNumber: Number(line.line_number),
        orderItemId: line.order_item_id,
        description: line.description,
        hsnCode: line.hsn_code,
        quantity: Number(line.quantity),
        unitPrice: toNumber(line.unit_price),
        discount: toNumber(line.discount),
        taxableValue: toNumber(line.taxable_value),
        gstRateBps: Number(line.gst_rate_bps),
        cgst: toNumber(line.cgst),
        sgst: toNumber(line.sgst),
        igst: toNumber(line.igst),
        lineTotal: toNumber(line.line_total),
      }),
    ),
  };
}

/** Structural view of an order, so this module never imports `modules/orders`. */
export interface InvoiceableOrder {
  id: string;
  storeId: string;
  orderNumber: string;
  checkoutId: string | null;
  currency: string;
  shippingTotal: number;
  grandTotal: number;
  items?: Array<{ id: string; variantId: string | null }>;
  addresses?: Array<{
    type: string;
    name: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    phone?: string | null;
  }>;
}

/**
 * Builds the invoice input from an order. The buyer is the shipping party,
 * because the shipping address decides the place of supply, with billing as
 * the fallback. Returns null for an order that never came from a checkout.
 */
export function buildIssueInvoiceInput(order: InvoiceableOrder): IssueInvoiceInput | null {
  if (!order.checkoutId) return null;

  const address =
    order.addresses?.find((a) => a.type === "SHIPPING") ??
    order.addresses?.find((a) => a.type === "BILLING") ??
    null;

  const buyer: InvoiceParty = address
    ? {
        name: address.name,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 ?? null,
        city: address.city,
        state: address.state ?? null,
        stateCode: null,
        postalCode: address.postalCode ?? null,
        country: address.country ?? null,
        phone: address.phone ?? null,
      }
    : {
        name: "Customer",
        addressLine1: "",
        city: "",
        state: null,
        postalCode: null,
        country: null,
      };

  const orderItemIdsByLineId: Record<string, string> = {};
  for (const item of order.items ?? []) {
    if (item.variantId) {
      orderItemIdsByLineId[item.variantId] = item.id;
    }
  }

  return {
    storeId: order.storeId,
    orderId: order.id,
    checkoutId: order.checkoutId,
    orderNumber: order.orderNumber,
    currency: order.currency,
    shippingTotal: order.shippingTotal,
    grandTotal: order.grandTotal,
    orderItemIdsByLineId,
    buyer,
  };
}

export class TaxService {
  constructor(private readonly repo: TaxRepository = new TaxRepository()) {}

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async getSettings(client: Client, storeId: string): Promise<TaxSettingsDTO> {
    return toSettingsDTO(await this.repo.findSettings(client, storeId), storeId);
  }

  async updateSettings(
    client: Client,
    storeId: string,
    input: UpdateTaxSettingsInput,
  ): Promise<TaxSettingsDTO> {
    const existing = await this.repo.findSettings(client, storeId);

    const pick = <T>(provided: T | undefined, current: T): T =>
      provided === undefined ? current : provided;

    let legalName = blankToNull(pick(input.legalName, existing?.legal_name ?? null));
    let gstin = blankToNull(pick(input.gstin, existing?.gstin ?? null));
    let stateCode = blankToNull(pick(input.stateCode, existing?.state_code ?? null));
    const addressLine1 = blankToNull(pick(input.addressLine1, existing?.address_line1 ?? null));
    const addressLine2 = blankToNull(pick(input.addressLine2, existing?.address_line2 ?? null));
    const city = blankToNull(pick(input.city, existing?.city ?? null));
    const postalCode = blankToNull(pick(input.postalCode, existing?.postal_code ?? null));
    const isEnabled = pick(input.isEnabled, existing?.is_enabled ?? false);
    const defaultGstRateBps = pick(
      input.defaultGstRateBps,
      existing ? Number(existing.default_gst_rate_bps) : 0,
    );

    legalName = legalName === null ? null : legalName.slice(0, 200);

    if (gstin !== null) {
      gstin = normalizeGstin(gstin);
      if (!isValidGstin(gstin)) {
        throw new InvalidGstinError(
          "GSTIN is not valid. Check the 15 characters, including the final check character.",
        );
      }
      const prefix = gstinStateCode(gstin);
      if (stateCode === null) {
        stateCode = prefix;
      } else if (stateCode !== prefix) {
        throw new InvalidGstinError(
          `GSTIN prefix '${prefix}' does not match the selected state code '${stateCode}'`,
        );
      }
    }

    if (stateCode !== null && !isValidGstStateCode(stateCode)) {
      throw new TaxDomainError(
        `'${stateCode}' is not a valid GST state code`,
        "INVALID_STATE_CODE",
        400,
      );
    }

    if (postalCode !== null && !INDIAN_POSTAL_CODE.test(postalCode)) {
      throw new TaxDomainError(
        "Postal code must be a 6-digit Indian PIN code",
        "INVALID_POSTAL_CODE",
        400,
      );
    }

    assertValidGstRateBps(defaultGstRateBps);

    if (isEnabled) {
      const missing: string[] = [];
      if (!legalName) missing.push("legalName");
      if (!gstin) missing.push("gstin");
      if (!stateCode) missing.push("stateCode");
      if (!addressLine1) missing.push("addressLine1");
      if (!city) missing.push("city");
      if (!postalCode) missing.push("postalCode");
      if (missing.length > 0) {
        throw new TaxSettingsIncompleteError(
          `Tax cannot be enabled until these are provided: ${missing.join(", ")}`,
          { missing },
        );
      }
    }

    const row = await this.repo.upsertSettings(client, {
      id: generateUuidV7(),
      storeId,
      isEnabled,
      legalName,
      gstin,
      stateCode,
      addressLine1,
      addressLine2,
      city,
      postalCode,
      defaultGstRateBps,
    });
    return toSettingsDTO(row, storeId);
  }

  // -------------------------------------------------------------------------
  // Product tax profiles
  // -------------------------------------------------------------------------

  async getProductProfile(
    client: Client,
    storeId: string,
    productId: string,
  ): Promise<ProductTaxProfileDTO | null> {
    const row = await this.repo.findProfile(client, storeId, productId);
    return row ? toProfileDTO(row) : null;
  }

  async listProductProfiles(
    client: Client,
    storeId: string,
    productIds: string[],
  ): Promise<ProductTaxProfileDTO[]> {
    const rows = await this.repo.findProfilesByProductIds(client, storeId, productIds);
    return rows.map(toProfileDTO);
  }

  /**
   * Sets a product's HSN/SAC code and GST rate. The caller must already have
   * confirmed through the products module that the product belongs to the
   * store; the composite foreign key is the database-level backstop.
   */
  async setProductProfile(
    client: Client,
    storeId: string,
    productId: string,
    input: SetProductTaxProfileInput,
  ): Promise<ProductTaxProfileDTO> {
    const hsnCode = input.hsnCode.trim();
    if (!HSN_PATTERN.test(hsnCode)) {
      throw new InvalidHsnCodeError();
    }
    assertValidGstRateBps(input.gstRateBps);

    try {
      const row = await this.repo.upsertProfile(client, {
        id: generateUuidV7(),
        storeId,
        productId,
        hsnCode,
        gstRateBps: input.gstRateBps,
      });
      if (!row) {
        throw new TaxDomainError("Product not found", "PRODUCT_NOT_FOUND", 404);
      }
      return toProfileDTO(row);
    } catch (error) {
      const pgErr = error as { code?: string };
      if (pgErr.code === "23503") {
        throw new TaxDomainError("Product not found", "PRODUCT_NOT_FOUND", 404);
      }
      throw error;
    }
  }

  async deleteProductProfile(
    client: Client,
    storeId: string,
    productId: string,
  ): Promise<boolean> {
    return this.repo.deleteProfile(client, storeId, productId);
  }

  // -------------------------------------------------------------------------
  // Checkout calculation
  // -------------------------------------------------------------------------

  /**
   * Recalculates GST for a checkout and freezes the result as its snapshot.
   *
   * - Tax off for the store: zero tax, any stale snapshot removed.
   * - Tax on but no destination yet: zero tax and no snapshot, so the payment
   *   guard refuses payment until a shipping address exists.
   * - Otherwise: GST is computed per line and upserted as the snapshot.
   *
   * Amounts come only from the lines supplied by checkout, which reads them
   * from persisted prices; nothing here trusts a client-supplied figure.
   */
  async calculateForCheckout(
    client: Client,
    input: CalculateCheckoutTaxInput,
  ): Promise<CheckoutTaxResult> {
    const settingsRow = await this.repo.findSettings(client, input.storeId);

    if (!settingsRow || !settingsRow.is_enabled) {
      await this.repo.deleteSnapshot(client, input.storeId, input.checkoutId);
      return { isEnabled: false, isAwaitingDestination: false, taxTotal: 0, calculation: null };
    }

    if (!input.destination) {
      await this.repo.deleteSnapshot(client, input.storeId, input.checkoutId);
      return { isEnabled: true, isAwaitingDestination: true, taxTotal: 0, calculation: null };
    }

    const productIds = [
      ...new Set(
        input.lines
          .map((line) => line.productId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const profiles = await this.repo.findProfilesByProductIds(client, input.storeId, productIds);
    const profileByProduct = new Map(profiles.map((p) => [p.product_id, p]));
    const defaultRate = Number(settingsRow.default_gst_rate_bps);

    const gstLines: GstLineInput[] = input.lines.map((line) => {
      const profile = line.productId ? profileByProduct.get(line.productId) : undefined;
      return {
        lineId: line.lineId,
        productId: line.productId,
        hsnCode: profile?.hsn_code ?? null,
        rateBps: profile ? Number(profile.gst_rate_bps) : defaultRate,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
      };
    });

    const calculation = calculateGst({
      sellerStateCode: settingsRow.state_code!,
      destination: input.destination,
      lines: gstLines,
      discountTotal: input.discountTotal,
      shippingAmount: input.shippingTotal ?? 0,
    });

    const descriptions = new Map(input.lines.map((line) => [line.lineId, line]));
    const seller: SnapshotSeller = {
      legalName: settingsRow.legal_name!,
      gstin: settingsRow.gstin!,
      stateCode: settingsRow.state_code!,
      stateName: gstStateName(settingsRow.state_code),
      addressLine1: settingsRow.address_line1!,
      addressLine2: settingsRow.address_line2,
      city: settingsRow.city!,
      postalCode: settingsRow.postal_code!,
    };

    const saved = await this.repo.upsertSnapshot(client, {
      id: generateUuidV7(),
      storeId: input.storeId,
      checkoutId: input.checkoutId,
      supplyType: calculation.supplyType,
      sellerStateCode: calculation.sellerStateCode,
      placeOfSupplyCode: calculation.placeOfSupplyCode,
      subtotal: calculation.subtotal,
      discountTotal: calculation.discountTotal,
      taxableTotal: calculation.taxableTotal,
      cgstTotal: calculation.cgstTotal,
      sgstTotal: calculation.sgstTotal,
      igstTotal: calculation.igstTotal,
      taxTotal: calculation.taxTotal,
      lines: calculation.lines.map((line) => ({
        ...line,
        description:
          line.lineId === SHIPPING_LINE_ID
            ? "Shipping charges"
            : (descriptions.get(line.lineId)?.description ?? ""),
        sku: descriptions.get(line.lineId)?.sku ?? null,
      })),
      seller,
    });

    if (!saved) {
      throw new TaxDomainError(
        "Checkout tax snapshot belongs to a different store",
        "CHECKOUT_TAX_STORE_MISMATCH",
        404,
      );
    }

    return {
      isEnabled: true,
      isAwaitingDestination: false,
      taxTotal: calculation.taxTotal,
      calculation,
    };
  }

  async getCheckoutTaxSnapshot(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutTaxSnapshotDTO | null> {
    const row = await this.repo.findSnapshot(client, storeId, checkoutId);
    return row ? toSnapshotDTO(row) : null;
  }

  /**
   * Payment guard. For a tax-enabled store, refuses to proceed unless the
   * checkout's stored subtotal, discount and tax all match a snapshot that
   * checkout recalculated. That catches a missing shipping address, a stale
   * calculation, and a manually overridden tax figure alike, so a customer is
   * never charged an amount that skipped or contradicted the tax engine.
   *
   * A store with tax off is unaffected.
   */
  async assertCheckoutTaxCurrent(
    client: Client,
    storeId: string,
    checkout: {
      id: string;
      subtotal: number;
      discountTotal: number;
      taxTotal: number;
      /** Shipping charged; must equal the shipping the snapshot taxed. */
      shippingTotal?: number;
    },
  ): Promise<void> {
    const settings = await this.repo.findSettings(client, storeId);
    if (!settings || !settings.is_enabled) {
      return;
    }

    const snapshot = await this.repo.findSnapshot(client, storeId, checkout.id);
    if (!snapshot) {
      throw new CheckoutTaxNotCurrentError(
        "GST has not been calculated for this checkout. Enter a shipping address with a valid state before paying.",
      );
    }

    const effectiveDiscount = Math.min(checkout.discountTotal, checkout.subtotal);
    const taxedShipping =
      snapshot.lines.find((line) => line.lineId === SHIPPING_LINE_ID)?.taxableValue ?? 0;
    if (
      toNumber(snapshot.tax_total) !== checkout.taxTotal ||
      toNumber(snapshot.subtotal) !== checkout.subtotal ||
      toNumber(snapshot.discount_total) !== effectiveDiscount ||
      (checkout.shippingTotal !== undefined && taxedShipping !== checkout.shippingTotal)
    ) {
      throw new CheckoutTaxNotCurrentError(
        "The tax on this checkout is out of date. Review your order and try again.",
      );
    }
  }

  // -------------------------------------------------------------------------
  // Invoices
  // -------------------------------------------------------------------------

  async getInvoiceByOrderId(
    client: Client,
    storeId: string,
    orderId: string,
  ): Promise<TaxInvoiceDTO | null> {
    const row = await this.repo.findInvoiceByOrderId(client, storeId, orderId);
    if (!row) return null;
    const lines = await this.repo.findInvoiceLines(client, storeId, row.id);
    return toInvoiceDTO(row, lines);
  }

  /**
   * Issues the GST invoice for a paid order, built from the checkout's frozen
   * tax snapshot. Idempotent: an order has at most one invoice, and a repeat
   * or concurrent call returns the existing one.
   *
   * Returns null when the order has no snapshot, i.e. the store did not have
   * tax enabled when the customer checked out.
   */
  async issueInvoiceForOrder(
    client: Client,
    input: IssueInvoiceInput,
  ): Promise<TaxInvoiceDTO | null> {
    try {
      return await runAtomically(client, async (tx) => {
        const existing = await this.repo.findInvoiceByOrderId(
          tx,
          input.storeId,
          input.orderId,
        );
        if (existing) {
          const lines = await this.repo.findInvoiceLines(tx, input.storeId, existing.id);
          return toInvoiceDTO(existing, lines);
        }

        const snapshot = await this.repo.findSnapshot(tx, input.storeId, input.checkoutId);
        if (!snapshot) {
          return null;
        }

        const taxable = toNumber(snapshot.taxable_total);
        const tax = toNumber(snapshot.tax_total);
        // Shipping the snapshot taxed is already inside `taxable` as a line of
        // its own. Only shipping NOT itemised there (a snapshot from before
        // shipping was taxed) is carried separately.
        const itemisedShipping =
          snapshot.lines.find((line) => line.lineId === SHIPPING_LINE_ID)?.taxableValue ?? 0;
        const unitemisedShipping = input.shippingTotal - itemisedShipping;
        if (unitemisedShipping < 0 || taxable + tax + unitemisedShipping !== input.grandTotal) {
          // An invoice that does not add up to what was charged must never be
          // issued; failing loudly is safer than a wrong legal document.
          throw new TaxDomainError(
            `Invoice totals (${taxable} + ${tax} + ${unitemisedShipping}) do not reconcile with the order total ${input.grandTotal}`,
            "INVOICE_TOTAL_MISMATCH",
            500,
          );
        }

        const issuedAt = input.issuedAt ?? new Date();
        const financialYear = financialYearCode(issuedAt);
        const sequence = await this.repo.nextInvoiceSequence(
          tx,
          input.storeId,
          financialYear,
        );
        const invoiceNumber = formatInvoiceNumber(financialYear, sequence);

        const invoiceId = generateUuidV7();
        const placeOfSupplyName = gstStateName(snapshot.place_of_supply_code);

        const row = await this.repo.insertInvoice(tx, {
          id: invoiceId,
          storeId: input.storeId,
          orderId: input.orderId,
          invoiceNumber,
          financialYear,
          sequenceNumber: sequence,
          issuedAt,
          currency: input.currency,
          supplyType: snapshot.supply_type,
          placeOfSupplyCode: snapshot.place_of_supply_code,
          placeOfSupplyName,
          seller: snapshot.seller,
          buyer: input.buyer,
          subtotal: toNumber(snapshot.subtotal),
          discountTotal: toNumber(snapshot.discount_total),
          taxableTotal: taxable,
          cgstTotal: toNumber(snapshot.cgst_total),
          sgstTotal: toNumber(snapshot.sgst_total),
          igstTotal: toNumber(snapshot.igst_total),
          taxTotal: tax,
          shippingTotal: unitemisedShipping,
          grandTotal: input.grandTotal,
        });

        const lineRows: TaxInvoiceLineRow[] = [];
        let lineNumber = 0;
        for (const line of snapshot.lines) {
          lineNumber += 1;
          lineRows.push(
            await this.repo.insertInvoiceLine(tx, {
              id: generateUuidV7(),
              invoiceId,
              storeId: input.storeId,
              lineNumber,
              orderItemId: input.orderItemIdsByLineId?.[line.lineId] ?? null,
              description: line.description,
              hsnCode: line.hsnCode,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discount: line.discountAmount,
              taxableValue: line.taxableValue,
              gstRateBps: line.rateBps,
              cgst: line.cgst,
              sgst: line.sgst,
              igst: line.igst,
              lineTotal: line.taxableValue + line.taxAmount,
            }),
          );
        }

        return toInvoiceDTO(row, lineRows);
      });
    } catch (error) {
      // Two concurrent issuers for one order: the loser hits the per-order
      // unique constraint after its transaction (or savepoint) has rolled
      // back, so the existing invoice is the correct answer.
      const pgErr = error as { code?: string; constraint?: string };
      if (
        pgErr.code === "23505" &&
        pgErr.constraint === "tax_invoices_store_order_unique"
      ) {
        return this.getInvoiceByOrderId(client, input.storeId, input.orderId);
      }
      throw error;
    }
  }

  /**
   * Fail-open variant for the purchase workflow. A captured payment must always
   * produce its order, so an invoice problem is logged and left for lazy
   * issuance on first download rather than allowed to abort the purchase.
   *
   * This only contains the failure when given a pool, because a transaction
   * client latches the first error (see `runAtomically`). The workflow
   * therefore calls it after its own transaction has committed.
   */
  async tryIssueInvoiceForOrder(
    client: Client,
    input: IssueInvoiceInput,
  ): Promise<TaxInvoiceDTO | null> {
    try {
      return await this.issueInvoiceForOrder(client, input);
    } catch (error) {
      console.error(
        `[TaxService] Failed to issue invoice for order ${input.orderId}; it will be issued on first download:`,
        error,
      );
      return null;
    }
  }
}
