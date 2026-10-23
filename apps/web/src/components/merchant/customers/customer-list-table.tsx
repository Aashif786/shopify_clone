"use client";

import React, { useState } from "react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* KPI Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-4)",
        }}
        data-testid="customer-kpi-summary"
      >
        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Customers
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
              {kpis.totalCustomers}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active Accounts
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-success, #16a34a)", marginTop: "var(--space-1)" }}>
              {kpis.activeCustomers}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Disabled Accounts
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
              {kpis.disabledCustomers}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Customer Spend
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)", marginTop: "var(--space-1)", fontFamily: "var(--font-mono, monospace)" }}>
              {formatCustomerSpend(kpis.totalSpend, kpis.currency)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Action Bar */}
      <Card>
        <CardContent style={{ padding: "var(--space-4)" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Search */}
            <form
              onSubmit={handleSearchSubmit}
              style={{ display: "flex", gap: "var(--space-2)", flex: "1 1 240px", minWidth: "220px" }}
            >
              <Input
                placeholder="Search customers by name, email, or phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search customers"
              />
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>

            {/* Filter Dropdown & Add Button */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-2)",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: "140px" }}>
                <Select
                  value={filters.status}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      status: e.target.value as CustomerFilterState["status"],
                    })
                  }
                  aria-label="Filter by customer status"
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
                >
                  + Add Customer
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CardTitle>Customer Directory ({customers.length})</CardTitle>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              Tenant-isolated customer profiles in PostgreSQL
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          {customers.length === 0 ? (
            <div style={{ padding: "var(--space-8)" }}>
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
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "var(--font-size-sm)",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                    }}
                  >
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Customer Name
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Email
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Phone
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Orders
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Total Spend
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Latest Order
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Status
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                      Joined Date
                    </th>
                    <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: "var(--font-weight-semibold)" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const fullName = formatCustomerName(c);
                    const isCustomerActive = c.status === "ACTIVE";

                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                          transition: "background-color 0.15s ease",
                        }}
                      >
                        {/* Customer Name Link */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                          <a
                            href={`/merchant/customers/${encodeURIComponent(c.id)}`}
                            style={{
                              color: "var(--color-primary, #2563eb)",
                              textDecoration: "none",
                            }}
                          >
                            {fullName}
                          </a>
                        </td>

                        {/* Email */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-secondary)" }}>
                          {c.email}
                        </td>

                        {/* Phone */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-muted)" }}>
                          {c.phone || "—"}
                        </td>

                        {/* Orders Count */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-medium)" }}>
                          {c.ordersCount !== undefined ? (
                            <span>
                              {c.ordersCount} {c.ordersCount === 1 ? "order" : "orders"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Total Spend */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)", fontFamily: "var(--font-mono, monospace)" }}>
                          {formatCustomerSpend(c.totalSpend, c.currency || "USD")}
                        </td>

                        {/* Latest Order */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-secondary)" }}>
                          {c.lastOrderAt ? formatCustomerDate(c.lastOrderAt) : "No orders yet"}
                        </td>

                        {/* Status */}
                        <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                          <CustomerStatusBadge status={c.status} />
                        </td>

                        {/* Joined Date */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-muted)" }}>
                          {formatCustomerDate(c.createdAt)}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                            <a
                              href={`/merchant/customers/${encodeURIComponent(c.id)}`}
                              className="btn btn-outline btn-sm"
                            >
                              Profile
                            </a>

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
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "var(--space-4)",
                borderTop: "1px solid var(--color-border)",
              }}
            >
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
