"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
} from "@shopify-clone/ui";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../src/components/theme-mode-toggle";

export default function MerchantOnboardingPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { stores, isLoading: isStoreLoading, refreshStores } = useStore();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/merchant/login?redirect=/merchant/onboarding");
      return;
    }
    if (!isAuthLoading && user && !isStoreLoading && stores.length > 0) {
      router.push("/merchant");
    }
  }, [isAuthLoading, user, isStoreLoading, stores, router]);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Organization
  const [orgName, setOrgName] = useState("");

  // Step 2: First Store
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [locale, setLocale] = useState("en-US");
  const [timezone, setTimezone] = useState("America/New_York");

  // Step 3: Store Details
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStoreName(val);
    if (!slug || slug === storeName.toLowerCase().replace(/[^a-z0-9]/g, "-")) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError("Organization name is required.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setError("Store name is required.");
      return;
    }
    if (!slug.trim()) {
      setError("Store slug is required.");
      return;
    }
    setError(null);
    setStep(3);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name: storeName.trim(),
        slug: slug.trim(),
        organizationName: orgName.trim() || undefined,
        currency: currency.toUpperCase(),
        locale,
        timezone,
        contactEmail: contactEmail.trim() || (user?.email ?? null),
        contactPhone: contactPhone.trim() || null,
        description: description.trim() || null,
      };

      const res = await apiClient.post<{ id: string }>("/api/v1/stores", payload);
      await refreshStores(res.id);
      router.push("/merchant");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to create store during onboarding.");
      } else {
        setError("An unexpected error occurred while setting up your merchant store.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-bg)",
        padding: "var(--space-6) var(--space-4)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "var(--space-4)",
          right: "var(--space-4)",
        }}
      >
        <ThemeModeToggle />
      </div>

      <div style={{ width: "100%", maxWidth: "560px" }}>
        {/* Onboarding Stepper Header */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-1) var(--space-3)",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-3)",
            }}
          >
            <span>Step {step} of 3</span>
            <span>•</span>
            <span>
              {step === 1 && "Organization Identity"}
              {step === 2 && "Primary Store Setup"}
              {step === 3 && "Store Configuration"}
            </span>
          </div>

          <h1
            style={{
              fontSize: "var(--font-size-3xl)",
              fontWeight: 800,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Welcome, {user?.name || "Merchant"}!
          </h1>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              marginTop: "var(--space-2)",
            }}
          >
            Let&apos;s set up your commerce foundation and launch your first digital storefront.
          </p>

          {/* Stepper Progress bar */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              marginTop: "var(--space-6)",
              padding: "0 var(--space-8)",
            }}
          >
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: "4px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor:
                    s <= step ? "var(--color-primary)" : "var(--color-border)",
                  transition: "background-color 0.3s ease",
                }}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: ORGANIZATION */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>1. Create Your Business Organization</CardTitle>
              <CardDescription>
                Organizations represent your legal or umbrella business entity and can hold multiple stores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNextStep1} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {error && (
                    <Alert variant="danger" title="Validation Error">
                      {error}
                    </Alert>
                  )}

                  <FormField
                    label="Organization Name"
                    htmlFor="onboarding-org-name"
                    required
                    helperText="e.g. Acme Brands LLC or Artisan Collective"
                  >
                    <Input
                      id="onboarding-org-name"
                      placeholder="My Commerce Company"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      autoFocus
                      required
                    />
                  </FormField>

                  <div
                    style={{
                      padding: "var(--space-3)",
                      backgroundColor: "var(--color-bg)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      fontSize: "var(--font-size-xs)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    💡 <strong>Multi-Tenancy Note:</strong> You can create and manage multiple stores
                    under this organization once onboarding is completed.
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!orgName.trim()}
                    style={{ width: "100%", marginTop: "var(--space-2)" }}
                  >
                    Continue to Store Setup →
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: STORE DETAILS */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>2. Set Up Your First Store</CardTitle>
              <CardDescription>
                This will be your initial storefront for customers and inventory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNextStep2} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {error && (
                    <Alert variant="danger" title="Validation Error">
                      {error}
                    </Alert>
                  )}

                  <FormField label="Store Name" htmlFor="onboarding-store-name" required>
                    <Input
                      id="onboarding-store-name"
                      placeholder="Artisan Goods"
                      value={storeName}
                      onChange={handleStoreNameChange}
                      autoFocus
                      required
                    />
                  </FormField>

                  <FormField
                    label="Store URL Handle (Slug)"
                    htmlFor="onboarding-store-slug"
                    required
                    helperText={`Storefront URL: /stores/${slug || "your-store"}`}
                  >
                    <Input
                      id="onboarding-store-slug"
                      placeholder="artisan-goods"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      required
                    />
                  </FormField>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                    <FormField label="Default Currency" htmlFor="onboarding-currency" required>
                      <Select
                        id="onboarding-currency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CAD">CAD ($)</option>
                        <option value="AUD">AUD ($)</option>
                        <option value="INR">INR (₹)</option>
                      </Select>
                    </FormField>

                    <FormField label="Locale" htmlFor="onboarding-locale" required>
                      <Select
                        id="onboarding-locale"
                        value={locale}
                        onChange={(e) => setLocale(e.target.value)}
                      >
                        <option value="en-US">English (United States)</option>
                        <option value="en-GB">English (United Kingdom)</option>
                        <option value="en-CA">English (Canada)</option>
                        <option value="es-ES">Spanish (Spain)</option>
                        <option value="fr-FR">French (France)</option>
                        <option value="de-DE">German (Germany)</option>
                      </Select>
                    </FormField>
                  </div>

                  <FormField label="Timezone" htmlFor="onboarding-timezone" required>
                    <Select
                      id="onboarding-timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    >
                      <option value="America/New_York">Eastern Time (US & Canada)</option>
                      <option value="America/Chicago">Central Time (US & Canada)</option>
                      <option value="America/Denver">Mountain Time (US & Canada)</option>
                      <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Paris, Berlin (CET)</option>
                      <option value="Asia/Kolkata">India Standard Time (IST)</option>
                      <option value="UTC">Coordinated Universal Time (UTC)</option>
                    </Select>
                  </FormField>

                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      style={{ flex: 1 }}
                    >
                      ← Back
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!storeName.trim() || !slug.trim()}
                      style={{ flex: 2 }}
                    >
                      Next: Contact & Info →
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: CONTACT & FINISH */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>3. Configure Store Information</CardTitle>
              <CardDescription>
                Provide public customer service contact information and a brief store description.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFinalSubmit} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {error && (
                    <Alert variant="danger" title="Error Launching Store">
                      {error}
                    </Alert>
                  )}

                  <FormField
                    label="Customer Support Email"
                    htmlFor="onboarding-contact-email"
                    helperText="Displayed to customers on invoices and order confirmations"
                  >
                    <Input
                      id="onboarding-contact-email"
                      type="email"
                      placeholder={user?.email || "support@store.com"}
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </FormField>

                  <FormField
                    label="Customer Support Phone"
                    htmlFor="onboarding-contact-phone"
                    helperText="Optional phone contact"
                  >
                    <Input
                      id="onboarding-contact-phone"
                      type="tel"
                      placeholder="+1 (555) 019-2834"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </FormField>

                  <FormField
                    label="Store Description"
                    htmlFor="onboarding-description"
                    helperText="A brief bio or tagline about your store"
                  >
                    <Input
                      id="onboarding-description"
                      placeholder="Handcrafted stoneware and artisanal kitchen goods."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </FormField>

                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(2)}
                      disabled={isSubmitting}
                      style={{ flex: 1 }}
                    >
                      ← Back
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      style={{ flex: 2 }}
                    >
                      Complete & Enter Dashboard 🚀
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
