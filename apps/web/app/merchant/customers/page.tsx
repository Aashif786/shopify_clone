"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CustomerDTO, CustomerListDTO } from "@shopify-clone/customers";
import { Alert, Button, EmptyState, Skeleton, Spinner } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { CustomerCreateDialog } from "../../../src/components/merchant/customers/customer-create-dialog";
import { CustomerListTable } from "../../../src/components/merchant/customers/customer-list-table";
import { CustomerStatusDialog } from "../../../src/components/merchant/customers/customer-status-dialog";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { ApiClientError, apiClient } from "../../../src/lib/api-client";
import {
  INITIAL_CUSTOMER_FILTERS,
  type CustomerFilterState,
} from "../../../src/lib/merchant-customer-helpers";
import { RefreshCw } from "lucide-react";

export default function MerchantCustomersPage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<CustomerFilterState>(INITIAL_CUSTOMER_FILTERS);

  const [isLoadingCustomers, setIsLoadingCustomers] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [statusDialogState, setStatusDialogState] = useState<{
    customer: CustomerDTO | null;
    action: "enable" | "disable";
    isOpen: boolean;
  }>({ customer: null, action: "disable", isOpen: false });

  const userRole = activeStore?.role;

  const loadCustomers = useCallback(
    async (
      storeId: string,
      currentFilters: CustomerFilterState,
      cursor?: string,
      append = false,
    ) => {
      setIsLoadingCustomers(true);
      setFetchError(null);

      try {
        const queryParams = new URLSearchParams();
        queryParams.set("limit", "50");

        if (currentFilters.status && currentFilters.status !== "ALL") {
          queryParams.set("status", currentFilters.status);
        }
        if (currentFilters.search && currentFilters.search.trim()) {
          queryParams.set("search", currentFilters.search.trim());
        }
        if (cursor) {
          queryParams.set("cursor", cursor);
        }

        const res = await apiClient.get<CustomerListDTO>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/customers?${queryParams.toString()}`,
        );

        if (append) {
          setCustomers((prev) => [...prev, ...res.items]);
        } else {
          setCustomers(res.items);
        }

        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          setFetchError(err.message || "Failed to load customers for this store.");
        } else {
          setFetchError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while fetching customers.",
          );
        }
        if (!append) {
          setCustomers([]);
        }
      } finally {
        setIsLoadingCustomers(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (activeStore?.id) {
      loadCustomers(activeStore.id, filters);
    } else {
      setCustomers([]);
      setFetchError(null);
      setIsLoadingCustomers(false);
    }
  }, [activeStore?.id, filters, loadCustomers]);

  const handleNextPage = () => {
    if (activeStore?.id && nextCursor) {
      loadCustomers(activeStore.id, filters, nextCursor, true);
    }
  };

  const handleCreateSuccess = (newCustomer: CustomerDTO) => {
    setCustomers((prev) => [newCustomer, ...prev]);
    setIsCreateOpen(false);
    setSuccessMessage(`Customer "${newCustomer.email}" added successfully.`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleToggleStatus = (customer: CustomerDTO, action: "enable" | "disable") => {
    setStatusDialogState({ customer, action, isOpen: true });
  };

  const handleStatusChangeSuccess = (updatedCustomer: CustomerDTO) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c)),
    );
    setStatusDialogState({ customer: null, action: "disable", isOpen: false });
    setSuccessMessage(
      `Customer status updated to ${updatedCustomer.status}.`,
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  };

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
      title="Customers Management"
      subtitle="Manage customer profiles, contact info, accounts, and address records"
    >
      <div className="space-y-6">
        {/* Success Alert */}
        {successMessage && (
          <Alert variant="success" title="Success" onDismiss={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {/* Loading state: Store or initial customers load */}
        {(isStoreLoading || (activeStore && isLoadingCustomers && customers.length === 0)) && (
          <div
            className="space-y-6"
            data-testid="customers-loading-skeleton"
          >
            {/* KPI Skeletons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-4 border border-border rounded-lg bg-card"
                >
                  <Skeleton width="50%" height={14} />
                  <div className="mt-2">
                    <Skeleton width="35%" height={26} />
                  </div>
                </div>
              ))}
            </div>

            {/* Table Skeleton */}
            <div className="p-5 border border-border rounded-lg bg-card space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton width="180px" height={22} />
                <Skeleton width="110px" height={32} />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between gap-4 py-3 border-b border-border/60"
                  >
                    <Skeleton width="140px" height={16} />
                    <Skeleton width="160px" height={16} />
                    <Skeleton width="90px" height={16} />
                    <Skeleton width="60px" height={16} />
                    <Skeleton width="80px" height={16} />
                    <Skeleton width="80px" height={20} />
                  </div>
                ))}
              </div>
              <div className="flex justify-center items-center gap-2 pt-3">
                <Spinner size="sm" label="Loading store customers..." />
                <span className="text-xs text-muted-foreground">
                  Fetching verified customer records from PostgreSQL...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state: No active store */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Store Selected"
            description="Please select an active store or create a new store to manage customer accounts."
            action={
              <Link href="/merchant/stores/new" className="btn btn-primary">
                Create New Store
              </Link>
            }
          />
        )}

        {/* Error state */}
        {!isLoadingCustomers && fetchError && activeStore && (
          <Alert
            variant="danger"
            title="Failed to Load Customers"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadCustomers(activeStore.id, filters)}
                className="gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </Button>
            }
          >
            {fetchError}
          </Alert>
        )}

        {/* Main Customers Table */}
        {activeStore && !fetchError && (
          <CustomerListTable
            customers={customers}
            hasMore={hasMore}
            filters={filters}
            isLoading={isLoadingCustomers}
            canManage={true}
            userRole={userRole}
            onFilterChange={setFilters}
            onNextPage={hasMore ? handleNextPage : undefined}
            onResetFilters={() => setFilters(INITIAL_CUSTOMER_FILTERS)}
            onOpenCreate={() => setIsCreateOpen(true)}
            onToggleStatus={handleToggleStatus}
          />
        )}
      </div>

      {/* Create Customer Dialog */}
      {activeStore && (
        <CustomerCreateDialog
          storeId={activeStore.id}
          isOpen={isCreateOpen}
          userRole={userRole}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Enable/Disable Status Dialog */}
      {activeStore && (
        <CustomerStatusDialog
          storeId={activeStore.id}
          customer={statusDialogState.customer}
          isOpen={statusDialogState.isOpen}
          action={statusDialogState.action}
          userRole={userRole}
          onClose={() =>
            setStatusDialogState({ customer: null, action: "disable", isOpen: false })
          }
          onSuccess={handleStatusChangeSuccess}
        />
      )}
    </MerchantShell>
  );
}
