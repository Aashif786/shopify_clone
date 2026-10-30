"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  CustomerAddressDTO,
  CustomerWithAddressesDTO,
} from "@calcart/customers";
import type { ListOrdersResultDto, OrderDTO } from "@calcart/orders";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from "@calcart/ui";
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
import {
  ArrowLeft,
  ShoppingBag,
  CreditCard,
  Clock,
  ShieldCheck,
  Plus,
  Eye,
} from "lucide-react";

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
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/merchant/customers"
                  className="btn btn-ghost btn-sm px-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All Customers</span>
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">
                  {fullName}
                </h1>
                <CustomerStatusBadge status={customer.status} size="md" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground m-0">
                Customer since {formatCustomerDate(customer.createdAt)} • Email:{" "}
                <strong className="text-foreground">{customer.email}</strong>
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
                size="sm"
              >
                {isCustomerActive ? "Disable Account" : "Enable Account"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action alerts */}
      {actionSuccess && (
        <Alert variant="success" title="Success" onDismiss={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}

      {actionError && (
        <Alert variant="danger" title="Error" onDismiss={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* Customer Commerce Metrics Overview */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        data-testid="customer-profile-kpis"
      >
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Orders Placed
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
                {customer.ordersCount !== undefined ? customer.ordersCount : orders.length}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Lifetime Spend
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground font-mono mt-1">
                {formatCustomerSpend(customer.totalSpend, customer.currency || "USD")}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
              <CreditCard className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Most Recent Order
              </div>
              <div className="text-sm font-semibold text-muted-foreground mt-1.5">
                {customer.lastOrderAt
                  ? formatCustomerDate(customer.lastOrderAt)
                  : orders.length > 0 && orders[0]?.createdAt
                    ? formatCustomerDate(orders[0].createdAt)
                    : "No orders placed"}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main 2-Column Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Profile Form & Order History (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <CustomerProfileForm
            storeId={storeId}
            customer={customer}
            userRole={userRole}
            onSuccess={() => onRefreshCustomer()}
          />

          {/* Customer Order History Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base font-semibold">
                  Order History ({orders.length})
                </CardTitle>
                <div className="text-xs text-muted-foreground">
                  Verified store purchases
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingOrders ? (
                <div className="p-8 flex flex-col items-center justify-center gap-2">
                  <Spinner size="md" label="Loading customer orders..." />
                  <span className="text-xs text-muted-foreground">Loading orders...</span>
                </div>
              ) : ordersError ? (
                <div className="p-4">
                  <Alert variant="warning" title="Notice">
                    {ordersError}
                  </Alert>
                </div>
              ) : orders.length === 0 ? (
                <div className="p-6 text-muted-foreground text-xs text-center">
                  No orders have been recorded for this customer in this store yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Order #</th>
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Date</th>
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Total</th>
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Status</th>
                        <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-sm">
                            <Link
                              href={`/merchant/orders/${encodeURIComponent(order.id)}`}
                              className="text-primary hover:underline font-mono"
                            >
                              #{order.orderNumber}
                            </Link>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {formatOrderDate(order.createdAt)}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-xs font-mono text-foreground">
                            {formatOrderPrice(order.grandTotal ?? order.total, order.currency)}
                          </td>
                          <td className="py-2.5 px-4">
                            <OrderStatusBadge status={order.status} />
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <Link
                              href={`/merchant/orders/${encodeURIComponent(order.id)}`}
                              className="btn btn-outline btn-sm h-7 px-2.5 text-xs inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Order</span>
                            </Link>
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

        {/* Right Column: Address Book & Account Status (1 col) */}
        <div className="space-y-6">
          {/* Address Book Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base font-semibold">
                  Address Book ({customer.addresses?.length ?? 0})
                </CardTitle>
                {!isStaff && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAddressToEdit(null);
                      setAddressModalOpen(true);
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {(!customer.addresses || customer.addresses.length === 0) ? (
                <p className="m-0 text-muted-foreground text-xs italic">
                  No saved addresses for this customer.
                </p>
              ) : (
                <div className="space-y-3">
                  {customer.addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-3 border border-border/60 rounded-lg bg-card space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-xs text-foreground">
                          {addr.label || "Address"}
                        </span>
                        {addr.isDefault && (
                          <Badge variant="success" size="sm">
                            Default
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground leading-relaxed">
                        <div className="text-foreground font-medium">
                          {[addr.firstName, addr.lastName].filter(Boolean).join(" ")}
                        </div>
                        {addr.company && <div>{addr.company}</div>}
                        <div>{addr.addressLine1}</div>
                        {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                        <div>
                          {addr.city}, {addr.state} {addr.postalCode}
                        </div>
                        <div>{addr.country}</div>
                        {addr.phone && <div className="text-[11px] mt-0.5">Tel: {addr.phone}</div>}
                      </div>

                      {/* Address Actions */}
                      {!isStaff && (
                        <div className="flex gap-1.5 pt-2 border-t border-border/50">
                          {!addr.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefaultAddress(addr.id)}
                              className="h-7 px-2 text-xs"
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
                            className="h-7 px-2 text-xs"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
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
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Account & Storefront Access</CardTitle>
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p className="m-0">
                <strong className="text-foreground">Tenant Scoped Identity:</strong> Customer profiles and saved address books are strictly isolated to this store.
              </p>
              <p className="m-0">
                <strong className="text-foreground">Storefront Customer Authentication:</strong> Storefront checkouts currently support guest and order-linked identities. Dedicated customer storefront login sessions are not implemented in this demo milestone.
              </p>
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
