"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@calcart/ui";
import { ArrowLeft, ArrowRight, Package, ShoppingBag, Clock } from "lucide-react";
import { useStorefrontIdentity } from "../../../../../src/components/storefront/use-storefront-identity";
import { Reveal } from "../../../../../src/components/storefront/motion/storefront-motion";
import { StorefrontShell } from "../../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../../src/lib/api-client";

interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  total: number;
  createdAt: string;
}

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

export default function CustomerOrderHistoryPage({ params }: PageProps) {
  const { storeSlug } = use(params);
  const { storeName, theme } = useStorefrontIdentity(storeSlug);
  const router = useRouter();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await apiClient.get<{ items: CustomerOrder[] }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/account/orders`
        );
        setOrders(res.items || []);
      } catch (err: unknown) {
        if (err instanceof ApiClientError && err.status === 401) {
          router.push(`/stores/${storeSlug}/login?redirect=/stores/${storeSlug}/account/orders`);
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load order history.");
      } finally {
        setIsLoading(false);
      }
    }

    loadOrders();
  }, [storeSlug, router]);

  const formatPrice = (minorUnits: number, currency: string) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(minorUnits / 100);
  };

  const getStatusBadgeVariant = (status: string): "success" | "neutral" | "info" => {
    if (status === "PAID" || status === "DELIVERED" || status === "COMPLETED") return "success";
    if (status === "PROCESSING" || status === "SHIPPED") return "info";
    return "neutral";
  };

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug} theme={theme} fullBleed>
      <div className="at-container pb-24 pt-8 sm:pt-12 space-y-8 sm:space-y-10">
        {/* Header & Navigation */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[color:var(--at-hairline)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                PURCHASE ARCHIVE
              </span>
            </div>
            <h1 className="at-display-lg text-foreground">
              Order History
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Review past orders, verify invoices, and track live shipments for this store.
            </p>
          </div>

          <Link
            href={`/stores/${storeSlug}/account`}
            className="btn btn-outline btn-sm rounded-none px-4 py-2 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-primary/50 self-start sm:self-auto transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Account</span>
          </Link>
        </header>

        {isLoading ? (
          <div className="space-y-4 " role="status" aria-busy="true" aria-label="Loading order history">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 rounded-none border border-[color:var(--at-hairline)] bg-muted/30" />
            ))}
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto py-12">
            <Alert variant="danger" title="Error">
              {error}
            </Alert>
          </div>
        ) : orders.length === 0 ? (
          <div className="max-w-md mx-auto py-16 text-center">
            <div className="p-10 rounded-none border border-dashed border-[color:var(--at-hairline)] bg-transparent/40 space-y-4">
              <div className="w-12 h-12 rounded-none bg-muted/40 border border-[color:var(--at-hairline)] flex items-center justify-center mx-auto text-muted-foreground">
                <ShoppingBag size={20} />
              </div>
              <EmptyState
                title="No Orders Found"
                description="You haven't placed any orders with this store yet."
                action={
                  <Link
                    href={`/stores/${storeSlug}/products`}
                    className="btn btn-primary btn-md rounded-none px-6 py-2.5 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
                  >
                    <span>Browse Products</span>
                    <ArrowRight size={13} />
                  </Link>
                }
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <Reveal key={order.id} delay={Math.min(index, 5) * 0.04}>
              <Card
                className="rounded-none border border-[color:var(--at-hairline)] bg-transparent hover:border-primary/40 transition-[border-color,box-shadow] duration-200 hover:shadow-md"
              >
                <CardHeader className="p-6 sm:p-7 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-primary" />
                        <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                          Order #{order.orderNumber}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock size={12} />
                        <span>Placed on {new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getStatusBadgeVariant(order.paymentStatus)} size="sm" className="text-[10px] uppercase tracking-wider">
                        Payment: {order.paymentStatus}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(order.fulfillmentStatus)} size="sm" className="text-[10px] uppercase tracking-wider">
                        Fulfillment: {order.fulfillmentStatus}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 sm:p-7 pt-0">
                  <div className="flex items-center justify-between pt-4 border-t border-[color:var(--at-hairline)]">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground block">
                        Total Amount
                      </span>
                      <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                        {formatPrice(order.total, order.currency)}
                      </div>
                    </div>

                    <Link
                      href={`/stores/${storeSlug}/orders/${order.id}`}
                      className="btn btn-outline btn-sm rounded-none px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <span>View Details &amp; Tracking</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </CardContent>
              </Card>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </StorefrontShell>
  );
}
