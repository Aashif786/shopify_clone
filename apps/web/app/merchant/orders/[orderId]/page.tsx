"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OrderDTO } from "@calcart/orders";
import { Alert, Button, EmptyState, Spinner } from "@calcart/ui";
import { MerchantShell } from "../../../../src/components/merchant/MerchantShell";
import { OrderCancelDialog } from "../../../../src/components/merchant/orders/order-cancel-dialog";
import { OrderFulfillDialog } from "../../../../src/components/merchant/orders/order-fulfill-dialog";
import { OrderRefundDialog } from "../../../../src/components/merchant/orders/order-refund-dialog";
import type { OrderRefundSummaryDTO } from "@calcart/payments";
import { OrderDetailsView } from "../../../../src/components/merchant/orders/order-details-view";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";
import { ApiClientError, apiClient } from "../../../../src/lib/api-client";
import { ArrowLeft, RefreshCw } from "lucide-react";

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default function MerchantOrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = use(params);
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState<boolean>(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);
  const [refundSummary, setRefundSummary] = useState<OrderRefundSummaryDTO | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const userRole = activeStore?.role;

  const loadOrderDetail = useCallback(
    async (storeId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiClient.get<OrderDTO>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}`,
        );
        setOrder(data);
        apiClient
          .get<OrderRefundSummaryDTO>(
            `/api/v1/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}/refund`,
          )
          .then(setRefundSummary)
          .catch(() => setRefundSummary(null));
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          if (err.status === 404) {
            setError(`Order was not found in this store.`);
          } else if (err.status === 403) {
            setError(`You do not have permission to view this order.`);
          } else {
            setError(err.message || "Failed to load order details.");
          }
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading order.",
          );
        }
        setOrder(null);
      } finally {
        setIsLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    if (activeStore?.id) {
      loadOrderDetail(activeStore.id);
    } else {
      setIsLoading(false);
      setOrder(null);
    }
  }, [activeStore?.id, loadOrderDetail]);

  const handleCancelSuccess = (updatedOrder: OrderDTO) => {
    setOrder(updatedOrder);
    setIsCancelModalOpen(false);
    setSuccessMessage(
      `Order #${updatedOrder.orderNumber} has been cancelled and reserved inventory was released back to stock.`,
    );
  };

  const handleFulfillSuccess = (updatedOrder: OrderDTO) => {
    setOrder(updatedOrder);
    setIsFulfillModalOpen(false);
    setSuccessMessage(
      `Order #${updatedOrder.orderNumber} has been successfully fulfilled and transitioned to shipped.`,
    );
  };

  const handleRefundSuccess = (updatedOrder: OrderDTO, message: string) => {
    setOrder(updatedOrder);
    setIsRefundModalOpen(false);
    setSuccessMessage(message);
    if (activeStore?.id) {
      apiClient
        .get<OrderRefundSummaryDTO>(
          `/api/v1/stores/${encodeURIComponent(activeStore.id)}/orders/${encodeURIComponent(orderId)}/refund`,
        )
        .then(setRefundSummary)
        .catch(() => {});
    }
  };

  return (
    <MerchantShell
      activePath="/merchant/orders"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      userRole={userRole}
      onLogout={logout}
      title={order ? `Order #${order.orderNumber}` : "Order Details"}
      subtitle="View customer order items, payment status, addresses, and order lifecycle history"
    >
      <div className="space-y-6">
        {/* Success Alert */}
        {successMessage && (
          <Alert variant="success" title="Success" onDismiss={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {/* Loading Spinner */}
        {(isStoreLoading || (isLoading && !order)) && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size="lg" label="Loading order details..." />
            <span className="text-xs text-muted-foreground font-medium">
              Loading order data and line items...
            </span>
          </div>
        )}

        {/* No Store Selected */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Store Selected"
            description="Please select an active store to view order details."
            action={
              <Link href="/merchant/stores" className="btn btn-primary">
                Select Store
              </Link>
            }
          />
        )}

        {/* Error / Not Found */}
        {!isLoading && error && activeStore && (
          <EmptyState
            title="Order Not Found"
            description={error}
            action={
              <div className="flex gap-2">
                <Link href="/merchant/orders" className="btn btn-outline inline-flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Orders</span>
                </Link>
                <Button
                  variant="primary"
                  onClick={() => loadOrderDetail(activeStore.id)}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </Button>
              </div>
            }
          />
        )}

        {/* Order Details View */}
        {!isLoading && !error && order && activeStore && (
          <OrderDetailsView
            order={order}
            userRole={userRole}
            onOpenCancel={() => setIsCancelModalOpen(true)}
            onOpenFulfill={() => setIsFulfillModalOpen(true)}
            refundSummary={refundSummary}
            onOpenRefund={() => setIsRefundModalOpen(true)}
          />
        )}
      </div>

      {/* Cancellation Modal */}
      {activeStore && order && (
        <OrderCancelDialog
          storeId={activeStore.id}
          order={order}
          isOpen={isCancelModalOpen}
          userRole={userRole}
          onClose={() => setIsCancelModalOpen(false)}
          onSuccess={handleCancelSuccess}
        />
      )}

      {/* Fulfillment Modal */}
      {activeStore && order && (
        <OrderFulfillDialog
          storeId={activeStore.id}
          order={order}
          isOpen={isFulfillModalOpen}
          userRole={userRole}
          onClose={() => setIsFulfillModalOpen(false)}
          onSuccess={handleFulfillSuccess}
        />
      )}

      {/* Refund Modal */}
      {activeStore && order && (
        <OrderRefundDialog
          storeId={activeStore.id}
          order={order}
          refundSummary={refundSummary}
          isOpen={isRefundModalOpen}
          userRole={userRole}
          onClose={() => setIsRefundModalOpen(false)}
          onSuccess={handleRefundSuccess}
        />
      )}
    </MerchantShell>
  );
}
