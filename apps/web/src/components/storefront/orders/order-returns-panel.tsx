"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { OrderDTO } from "@calcart/orders";
import type { ReturnEligibilityDTO, ReturnRequestDTO } from "@calcart/returns";
import { Alert, Badge, Spinner } from "@calcart/ui";
import { PackageOpen, Undo2 } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { ReturnRequestDialog } from "./return-request-dialog";

export interface OrderReturnsPanelProps {
  order: OrderDTO;
  storeSlug: string;
  guestToken?: string | null;
}

interface ReturnsApiResponse {
  eligibility: ReturnEligibilityDTO;
  returns: ReturnRequestDTO[];
  customerId: string | null;
}

/** Human-readable explanation for each ineligibility reason. */
const INELIGIBILITY_COPY: Record<string, string> = {
  RETURNS_DISABLED: "This store does not currently accept returns.",
  ORDER_CANCELLED: "This order was cancelled, so there is nothing to return.",
  ORDER_NOT_FULFILLED:
    "Returns open up once your order has shipped.",
  ORDER_NOT_PAID:
    "This order has no captured payment, so there is nothing to refund.",
  ORDER_FULLY_REFUNDED: "This order has already been fully refunded.",
  RETURN_WINDOW_EXPIRED: "The return window for this order has closed.",
  RETURN_ALREADY_OPEN:
    "You already have a return in progress for this order.",
};

function statusVariant(
  status: ReturnRequestDTO["status"],
): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "REFUNDED":
      return "success";
    case "REQUESTED":
      return "warning";
    case "APPROVED":
    case "RECEIVED":
      return "info";
    case "REJECTED":
      return "danger";
    default:
      return "neutral";
  }
}

function statusLabel(status: ReturnRequestDTO["status"]): string {
  switch (status) {
    case "REQUESTED":
      return "Awaiting review";
    case "APPROVED":
      return "Approved — send items back";
    case "RECEIVED":
      return "Items received";
    case "REFUNDED":
      return "Refunded";
    case "REJECTED":
      return "Declined";
    case "CANCELLED":
      return "Withdrawn";
    default:
      return status;
  }
}

export function OrderReturnsPanel({
  order,
  storeSlug,
  guestToken,
}: OrderReturnsPanelProps) {
  const [data, setData] = useState<ReturnsApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const formatPrice = (minorUnits: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: order.currency || "USD",
    }).format(minorUnits / 100);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (guestToken) headers["x-guest-token"] = guestToken;

      const res = await apiClient.get<ReturnsApiResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(order.id)}/returns`,
        { headers, params: guestToken ? { guestToken } : undefined },
      );
      setData(res);
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not load return information.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug, order.id, guestToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleWithdraw = async (returnRequest: ReturnRequestDTO) => {
    setCancellingId(returnRequest.id);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (guestToken) headers["x-guest-token"] = guestToken;

      await apiClient.post(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(order.id)}/returns/${encodeURIComponent(returnRequest.id)}/cancel`,
        undefined,
        { headers, params: guestToken ? { guestToken } : undefined },
      );
      await load();
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not withdraw the return request.",
      );
    } finally {
      setCancellingId(null);
    }
  };

  // Nothing to show at all: no returns and the order was never returnable.
  const hasReturns = (data?.returns.length ?? 0) > 0;
  const isEligible = data?.eligibility.isEligible ?? false;
  const neverReturnable =
    !hasReturns &&
    !isEligible &&
    (data?.eligibility.reason === "ORDER_NOT_PAID" ||
      data?.eligibility.reason === "ORDER_CANCELLED" ||
      data?.eligibility.reason === "RETURNS_DISABLED");

  if (!isLoading && (neverReturnable || (!data && error === null))) {
    return null;
  }

  return (
    <div
      className="pt-4 border-t border-border/50 space-y-3"
      data-testid="order-returns-panel"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground block">
          Returns
        </span>
        {isEligible && (
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="btn btn-outline btn-sm rounded-2xl px-3 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-primary/50 transition-colors"
            data-testid="request-return-button"
          >
            <Undo2 size={13} />
            Request a return
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-2">
          <Spinner size="sm" className="spinner spinner-sm text-primary" />
          <span className="text-xs text-muted-foreground font-mono">
            Checking return eligibility…
          </span>
        </div>
      )}

      {error && (
        <Alert variant="danger" title="Returns unavailable">
          {error}
        </Alert>
      )}

      {!isLoading && data && (
        <>
          {/* Existing return requests */}
          {hasReturns && (
            <ul className="space-y-2" data-testid="order-returns-list">
              {data.returns.map((req) => (
                <li
                  key={req.id}
                  className="p-3 rounded-2xl bg-muted/20 border border-border/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {req.returnNumber}
                    </span>
                    <Badge variant={statusVariant(req.status)}>
                      {statusLabel(req.status)}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {req.items?.length ?? 0}{" "}
                    {(req.items?.length ?? 0) === 1 ? "item" : "items"} ·{" "}
                    {req.status === "REFUNDED" && req.refundedAmount !== null
                      ? `${formatPrice(req.refundedAmount)} refunded`
                      : `${formatPrice(req.requestedAmount)} expected`}
                  </div>
                  {req.reason && (
                    <div className="text-[11px] text-muted-foreground">
                      Reason: {req.reason}
                    </div>
                  )}
                  {req.merchantNote && (
                    <div className="text-[11px] text-foreground">
                      Store note: {req.merchantNote}
                    </div>
                  )}
                  {req.status === "REQUESTED" && (
                    <button
                      type="button"
                      onClick={() => handleWithdraw(req)}
                      disabled={cancellingId === req.id}
                      className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      data-testid={`withdraw-return-${req.id}`}
                    >
                      {cancellingId === req.id
                        ? "Withdrawing…"
                        : "Withdraw request"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Eligibility messaging */}
          {isEligible && data.eligibility.windowEndsAt && (
            <p className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
              <PackageOpen size={13} className="mt-0.5 shrink-0" />
              <span>
                You can request a return until{" "}
                <span className="font-semibold text-foreground">
                  {new Date(
                    data.eligibility.windowEndsAt,
                  ).toLocaleDateString()}
                </span>{" "}
                ({data.eligibility.returnWindowDays}-day return window).
              </span>
            </p>
          )}

          {!isEligible && data.eligibility.reason && !hasReturns && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {INELIGIBILITY_COPY[data.eligibility.reason] ??
                "This order is not currently eligible for a return."}
            </p>
          )}
        </>
      )}

      {data && (
        <ReturnRequestDialog
          storeSlug={storeSlug}
          orderId={order.id}
          orderNumber={order.orderNumber}
          currency={order.currency}
          guestToken={guestToken}
          eligibleItems={data.eligibility.eligibleItems}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
