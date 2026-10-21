"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from "@shopify-clone/ui";
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
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-6)",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "var(--font-size-2xl)",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Order History
            </h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}>
              Review past orders and track current shipments in this store.
            </p>
          </div>

          <a href={`/stores/${storeSlug}/account`} className="btn btn-outline btn-sm">
            ← Back to Account
          </a>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16) 0" }}>
            <Spinner size="lg" label="Loading order history..." />
          </div>
        ) : error ? (
          <Alert variant="danger" title="Error">
            {error}
          </Alert>
        ) : orders.length === 0 ? (
          <EmptyState
            title="No Orders Found"
            description="You haven't placed any orders with this store yet."
            action={
              <Button
                variant="primary"
                onClick={() => router.push(`/stores/${storeSlug}/products`)}
              >
                Browse Products
              </Button>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader style={{ paddingBottom: "var(--space-3)" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div>
                      <CardTitle style={{ fontSize: "var(--font-size-base)" }}>
                        Order #{order.orderNumber}
                      </CardTitle>
                      <CardDescription>
                        Placed on {new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </CardDescription>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <Badge variant={getStatusBadgeVariant(order.paymentStatus)}>
                        Payment: {order.paymentStatus}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(order.fulfillmentStatus)}>
                        Fulfillment: {order.fulfillmentStatus}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent style={{ paddingTop: "var(--space-2)" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: "var(--space-3)",
                      borderTop: "1px solid var(--color-border)",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                        Total Amount
                      </span>
                      <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text-primary)" }}>
                        {formatPrice(order.total, order.currency)}
                      </div>
                    </div>

                    <a
                      href={`/stores/${storeSlug}/orders/${order.id}`}
                      className="btn btn-outline btn-sm"
                    >
                      View Details & Tracking →
                    </a>
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
