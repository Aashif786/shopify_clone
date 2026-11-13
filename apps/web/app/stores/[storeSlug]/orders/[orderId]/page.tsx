"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { OrderDTO, ShipmentDTO } from "@calcart/orders";
import { Alert } from "@calcart/ui";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { useStorefrontIdentity } from "../../../../../src/components/storefront/use-storefront-identity";
import { StorefrontShell } from "../../../../../src/components/storefront/StorefrontShell";
import { OrderDetailView } from "../../../../../src/components/storefront/orders/order-details-view";
import { apiClient, ApiClientError } from "../../../../../src/lib/api-client";

interface PageProps {
  params: Promise<{ storeSlug: string; orderId: string }>;
}

interface OrderApiResponse {
  order: OrderDTO;
  shipment: ShipmentDTO | null;
  store: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };
}

export default function CustomerOrderDetailPage({ params }: PageProps) {
  const { storeSlug, orderId } = use(params);
  const router = useRouter();
  const identity = useStorefrontIdentity(storeSlug, "Order Details");
  const searchParams = useSearchParams();
  const guestToken = searchParams?.get("guestToken");

  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [shipment, setShipment] = useState<ShipmentDTO | null>(null);
  const [storeInfo, setStoreInfo] = useState<{ id: string; name: string; slug: string; currency: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    setIsNotFound(false);
    setError(null);

    try {
      const headers: Record<string, string> = {};
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }

      const res = await apiClient.get<OrderApiResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(orderId)}`,
        {
          headers,
          params: guestToken ? { guestToken } : undefined,
        },
      );

      setOrder(res.order);
      setShipment(res.shipment);
      setStoreInfo(res.store);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 404 || err.code === "ORDER_NOT_FOUND" || err.code === "STOREFRONT_NOT_FOUND") {
          setIsNotFound(true);
          return;
        }
        if (err.status === 401) {
          router.push(`/stores/${encodeURIComponent(storeSlug)}/login?redirect=${encodeURIComponent(`/stores/${storeSlug}/orders/${orderId}`)}`);
          return;
        }
      }
      setError(err instanceof Error ? err.message : "Failed to load order details.");
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug, orderId, guestToken, router]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return (
    <StorefrontShell storeName={storeInfo?.name || identity.storeName} storeSlug={storeSlug} theme={identity.theme} fullBleed>
      <div className="at-container pb-24 pt-8 sm:pt-12 space-y-8 sm:space-y-10">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6 " data-testid="order-details-loading" role="status" aria-busy="true" aria-label="Loading order details">
            <div className="h-10 w-64 rounded-none bg-muted/70" />
            <div className="h-56 rounded-none bg-muted/40" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 h-64 rounded-none bg-muted/40" />
              <div className="lg:col-span-4 h-64 rounded-none bg-muted/30" />
            </div>
          </div>
        )}

        {/* 404 / Unauthorized State */}
        {!isLoading && isNotFound && (
          <div className="max-w-md mx-auto py-16 text-center space-y-6" data-testid="order-not-found">
            <div className="p-10 rounded-none border border-dashed border-[color:var(--at-hairline)] bg-transparent/40 space-y-4">
              <div className="w-14 h-14 rounded-none bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto text-destructive">
                <ShieldAlert size={28} />
              </div>
              <div className="space-y-1.5">
                <h2 className="at-title text-2xl text-foreground">
                  Order Not Found
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  This order could not be found or you do not have permission to view it. If you placed this order as a registered customer, please sign in to the corresponding account.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={`/stores/${encodeURIComponent(storeSlug)}/login?redirect=${encodeURIComponent(`/stores/${storeSlug}/orders/${orderId}`)}`}
                  className="btn btn-primary btn-md w-full sm:w-auto rounded-none px-6 py-2.5 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={14} />
                  <span>Sign In</span>
                </Link>
                <Link
                  href={`/stores/${encodeURIComponent(storeSlug)}/account/orders`}
                  className="btn btn-outline btn-md w-full sm:w-auto rounded-none px-5 py-2.5 text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:border-primary/50"
                >
                  <ArrowLeft size={13} />
                  <span>Order History</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* General Error State */}
        {!isLoading && !isNotFound && error && (
          <div className="max-w-md mx-auto py-12 space-y-4" data-testid="order-error">
            <Alert variant="danger" title="Unable to Load Order">
              {error}
            </Alert>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => fetchOrder()}
                className="btn btn-primary btn-md rounded-none px-5 text-xs font-semibold"
              >
                Try Again
              </button>
              <Link
                href={`/stores/${encodeURIComponent(storeSlug)}/account/orders`}
                className="btn btn-outline btn-md rounded-none px-5 text-xs font-semibold"
              >
                Back to Orders
              </Link>
            </div>
          </div>
        )}

        {/* Order Details View */}
        {!isLoading && !isNotFound && !error && order && (
          <OrderDetailView
            order={order}
            storeSlug={storeSlug}
            storeName={storeInfo?.name}
            guestToken={guestToken}
            carrierStatus={shipment?.carrierStatus}
          />
        )}
      </div>
    </StorefrontShell>
  );
}
