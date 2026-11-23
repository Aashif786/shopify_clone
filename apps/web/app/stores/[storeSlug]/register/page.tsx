"use client";

import Link from "next/link";
import React, { Suspense, use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Spinner,
} from "@calcart/ui";
import { AuthShell } from "../../../../src/components/storefront/auth/auth-shell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

function getSafeRedirectUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) {
    return url;
  }
  return fallback;
}

function CustomerRegisterForm({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultAccountUrl = `/stores/${storeSlug}/account`;
  const redirectUrl = getSafeRedirectUrl(searchParams?.get("redirect"), defaultAccountUrl);
  const isCheckoutRedirect = redirectUrl.includes("/checkout");
  const loginHref = isCheckoutRedirect
    ? `/stores/${encodeURIComponent(storeSlug)}/login?redirect=${encodeURIComponent(redirectUrl)}`
    : `/stores/${encodeURIComponent(storeSlug)}/login`;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || isSubmitting) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/auth/register`, {
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      // Attempt immediate seamless login so customer flows directly to checkout or target
      try {
        await apiClient.post(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/auth/login`, {
          email: email.trim(),
          password,
        });

        if (typeof window !== "undefined") {
          window.location.href = redirectUrl;
          return;
        } else {
          router.push(redirectUrl);
          return;
        }
      } catch {
        // Fall back to success message with direct sign-in button if auto-login is not permitted
        setAccepted(true);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to create customer account.");
      } else {
        setError("An unexpected error occurred while creating your account.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell storeSlug={storeSlug} maxWidth="md">
      <Card>
        <CardHeader>
          <CardTitle>
            {isCheckoutRedirect ? "Create Account to Checkout" : "Create an Account"}
          </CardTitle>
          <CardDescription>
            {isCheckoutRedirect
              ? "Create your customer account to complete your order. Your cart items are saved."
              : "Save your shipping information, review past orders, and speed up future checkouts."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accepted ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Alert variant="success" title="Account created successfully!">
                {isCheckoutRedirect
                  ? "Your account has been created. Click below to sign in and proceed to checkout."
                  : "If this address can be registered, we sent a verification link. After verifying, please sign in."}
              </Alert>
              <Link
                href={loginHref}
                className="ds-btn ds-btn-primary"
                style={{ width: "100%", textAlign: "center", textDecoration: "none" }}
              >
                {isCheckoutRedirect ? "Sign In & Continue to Checkout" : "Sign In to Account"}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {isCheckoutRedirect && (
                  <Alert variant="info" title="Checkout requires an account">
                    Creating an account takes less than a minute and preserves your cart items.
                  </Alert>
                )}
                {error && (
                  <Alert variant="danger" title="Registration Error">
                    {error}
                  </Alert>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <FormField label="First Name" htmlFor="cust-first-name">
                    <Input
                      id="cust-first-name"
                      autoComplete="given-name"
                      name="firstName"
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </FormField>
                  <FormField label="Last Name" htmlFor="cust-last-name">
                    <Input
                      id="cust-last-name"
                      autoComplete="family-name"
                      name="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>

                <FormField label="Email Address" htmlFor="cust-email" required>
                  <Input
                    id="cust-email"
                    autoComplete="email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </FormField>

                <FormField label="Phone Number" htmlFor="cust-phone">
                  <Input
                    id="cust-phone"
                    autoComplete="tel"
                    type="tel"
                    name="phone"
                    placeholder="+1 (555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting}
                  />
                </FormField>

                <FormField
                  label="Password"
                  htmlFor="cust-password"
                  required
                  helperText="At least 8 characters long."
                >
                  <Input
                    id="cust-password"
                    autoComplete="new-password"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </FormField>

                <FormField label="Confirm Password" htmlFor="cust-confirm-password" required>
                  <Input
                    id="cust-confirm-password"
                    autoComplete="new-password"
                    type="password"
                    name="confirmPassword"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </FormField>

                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={
                    isSubmitting ||
                    !email.trim() ||
                    !password ||
                    password !== confirmPassword
                  }
                  style={{ width: "100%", marginTop: "var(--space-2)" }}
                >
                  {isCheckoutRedirect ? "Create Account & Continue to Checkout" : "Create Customer Account"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter
          style={{
            borderTop: "1px solid var(--color-border)",
            justifyContent: "center",
            padding: "var(--space-4)",
          }}
        >
          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
            Already have an account?{" "}
            <Link
              href={loginHref}
              style={{
                color: "var(--color-primary)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </span>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}

export default function CustomerRegisterPage({ params }: PageProps) {
  const { storeSlug } = use(params);

  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16) 0" }}>
          <Spinner size="lg" label="Loading..." />
        </div>
      }
    >
      <CustomerRegisterForm storeSlug={storeSlug} />
    </Suspense>
  );
}
