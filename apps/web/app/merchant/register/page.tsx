"use client";

import React, { useState } from "react";
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
} from "@shopify-clone/ui";
import { useAuth } from "../../../src/context/auth-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../src/components/theme-mode-toggle";

export default function MerchantRegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || isSubmitting) return;

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
      await apiClient.post("/api/v1/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      await refreshUser();
      router.push("/merchant/onboarding");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to create account.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to register. Please try again.");
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
        padding: "var(--space-4)",
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

      <div style={{ width: "100%", maxWidth: "460px" }}>
        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "22px",
              marginBottom: "var(--space-3)",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
            }}
          >
            S
          </div>
          <h1
            style={{
              fontSize: "var(--font-size-2xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Create Your Merchant Account
          </h1>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              marginTop: "var(--space-1)",
            }}
          >
            Start your multi-tenant commerce journey in minutes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Merchant Registration</CardTitle>
            <CardDescription>
              Set up your merchant identity and proceed to configure your store.
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

                <FormField label="Full Name" htmlFor="merchant-name" required>
                  <Input
                    id="merchant-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                    autoFocus
                    required
                  />
                </FormField>

                <FormField label="Business Email" htmlFor="merchant-email" required>
                  <Input
                    id="merchant-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="jane@mycompany.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </FormField>

                <FormField
                  label="Password"
                  htmlFor="merchant-password"
                  required
                  helperText="Must be at least 8 characters long."
                >
                  <Input
                    id="merchant-password"
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </FormField>

                <FormField
                  label="Confirm Password"
                  htmlFor="merchant-confirm-password"
                  required
                >
                  <Input
                    id="merchant-confirm-password"
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
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
                    !name.trim() ||
                    !email.trim() ||
                    !password ||
                    password !== confirmPassword
                  }
                  style={{ width: "100%", marginTop: "var(--space-2)" }}
                >
                  Continue to Store Setup
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
                href="/merchant/login"
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
  );
}
