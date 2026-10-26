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
  Spinner,
} from "@shopify-clone/ui";
import { ArrowLeft, ArrowRight, Package, ShoppingBag, Clock } from "lucide-react";
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
    <StorefrontShell storeName="Order History" storeSlug={storeSlug}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
        {/* Header & Navigation */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary">
                PURCHASE ARCHIVE
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Order History
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Review past orders, verify invoices, and track live shipments for this store.
            </p>
          </div>

          <Link
            href={`/stores/${storeSlug}/account`}
            className="btn btn-outline btn-sm rounded-2xl px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-primary/50 self-start sm:self-auto transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Account</span>
          </Link>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="p-4 rounded-3xl bg-card border border-border/70 shadow-sm">
              <Spinner size="lg" className="spinner spinner-lg text-primary" label="Loading order history..." />
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground animate-pulse">
              Retrieving orders...
            </p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto py-12">
            <Alert variant="danger" title="Error">
              {error}
            </Alert>
          </div>
        ) : orders.length === 0 ? (
          <div className="max-w-md mx-auto py-16 text-center">
            <div className="p-10 rounded-3xl border border-dashed border-border/80 bg-card/40 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center mx-auto text-muted-foreground">
                <ShoppingBag size={20} />
              </div>
              <EmptyState
                title="No Orders Found"
                description="You haven't placed any orders with this store yet."
                action={
                  <Link
                    href={`/stores/${storeSlug}/products`}
                    className="btn btn-primary btn-md rounded-2xl px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider shadow-md shadow-primary/10 inline-flex items-center gap-2"
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
            {orders.map((order) => (
              <Card
                key={order.id}
                className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md shadow-sm hover:border-primary/40 transition-all duration-200"
              >
                <CardHeader className="p-6 sm:p-7 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-primary" />
                        <CardTitle className="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
                          Order #{order.orderNumber}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                        <Clock size={12} />
                        <span>Placed on {new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getStatusBadgeVariant(order.paymentStatus)} size="sm" className="font-mono text-[10px] uppercase tracking-wider">
                        Payment: {order.paymentStatus}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(order.fulfillmentStatus)} size="sm" className="font-mono text-[10px] uppercase tracking-wider">
                        Fulfillment: {order.fulfillmentStatus}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 sm:p-7 pt-0">
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                        Total Amount
                      </span>
                      <div className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                        {formatPrice(order.total, order.currency)}
                      </div>
                    </div>

                    <Link
                      href={`/stores/${storeSlug}/orders/${order.id}`}
                      className="btn btn-outline btn-sm rounded-2xl px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <span>View Details &amp; Tracking</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StorefrontShell>
  );
}
