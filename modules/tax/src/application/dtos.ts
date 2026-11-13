import type { GstCalculation, GstLineResult, SupplyType } from "../domain/gst-calculation.js";

export interface TaxSettingsDTO {
  storeId: string;
  isEnabled: boolean;
  pricesIncludeTax: boolean;
  legalName: string | null;
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  /** GST rate (basis points) for a product with no tax profile. */
  defaultGstRateBps: number;
  /** True when the store has never saved tax settings. */
  isDefault: boolean;
  updatedAt: string | null;
}

export interface UpdateTaxSettingsInput {
  isEnabled?: boolean;
  pricesIncludeTax?: boolean;
  legalName?: string | null;
  gstin?: string | null;
  stateCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  defaultGstRateBps?: number;
}

export interface ProductTaxProfileDTO {
  storeId: string;
  productId: string;
  hsnCode: string;
  gstRateBps: number;
  updatedAt: string;
}

export interface SetProductTaxProfileInput {
  hsnCode: string;
  gstRateBps: number;
}

/** A line as supplied by checkout; amounts are always read server-side. */
export interface CheckoutTaxLineInput {
  /** Stable key within the checkout. Checkout uses the variant id. */
  lineId: string;
  productId: string | null;
  description: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
}

export interface CheckoutTaxDestination {
  country: string | null | undefined;
  state: string | null | undefined;
}

export interface CalculateCheckoutTaxInput {
  storeId: string;
  checkoutId: string;
  lines: CheckoutTaxLineInput[];
  discountTotal: number;
  /** Shipping currently charged on the checkout; taxed as its own line. */
  shippingTotal?: number;
  /** Null when no shipping address has been entered yet. */
  destination: CheckoutTaxDestination | null;
}

export interface CheckoutTaxResult {
  /** False when the store has tax switched off; every figure is then zero. */
  isEnabled: boolean;
  /** True when tax is on but cannot be calculated until a destination exists. */
  isAwaitingDestination: boolean;
  taxTotal: number;
  calculation: GstCalculation | null;
}

export interface SnapshotSeller {
  legalName: string;
  gstin: string;
  stateCode: string;
  stateName: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
}

export interface SnapshotLine extends GstLineResult {
  description: string;
  sku: string | null;
}

export interface CheckoutTaxSnapshotDTO {
  checkoutId: string;
  storeId: string;
  supplyType: SupplyType;
  pricesIncludeTax: boolean;
  sellerStateCode: string;
  placeOfSupplyCode: string | null;
  placeOfSupplyName: string | null;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  lines: SnapshotLine[];
  seller: SnapshotSeller;
  calculatedAt: string;
}

export interface TaxInvoiceLineDTO {
  id: string;
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

export interface InvoiceParty {
  name: string;
  gstin?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string | null;
  stateCode?: string | null;
  postalCode: string | null;
  country: string | null;
  phone?: string | null;
}

export interface TaxInvoiceDTO {
  id: string;
  storeId: string;
  orderId: string;
  invoiceNumber: string;
  financialYear: string;
  issuedAt: string;
  currency: string;
  supplyType: SupplyType;
  pricesIncludeTax: boolean;
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
  lines: TaxInvoiceLineDTO[];
}

export interface IssueInvoiceInput {
  storeId: string;
  orderId: string;
  checkoutId: string;
  orderNumber: string;
  currency: string;
  shippingTotal: number;
  grandTotal: number;
  pricesIncludeTax?: boolean;
  /** Order line ids by checkout line key, so invoice lines can link back. */
  orderItemIdsByLineId?: Record<string, string>;
  buyer: InvoiceParty;
  issuedAt?: Date;
}
