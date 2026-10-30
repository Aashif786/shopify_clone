"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Badge,
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
import { Mail, Store, Shield, ArrowRight } from "lucide-react";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../../src/components/theme-mode-toggle";

interface InvitationData {
  id: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  email: string;
  role: "owner" | "admin" | "staff";
  status: string;
  expiresAt: string;
  isExpired: boolean;
}

function InvitationAcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";

  const { user, refreshUser } = useAuth();
  const { refreshStores } = useStore();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form fields for new account creation
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setFetchError("No invitation token was provided in the URL.");
      setIsLoading(false);
      return;
    }

    async function loadInvitation() {
      try {
        const res = await apiClient.get<{ invitation: InvitationData }>(
          `/api/v1/invitations/${encodeURIComponent(token)}`
        );
        if (res.invitation.status === "REVOKED") {
          setFetchError("This invitation has been revoked by the store administrator.");
        } else if (res.invitation.isExpired || res.invitation.status === "EXPIRED") {
          setFetchError("This invitation has expired. Contact the store administrator for a new invitation.");
        } else if (res.invitation.status === "ACCEPTED") {
          setFetchError("This invitation has already been accepted.");
        } else if (res.invitation.status !== "PENDING") {
          setFetchError("This invitation is no longer active.");
        } else {
          setInvitation(res.invitation);
        }
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          setFetchError(err.message || "Invalid or expired invitation.");
        } else {
          setFetchError("Unable to verify invitation. Please contact your store administrator.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadInvitation();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || isSubmitting) return;

    if (!user) {
      if (!name.trim()) {
        setActionError("Please enter your name.");
        return;
      }
      if (!password || password.length < 8) {
        setActionError("Password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setActionError("Passwords do not match.");
        return;
      }
    }

    setActionError(null);
    setIsSubmitting(true);

    try {
      const payload = user ? {} : { name: name.trim(), password };
      const res = await apiClient.post<{ storeId: string }>(
        `/api/v1/invitations/${encodeURIComponent(token)}`,
        payload
      );

      await refreshUser();
      await refreshStores(res.storeId);
      router.push("/merchant");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setActionError(err.message || "Failed to accept store invitation.");
      } else {
        setActionError("An unexpected error occurred while processing invitation.");
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

      <div className="w-full max-w-[480px] space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-md shadow-primary/20">
            C
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Store Team Invitation
          </h1>
          <p className="text-xs text-muted-foreground">
            Join your store team and start managing operations
          </p>
        </div>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-5">
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              Team Membership Invitation
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              You have been invited to collaborate on a merchant store.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Spinner size="md" label="Verifying invitation details..." />
                <span className="text-xs text-muted-foreground animate-pulse">
                  Verifying invitation details...
                </span>
              </div>
            ) : fetchError ? (
              <div className="space-y-4">
                <Alert variant="danger" title="Invalid Invitation">
                  {fetchError}
                </Alert>
                <p className="text-xs text-muted-foreground">
                  This invitation may have expired, been revoked, or already accepted. Contact the store owner to request a new invitation.
                </p>
              </div>
            ) : invitation ? (
              <form onSubmit={handleAccept} noValidate className="space-y-4">
                {actionError && (
                  <Alert variant="danger" title="Error">
                    {actionError}
                  </Alert>
                )}

                {/* Store & Role Summary Box */}
                <div className="p-4 bg-muted/40 rounded-lg border border-border/60 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5" />
                      Invited Store:
                    </span>
                    <strong className="text-foreground font-semibold">
                      {invitation.storeName}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Assigned Role:
                    </span>
                    <Badge variant="info" className="uppercase text-[11px] font-semibold px-2 py-0.5">
                      {invitation.role}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Recipient Email:
                    </span>
                    <span className="text-foreground font-medium font-mono text-[11px]">
                      {invitation.email}
                    </span>
                  </div>
                </div>

                {/* Authenticated user mode */}
                {user ? (
                  <div className="space-y-4 pt-2">
                    <Alert variant="info" title="Logged In">
                      You are currently signed in as <strong>{user.name}</strong> ({user.email}). Accepting will link this store to your existing account.
                    </Alert>

                    <Button
                      type="submit"
                      variant="primary"
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      className="w-full h-9 text-xs font-medium"
                    >
                      Accept Invitation &amp; Enter Store
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </div>
                ) : (
                  /* New user registration mode */
                  <div className="space-y-4 pt-2">
                    <div className="text-xs text-muted-foreground">
                      Create a password to set up your staff account:
                    </div>

                    <FormField label="Full Name" htmlFor="staff-name" required>
                      <Input
                        id="staff-name"
                        placeholder="Your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSubmitting}
                        autoFocus
                        required
                        className="h-9 text-sm"
                      />
                    </FormField>

                    <FormField
                      label="Password"
                      htmlFor="staff-password"
                      required
                      helperText="Minimum 8 characters."
                    >
                      <Input
                        id="staff-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isSubmitting}
                        required
                        className="h-9 text-sm font-mono"
                      />
                    </FormField>

                    <FormField label="Confirm Password" htmlFor="staff-confirm-password" required>
                      <Input
                        id="staff-confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isSubmitting}
                        required
                        className="h-9 text-sm font-mono"
                      />
                    </FormField>

                    <Button
                      type="submit"
                      variant="primary"
                      loading={isSubmitting}
                      disabled={isSubmitting || !name.trim() || !password || password !== confirmPassword}
                      className="w-full h-9 text-xs font-medium mt-2"
                    >
                      Create Account &amp; Join Store
                    </Button>
                  </div>
                )}
              </form>
            ) : null}
          </CardContent>
          <CardFooter className="border-t border-border/50 bg-muted/20 py-4 px-6 justify-center">
            <Link
              href={
                token
                  ? `/merchant/login?redirect=${encodeURIComponent(`/merchant/invitations/accept?token=${token}`)}`
                  : "/merchant/login"
              }
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            >
              Sign in with an existing account
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function InvitationAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <Spinner size="lg" label="Loading invitation..." />
        </div>
      }
    >
      <InvitationAcceptForm />
    </Suspense>
  );
}
