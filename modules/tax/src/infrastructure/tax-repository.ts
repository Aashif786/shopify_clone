import type { Database, DatabaseClient } from "@calcart/db";
import type { SupplyType } from "../domain/gst-calculation.js";
import type {
  InvoiceParty,
  SnapshotLine,
  SnapshotSeller,
} from "../application/dtos.js";

type Client = Database | DatabaseClient;

type Money = string | number | bigint;

export interface TaxSettingsRow {
  id: string;
  store_id: string;
  is_enabled: boolean;
  legal_name: string | null;
  gstin: string | null;
  state_code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  default_gst_rate_bps: number;
  created_at: Date;
  updated_at: Date;
}

export interface ProductTaxProfileRow {
  id: string;
  store_id: string;
  product_id: string;
  hsn_code: string;
  gst_rate_bps: number;
  created_at: Date;
  updated_at: Date;
}

export interface CheckoutTaxSnapshotRow {
  id: string;
  store_id: string;
  checkout_id: string;
  supply_type: SupplyType;
  seller_state_code: string;
  place_of_supply_code: string | null;
  subtotal: Money;
  discount_total: Money;
  taxable_total: Money;
  cgst_total: Money;
  sgst_total: Money;
  igst_total: Money;
  tax_total: Money;
  lines: SnapshotLine[];
  seller: SnapshotSeller;
  calculated_at: Date;
}

export interface TaxInvoiceRow {
  id: string;
  store_id: string;
  order_id: string;
  invoice_number: string;
  financial_year: string;
  sequence_number: number;
  issued_at: Date;
  currency: string;
  supply_type: SupplyType;
  place_of_supply_code: string | null;
  place_of_supply_name: string | null;
  seller: SnapshotSeller;
  buyer: InvoiceParty;
  subtotal: Money;
  discount_total: Money;
  taxable_total: Money;
  cgst_total: Money;
  sgst_total: Money;
  igst_total: Money;
  tax_total: Money;
  shipping_total: Money;
  grand_total: Money;
  created_at: Date;
}

export interface TaxInvoiceLineRow {
  id: string;
  invoice_id: string;
  store_id: string;
  line_number: number;
  order_item_id: string | null;
  description: string;
  hsn_code: string | null;
  quantity: number;
  unit_price: Money;
  discount: Money;
  taxable_value: Money;
  gst_rate_bps: number;
  cgst: Money;
  sgst: Money;
  igst: Money;
  line_total: Money;
  created_at: Date;
}

export interface UpsertTaxSettingsData {
  id: string;
  storeId: string;
  isEnabled: boolean;
  legalName: string | null;
  gstin: string | null;
  stateCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  defaultGstRateBps: number;
}

export interface UpsertSnapshotData {
  id: string;
  storeId: string;
  checkoutId: string;
  supplyType: SupplyType;
  sellerStateCode: string;
  placeOfSupplyCode: string | null;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  lines: SnapshotLine[];
  seller: SnapshotSeller;
}

export interface InsertInvoiceData {
  id: string;
  storeId: string;
  orderId: string;
  invoiceNumber: string;
  financialYear: string;
  sequenceNumber: number;
  issuedAt: Date;
  currency: string;
  supplyType: SupplyType;
  placeOfSupplyCode: string | null;
  placeOfSupplyName: string | null;
  seller: SnapshotSeller;
  buyer: InvoiceParty;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;
}

export interface InsertInvoiceLineData {
  id: string;
  invoiceId: string;
  storeId: string;
  lineNumber: number;
  orderItemId: string | null;
  description: string;
  hsnCode: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  gstRateBps: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
}

/**
 * Every statement is scoped by store id, and every cross-module reference in
 * the schema is a composite (id, store_id) foreign key, so the tax tables can
 * never be read or written through another tenant's store.
 */
export class TaxRepository {
  // --- Settings -----------------------------------------------------------

  async findSettings(
    client: Client,
    storeId: string,
  ): Promise<TaxSettingsRow | null> {
    const res = await client.query<TaxSettingsRow>(
      `SELECT * FROM tax_settings WHERE store_id = $1`,
      [storeId],
    );
    return res.rows[0] ?? null;
  }

