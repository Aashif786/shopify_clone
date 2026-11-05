import type { Database, DatabaseClient } from "@calcart/db";
import type { OrderDTO } from "@calcart/orders";
import {
  TaxService,
  buildIssueInvoiceInput,
  renderTaxInvoiceHtml,
  type TaxInvoiceDTO,
} from "@calcart/tax";
import { ApiHttpError, apiSuccess } from "@/lib/api";

const taxService = new TaxService();

const PAID_PAYMENT_STATUSES = new Set(["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);

/**
 * Returns the order's tax invoice, issuing it now if the purchase workflow did
 * not (it is fail-open, so an invoice problem there must not lose a paid
 * order). Issuance is idempotent, so concurrent callers all get the same
 * invoice and the number sequence is consumed at most once.
 *
 * Only a paid order can be invoiced, and only a store that had tax enabled
 * when the customer checked out has a tax snapshot to build one from.
 */
export async function loadOrIssueInvoice(
  db: Database | DatabaseClient,
  storeId: string,
  order: OrderDTO,
): Promise<TaxInvoiceDTO> {
  const existing = await taxService.getInvoiceByOrderId(db, storeId, order.id);
  if (existing) {
    return existing;
  }

  if (!PAID_PAYMENT_STATUSES.has(order.paymentStatus)) {
    throw new ApiHttpError(
      404,
      "INVOICE_NOT_AVAILABLE",
      "A tax invoice is available once the order has been paid",
    );
  }

  const input = buildIssueInvoiceInput(order);
  const issued = input ? await taxService.issueInvoiceForOrder(db, input) : null;
  if (!issued) {
    throw new ApiHttpError(
      404,
      "INVOICE_NOT_AVAILABLE",
      "No tax invoice is available for this order",
    );
  }
  return issued;
}

/**
 * Renders the invoice as HTML (default), JSON (`?format=json`), or as a file
 * download (`?download=1`).
 *
 * The document carries a buyer's name and address, so it is never cached, is
 * forbidden from loading any external resource, and is served with `nosniff`.
 */
export function invoiceResponse(
  req: Request,
  invoice: TaxInvoiceDTO,
  requestId?: string,
): Response {
  const url = new URL(req.url);

  if (url.searchParams.get("format") === "json") {
    return apiSuccess(invoice, { requestId });
  }

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  });
  if (requestId) {
    headers.set("x-request-id", requestId);
  }
  if (url.searchParams.get("download") === "1") {
    const safeName = invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "_");
    headers.set(
      "Content-Disposition",
      `attachment; filename="tax-invoice-${safeName}.html"`,
    );
  }

  return new Response(renderTaxInvoiceHtml(invoice), { status: 200, headers });
}
