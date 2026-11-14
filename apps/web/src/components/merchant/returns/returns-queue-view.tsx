"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReturnRequestDTO, ReturnRequestStatus } from "@calcart/returns";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Spinner,
} from "@calcart/ui";
import { hasRoleAtLeast } from "@calcart/tenant";
import { CheckCircle2, PackageCheck, Undo2, XCircle } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { useStore } from "../../../context/store-context";

interface ListResponse {
  returns: ReturnRequestDTO[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_FILTERS: Array<{
  value: ReturnRequestStatus | "ALL";
  label: string;
}> = [
  { value: "REQUESTED", label: "Needs review" },
  { value: "APPROVED", label: "Awaiting goods" },
  { value: "RECEIVED", label: "Ready to refund" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "REJECTED", label: "Declined" },
  { value: "CANCELLED", label: "Withdrawn" },
  { value: "ALL", label: "All" },
];

function statusVariant(
  status: ReturnRequestStatus,
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

export function ReturnsQueueView() {
  const { activeStore } = useStore();
  const storeId = activeStore?.id ?? null;
  const userRole = activeStore?.role;

  const [filter, setFilter] = useState<ReturnRequestStatus | "ALL">(
    "REQUESTED",
  );
  const [data, setData] = useState<ListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Refunds move money, so the button is only live for admin and owner.
  const canRefund = hasRoleAtLeast(userRole ?? "staff", "admin");

  const load = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ListResponse>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/returns`,
        {
          params: {
            limit: 50,
            ...(filter === "ALL" ? {} : { status: filter }),
          },
        },
      );
      setData(res);
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not load return requests.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [storeId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (
    req: ReturnRequestDTO,
    action: "approve" | "reject" | "receive" | "refund",
  ) => {
    if (!storeId) return;
    setBusyId(req.id);
    setActionError(null);
    try {
      await apiClient.post(
        `/api/v1/stores/${encodeURIComponent(storeId)}/returns/${encodeURIComponent(req.id)}/${action}`,
        action === "refund" ? undefined : {},
      );
      await load();
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiClientError
          ? err.message
          : `Could not ${action} return ${req.returnNumber}.`,
      );
    } finally {
      setBusyId(null);
    }
  };

  const formatPrice = (minorUnits: number, currency: string) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(minorUnits / 100);

  const rows = useMemo(() => data?.returns ?? [], [data]);

  return (
    <div className="space-y-6" data-testid="returns-queue-view">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Returns
        </h1>
        <p className="text-sm text-muted-foreground">
          Review customer return requests, confirm receipt of goods, and issue
          refunds.
        </p>
      </header>

      {/* Status filters */}
      <div
        className="flex items-center gap-2 flex-wrap"
        role="tablist"
        aria-label="Filter returns by status"
      >
        {STATUS_FILTERS.map((option) => {
          const isActive = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(option.value)}
              className={`px-3 py-1.5 rounded-2xl text-[11px] font-mono font-semibold uppercase tracking-wider border transition-colors ${
                isActive
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-card border-border/60 text-muted-foreground hover:border-primary/30"
              }`}
              data-testid={`returns-filter-${option.value}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {actionError && (
        <Alert variant="danger" title="Action failed">
          {actionError}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" title="Unable to load returns">
          {error}
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" className="spinner spinner-lg text-primary" label="Loading returns..." />
        </div>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <EmptyState
          title="No return requests"
          description={
            filter === "REQUESTED"
              ? "Nothing is waiting on your review right now."
              : "No returns match this filter."
          }
        />
      )}

      {!isLoading && rows.length > 0 && (
        <ul className="space-y-3" data-testid="returns-queue-list">
          {rows.map((req) => {
            const isBusy = busyId === req.id;
            return (
              <li key={req.id}>
                <Card>
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {req.returnNumber}
                          </span>
                          <Badge variant={statusVariant(req.status)}>
                            {req.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          Order{" "}
                          <Link
                            href={`/merchant/orders/${req.orderId}`}
                            className="text-primary underline underline-offset-2 hover:opacity-80"
                          >
                            {req.orderNumber ?? req.orderId.slice(0, 8)}
                          </Link>{" "}
                          · requested{" "}
                          {new Date(req.requestedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold text-foreground font-mono">
                          {formatPrice(
                            req.status === "REFUNDED" &&
                              req.refundedAmount !== null
                              ? req.refundedAmount
                              : req.requestedAmount,
                            req.currency,
                          )}
                        </div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {req.status === "REFUNDED" ? "Refunded" : "Requested"}
                        </div>
                      </div>
                    </div>

                    {/* Line items */}
                    {req.items && req.items.length > 0 && (
                      <ul className="space-y-1 pt-1 border-t border-border/40">
                        {req.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="min-w-0 truncate text-foreground">
                              {item.quantity} ×{" "}
                              {item.productNameSnapshot}
                              {item.variantNameSnapshot
                                ? ` (${item.variantNameSnapshot})`
                                : ""}
                            </span>
                            <span className="font-mono text-muted-foreground shrink-0">
                              {formatPrice(item.lineRefundAmount, req.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        Reason:
                      </span>{" "}
                      {req.reason}
                      {req.customerNote && (
                        <>
                          <br />
                          <span className="font-semibold text-foreground">
                            Customer note:
                          </span>{" "}
                          {req.customerNote}
                        </>
                      )}
                      {req.merchantNote && (
                        <>
                          <br />
                          <span className="font-semibold text-foreground">
                            Your note:
                          </span>{" "}
                          {req.merchantNote}
                        </>
                      )}
                    </div>

                    {/* Stage-appropriate actions only */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {req.status === "REQUESTED" && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            loading={isBusy}
                            disabled={isBusy}
                            onClick={() => runAction(req, "approve")}
                            icon={<CheckCircle2 size={14} />}
                            data-testid={`approve-return-${req.id}`}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            loading={isBusy}
                            disabled={isBusy}
                            onClick={() => runAction(req, "reject")}
                            icon={<XCircle size={14} />}
                            data-testid={`reject-return-${req.id}`}
                          >
                            Decline
                          </Button>
                        </>
                      )}

                      {req.status === "APPROVED" && (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={isBusy}
                          disabled={isBusy}
                          onClick={() => runAction(req, "receive")}
                          icon={<PackageCheck size={14} />}
                          data-testid={`receive-return-${req.id}`}
                        >
                          Mark items received
                        </Button>
                      )}

                      {req.status === "RECEIVED" && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            loading={isBusy}
                            disabled={isBusy || !canRefund}
                            onClick={() => runAction(req, "refund")}
                            icon={<Undo2 size={14} />}
                            data-testid={`refund-return-${req.id}`}
                          >
                            Issue refund
                          </Button>
                          {!canRefund && (
                            <span className="text-[11px] text-muted-foreground">
                              Refunds require an admin or owner role.
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.total > rows.length && (
        <p className="text-xs text-muted-foreground font-mono text-center">
          Showing {rows.length} of {data.total} returns
        </p>
      )}
    </div>
  );
}
