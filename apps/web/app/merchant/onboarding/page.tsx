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
import {
  Building2,
  Store,
  FileText,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Info,
} from "lucide-react";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../src/components/theme-mode-toggle";

export default function MerchantOnboardingPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { stores, isLoading: isStoreLoading, hasLoaded, refreshStores } = useStore();

  useEffect(() => {
    if (isAuthLoading || isStoreLoading || !hasLoaded) {
      return;
    }
    if (!user) {
      router.push("/merchant/login?redirect=/merchant/onboarding");
      return;
    }
    if (stores.length > 0) {
      router.push("/merchant");
    }
  }, [isAuthLoading, user, isStoreLoading, hasLoaded, stores.length, router]);

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
        status: "ACTIVE",
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12 relative">
      <div className="absolute top-4 right-4">
        <ThemeModeToggle />
      </div>

      <div className="w-full max-w-[540px] space-y-6">
        {/* Onboarding Stepper Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 border border-border/80 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Step {step} of 3</span>
            <span>•</span>
            <span>
              {step === 1 && "Organization Identity"}
              {step === 2 && "Primary Store Setup"}
              {step === 3 && "Store Configuration"}
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Welcome, {user?.name || "Merchant"}!
          </h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Let&apos;s set up your commerce foundation and launch your first digital storefront.
          </p>

          {/* Stepper Progress bar */}
          <div className="flex gap-2 max-w-xs mx-auto pt-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: ORGANIZATION */}
        {step === 1 && (
          <Card className="border-border/70 bg-card shadow-sm">
            <CardHeader className="border-b border-border/50 pb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                    1. Create Your Business Organization
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Organizations represent your legal or umbrella business entity and can hold multiple stores.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleNextStep1} noValidate className="space-y-4">
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
                    className="h-9 text-sm"
                  />
                </FormField>

                <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg border border-border/60 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Multi-Tenancy Note:</strong> You can create and manage multiple stores
                    under this organization once onboarding is completed.
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={!orgName.trim()}
                  className="w-full h-9 text-xs font-medium"
                >
                  Continue to Store Setup
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: STORE DETAILS */}
        {step === 2 && (
          <Card className="border-border/70 bg-card shadow-sm">
            <CardHeader className="border-b border-border/50 pb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Store className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                    2. Set Up Your First Store
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    This will be your initial storefront for customers and inventory.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleNextStep2} noValidate className="space-y-4">
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
                    className="h-9 text-sm"
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
                    className="h-9 text-sm font-mono"
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Default Currency" htmlFor="onboarding-currency" required>
                    <Select
                      id="onboarding-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-9 text-sm"
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
                      className="h-9 text-sm"
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
                    className="h-9 text-sm"
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

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1 h-9 text-xs"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!storeName.trim() || !slug.trim()}
                    className="flex-2 h-9 text-xs font-medium"
                  >
                    Next: Contact &amp; Info
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: CONTACT & FINISH */}
        {step === 3 && (
          <Card className="border-border/70 bg-card shadow-sm">
            <CardHeader className="border-b border-border/50 pb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                    3. Configure Store Information
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Provide public customer service contact information and a brief store description.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleFinalSubmit} noValidate className="space-y-4">
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
                    className="h-9 text-sm"
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
                    className="h-9 text-sm"
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
                    className="h-9 text-sm"
                  />
                </FormField>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    disabled={isSubmitting}
                    className="flex-1 h-9 text-xs"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    className="flex-2 h-9 text-xs font-medium"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Complete &amp; Enter Dashboard
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
