"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import type { OrderDTO } from "@shopify-clone/orders";
import { CartProvider } from "../../../../../../src/context/cart-context";
import { StorefrontShell } from "../../../../../../src/components/storefront/StorefrontShell";
import { OrderConfirmation } from "../../../../../../src/components/storefront/orders/order-confirmation";
import { apiClient } from "../../../../../../src/lib/api-client";
import { Button, Spinner } from "@shopify-clone/ui";

interface ConfirmationPageProps {
  params: Promise<{ storeSlug: string; orderId: string }>;
}

interface OrderApiResponse {
  order: OrderDTO;
  store: { id: string; name: string; slug: string; currency: string };
}

import { useSearchParams } from "next/navigation";

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
      <div className="storefront-confirmation-page-container" style={{ padding: "var(--space-6) var(--space-4)" }}>
        {/* Loading */}
        {isLoading && (
          <div className="storefront-grid-state text-center" style={{ padding: "var(--space-12) 0" }} data-testid="confirmation-loading">
            <Spinner size="lg" />
            <p className="text-muted" style={{ marginTop: "var(--space-3)" }}>
              Loading order confirmation...
            </p>
          </div>
        )}

        {/* Error / Not Found */}
        {error && !isLoading && (
          <div className="card text-center" style={{ maxWidth: "600px", margin: "var(--space-12) auto", padding: "var(--space-8)" }} data-testid="confirmation-error">
            <h2 className="font-bold text-xl" style={{ margin: "0 0 var(--space-2) 0" }}>
              Unable to Load Order
            </h2>
            <p className="text-muted text-sm" style={{ marginBottom: "var(--space-4)" }}>
              {error}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)" }}>
              <Button variant="primary" size="md" onClick={() => fetchOrder()}>
                Try Again
              </Button>
              <a href={catalogHref} className="btn btn-outline btn-md">
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

export default function StorefrontOrderConfirmationPage({ params }: ConfirmationPageProps) {
  const { storeSlug, orderId } = use(params);
  const [storeName, setStoreName] = useState<string>("Online Store");

  useEffect(() => {
    let active = true;
    apiClient
      .get<{ store: { name: string } }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart`,
      )
      .then((data) => {
        if (active && data?.store?.name) {
          setStoreName(data.store.name);
        }
      })
      .catch(() => {
        if (active) {
          setStoreName(storeSlug.charAt(0).toUpperCase() + storeSlug.slice(1));
        }
      });

    return () => {
      active = false;
    };
  }, [storeSlug]);

  return (
    <CartProvider storeSlug={storeSlug}>
      <ConfirmationView storeSlug={storeSlug} orderId={orderId} storeName={storeName} />
    </CartProvider>
  );
}