  async upsertSettings(
    client: Client,
    data: UpsertTaxSettingsData,
  ): Promise<TaxSettingsRow> {
    const res = await client.query<TaxSettingsRow>(
      `INSERT INTO tax_settings (
         id, store_id, is_enabled, legal_name, gstin, state_code, address_line1,
         address_line2, city, postal_code, default_gst_rate_bps
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (store_id) DO UPDATE SET
         is_enabled = EXCLUDED.is_enabled,
         legal_name = EXCLUDED.legal_name,
         gstin = EXCLUDED.gstin,
         state_code = EXCLUDED.state_code,
         address_line1 = EXCLUDED.address_line1,
         address_line2 = EXCLUDED.address_line2,
         city = EXCLUDED.city,
         postal_code = EXCLUDED.postal_code,
         default_gst_rate_bps = EXCLUDED.default_gst_rate_bps,
         updated_at = NOW()
       RETURNING *`,
      [
        data.id,
        data.storeId,
        data.isEnabled,
        data.legalName,
        data.gstin,
        data.stateCode,
        data.addressLine1,
        data.addressLine2,
        data.city,
        data.postalCode,
        data.defaultGstRateBps,
      ],
    );
    return res.rows[0]!;
  }

  // --- Product profiles ---------------------------------------------------

  async findProfile(
    client: Client,
    storeId: string,
    productId: string,
  ): Promise<ProductTaxProfileRow | null> {
    const res = await client.query<ProductTaxProfileRow>(
      `SELECT * FROM product_tax_profiles WHERE store_id = $1 AND product_id = $2`,
      [storeId, productId],
    );
    return res.rows[0] ?? null;
  }

  async findProfilesByProductIds(
    client: Client,
    storeId: string,
    productIds: string[],
  ): Promise<ProductTaxProfileRow[]> {
    if (productIds.length === 0) return [];
    const res = await client.query<ProductTaxProfileRow>(
      `SELECT * FROM product_tax_profiles
       WHERE store_id = $1 AND product_id = ANY($2::uuid[])`,
      [storeId, productIds],
    );
    return res.rows;
  }

  async upsertProfile(
    client: Client,
    data: { id: string; storeId: string; productId: string; hsnCode: string; gstRateBps: number },
  ): Promise<ProductTaxProfileRow | null> {
    const res = await client.query<ProductTaxProfileRow>(
      `INSERT INTO product_tax_profiles (id, store_id, product_id, hsn_code, gst_rate_bps)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (product_id) DO UPDATE SET
         hsn_code = EXCLUDED.hsn_code,
         gst_rate_bps = EXCLUDED.gst_rate_bps,
         updated_at = NOW()
       WHERE product_tax_profiles.store_id = EXCLUDED.store_id
       RETURNING *`,
      [data.id, data.storeId, data.productId, data.hsnCode, data.gstRateBps],
    );
    // No row means the product already has a profile owned by another store.
    return res.rows[0] ?? null;
  }

  async deleteProfile(
    client: Client,
    storeId: string,
    productId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM product_tax_profiles WHERE store_id = $1 AND product_id = $2`,
      [storeId, productId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // --- Checkout snapshots -------------------------------------------------

  async findSnapshot(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutTaxSnapshotRow | null> {
    const res = await client.query<CheckoutTaxSnapshotRow>(
      `SELECT * FROM checkout_tax_snapshots WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
    return res.rows[0] ?? null;
  }

  async upsertSnapshot(
    client: Client,
    data: UpsertSnapshotData,
  ): Promise<CheckoutTaxSnapshotRow | null> {
    const res = await client.query<CheckoutTaxSnapshotRow>(
      `INSERT INTO checkout_tax_snapshots (
         id, store_id, checkout_id, supply_type, seller_state_code, place_of_supply_code,
         subtotal, discount_total, taxable_total, cgst_total, sgst_total, igst_total,
         tax_total, lines, seller
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)
       ON CONFLICT (checkout_id) DO UPDATE SET
         supply_type = EXCLUDED.supply_type,
         seller_state_code = EXCLUDED.seller_state_code,
         place_of_supply_code = EXCLUDED.place_of_supply_code,
         subtotal = EXCLUDED.subtotal,
         discount_total = EXCLUDED.discount_total,
         taxable_total = EXCLUDED.taxable_total,
         cgst_total = EXCLUDED.cgst_total,
         sgst_total = EXCLUDED.sgst_total,
         igst_total = EXCLUDED.igst_total,
         tax_total = EXCLUDED.tax_total,
         lines = EXCLUDED.lines,
         seller = EXCLUDED.seller,
         calculated_at = NOW()
       WHERE checkout_tax_snapshots.store_id = EXCLUDED.store_id
       RETURNING *`,
      [
        data.id,
        data.storeId,
        data.checkoutId,
        data.supplyType,
        data.sellerStateCode,
        data.placeOfSupplyCode,
        data.subtotal,
        data.discountTotal,
        data.taxableTotal,
        data.cgstTotal,
        data.sgstTotal,
        data.igstTotal,
        data.taxTotal,
        JSON.stringify(data.lines),
        JSON.stringify(data.seller),
      ],
    );
    // No row means the checkout's snapshot belongs to a different store.
    return res.rows[0] ?? null;
  }

