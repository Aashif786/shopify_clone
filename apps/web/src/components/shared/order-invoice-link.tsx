"use client";

import React, { useEffect, useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { apiClient } from "../../lib/api-client";

const PAID_STATUSES = new Set(["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);

export interface OrderInvoiceLinkProps {
  /** Invoice endpoint for this order, with no query string. */
  invoicePath: string;
  paymentStatus: string;
  /**
   * Ownership token for a guest order. A link cannot carry a header, so for a
   * guest it travels as a query parameter, the same way the order page itself
   * accepts it. A signed-in customer or merchant is identified by cookie.
   */
  guestToken?: string | null;
  /**
   * Layout. The divider belongs to this component, not its parent, so a store
   * with no invoice leaves no stray empty rule behind.
   * "row" is a compact divided row, "section" a roomier divided block, and
   * "plain" has no divider.
   */
  variant?: "row" | "section" | "plain";
  testId?: string;
}

interface InvoiceSummary {
  invoiceNumber: string;
}

/**
 * Shows "View" and "Download" for an order's GST tax invoice, but only when one
 * exists. It asks the API first and renders nothing on any failure, because for
 * a store that charges no tax there is simply no invoice, and that is not an
 * error worth showing a customer.
 */
export function OrderInvoiceLink({
  invoicePath,
  paymentStatus,
  guestToken,
  variant = "row",
  testId = "order-invoice-link",
}: OrderInvoiceLinkProps) {
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const isPaid = PAID_STATUSES.has(paymentStatus);

  useEffect(() => {
    if (!isPaid) {
      setInvoice(null);
      return;
    }

    let cancelled = false;
    const headers: Record<string, string> = {};
    if (guestToken) headers["x-guest-token"] = guestToken;

    apiClient
      .get<InvoiceSummary>(invoicePath, {
        headers,
        params: { format: "json", ...(guestToken ? { guestToken } : {}) },
      })
      .then((result) => {
        if (!cancelled) setInvoice({ invoiceNumber: result.invoiceNumber });
      })
      .catch(() => {
        if (!cancelled) setInvoice(null);
      });

    return () => {
      cancelled = true;
    };
  }, [invoicePath, isPaid, guestToken]);

  if (!invoice) return null;

  const query = guestToken ? `guestToken=${encodeURIComponent(guestToken)}` : "";
  const viewHref = query ? `${invoicePath}?${query}` : invoicePath;
  const downloadHref = `${invoicePath}?${query ? `${query}&` : ""}download=1`;

  const linkClass =
    "inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80 transition-opacity active:opacity-60";

  return (
    <div
      className={
        variant === "row"
          ? "border-t border-border/50 pt-2.5 space-y-1.5"
          : variant === "section"
            ? "border-t border-border/50 pt-4 space-y-1.5"
            : "space-y-1.5"
      }
      data-testid={testId}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground uppercase font-semibold text-[11px]">
        <FileText className="w-3.5 h-3.5" aria-hidden="true" />
        Tax invoice
      </div>
      <div className="font-mono text-xs text-foreground break-all">{invoice.invoiceNumber}</div>
      <div className="flex items-center gap-4">
        <a href={viewHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          View
        </a>
        <a href={downloadHref} className={linkClass}>
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Download
        </a>
      </div>
    </div>
  );
}
