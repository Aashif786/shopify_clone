"use client";

import React, { useState } from "react";
import Link from "next/link";
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeModeToggle />
      </div>

      <div className="w-full max-w-[460px] space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-md shadow-primary/20">
            C
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create Your Merchant Account
          </h1>
          <p className="text-xs text-muted-foreground">
            Start your multi-tenant commerce journey in minutes
          </p>
        </div>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-5">
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              Merchant Registration
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Set up your merchant identity and proceed to configure your store.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {error && (
                <Alert variant="danger" title="Registration Error">
                  {error}
                </Alert>
              )}

              <FormField label="Full Name" htmlFor="merchant-name" required>
                <Input
                  id="merchant-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Jane Merchant"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                  required
                  className="h-9 text-sm"
                />
              </FormField>

              <FormField label="Email Address" htmlFor="merchant-email" required>
                <Input
                  id="merchant-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="name@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="h-9 text-sm"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Password"
                  htmlFor="merchant-password"
                  required
                  helperText="At least 8 characters"
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
                    className="h-9 text-sm font-mono"
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
                    className="h-9 text-sm font-mono"
                  />
                </FormField>
              </div>

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
                className="w-full h-9 text-xs font-medium mt-2"
              >
                Create Account
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t border-border/50 bg-muted/20 py-4 px-6 justify-center">
            <span className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/merchant/login"
                className="text-primary font-medium hover:underline"
              >
                Sign in
              </Link>
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
