"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { CustomerDTO } from "@shopify-clone/customers";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Select,
} from "@shopify-clone/ui";
import {
  calculateCustomerMetrics,
  formatCustomerDate,
  formatCustomerName,
  formatCustomerSpend,
  type CustomerFilterState,
} from "../../../lib/merchant-customer-helpers";
import { CustomerStatusBadge } from "./customer-status-badge";
import {
  Users,
  UserCheck,
  UserX,
  CreditCard,
  Search,
  Plus,
  Eye,
} from "lucide-react";

export interface CustomerListTableProps {
  customers: CustomerDTO[];
  hasMore: boolean;
  filters: CustomerFilterState;
  isLoading: boolean;
  canManage: boolean;
  userRole?: string;
  onFilterChange: (filters: CustomerFilterState) => void;
  onNextPage?: () => void;
  onResetFilters: () => void;
  onOpenCreate: () => void;
  onToggleStatus: (customer: CustomerDTO, action: "enable" | "disable") => void;
}

export function CustomerListTable({
  customers,
  hasMore,
  filters,
  isLoading,
  canManage,
  userRole,
  onFilterChange,
  onNextPage,
  onResetFilters,
  onOpenCreate,
  onToggleStatus,
}: CustomerListTableProps) {
  const [searchInput, setSearchInput] = useState<string>(filters.search);

  const kpis = calculateCustomerMetrics(customers);
  const isStaff = userRole === "staff";

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ ...filters, search: searchInput.trim() });
  };

  const hasActiveFilters = filters.search !== "" || filters.status !== "ALL";

  return (
    <div className="space-y-6">
      {/* KPI Overview Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        data-testid="customer-kpi-summary"
      >
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Total Customers
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
                {kpis.totalCustomers}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Active Accounts
              </div>
              <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
                {kpis.activeCustomers}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Disabled Accounts
              </div>
              <div className="text-2xl font-bold tracking-tight text-muted-foreground mt-1">
                {kpis.disabledCustomers}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
              <UserX className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Total Customer Spend
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground font-mono mt-1">
                {formatCustomerSpend(kpis.totalSpend, kpis.currency)}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
              <CreditCard className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Action Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex gap-2 flex-1 max-w-sm"
            >
              <Input
                placeholder="Search customers by name, email, or phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search customers"
                className="text-xs h-9"
              />
              <Button type="submit" variant="outline" size="sm" className="h-9 px-3 gap-1.5">
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </Button>
            </form>

            {/* Filter Dropdown & Add Button */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="min-w-[140px]">
                <Select
                  value={filters.status}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      status: e.target.value as CustomerFilterState["status"],
                    })
                  }
                  aria-label="Filter by customer status"
                  className="text-xs h-9"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Disabled</option>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    onResetFilters();
                  }}
                  className="h-9 text-xs"
                >
                  Clear Filters
                </Button>
              )}

              {canManage && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onOpenCreate}
                  disabled={isStaff}
                  title={isStaff ? "Requires Admin or Owner role" : "Add customer"}
                  className="h-9 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Customer</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex justify-between items-center w-full">
            <CardTitle className="text-base font-semibold">Customer Directory ({customers.length})</CardTitle>
            <div className="text-xs text-muted-foreground">
              Tenant-isolated customer profiles in PostgreSQL
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {customers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No Customers Found"
                description={
                  hasActiveFilters
                    ? "No customers match the current search or status filter. Try clearing your search."
                    : "No customers have been registered for this store yet. Customers are created during checkout or can be added manually above."
                }
                action={
                  hasActiveFilters ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchInput("");
                        onResetFilters();
                      }}
                    >
                      Reset Filters
                    </Button>
                  ) : canManage && !isStaff ? (
                    <Button variant="primary" size="sm" onClick={onOpenCreate}>
                      Add First Customer
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="table-container overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Customer Name
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Email
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Phone
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Orders
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Total Spend
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Latest Order
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Status
                    </th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground">
                      Joined Date
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-xs text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((c) => {
                    const fullName = formatCustomerName(c);
                    const isCustomerActive = c.status === "ACTIVE";

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        {/* Customer Name Link */}
                        <td className="py-3 px-4 font-semibold text-sm">
                          <Link
                            href={`/merchant/customers/${encodeURIComponent(c.id)}`}
                            className="text-foreground hover:text-primary transition-colors hover:underline"
                          >
                            {fullName}
                          </Link>
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {c.email}
                        </td>

                        {/* Phone */}
                        <td className="py-3 px-4 text-xs text-muted-foreground font-mono">
                          {c.phone || "—"}
                        </td>

                        {/* Orders Count */}
                        <td className="py-3 px-4 text-xs font-medium">
                          {c.ordersCount !== undefined ? (
                            <span>
                              {c.ordersCount} {c.ordersCount === 1 ? "order" : "orders"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Total Spend */}
                        <td className="py-3 px-4 text-xs font-semibold font-mono text-foreground">
                          {formatCustomerSpend(c.totalSpend, c.currency || "USD")}
                        </td>

                        {/* Latest Order */}
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {c.lastOrderAt ? formatCustomerDate(c.lastOrderAt) : "No orders yet"}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <CustomerStatusBadge status={c.status} />
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatCustomerDate(c.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-2 justify-end items-center">
                            <Link
                              href={`/merchant/customers/${encodeURIComponent(c.id)}`}
                              className="btn btn-outline btn-sm h-8 px-2.5 text-xs inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Profile</span>
                            </Link>

                            {canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  onToggleStatus(
                                    c,
                                    isCustomerActive ? "disable" : "enable",
                                  )
                                }
                                disabled={isStaff}
                                title={
                                  isStaff
                                    ? "Requires Admin or Owner role"
                                    : isCustomerActive
                                      ? "Disable customer account"
                                      : "Enable customer account"
                                }
                                className="h-8 px-2.5 text-xs"
                              >
                                {isCustomerActive ? "Disable" : "Enable"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {hasMore && onNextPage && (
            <div className="flex justify-center p-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={onNextPage}
                loading={isLoading}
              >
                Load More Customers
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