  async deleteSnapshot(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<void> {
    await client.query(
      `DELETE FROM checkout_tax_snapshots WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
  }

  // --- Invoices -----------------------------------------------------------

  /**
   * Atomically takes the next invoice number for a store and financial year.
   * The upsert row-locks the counter until the surrounding transaction ends,
   * so concurrent issuers serialise, and a rolled-back transaction rolls the
   * counter back too, which is what keeps numbering gapless.
   */
  async nextInvoiceSequence(
    client: Client,
    storeId: string,
    financialYear: string,
  ): Promise<number> {
    const res = await client.query<{ last_number: number }>(
      `INSERT INTO tax_invoice_sequences (store_id, financial_year, last_number)
       VALUES ($1, $2, 1)
       ON CONFLICT (store_id, financial_year) DO UPDATE
         SET last_number = tax_invoice_sequences.last_number + 1,
             updated_at = NOW()
       RETURNING last_number`,
      [storeId, financialYear],
    );
    return Number(res.rows[0]!.last_number);
  }

  async insertInvoice(
    client: Client,
    data: InsertInvoiceData,
  ): Promise<TaxInvoiceRow> {
    const res = await client.query<TaxInvoiceRow>(
      `INSERT INTO tax_invoices (
         id, store_id, order_id, invoice_number, financial_year, sequence_number,
         issued_at, currency, supply_type, place_of_supply_code, place_of_supply_name,
         seller, buyer, subtotal, discount_total, taxable_total, cgst_total, sgst_total,
         igst_total, tax_total, shipping_total, grand_total
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb,
         $14, $15, $16, $17, $18, $19, $20, $21, $22
       )
       RETURNING *`,
      [
        data.id,
        data.storeId,
        data.orderId,
        data.invoiceNumber,
        data.financialYear,
        data.sequenceNumber,
        data.issuedAt,
        data.currency,
        data.supplyType,
        data.placeOfSupplyCode,
        data.placeOfSupplyName,
        JSON.stringify(data.seller),
        JSON.stringify(data.buyer),
        data.subtotal,
        data.discountTotal,
        data.taxableTotal,
        data.cgstTotal,
        data.sgstTotal,
        data.igstTotal,
        data.taxTotal,
        data.shippingTotal,
        data.grandTotal,
      ],
    );
    return res.rows[0]!;
  }

  async insertInvoiceLine(
    client: Client,
    data: InsertInvoiceLineData,
  ): Promise<TaxInvoiceLineRow> {
    const res = await client.query<TaxInvoiceLineRow>(
      `INSERT INTO tax_invoice_lines (
         id, invoice_id, store_id, line_number, order_item_id, description, hsn_code,
         quantity, unit_price, discount, taxable_value, gst_rate_bps, cgst, sgst, igst,
         line_total
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        data.id,
        data.invoiceId,
        data.storeId,
        data.lineNumber,
        data.orderItemId,
        data.description,
        data.hsnCode,
        data.quantity,
        data.unitPrice,
        data.discount,
        data.taxableValue,
        data.gstRateBps,
        data.cgst,
        data.sgst,
        data.igst,
        data.lineTotal,
      ],
    );
    return res.rows[0]!;
  }

  async findInvoiceByOrderId(
    client: Client,
    storeId: string,
    orderId: string,
  ): Promise<TaxInvoiceRow | null> {
    const res = await client.query<TaxInvoiceRow>(
      `SELECT * FROM tax_invoices WHERE store_id = $1 AND order_id = $2`,
      [storeId, orderId],
    );
    return res.rows[0] ?? null;
  }

  async findInvoiceLines(
    client: Client,
    storeId: string,
    invoiceId: string,
  ): Promise<TaxInvoiceLineRow[]> {
    const res = await client.query<TaxInvoiceLineRow>(
      `SELECT * FROM tax_invoice_lines
       WHERE store_id = $1 AND invoice_id = $2
       ORDER BY line_number ASC`,
      [storeId, invoiceId],
    );
    return res.rows;
  }
}
