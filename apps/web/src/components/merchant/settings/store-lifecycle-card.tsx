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
        return <Badge variant="success">Active</Badge>;
      case "SUSPENDED":
        return <Badge variant="warning">Suspended</Badge>;
      case "ARCHIVED":
        return <Badge variant="danger">Archived</Badge>;
      case "DRAFT":
      default:
        return <Badge variant="neutral">Draft</Badge>;
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
      <Card className="store-lifecycle-card">
        <CardHeader>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-2)",
            }}
          >
            <div>
              <CardTitle>Store Lifecycle & Operational Status</CardTitle>
              <CardDescription>
                Manage lifecycle state transitions for this store according to platform
                governance rules.
              </CardDescription>
            </div>
            <div>{getStatusBadge(store.status)}</div>
          </div>
        </CardHeader>

        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Status Information Box */}
            <div
              style={{
                padding: "var(--space-4)",
                backgroundColor: "var(--color-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "var(--space-2)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>
                  Operational State: {store.status}
                </div>
                <div
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  ID: {store.id}
                </div>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.5,
                }}
              >
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
            <div>
              <h4
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 600,
                  margin: "0 0 var(--space-3) 0",
                  color: "var(--color-text-primary)",
                }}
              >
                Permitted Lifecycle Transitions
              </h4>

              {availableActions.length === 0 ? (
                <div
                  style={{
                    padding: "var(--space-4)",
                    backgroundColor: "var(--color-bg)",
                    borderRadius: "var(--radius-md)",
                    border: "1px dashed var(--color-border)",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                  }}
                >
                  {store.status === "ARCHIVED"
                    ? "This store is permanently archived. No further lifecycle transitions are permitted."
                    : "No lifecycle transitions are currently available for this store status."}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                  }}
                >
                  {availableActions.map((action) => (
                    <div
                      key={action.action}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "var(--space-3) var(--space-4)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        flexWrap: "wrap",
                        gap: "var(--space-3)",
                      }}
                    >
                      <div style={{ flex: "1 1 280px" }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "var(--font-size-sm)",
                            color:
                              action.variant === "danger"
                                ? "var(--color-danger, #dc2626)"
                                : "var(--color-text-primary)",
                          }}
                        >
                          {action.label}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--font-size-xs)",
                            color: "var(--color-text-muted)",
                            marginTop: "2px",
                          }}
                        >
                          {action.description}
                        </div>
                        {action.disabled && action.disabledReason && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--color-warning, #d97706)",
                              marginTop: "4px",
                              fontWeight: 500,
                            }}
                          >
                            ⚠ {action.disabledReason}
                          </div>
                        )}
                      </div>

                      <div>
                        <Button
                          variant={action.variant}
                          size="sm"
                          disabled={action.disabled || isProcessing}
                          onClick={() => handleActionClick(action)}
                        >
                          {action.label}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
