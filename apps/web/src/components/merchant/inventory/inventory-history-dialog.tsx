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
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Spinner size="md" label="Loading stock history..." />
            <span className="text-xs text-muted-foreground">
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
          <div className="max-h-[360px] overflow-y-auto border border-border/50 rounded-md">
            <Table fullWidth>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-xs">Date & Time</TableHead>
                  <TableHead className="font-semibold text-xs">Reason</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Delta</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Stock Change</TableHead>
                  <TableHead className="font-semibold text-xs">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => {
                  const isPositive = record.quantityDelta > 0;
                  return (
                    <TableRow key={record.id} className="hover:bg-muted/40 transition-colors">
                      {/* Date */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
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
                          className={`font-mono text-xs font-bold ${
                            isPositive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          }`}
                        >
                          {isPositive ? `+${record.quantityDelta}` : record.quantityDelta}
                        </span>
                      </TableCell>

                      {/* Stock levels before -> after */}
                      <TableCell align="right">
                        <span className="font-mono text-xs text-muted-foreground">
                          {record.previousQuantity} →{" "}
                          <strong className="text-foreground">
                            {record.newQuantity}
                          </strong>
                        </span>
                      </TableCell>

                      {/* Reference */}
                      <TableCell>
                        {record.referenceId ? (
                          <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded border border-border/50 text-foreground">
                            {record.referenceType ? `${record.referenceType}: ` : ""}
                            {record.referenceId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-mono">
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
