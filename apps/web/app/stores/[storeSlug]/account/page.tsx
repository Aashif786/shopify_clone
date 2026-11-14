"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@calcart/ui";
import {
  MapPin,
  Package,
  LogOut,
  Check,
  Coins,
  Sparkles,
  Trash2,
  Gift,
} from "lucide-react";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { useStorefrontIdentity } from "../../../../src/components/storefront/use-storefront-identity";
import { Reveal } from "../../../../src/components/storefront/motion/storefront-motion";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";
import { formatStorePrice } from "../../../../src/components/storefront/products/product-card";
import { useOptionalCart } from "../../../../src/context/cart-context";

interface CustomerAddress {
  id: string;
  firstName: string | null;
  lastName: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface CustomerData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  addresses?: CustomerAddress[];
}

interface StoreCreditTransaction {
  id: string;
  amount: number;
  type: string;
  notes: string | null;
  createdAt: string;
}

interface StoreCreditData {
  id: string;
  balance: number;
  currency: string;
  transactions: StoreCreditTransaction[];
}

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

export default function CustomerAccountPage({ params }: PageProps) {
  const { storeSlug } = use(params);
  const router = useRouter();
  const { storeName, theme } = useStorefrontIdentity(storeSlug);
  const cartContext = useOptionalCart();

  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [storeCredit, setStoreCredit] = useState<StoreCreditData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Profile Edit State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Address Actions State
  const [addressToast, setAddressToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [updatingAddressId, setUpdatingAddressId] = useState<string | null>(null);
  const [isDeletingAddressId, setIsDeletingAddressId] = useState<string | null>(null);

  const refreshCustomer = async () => {
    try {
      const res = await apiClient.get<{
        customer: CustomerData;
        storeCredit?: StoreCreditData | null;
      }>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/account/profile`);
      setCustomer(res.customer);
      if (res.storeCredit) {
        setStoreCredit(res.storeCredit);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await apiClient.get<{
          customer: CustomerData;
          storeCredit?: StoreCreditData | null;
        }>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/account/profile`);
        setCustomer(res.customer);
        if (res.storeCredit) {
          setStoreCredit(res.storeCredit);
        }
        setFirstName(res.customer.firstName || "");
        setLastName(res.customer.lastName || "");
        setPhone(res.customer.phone || "");
      } catch (err: unknown) {
        if (
          err instanceof ApiClientError &&
          (err.status === 401 || err.status === 403 || err.status === 404 || err.code === "CUSTOMER_NOT_FOUND")
        ) {
          router.push(`/stores/${storeSlug}/login?redirect=/stores/${storeSlug}/account`);
          return;
        }
        setAuthError(err instanceof Error ? err.message : "Failed to load customer profile.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [storeSlug, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdating) return;

    setIsUpdating(true);
    setProfileSuccess(false);
    setProfileError(null);

    try {
      const res = await apiClient.patch<{ customer: CustomerData }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/account/profile`,
        {
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
        }
      );
      setCustomer(res.customer);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 5000);
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : "Failed to update profile information."
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectDefaultAddress = async (addressId: string, isCurrentDefault: boolean) => {
    if (isCurrentDefault || updatingAddressId || isDeletingAddressId) return;

    setUpdatingAddressId(addressId);
    setAddressToast(null);

    try {
      await apiClient.post(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/account/addresses/${encodeURIComponent(addressId)}/default`
      );
      // Refresh displayed addresses AFTER server response confirms the change
      await refreshCustomer();

      const successMsg = "Default address updated";
      setAddressToast({ message: successMsg, type: "success" });
      cartContext?.showToast({
        status: "success",
        message: successMsg,
        duration: 3500,
      });
      setTimeout(() => setAddressToast(null), 5000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update default address.";
      setAddressToast({ message: errorMsg, type: "error" });
    } finally {
      setUpdatingAddressId(null);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (updatingAddressId || isDeletingAddressId) return;

    const confirmed = typeof window !== "undefined"
      ? window.confirm("Are you sure you want to delete this saved address?")
      : true;
    if (!confirmed) return;

    setIsDeletingAddressId(addressId);
    setAddressToast(null);

    try {
      await apiClient.delete(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/account/addresses/${encodeURIComponent(addressId)}`
      );
      await refreshCustomer();
      setAddressToast({ message: "Address deleted successfully", type: "success" });
      setTimeout(() => setAddressToast(null), 4000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete address.";
      setAddressToast({ message: errorMsg, type: "error" });
    } finally {
      setIsDeletingAddressId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/auth/logout`);
    } finally {
      router.push(`/stores/${storeSlug}`);
    }
  };

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug} theme={theme} fullBleed>
      <div className="at-container pb-24 pt-8 sm:pt-12">
        {isLoading ? (
          <div className="space-y-8" role="status" aria-busy="true" aria-label="Loading customer account">
            <div className="flex items-center gap-4 pb-6 border-b border-[color:var(--at-hairline)]">
              <div className="w-14 h-14 rounded-none bg-muted/70" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded bg-muted/60" />
                <div className="h-7 w-56 rounded-none bg-muted/70" />
                <div className="h-3 w-44 rounded bg-muted/50" />
              </div>
            </div>
            <div className="h-44 rounded-none bg-muted/50" />
            <div className="h-72 rounded-none bg-muted/40" />
          </div>
        ) : authError ? (
          <div className="max-w-md mx-auto py-16 space-y-4">
            <Alert variant="danger" title="Access Error">
              {authError}
            </Alert>
            <div className="pt-2 text-center">
              <Button variant="primary" onClick={() => router.push(`/stores/${storeSlug}/login`)} className="rounded-none px-6">
                Sign In to Store
              </Button>
            </div>
          </div>
        ) : customer ? (
          <div className="space-y-8 sm:space-y-10">
            {/* Editorial Portal Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[color:var(--at-hairline)]">
              <div>
                <p className="at-eyebrow text-muted-foreground">My account</p>
                <h1 className="at-display-lg mt-3 text-foreground">
                  {customer.firstName ? `${customer.firstName} ${customer.lastName || ""}` : "My Account"}
                </h1>
                <p className="at-num mt-3 text-sm text-muted-foreground">{customer.email}</p>
              </div>

              {/* Portal Actions & Navigation */}
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href={`/stores/${storeSlug}/account/orders`}
                  className="btn btn-outline btn-sm rounded-none px-4 py-2 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-primary/50 transition-colors"
                >
                  <Package size={14} className="text-primary" />
                  <span>Order History</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-outline btn-sm rounded-none px-4 py-2 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </header>

            {/* Store Credit Balance Card */}
            <Reveal>
            <Card className="rounded-none border border-[color:var(--at-hairline)] bg-transparent overflow-hidden" data-testid="account-store-credit-card">
              <CardHeader className="p-6 sm:p-8 pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                        STORED VALUE
                      </span>
                    </div>
                    <CardTitle className="at-title text-2xl text-foreground flex items-center gap-2">
                      <Coins className="w-5 h-5 text-emerald-500" />
                      Store Credit Balance
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                      Credits from return refunds and gift cards are saved here and can be applied during checkout.
                    </CardDescription>
                    <div className="pt-2">
                      <Link
                        href={`/stores/${encodeURIComponent(storeSlug)}/gift-cards?tab=redeem`}
                        className="btn btn-outline btn-xs rounded-none text-xs font-semibold inline-flex items-center gap-1.5 hover:border-primary transition-colors"
                        data-testid="account-redeem-gift-card-link"
                      >
                        <Gift size={13} className="text-primary" />
                        <span>Redeem a Gift Card</span>
                      </Link>
                    </div>
                  </div>
                  <div className="p-4 rounded-none bg-transparent border border-[color:var(--at-hairline)] text-right min-w-[160px]">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      Available Balance
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight" data-testid="account-store-credit-balance">
                      {formatStorePrice(storeCredit?.balance ?? 0, storeCredit?.currency ?? "INR")}
                    </div>
                  </div>
                </div>
              </CardHeader>
              {storeCredit?.transactions && storeCredit.transactions.length > 0 && (
                <CardContent className="p-6 sm:p-8 pt-0">
                  <div className="space-y-2 pt-3 border-t border-[color:var(--at-hairline)]">
                    <div className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={12} className="text-emerald-500" />
                      <span>Recent Activity</span>
                    </div>
                    <ul className="divide-y divide-border/40 text-xs list-none p-0 m-0">
                      {storeCredit.transactions.map((tx) => (
                        <li key={tx.id} className="py-2.5 flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <div className="font-medium text-foreground">
                              {tx.type === "ISSUE" ? "Credit Issued (Return Refund)" : tx.type === "REDEEM" ? "Checkout Redemption" : tx.type}
                            </div>
                            {tx.notes && <div className="text-[11px] text-muted-foreground">{tx.notes}</div>}
                          </div>
                          <div className={`font-semibold ${tx.amount >= 0 ? "text-foreground" : "text-destructive"}`}>
                            {tx.amount >= 0 ? "+" : ""}{formatStorePrice(tx.amount, storeCredit.currency)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              )}
            </Card>
            </Reveal>

            {/* Account Information Card */}
            <Reveal delay={0.05}>
            <Card className="rounded-none border border-[color:var(--at-hairline)] bg-transparent">
              <CardHeader className="p-6 sm:p-8 pb-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">IDENTITY &amp; CONTACT</span>
                  <CardTitle className="at-title text-2xl text-foreground">Personal Information</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                    Update your verified name and contact details associated with this storefront.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 pt-0">
                <form onSubmit={handleUpdateProfile} noValidate className="space-y-6">
                  {profileSuccess && (
                    <div role="status" className="p-3.5 rounded-none bg-transparent border border-[color:var(--at-hairline)] text-foreground text-xs font-medium flex items-center gap-2">
                      <Check size={16} className="text-emerald-400 shrink-0" />
                      <span>Your contact information has been updated successfully.</span>
                    </div>
                  )}
                  {profileError && (
                    <Alert variant="danger" title="Error">
                      {profileError}
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <FormField label="First Name" htmlFor="profile-first-name">
                      <Input
                        id="profile-first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={isUpdating}
                        className="rounded-none border-[color:var(--at-hairline)] focus:border-primary"
                      />
                    </FormField>

                    <FormField label="Last Name" htmlFor="profile-last-name">
                      <Input
                        id="profile-last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={isUpdating}
                        className="rounded-none border-[color:var(--at-hairline)] focus:border-primary"
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <FormField label="Email Address" htmlFor="profile-email">
                      <Input id="profile-email" value={customer.email} disabled className="rounded-none opacity-75 text-xs" />
                    </FormField>

                    <FormField label="Phone Number" htmlFor="profile-phone">
                      <Input
                        id="profile-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={isUpdating}
                        placeholder="+1 (555) 123-4567"
                        className="rounded-none border-[color:var(--at-hairline)] focus:border-primary"
                      />
                    </FormField>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      loading={isUpdating}
                      disabled={isUpdating}
                      className="rounded-none px-6 py-2.5 text-xs font-bold uppercase tracking-wider"
                    >
                      Save Details
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            </Reveal>

            {/* Saved Delivery Addresses Card */}
            <Reveal delay={0.1}>
            <Card className="rounded-none border border-[color:var(--at-hairline)] bg-transparent">
              <CardHeader className="p-6 sm:p-8 pb-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">DESTINATIONS</span>
                  <CardTitle className="at-title text-2xl text-foreground">Saved Delivery Addresses</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                    Click any address to make it your default delivery destination.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 pt-0 space-y-4">
                {addressToast && (
                  <div
                    role="status"
                    data-testid="default-address-toast"
                    className={`p-3.5 rounded-none text-xs font-medium flex items-center justify-between gap-2 border ${
                      addressToast.type === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {addressToast.type === "success" ? (
                        <Check size={16} className="text-emerald-500 shrink-0" />
                      ) : (
                        <span className="font-bold">!</span>
                      )}
                      <span>{addressToast.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddressToast(null)}
                      className="text-xs opacity-70 hover:opacity-100"
                      aria-label="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                )}

                {!customer.addresses || customer.addresses.length === 0 ? (
                  <div className="p-8 rounded-none border border-dashed border-[color:var(--at-hairline)] bg-muted/10 text-center space-y-2">
                    <MapPin size={24} className="mx-auto text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">
                      No saved addresses yet. Addresses are automatically saved when you place an order.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="region" aria-label="Saved Addresses">
                    {customer.addresses.map((addr) => {
                      const isDefault = addr.isDefault;
                      const isUpdatingThis = updatingAddressId === addr.id;
                      const isDeletingThis = isDeletingAddressId === addr.id;

                      return (
                        <div
                          key={addr.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectDefaultAddress(addr.id, isDefault)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectDefaultAddress(addr.id, isDefault);
                            }
                          }}
                          data-testid={isDefault ? "saved-address-default" : "saved-address-card"}
                          data-address-id={addr.id}
                          aria-label={isDefault ? `Default address: ${addr.addressLine1}` : `Set ${addr.addressLine1} as default address`}
                          className={`p-5 rounded-none border relative flex flex-col justify-between space-y-3 transition-all cursor-pointer ${
                            isDefault
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-[color:var(--at-hairline)] bg-transparent hover:border-primary/50"
                          } ${isUpdatingThis || isDeletingThis ? "opacity-60 pointer-events-none" : ""}`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                {isDefault && <Check size={14} className="text-primary shrink-0" aria-hidden="true" />}
                                {[addr.firstName, addr.lastName].filter(Boolean).join(" ") || "Customer"}
                              </span>
                              <div className="flex items-center gap-2">
                                {isDefault && (
                                  <Badge variant="info" size="sm" className="text-[10px] uppercase tracking-wider">
                                    Default
                                  </Badge>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAddress(addr.id);
                                  }}
                                  aria-label={`Delete address ${addr.addressLine1}`}
                                  data-testid="delete-address-btn"
                                  className="at-press p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-none"
                                >
                                  <Trash2 size={13} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5 leading-relaxed">
                              <div>{addr.addressLine1}</div>
                              {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                              <div>
                                {addr.city}, {addr.state} {addr.postalCode}
                              </div>
                              <div className="text-[11px] text-muted-foreground/80">{addr.country}</div>
                            </div>
                          </div>
                          {!isDefault && (
                            <div className="pt-2 text-[11px] text-muted-foreground/70 font-medium">
                              Click to make default
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            </Reveal>
          </div>
        ) : null}
      </div>
    </StorefrontShell>
  );
}
