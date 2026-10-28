"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { OrderDTO } from "@shopify-clone/orders";
import { Alert, Spinner } from "@shopify-clone/ui";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { StorefrontShell } from "../../../../../src/components/storefront/StorefrontShell";
import { OrderDetailView } from "../../../../../src/components/storefront/orders/order-details-view";
import { apiClient, ApiClientError } from "../../../../../src/lib/api-client";

interface PageProps {
  params: Promise<{ storeSlug: string; orderId: string }>;
}

interface OrderApiResponse {
  order: OrderDTO;
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
  const searchParams = useSearchParams();
  const guestToken = searchParams?.get("guestToken");

  const [order, setOrder] = useState<OrderDTO | null>(null);
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
    <StorefrontShell storeName={storeInfo?.name || "Order Details"} storeSlug={storeSlug}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4" data-testid="order-details-loading">
            <div className="p-4 rounded-3xl bg-card border border-border/70 shadow-sm">
              <Spinner size="lg" className="spinner spinner-lg text-primary" label="Loading order details..." />
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground animate-pulse">
              Retrieving order details...
            </p>
          </div>
        )}

        {/* 404 / Unauthorized State */}
        {!isLoading && isNotFound && (
          <div className="max-w-md mx-auto py-16 text-center space-y-6" data-testid="order-not-found">
            <div className="p-10 rounded-3xl border border-dashed border-border/80 bg-card/40 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto text-destructive">
                <ShieldAlert size={28} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Order Not Found
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  This order could not be found or you do not have permission to view it. If you placed this order as a registered customer, please sign in to the corresponding account.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={`/stores/${encodeURIComponent(storeSlug)}/login?redirect=${encodeURIComponent(`/stores/${storeSlug}/orders/${orderId}`)}`}
                  className="btn btn-primary btn-md w-full sm:w-auto rounded-2xl px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider shadow-md shadow-primary/10 inline-flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={14} />
                  <span>Sign In</span>
                </Link>
                <Link
                  href={`/stores/${encodeURIComponent(storeSlug)}/account/orders`}
                  className="btn btn-outline btn-md w-full sm:w-auto rounded-2xl px-5 py-2.5 text-xs font-mono font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:border-primary/50"
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
                className="btn btn-primary btn-md rounded-2xl px-5 text-xs font-semibold"
              >
                Try Again
              </button>
              <Link
                href={`/stores/${encodeURIComponent(storeSlug)}/account/orders`}
                className="btn btn-outline btn-md rounded-2xl px-5 text-xs font-semibold"
              >
                Back to Orders
              </Link>
            </div>
          </div>
        )}

        {/* Order Details View */}
        {!isLoading && !isNotFound && !error && order && (
          <OrderDetailView order={order} storeSlug={storeSlug} storeName={storeInfo?.name} />
        )}
      </div>
    </StorefrontShell>
  );
}
