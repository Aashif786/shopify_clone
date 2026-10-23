"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  CustomerAddressDTO,
  CustomerWithAddressesDTO,
} from "@shopify-clone/customers";
import type { ListOrdersResultDto, OrderDTO } from "@shopify-clone/orders";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  formatCustomerDate,
  formatCustomerName,
  formatCustomerSpend,
} from "../../../lib/merchant-customer-helpers";
import { formatOrderDate, formatOrderPrice } from "../../../lib/merchant-order-helpers";
import { OrderStatusBadge } from "../orders/order-status-badge";
import { CustomerAddressDialog } from "./customer-address-dialog";
import { CustomerProfileForm } from "./customer-profile-form";
import { CustomerStatusBadge } from "./customer-status-badge";
import { CustomerStatusDialog } from "./customer-status-dialog";

export interface CustomerDetailsViewProps {
  storeId: string;
  customer: CustomerWithAddressesDTO;
  userRole?: string;
  onRefreshCustomer: () => void;
}

export function CustomerDetailsView({
  storeId,
  customer,
  userRole,
  onRefreshCustomer,
}: CustomerDetailsViewProps) {
  // Address Modal state
  const [addressModalOpen, setAddressModalOpen] = useState<boolean>(false);
  const [selectedAddressToEdit, setSelectedAddressToEdit] =
    useState<CustomerAddressDTO | null>(null);

  // Status Modal state
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);

  // Customer Orders state
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Feedback states
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isStaff = userRole === "staff";
  const fullName = formatCustomerName(customer);
  const isCustomerActive = customer.status === "ACTIVE";

  // Fetch actual customer orders from verified endpoint
  const loadCustomerOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    setOrdersError(null);
    try {
      const res = await apiClient.get<ListOrdersResultDto>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/orders?customerId=${encodeURIComponent(customer.id)}&limit=20`,
      );
      setOrders(res.items);
    } catch {
      setOrdersError("Could not load customer purchase history.");
      setOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [storeId, customer.id]);

  useEffect(() => {
    loadCustomerOrders();
  }, [loadCustomerOrders]);

  const handleSetDefaultAddress = async (addressId: string) => {
    if (isStaff) return;
    setActionError(null);
    try {
      await apiClient.post(
        `/api/v1/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customer.id)}/addresses/${encodeURIComponent(addressId)}/default`,
        {},
      );
      setActionSuccess("Default address updated.");
      onRefreshCustomer();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiClientError ? err.message : "Failed to set default address.",
      );
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (isStaff) return;
    if (!window.confirm("Are you sure you want to delete this address?")) return;

    setActionError(null);
    try {
      await apiClient.delete(
        `/api/v1/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customer.id)}/addresses/${encodeURIComponent(addressId)}`,
      );
      setActionSuccess("Address removed.");
      onRefreshCustomer();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiClientError ? err.message : "Failed to delete address.",
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Top Header Card */}
      <Card>
        <CardContent style={{ padding: "var(--space-5)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-4)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <a
                  href="/merchant/customers"
                  className="btn btn-ghost btn-sm"
                  style={{ textDecoration: "none", padding: "0 var(--space-2)" }}
                >
                  ← All Customers
                </a>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "var(--font-size-2xl)",
                    fontWeight: "var(--font-weight-bold)",
                  }}
                >
                  {fullName}
                </h1>
                <CustomerStatusBadge status={customer.status} size="md" />
              </div>
              <p
                style={{
                  margin: "var(--space-2) 0 0",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Customer since {formatCustomerDate(customer.createdAt)} • Email:{" "}
                <strong>{customer.email}</strong>
                {customer.phone && ` • Phone: ${customer.phone}`}
              </p>
            </div>

            {/* Status toggle action */}
            <div>
              <Button
                variant={isCustomerActive ? "outline" : "primary"}
                onClick={() => setStatusModalOpen(true)}
                disabled={isStaff}
                title={isStaff ? "Requires Admin or Owner role" : undefined}
              >
                {isCustomerActive ? "Disable Account" : "Enable Account"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action alerts */}
      {actionSuccess && (
        <Alert variant="success" title="Success">
          {actionSuccess}
        </Alert>
      )}

      {actionError && (
        <Alert variant="danger" title="Error">
          {actionError}
        </Alert>
      )}

      {/* Customer Commerce Metrics Overview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-4)",
        }}
        data-testid="customer-profile-kpis"
      >
        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Orders Placed
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
              {customer.ordersCount !== undefined ? customer.ordersCount : orders.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Lifetime Spend
            </div>
            <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text-primary)", marginTop: "var(--space-1)", fontFamily: "var(--font-mono, monospace)" }}>
              {formatCustomerSpend(customer.totalSpend, customer.currency || "USD")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Most Recent Order
            </div>
            <div style={{ fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
              {customer.lastOrderAt
                ? formatCustomerDate(customer.lastOrderAt)
                : orders.length > 0 && orders[0]?.createdAt
                  ? formatCustomerDate(orders[0].createdAt)
                  : "No orders placed"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main 2-Column Content Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        {/* Left Column: Profile Form & Order History */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <CustomerProfileForm
            storeId={storeId}
            customer={customer}
            userRole={userRole}
            onSuccess={() => onRefreshCustomer()}
          />

          {/* Customer Order History Card */}
          <Card>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardTitle>Order History ({orders.length})</CardTitle>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  Verified store purchases
                </div>
              </div>
            </CardHeader>
            <CardContent style={{ padding: 0 }}>
              {isLoadingOrders ? (
                <div style={{ padding: "var(--space-6)", display: "flex", justifyContent: "center" }}>
                  <Spinner size="md" label="Loading customer orders..." />
                </div>
              ) : ordersError ? (
                <div style={{ padding: "var(--space-4)" }}>
                  <Alert variant="warning" title="Notice">
                    {ordersError}
                  </Alert>
                </div>
              ) : orders.length === 0 ? (
                <div style={{ padding: "var(--space-6)", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                  No orders have been recorded for this customer in this store yet.
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
                      <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-secondary, var(--color-bg-surface-sunken))" }}>
                        <th style={{ padding: "var(--space-3) var(--space-4)" }}>Order #</th>
                        <th style={{ padding: "var(--space-3) var(--space-4)" }}>Date</th>
                        <th style={{ padding: "var(--space-3) var(--space-4)" }}>Total</th>
                        <th style={{ padding: "var(--space-3) var(--space-4)" }}>Status</th>
                        <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                          <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                            <a
                              href={`/merchant/orders/${encodeURIComponent(order.id)}`}
                              style={{ color: "var(--color-primary)", textDecoration: "none", fontFamily: "var(--font-mono, monospace)" }}
                            >
                              #{order.orderNumber}
                            </a>
                          </td>
                          <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-text-secondary)" }}>
                            {formatOrderDate(order.createdAt)}
                          </td>
                          <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: "var(--font-weight-semibold)" }}>
                            {formatOrderPrice(order.grandTotal ?? order.total, order.currency)}
                          </td>
                          <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                            <OrderStatusBadge status={order.status} />
                          </td>
                          <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>
                            <a
                              href={`/merchant/orders/${encodeURIComponent(order.id)}`}
                              className="btn btn-outline btn-sm"
                            >
                              View Order
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Address Book & Account Status */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Address Book Card */}
          <Card>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <CardTitle>Address Book ({customer.addresses?.length ?? 0})</CardTitle>
                {!isStaff && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAddressToEdit(null);
                      setAddressModalOpen(true);
                    }}
                  >
                    + Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(!customer.addresses || customer.addresses.length === 0) ? (
                <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                  No saved addresses for this customer.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {customer.addresses.map((addr) => (
                    <div
                      key={addr.id}
                      style={{
                        padding: "var(--space-3)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "var(--color-bg)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
                        <span style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)" }}>
                          {addr.label || "Address"}
                        </span>
                        {addr.isDefault && (
                          <Badge variant="success" size="sm">
                            Default
                          </Badge>
                        )}
                      </div>

                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                        <div>
                          {[addr.firstName, addr.lastName].filter(Boolean).join(" ")}
                        </div>
                        {addr.company && <div>{addr.company}</div>}
                        <div>{addr.addressLine1}</div>
                        {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                        <div>
                          {addr.city}, {addr.state} {addr.postalCode}
                        </div>
                        <div>{addr.country}</div>
                        {addr.phone && <div>Tel: {addr.phone}</div>}
                      </div>

                      {/* Address Actions */}
                      {!isStaff && (
                        <div
                          style={{
                            display: "flex",
                            gap: "var(--space-2)",
                            marginTop: "var(--space-3)",
                            borderTop: "1px solid var(--color-border)",
                            paddingTop: "var(--space-2)",
                          }}
                        >
                          {!addr.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefaultAddress(addr.id)}
                            >
                              Set Default
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAddressToEdit(addr);
                              setAddressModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAddress(addr.id)}
                            style={{ color: "var(--color-danger, #dc2626)" }}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Authentication & Security Notice */}
          <Card>
            <CardHeader>
              <CardTitle>Account & Storefront Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                <p style={{ margin: 0 }}>
                  <strong>Tenant Scoped Identity:</strong> Customer profiles and saved address books are strictly isolated to this store.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Storefront Customer Authentication:</strong> Storefront checkouts currently support guest and order-linked identities. Dedicated customer storefront login sessions are not implemented in this demo milestone.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Address Dialog */}
      <CustomerAddressDialog
        storeId={storeId}
        customerId={customer.id}
        addressToEdit={selectedAddressToEdit}
        isOpen={addressModalOpen}
        userRole={userRole}
        onClose={() => {
          setAddressModalOpen(false);
          setSelectedAddressToEdit(null);
        }}
        onSuccess={() => onRefreshCustomer()}
      />

      {/* Status Dialog */}
      <CustomerStatusDialog
        storeId={storeId}
        customer={customer}
        isOpen={statusModalOpen}
        action={isCustomerActive ? "disable" : "enable"}
        userRole={userRole}
        onClose={() => setStatusModalOpen(false)}
        onSuccess={(updated) => {
          setActionSuccess(`Customer status updated to ${updated.status}.`);
          onRefreshCustomer();
          setTimeout(() => setActionSuccess(null), 4000);
        }}
      />
    </div>
  );
}
