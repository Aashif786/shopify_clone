"use client";

import React, { useState } from "react";
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
} from "@shopify-clone/ui";
import {
  User,
  KeyRound,
  Mail,
  Store,
  Lock,
  Save,
} from "lucide-react";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";

export default function MerchantAccountPage() {
  const { user, refreshUser, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  // Profile Form state
  const [name, setName] = useState(user?.name || "");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isUpdatingProfile) return;

    setProfileError(null);
    setProfileSuccess(false);
    setIsUpdatingProfile(true);

    try {
      await apiClient.patch("/api/v1/auth/me", { name: name.trim() });
      await refreshUser();
      setProfileSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setProfileError(err.message || "Failed to update profile name.");
      } else {
        setProfileError("An unexpected error occurred.");
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || isChangingPassword) return;

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(false);
    setIsChangingPassword(true);

    try {
      await apiClient.post("/api/v1/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setPasswordError(err.message || "Failed to change password. Please verify current password.");
      } else {
        setPasswordError("An unexpected error occurred while updating password.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <MerchantShell
      activePath="/merchant/account"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      onLogout={logout}
      title="Account & Security Settings"
      subtitle="Manage your personal profile identity and authentication credentials"
    >
      <div className="space-y-6 w-full">
        {/* User Identity Overview */}
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {user?.name?.[0]?.toUpperCase() || "M"}
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                    Merchant Identity
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Your authenticated platform credentials and tenant membership scope
                  </CardDescription>
                </div>
              </div>
              <Badge variant="success" className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {user?.status || "ACTIVE"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border border-border/60">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Email Address
                </div>
                <div className="text-sm font-semibold text-foreground truncate">
                  {user?.email || "—"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  Display Name
                </div>
                <div className="text-sm font-semibold text-foreground truncate">
                  {user?.name || "—"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Store className="h-3.5 w-3.5" />
                  Authorized Stores
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {stores.length} {stores.length === 1 ? "Store" : "Stores"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details Form */}
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <User className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                  Profile Details
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Update your primary display name shown across all store consoles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleUpdateProfile} noValidate className="space-y-4">
              {profileSuccess && (
                <Alert variant="success" title="Profile Saved">
                  Your display name has been updated successfully.
                </Alert>
              )}
              {profileError && (
                <Alert variant="danger" title="Error">
                  {profileError}
                </Alert>
              )}

              <FormField label="Full Name" htmlFor="profile-name" required>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isUpdatingProfile}
                  required
                  placeholder="Your full name"
                  className="h-9 text-sm"
                />
              </FormField>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={isUpdatingProfile}
                  disabled={isUpdatingProfile || !name.trim()}
                  className="h-8 text-xs font-medium"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Form */}
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                  Security & Password
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Change your password. Upon completion, active sessions on all other devices will be revoked.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleChangePassword} noValidate className="space-y-4">
              {passwordSuccess && (
                <Alert variant="success" title="Password Updated">
                  Your password has been changed. Other device sessions were automatically terminated.
                </Alert>
              )}
              {passwordError && (
                <Alert variant="danger" title="Security Error">
                  {passwordError}
                </Alert>
              )}

              <FormField label="Current Password" htmlFor="current-password" required>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isChangingPassword}
                  required
                  placeholder="••••••••"
                  className="h-9 text-sm font-mono"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="New Password"
                  htmlFor="new-password"
                  required
                  helperText="Must be at least 8 characters long."
                >
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                    placeholder="••••••••"
                    className="h-9 text-sm font-mono"
                  />
                </FormField>

                <FormField label="Confirm New Password" htmlFor="confirm-new-password" required>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                    placeholder="••••••••"
                    className="h-9 text-sm font-mono"
                  />
                </FormField>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={isChangingPassword}
                  disabled={
                    isChangingPassword ||
                    !currentPassword ||
                    !newPassword ||
                    newPassword !== confirmPassword
                  }
                  className="h-8 text-xs font-medium"
                >
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MerchantShell>
  );
}
