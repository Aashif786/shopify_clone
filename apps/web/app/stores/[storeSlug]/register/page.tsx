"use client";

import React, { use, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@calcart/ui";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

export default function CustomerRegisterPage({ params }: PageProps) {
  const { storeSlug } = use(params);
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      router.push(`/stores/${storeSlug}/account`);
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
    <StorefrontShell storeName="Create Customer Account" storeSlug={storeSlug}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "var(--space-12) var(--space-4)",
        }}
      >
        <div style={{ width: "100%", maxWidth: "460px" }}>
          <Card>
            <CardHeader>
              <CardTitle>Create an Account</CardTitle>
              <CardDescription>
                Save your shipping information, review past orders, and speed up future checkouts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {error && (
                    <Alert variant="danger" title="Registration Error">
                      {error}
                    </Alert>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                    <FormField label="First Name" htmlFor="cust-first-name">
                      <Input
                        id="cust-first-name"
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
                    Create Customer Account
                  </Button>
                </div>
              </form>
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
                <a
                  href={`/stores/${storeSlug}/login`}
                  style={{
                    color: "var(--color-primary)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Sign in
                </a>
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </StorefrontShell>
  );
}
