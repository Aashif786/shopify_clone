"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import type { CustomerWithAddressesDTO } from "@shopify-clone/customers";
import { Button, EmptyState, Spinner } from "@shopify-clone/ui";
import { MerchantShell } from "../../../../src/components/merchant/MerchantShell";
import { CustomerDetailsView } from "../../../../src/components/merchant/customers/customer-details-view";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";
import { ApiClientError, apiClient } from "../../../../src/lib/api-client";
import { formatCustomerName } from "../../../../src/lib/merchant-customer-helpers";

interface CustomerDetailPageProps {
  params: Promise<{ customerId: string }>;
}

export default function MerchantCustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { customerId } = use(params);
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [customer, setCustomer] = useState<CustomerWithAddressesDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const userRole = activeStore?.role;

  const loadCustomerDetail = useCallback(
    async (storeId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiClient.get<CustomerWithAddressesDTO>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customerId)}`,
        );
        setCustomer(data);
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          if (err.status === 404) {
            setError("Customer was not found in this store.");
          } else if (err.status === 403) {
            setError("You do not have permission to view this customer.");
          } else {
            setError(err.message || "Failed to load customer details.");
          }
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading customer.",
          );
        }
        setCustomer(null);
      } finally {
        setIsLoading(false);
      }
    },
    [customerId],
  );

  useEffect(() => {
    if (activeStore?.id) {
      loadCustomerDetail(activeStore.id);
    } else {
      setIsLoading(false);
      setCustomer(null);
    }
  }, [activeStore?.id, loadCustomerDetail]);

  const customerTitle = customer
    ? formatCustomerName(customer)
    : "Customer Details";

  return (
    <MerchantShell
      activePath="/merchant/customers"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      userRole={userRole}
      onLogout={logout}
      title={customerTitle}
      subtitle="View and edit customer profile, manage address book, and inspect order records"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Loading Spinner */}
        {(isStoreLoading || (isLoading && !customer)) && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "260px",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <Spinner size="lg" label="Loading customer details..." />
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
              Fetching customer profile and address records...
            </span>
          </div>
        )}

        {/* No Store Selected */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Store Selected"
            description="Please select an active store to manage customer accounts."
            action={
              <a href="/merchant/stores" className="btn btn-primary">
                Select Store
              </a>
            }
          />
        )}

        {/* Error / Not Found */}
        {!isLoading && error && activeStore && (
          <EmptyState
            title="Customer Not Found"
            description={error}
            action={
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <a href="/merchant/customers" className="btn btn-outline">
                  ← Back to Customers
                </a>
                <Button
                  variant="primary"
                  onClick={() => loadCustomerDetail(activeStore.id)}
                >
                  Retry
                </Button>
              </div>
            }
          />
        )}

        {/* Customer Details View */}
        {!isLoading && !error && customer && activeStore && (
          <CustomerDetailsView
            storeId={activeStore.id}
            customer={customer}
            userRole={userRole}
            onRefreshCustomer={() => loadCustomerDetail(activeStore.id)}
          />
        )}
      </div>
    </MerchantShell>
  );
}
