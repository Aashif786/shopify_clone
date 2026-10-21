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
  FormField,
  Input,
  Spinner,
} from "@shopify-clone/ui";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

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

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

export default function CustomerAccountPage({ params }: PageProps) {
  const { storeSlug } = use(params);
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerData | null>(null);
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
        const res = await apiClient.get<{ customer: CustomerData }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/account/profile`
        );
        setCustomer(res.customer);
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

    setProfileError(null);
    setProfileSuccess(false);
    setIsUpdating(true);

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
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setProfileError(err.message || "Failed to update profile.");
      } else {
        setProfileError("An unexpected error occurred while saving profile changes.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post("/api/v1/auth/logout");
    } finally {
      router.push(`/stores/${storeSlug}`);
    }
  };

  return (
    <StorefrontShell storeName="Customer Account" storeSlug={storeSlug}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16) 0" }}>
            <Spinner size="lg" label="Loading customer account..." />
          </div>
        ) : authError ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Alert variant="danger" title="Access Error">
              {authError}
            </Alert>
            <Button variant="primary" onClick={() => router.push(`/stores/${storeSlug}/login`)}>
              Sign In to Store
            </Button>
          </div>
        ) : customer ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {/* Header & Quick Links */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--space-3)",
                paddingBottom: "var(--space-4)",
                borderBottom: "1px solid var(--color-border)",
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
                  My Account
                </h1>
                <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)", margin: 0 }}>
                  Welcome back, {customer.firstName || customer.email}!
                </p>
              </div>

              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <a
                  href={`/stores/${storeSlug}/account/orders`}
                  className="btn btn-outline btn-sm"
                >
                  View Order History
                </a>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Sign Out
                </Button>
              </div>
            </div>

            {/* Account Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your name and contact details associated with this store.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} noValidate>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    {profileSuccess && (
                      <Alert variant="success" title="Profile Saved">
                        Your contact information has been updated.
                      </Alert>
                    )}
                    {profileError && (
                      <Alert variant="danger" title="Error">
                        {profileError}
                      </Alert>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                      <FormField label="First Name" htmlFor="profile-first-name">
                        <Input
                          id="profile-first-name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          disabled={isUpdating}
                        />
                      </FormField>

                      <FormField label="Last Name" htmlFor="profile-last-name">
                        <Input
                          id="profile-last-name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          disabled={isUpdating}
                        />
                      </FormField>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                      <FormField label="Email Address" htmlFor="profile-email">
                        <Input id="profile-email" value={customer.email} disabled />
                      </FormField>

                      <FormField label="Phone Number" htmlFor="profile-phone">
                        <Input
                          id="profile-phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={isUpdating}
                          placeholder="+1 (555) 123-4567"
                        />
                      </FormField>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={isUpdating}
                        disabled={isUpdating}
                      >
                        Save Details
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Saved Addresses Card */}
            <Card>
              <CardHeader>
                <CardTitle>Saved Delivery Addresses</CardTitle>
                <CardDescription>
                  Addresses used during checkout in this store
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!customer.addresses || customer.addresses.length === 0 ? (
                  <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)", margin: 0 }}>
                    No saved addresses yet. Addresses are automatically saved when you place an order.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "var(--space-4)",
                    }}
                  >
                    {customer.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        style={{
                          padding: "var(--space-4)",
                          backgroundColor: "var(--color-bg)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-border)",
                          position: "relative",
                        }}
                      >
                        {addr.isDefault && (
                          <div style={{ marginBottom: "var(--space-2)" }}>
                            <Badge variant="info">Default Address</Badge>
                          </div>
                        )}
                        <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                          {[addr.firstName, addr.lastName].filter(Boolean).join(" ") || "Customer"}
                        </div>
                        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
                          {addr.addressLine1}
                          {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                          <div>
                            {addr.city}, {addr.state} {addr.postalCode}
                          </div>
                          <div>{addr.country}</div>
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
