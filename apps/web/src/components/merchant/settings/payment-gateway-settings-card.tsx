"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { MerchantRazorpayConfigDTO } from "@calcart/payments";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from "@calcart/ui";
import {
  CreditCard,
  Key,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
} from "lucide-react";
import { apiClient } from "../../../lib/api-client";

interface PaymentGatewaySettingsCardProps {
  storeId: string;
  userRole?: string;
}

export function PaymentGatewaySettingsCard({
  storeId,
  userRole = "owner",
}: PaymentGatewaySettingsCardProps) {
  const isReadOnly = userRole === "staff";

  const [config, setConfig] = useState<MerchantRazorpayConfigDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<MerchantRazorpayConfigDTO>(
        `/api/v1/stores/${storeId}/payments/gateways/razorpay`
      );
      setConfig(res);
      setKeyId(res.keyId || "");
      setKeySecret("");
      setWebhookSecret("");
      setIsEnabled(res.isEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Razorpay payment gateway settings");
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload: {
        keyId?: string;
        keySecret?: string;
        webhookSecret?: string;
        isEnabled: boolean;
      } = {
        isEnabled,
      };

      if (keyId.trim()) {
        payload.keyId = keyId.trim();
      }
      if (keySecret.trim()) {
        payload.keySecret = keySecret.trim();
      }
      if (webhookSecret.trim()) {
        payload.webhookSecret = webhookSecret.trim();
      }

      const res = await apiClient.put<MerchantRazorpayConfigDTO>(
        `/api/v1/stores/${storeId}/payments/gateways/razorpay`,
        payload
      );

      setConfig(res);
      setKeyId(res.keyId || "");
      setKeySecret("");
      setWebhookSecret("");
      setIsEnabled(res.isEnabled);
      setSuccessMessage("Razorpay credentials and configuration saved successfully.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment gateway settings");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = () => {
    if (!config) return null;
    switch (config.status) {
      case "ACTIVE":
        return (
          <Badge variant="success" className="gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            Live & Active
          </Badge>
        );
      case "TEST_MODE":
        return (
          <Badge variant="warning" className="gap-1 font-medium">
            <Zap className="h-3 w-3" />
            Test Mode (rzp_test)
          </Badge>
        );
      case "INACTIVE":
        return (
          <Badge variant="neutral" className="gap-1 font-medium">
            Disabled
          </Badge>
        );
      case "NOT_CONFIGURED":
      default:
        return (
          <Badge variant="neutral" className="gap-1 font-medium">
            Not Configured
          </Badge>
        );
    }
  };

  return (
    <Card className="border border-border/70 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Payment Gateway & Razorpay Onboarding
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Configure your store-specific Razorpay account keys to receive payments and process customer refunds directly.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {getStatusBadge()}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadConfig}
              disabled={isLoading}
              className="h-8 w-8 p-0"
              title="Refresh status"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {error && (
          <Alert variant="danger" title="Payment Configuration Error">
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" title="Settings Saved">
            {successMessage}
          </Alert>
        )}

        {isLoading && !config ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Spinner size="md" />
            <span className="text-xs">Loading payment provider details...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Status & Security Callout */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-medium text-blue-900 dark:text-blue-300">
                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Store-Wise Tenant Isolation Guarantee</span>
              </div>
              <p className="text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                Cal Cart runs a multi-tenant payment architecture. Your credentials are fully isolated to this store.
                Transactions, checkout orders, and refunds for this store are routed directly into your own Razorpay merchant dashboard.
              </p>
              <div className="pt-1">
                <a
                  href="https://dashboard.razorpay.com/#/access/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Open Razorpay Dashboard API Keys</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Razorpay Key ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    Razorpay Key ID
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Starts with <code className="bg-muted px-1 py-0.5 rounded">rzp_live_</code> or <code className="bg-muted px-1 py-0.5 rounded">rzp_test_</code>
                  </span>
                </label>
                <input
                  type="text"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  disabled={isReadOnly || isSaving}
                  placeholder="rzp_live_xxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>

              {/* Razorpay Key Secret */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Razorpay Key Secret
                  </span>
                  {config?.hasKeySecret && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Configured ({config.keySecretMasked})
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={keySecret}
                    onChange={(e) => setKeySecret(e.target.value)}
                    disabled={isReadOnly || isSaving}
                    placeholder={config?.hasKeySecret ? "•••••••••••••••• (Leave blank to keep existing)" : "Paste your Razorpay Key Secret"}
                    className="w-full pl-3 pr-9 py-2 text-xs font-mono rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    tabIndex={-1}
                  >
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Webhook Secret */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  Razorpay Webhook Secret (Optional)
                </span>
                {config?.hasWebhookSecret && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Configured ({config.webhookSecretMasked})
                  </span>
                )}
              </label>
              <input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                disabled={isReadOnly || isSaving}
                placeholder={config?.hasWebhookSecret ? "•••••••••••••••• (Leave blank to keep existing)" : "Enter webhook secret for Razorpay event signature verification"}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <p className="text-[11px] text-muted-foreground">
                Required only if configuring custom merchant webhook endpoints for asynchronous event reconciliation.
              </p>
            </div>

            {/* Gateway Enablement Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-muted/10">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground">
                  Enable Razorpay for this Storefront
                </span>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, customers can pay using Razorpay on your store checkout.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  disabled={isReadOnly || isSaving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Save Button */}
            {!isReadOnly && (
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSaving}
                  className="min-w-[120px]"
                >
                  {isSaving ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Configuration"
                  )}
                </Button>
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
