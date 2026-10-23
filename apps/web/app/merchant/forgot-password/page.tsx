"use client";

import React, { useState } from "react";
import Link from "next/link";
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
import { ArrowLeft } from "lucide-react";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../src/components/theme-mode-toggle";

export default function MerchantForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post<{ message: string }>(
        "/api/v1/auth/forgot-password",
        { email: email.trim() }
      );

      setResetSent(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to process password reset request.");
      } else {
        setError("An unexpected error occurred. Please try again.");
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

      <div className="w-full max-w-[420px] space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-md shadow-primary/20">
            C
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reset Your Password
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your merchant email to receive password reset instructions
          </p>
        </div>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-5">
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              Merchant Password Recovery
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              We will send a secure token to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {resetSent ? (
              <div className="space-y-4">
                <Alert variant="success" title="Instructions Dispatched">
                  If an account exists with <strong>{email}</strong>, a password reset token has been issued.
                </Alert>

                <p className="text-xs text-muted-foreground">
                  Did not receive an email? Check your spam folder or ensure the email matches your merchant registration.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {error && (
                  <Alert variant="danger" title="Error">
                    {error}
                  </Alert>
                )}

                <FormField label="Email Address" htmlFor="reset-email" required>
                  <Input
                    id="reset-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="name@business.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    autoFocus
                    required
                    className="h-9 text-sm"
                  />
                </FormField>

                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={isSubmitting || !email.trim()}
                  className="w-full h-9 text-xs font-medium"
                >
                  Send Reset Instructions
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="border-t border-border/50 bg-muted/20 py-4 px-6 justify-center">
            <Link
              href="/merchant/login"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
