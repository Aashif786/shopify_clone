"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { InventoryAdjustmentDTO } from "@shopify-clone/inventory";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  formatAdjustmentReason,
  type InventoryVariantItem,
} from "../../../lib/merchant-inventory-helpers";

export interface InventoryHistoryDialogProps {
  storeId: string;
  variantItem: InventoryVariantItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InventoryHistoryDialog({
  storeId,
  variantItem,
  isOpen,
  onClose,
}: InventoryHistoryDialogProps) {
  const [history, setHistory] = useState<InventoryAdjustmentDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!variantItem) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{ items: InventoryAdjustmentDTO[] }>(
        `/api/v1/stores/${storeId}/inventory/${variantItem.variantId}/history?limit=50`,
      );
      setHistory(response.items || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to load inventory movement history.");
      } else {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred loading history.",
        );
      }
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, variantItem]);

  useEffect(() => {
    if (isOpen && variantItem) {
      fetchHistory();
    } else {
      setHistory([]);
      setError(null);
    }
  }, [isOpen, variantItem, fetchHistory]);

  if (!variantItem) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Inventory Audit History"
      description={`Chronological record of stock movements and manual adjustments for "${variantItem.productTitle} — ${variantItem.variantTitle}".`}
      size="lg"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {isLoading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "180px",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <Spinner size="md" label="Loading stock history..." />
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
              Fetching audit records...
            </span>
          </div>
        )}

        {error && !isLoading && (
          <Alert
            variant="danger"
            title="Failed to Load History"
            action={
              <Button variant="outline" size="sm" onClick={fetchHistory}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {!isLoading && !error && history.length === 0 && (
          <EmptyState
            title="No Movement Records Found"
            description="No adjustments or movements have been recorded for this variant yet."
          />
        )}

        {!isLoading && !error && history.length > 0 && (
          <div style={{ maxHeight: "360px", overflowY: "auto" }}>
            <Table fullWidth>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead align="right">Delta</TableHead>
                  <TableHead align="right">Stock Change</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => {
                  const isPositive = record.quantityDelta > 0;
                  return (
                    <TableRow key={record.id}>
                      {/* Date */}
                      <TableCell>
                        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                          {new Date(record.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </TableCell>

                      {/* Reason */}
                      <TableCell>
                        <Badge
                          variant={
                            record.reason === "RESTOCK" || record.reason === "INITIAL_STOCK"
                              ? "success"
                              : record.reason === "DAMAGED" || record.reason === "LOST"
                                ? "danger"
                                : "neutral"
                          }
                          size="sm"
                        >
                          {formatAdjustmentReason(record.reason)}
                        </Badge>
                      </TableCell>

                      {/* Quantity Delta */}
                      <TableCell align="right">
                        <span
                          style={{
                            fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--font-size-xs)",
                            color: isPositive
                              ? "var(--color-success, #16a34a)"
                              : "var(--color-danger, #dc2626)",
                          }}
                        >
                          {isPositive ? `+${record.quantityDelta}` : record.quantityDelta}
                        </span>
                      </TableCell>

                      {/* Stock levels before -> after */}
                      <TableCell align="right">
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--font-size-xs)",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {record.previousQuantity} →{" "}
                          <strong style={{ color: "var(--color-text-primary)" }}>
                            {record.newQuantity}
                          </strong>
                        </span>
                      </TableCell>

                      {/* Reference */}
                      <TableCell>
                        {record.referenceId ? (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "11px",
                              backgroundColor: "var(--color-bg)",
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--color-border)",
                            }}
                          >
                            {record.referenceType ? `${record.referenceType}: ` : ""}
                            {record.referenceId}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
