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
  Spinner,
} from "@calcart/ui";
import {
  MapPin,
  Package,
  LogOut,
  ShieldCheck,
  Check,
  Coins,
  Sparkles,
} from "lucide-react";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";
import { formatStorePrice } from "../../../../src/components/storefront/products/product-card";

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

  const handleLogout = async () => {
    try {
      await apiClient.post(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/auth/logout`);
    } finally {
      router.push(`/stores/${storeSlug}`);
    }
  };

  return (
    <StorefrontShell storeName="Customer Account" storeSlug={storeSlug}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="p-4 rounded-3xl bg-card border border-border/70 shadow-sm">
              <Spinner size="lg" className="spinner spinner-lg text-primary" label="Loading customer account..." />
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground animate-pulse">
              Authenticating session...
            </p>
          </div>
        ) : authError ? (
          <div className="max-w-md mx-auto py-16 space-y-4">
            <Alert variant="danger" title="Access Error">
              {authError}
            </Alert>
            <div className="pt-2 text-center">
              <Button variant="primary" onClick={() => router.push(`/stores/${storeSlug}/login`)} className="rounded-2xl px-6">
                Sign In to Store
              </Button>
            </div>
          </div>
        ) : customer ? (
          <div className="space-y-8 sm:space-y-10">
            {/* Editorial Portal Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/60">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-mono text-xl font-bold shadow-sm">
                  {(customer.firstName?.[0] || customer.email?.[0] || "U").toUpperCase()}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary">
                      AUTHENTICATED CLIENT
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    {customer.firstName ? `${customer.firstName} ${customer.lastName || ""}` : "My Account"}
                  </h1>
                  <p className="text-xs font-mono text-muted-foreground">
                    {customer.email}
                  </p>
                </div>
              </div>

              {/* Portal Actions & Navigation */}
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href={`/stores/${storeSlug}/account/orders`}
                  className="btn btn-outline btn-sm rounded-2xl px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-primary/50 transition-colors"
                >
                  <Package size={14} className="text-primary" />
                  <span>Order History</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-outline btn-sm rounded-2xl px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </header>

            {/* Store Credit Balance Card */}
            <Card className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md shadow-sm overflow-hidden" data-testid="account-store-credit-card">
              <CardHeader className="p-6 sm:p-8 pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                        STORED VALUE
                      </span>
                    </div>
                    <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      <Coins className="w-5 h-5 text-emerald-500" />
                      Store Credit Balance
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                      Credits from return refunds are automatically saved here and can be applied during checkout.
                    </CardDescription>
                  </div>
                  <div className="p-4 rounded-2xl bg-card border border-emerald-500/20 shadow-sm text-right min-w-[160px]">
                    <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                      Available Balance
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight" data-testid="account-store-credit-balance">
                      {formatStorePrice(storeCredit?.balance ?? 0, storeCredit?.currency ?? "INR")}
                    </div>
                  </div>
                </div>
              </CardHeader>
              {storeCredit?.transactions && storeCredit.transactions.length > 0 && (
                <CardContent className="p-6 sm:p-8 pt-0">
                  <div className="space-y-2 pt-3 border-t border-emerald-500/15">
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
                          <div className={`font-mono font-semibold ${tx.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                            {tx.amount >= 0 ? "+" : ""}{formatStorePrice(tx.amount, storeCredit.currency)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Account Information Card */}
            <Card className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md shadow-sm">
              <CardHeader className="p-6 sm:p-8 pb-4">
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">IDENTITY &amp; CONTACT</span>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground">Personal Information</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                    Update your verified name and contact details associated with this storefront.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 pt-0">
                <form onSubmit={handleUpdateProfile} noValidate className="space-y-6">
                  {profileSuccess && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
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
                        className="rounded-xl border-border/70 focus:border-primary"
                      />
                    </FormField>

                    <FormField label="Last Name" htmlFor="profile-last-name">
                      <Input
                        id="profile-last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={isUpdating}
                        className="rounded-xl border-border/70 focus:border-primary"
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <FormField label="Email Address" htmlFor="profile-email">
                      <Input id="profile-email" value={customer.email} disabled className="rounded-xl opacity-75 font-mono text-xs" />
                    </FormField>

                    <FormField label="Phone Number" htmlFor="profile-phone">
                      <Input
                        id="profile-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={isUpdating}
                        placeholder="+1 (555) 123-4567"
                        className="rounded-xl border-border/70 focus:border-primary"
                      />
                    </FormField>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      loading={isUpdating}
                      disabled={isUpdating}
                      className="rounded-2xl px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider shadow-md shadow-primary/10"
                    >
                      Save Details
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Saved Delivery Addresses Card */}
            <Card className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md shadow-sm">
              <CardHeader className="p-6 sm:p-8 pb-4">
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">DESTINATIONS</span>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground">Saved Delivery Addresses</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                    Addresses stored from your previous orders for rapid express checkout.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 pt-0">
                {!customer.addresses || customer.addresses.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-center space-y-2">
                    <MapPin size={24} className="mx-auto text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">
                      No saved addresses yet. Addresses are automatically saved when you place an order.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {customer.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-5 rounded-2xl bg-card border border-border/70 relative flex flex-col justify-between space-y-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-foreground">
                              {[addr.firstName, addr.lastName].filter(Boolean).join(" ") || "Customer"}
                            </span>
                            {addr.isDefault && (
                              <Badge variant="info" size="sm" className="font-mono text-[10px] uppercase tracking-wider">
                                Default
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5 leading-relaxed">
                            <div>{addr.addressLine1}</div>
                            {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                            <div>
                              {addr.city}, {addr.state} {addr.postalCode}
                            </div>
                            <div className="font-mono text-[11px] text-muted-foreground/80">{addr.country}</div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/40 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                          <ShieldCheck size={13} className="text-primary" />
                          <span>Verified Shipping Destination</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </StorefrontShell>
  );
}
