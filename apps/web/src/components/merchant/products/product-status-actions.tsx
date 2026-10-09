"use client";

import React, { useState } from "react";
import type { ProductDetailDTO, ProductStatus } from "@shopify-clone/products";
import {
  Button,
  ConfirmationDialog,
  Alert,
} from "@shopify-clone/ui";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import { apiClient, ApiClientError } from "../../../lib/api-client";

export interface ProductStatusActionsProps {
  product: ProductDetailDTO;
  storeId: string;
  userRole?: "owner" | "admin" | "staff";
  onStatusChange: (updatedProduct: ProductDetailDTO) => void;
  disabled?: boolean;
}

export function ProductStatusActions({
  product,
  storeId,
  userRole = "staff",
  onStatusChange,
  disabled = false,
}: ProductStatusActionsProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"publish" | "unpublish" | "archive" | null>(null);

  const canManageStatus = hasRoleAtLeast(userRole, "admin");

  const executeTransition = async (action: "publish" | "unpublish" | "archive") => {
    setIsSubmitting(true);
    setError(null);
    try {
      let endpoint = `/api/v1/stores/${storeId}/products/${product.id}/publish`;
      if (action === "unpublish") {
        endpoint = `/api/v1/stores/${storeId}/products/${product.id}/unpublish`;
      } else if (action === "archive") {
        endpoint = `/api/v1/stores/${storeId}/products/${product.id}/archive`;
      }

      const updated = await apiClient.post<ProductDetailDTO>(
        endpoint,
        {},
        { storeId }
      );
      onStatusChange(updated);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || `Failed to transition product status to ${action}`);
      } else {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
      setConfirmAction(null);
    }
  };

  const renderButtons = () => {
    if (!canManageStatus) {
      return (
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
            alignSelf: "center",
          }}
        >
          Admin privileges required to change product status.
        </span>
      );
    }

    const currentStatus: ProductStatus = product.status;

    return (
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
        {/* Publish Action: available for DRAFT */}
        {currentStatus === "DRAFT" && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => executeTransition("publish")}
            disabled={disabled || isSubmitting}
            loading={isSubmitting && confirmAction === "publish"}
          >
            Publish Product
          </Button>
        )}

        {/* Unpublish Action: available for ACTIVE */}
        {currentStatus === "ACTIVE" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmAction("unpublish")}
            disabled={disabled || isSubmitting}
          >
            Unpublish (Draft)
          </Button>
        )}

        {/* Restore Action: available for ARCHIVED -> DRAFT */}
        {currentStatus === "ARCHIVED" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => executeTransition("unpublish")}
            disabled={disabled || isSubmitting}
            loading={isSubmitting && confirmAction === "unpublish"}
          >
            Restore to Draft
          </Button>
        )}

        {/* Archive Action: available for DRAFT or ACTIVE */}
        {currentStatus !== "ARCHIVED" && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmAction("archive")}
            disabled={disabled || isSubmitting}
          >
            Archive Product
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="product-status-actions">
      {error && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          <Alert
            variant="danger"
            title="Status Change Error"
            onDismiss={() => setError(null)}
          >
            {error}
          </Alert>
        </div>
      )}

      {renderButtons()}

      {/* Confirmation Dialogs for Consequential Actions */}
      <ConfirmationDialog
        isOpen={confirmAction === "unpublish"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => executeTransition("unpublish")}
        title="Unpublish Product?"
        description="Unpublishing this product will remove it from your online storefront and customers will no longer be able to purchase it."
        confirmLabel="Unpublish"
        isDestructive={false}
        isLoading={isSubmitting}
      />

      <ConfirmationDialog
        isOpen={confirmAction === "archive"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => executeTransition("archive")}
        title="Archive Product?"
        description="Archiving will remove this product from active catalog sales and drafts. You can restore it to Draft status later."
        confirmLabel="Archive"
        isDestructive={true}
        isLoading={isSubmitting}
      />
    </div>
  );
}
