"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import type { OrderDTO } from "@shopify-clone/orders";
import { CartProvider } from "../../../../../../src/context/cart-context";
import { StorefrontShell } from "../../../../../../src/components/storefront/StorefrontShell";
import { OrderConfirmation } from "../../../../../../src/components/storefront/orders/order-confirmation";
import { apiClient } from "../../../../../../src/lib/api-client";
import { Button, Spinner } from "@shopify-clone/ui";
import { useSearchParams } from "next/navigation";

interface ConfirmationPageProps {
  params: Promise<{ storeSlug: string; orderId: string }>;
}

interface OrderApiResponse {
  order: OrderDTO;
  store: { id: string; name: string; slug: string; currency: string };
}

function ConfirmationView({
  storeSlug,
  orderId,
  storeName,
}: {
  storeSlug: string;
  orderId: string;
  storeName: string;
}) {
  const searchParams = useSearchParams();
  const guestToken = searchParams?.get("guestToken");

  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }
      const res = await apiClient.get<OrderApiResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(orderId)}`,
        { headers },
      );
      setOrder(res.order);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load order confirmation";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug, orderId, guestToken]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug}>
      <div className="storefront-confirmation-page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Loading */}
        {isLoading && (
          <div className="storefront-grid-state text-center py-24 space-y-3" data-testid="confirmation-loading">
            <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm inline-block">
              <Spinner size="lg" className="spinner spinner-lg text-primary" />
            </div>
            <p className="text-muted-foreground text-sm font-medium animate-pulse">
              Loading order confirmation...
            </p>
          </div>
        )}

        {/* Error / Not Found */}
        {error && !isLoading && (
          <div className="card max-w-md mx-auto py-16 px-6 text-center rounded-3xl border border-destructive/20 bg-destructive/5 shadow-sm space-y-4" data-testid="confirmation-error">
            <h2 className="font-extrabold text-xl tracking-tight text-foreground">
              Unable to Load Order
            </h2>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-xs mx-auto">
              {error}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="primary" size="md" onClick={() => fetchOrder()} className="rounded-2xl px-5 text-xs font-semibold">
                Try Again
              </Button>
              <a href={catalogHref} className="btn btn-outline btn-md rounded-2xl px-5 text-xs font-semibold">
                Return to Store
              </a>
            </div>
          </div>
        )}

        {/* Confirmed Order Display */}
        {!isLoading && order && (
          <OrderConfirmation order={order} storeSlug={storeSlug} storeName={storeName} />
        )}
      </div>
    </StorefrontShell>
  );
}

export default function StorefrontOrderConfirmationPage({
  params,
}: ConfirmationPageProps) {
  const { storeSlug, orderId } = use(params);
  const formattedStoreName = storeSlug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <CartProvider storeSlug={storeSlug}>
      <ConfirmationView
        storeSlug={storeSlug}
        orderId={orderId}
        storeName={formattedStoreName}
      />
    </CartProvider>
  );
}
