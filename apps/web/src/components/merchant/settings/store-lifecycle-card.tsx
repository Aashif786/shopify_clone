"use client";

import React, { useState } from "react";
import type { StoreDetailDTO } from "@shopify-clone/stores";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmationDialog,
} from "@shopify-clone/ui";
import {
  Activity,
  AlertTriangle,
  Archive,
  PauseCircle,
  Clock,
} from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  getAvailableLifecycleActions,
  type LifecycleActionConfig,
} from "../../../lib/merchant-store-helpers";

export interface StoreLifecycleCardProps {
  store: StoreDetailDTO;
  userRole?: "owner" | "admin" | "staff";
  onStatusChange?: (updated: StoreDetailDTO) => void;
}

export function StoreLifecycleCard({
  store,
  userRole = "owner",
  onStatusChange,
}: StoreLifecycleCardProps) {
  const [activeAction, setActiveAction] = useState<LifecycleActionConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const availableActions = getAvailableLifecycleActions(store.status, userRole);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge variant="success" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </Badge>
        );
      case "SUSPENDED":
        return (
          <Badge variant="warning" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium">
            <PauseCircle className="h-3 w-3 text-amber-500" />
            Suspended
          </Badge>
        );
      case "ARCHIVED":
        return (
          <Badge variant="danger" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium">
            <Archive className="h-3 w-3 text-rose-500" />
            Archived
          </Badge>
        );
      case "DRAFT":
      default:
        return (
          <Badge variant="neutral" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium">
            <Clock className="h-3 w-3 text-muted-foreground" />
            Draft
          </Badge>
        );
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "This store is currently in draft status. You can customize catalog items, settings, and team roles before launching to the public.";
      case "ACTIVE":
        return "This store is live and operational. Shoppers can browse storefront collections and place checkouts.";
      case "SUSPENDED":
        return "This store is currently suspended. Public storefront customer browsing and checkouts are temporarily disabled. Merchant administration remains open.";
      case "ARCHIVED":
        return "This store is permanently archived. All storefront and merchant commerce operations are closed. Archival is irreversible.";
      default:
        return "Current operational lifecycle state of this store.";
    }
  };

  const handleActionClick = (action: LifecycleActionConfig) => {
    if (action.disabled || isProcessing) return;
    setApiError(null);
    setSuccessMessage(null);
    setActiveAction(action);
  };

  const handleConfirmAction = async () => {
    if (!activeAction || isProcessing) return;

    setIsProcessing(true);
    setApiError(null);
    setSuccessMessage(null);

    try {
      const updatedStore = await apiClient.post<StoreDetailDTO>(
        `/api/v1/stores/${store.id}/${activeAction.action}`,
      );

      setActiveAction(null);
      setSuccessMessage(
        `Store was successfully updated to ${updatedStore.status.toLowerCase()} status.`,
      );
      onStatusChange?.(updatedStore);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setApiError(err.message || `Failed to ${activeAction.action} store.`);
      } else {
        setApiError(
          err instanceof Error
            ? err.message
            : `An unexpected error occurred during store ${activeAction.action}.`,
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Card className="store-lifecycle-card border-border/70 bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Store Lifecycle & Operational Status
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Manage lifecycle state transitions for this store according to platform
                governance rules.
              </CardDescription>
            </div>
            <div>{getStatusBadge(store.status)}</div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          {/* Status Information Box */}
          <div className="p-4 bg-muted/40 rounded-lg border border-border/60">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-semibold text-xs uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Operational State: {store.status}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                ID: {store.id}
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {getStatusDescription(store.status)}
            </p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <Alert variant="success" title="Lifecycle Action Completed">
              {successMessage}
            </Alert>
          )}

          {/* API Error Message */}
          {apiError && (
            <Alert variant="danger" title="Transition Failed">
              {apiError}
            </Alert>
          )}

          {/* Lifecycle Actions */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Permitted Lifecycle Transitions
            </h4>

            {availableActions.length === 0 ? (
              <div className="p-5 bg-muted/20 rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground text-center">
                {store.status === "ARCHIVED"
                  ? "This store is permanently archived. No further lifecycle transitions are permitted."
                  : "No lifecycle transitions are currently available for this store status."}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {availableActions.map((action) => (
                  <div
                    key={action.action}
                    className="flex items-center justify-between p-3.5 px-4 rounded-lg border border-border/70 bg-card hover:border-border transition-colors flex-wrap gap-3"
                  >
                    <div className="flex-1 min-w-[260px]">
                      <div
                        className={`text-sm font-semibold ${
                          action.variant === "danger"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-foreground"
                        }`}
                      >
                        {action.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {action.description}
                      </div>
                      {action.disabled && action.disabledReason && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>{action.disabledReason}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <Button
                        variant={action.variant}
                        size="sm"
                        disabled={action.disabled || isProcessing}
                        onClick={() => handleActionClick(action)}
                        className="h-8 text-xs font-medium"
                      >
                        {action.label}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Disruptive/Irreversible Transitions */}
      {activeAction && (
        <ConfirmationDialog
          isOpen={Boolean(activeAction)}
          onClose={() => {
            if (!isProcessing) {
              setActiveAction(null);
            }
          }}
          onConfirm={handleConfirmAction}
          title={activeAction.dialogTitle}
          description={activeAction.dialogDescription}
          confirmLabel={activeAction.confirmLabel}
          cancelLabel="Cancel"
          isDestructive={activeAction.isDestructive}
          isLoading={isProcessing}
        />
      )}
    </>
  );
}
