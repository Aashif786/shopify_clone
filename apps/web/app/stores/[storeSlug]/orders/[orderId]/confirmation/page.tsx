"use client";

import Link from "next/link";
import React, { use, useCallback, useEffect, useState } from "react";
import type { OrderDTO } from "@calcart/orders";
import { StorefrontShell } from "../../../../../../src/components/storefront/StorefrontShell";
import { OrderConfirmation } from "../../../../../../src/components/storefront/orders/order-confirmation";
import { apiClient } from "../../../../../../src/lib/api-client";
import { Button } from "@calcart/ui";
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
    <StorefrontShell storeName={storeName} storeSlug={storeSlug} fullBleed>
      <div className="storefront-confirmation-page-container at-container pb-24 pt-8 sm:pt-12">
        {/* Loading */}
        {isLoading && (
          <div className="storefront-grid-state space-y-4 py-10" data-testid="confirmation-loading" aria-busy="true">
            <div className="at-skeleton h-12 w-2/3 max-w-xl" />
            <div className="at-skeleton h-4 w-1/2 max-w-md" />
            <p className="sr-only">Loading order confirmation...</p>
          </div>
        )}

        {/* Error / Not Found */}
        {error && !isLoading && (
          <div className="border-y border-[color:var(--at-hairline)] py-16 text-center space-y-4" data-testid="confirmation-error">
            <h2 className="at-display-md text-foreground">
              Unable to Load Order
            </h2>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-xs mx-auto">
              {error}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="primary" size="md" onClick={() => fetchOrder()} className="rounded-none px-5 text-xs font-medium uppercase tracking-[0.12em]">
                Try Again
              </Button>
              <Link href={catalogHref} className="at-link text-xs text-foreground">
                Return to Store
              </Link>
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
      <ConfirmationView
        storeSlug={storeSlug}
        orderId={orderId}
        storeName={formattedStoreName}
      />
  );
}
