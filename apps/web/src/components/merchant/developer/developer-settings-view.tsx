"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Key,
  Webhook,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  Button,
  Badge,
  Spinner,
  Alert,
} from "@calcart/ui";
import { apiClient } from "../../../lib/api-client";

interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  secret: string;
  event_types: string[];
  is_active: boolean;
  created_at: string;
}

interface WebhookDeliveryItem {
  id: string;
  event_type: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  attempts: number;
  response_status_code: number | null;
  error_message: string | null;
  created_at: string;
  delivered_at: string | null;
}

const AVAILABLE_SCOPES = [
  { id: "read:products", label: "Read Products", description: "View products, collections and pricing" },
  { id: "write:products", label: "Write Products", description: "Create and update catalog products" },
  { id: "read:orders", label: "Read Orders", description: "View customer orders and fulfillment details" },
  { id: "write:orders", label: "Write Orders", description: "Update order statuses and tracking" },
  { id: "read:inventory", label: "Read Inventory", description: "Query warehouse stock availability" },
  { id: "write:inventory", label: "Write Inventory", description: "Adjust warehouse stock levels" },
  { id: "read:webhooks", label: "Read Webhooks", description: "View webhook subscriptions" },
  { id: "write:webhooks", label: "Write Webhooks", description: "Manage webhook endpoints" },
];

const AVAILABLE_EVENTS = [
  { id: "order.created", label: "Order Created", desc: "Fired immediately when a new checkout completes into an order" },
  { id: "order.paid", label: "Order Paid", desc: "Fired when payment is confirmed or COD cash collected" },
  { id: "order.fulfilled", label: "Order Fulfilled", desc: "Fired when a courier shipment is dispatched with AWB" },
  { id: "shipment.delivered", label: "Shipment Delivered", desc: "Fired when courier confirms delivery at customer address" },
  { id: "return.received", label: "Return Received", desc: "Fired when returned merchandise is received and restocked" },
];

interface DeveloperSettingsViewProps {
  storeId: string;
  storeSlug?: string;
}

export function DeveloperSettingsView({ storeId }: DeveloperSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks">("keys");

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);

  // New Key Modal state
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "read:products",
    "read:orders",
    "read:inventory",
  ]);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSubmittingKey, setIsSubmittingKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(true);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  // New Webhook Modal state
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "order.created",
    "order.paid",
  ]);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isSubmittingWebhook, setIsSubmittingWebhook] = useState(false);

  // Load API keys
  const loadApiKeys = useCallback(async () => {
    setIsLoadingKeys(true);
    setKeyError(null);
    try {
      const data = await apiClient.get<ApiKeyItem[]>(`/api/v1/stores/${storeId}/api-keys`);
      setApiKeys(data);
    } catch (err: unknown) {
      setKeyError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setIsLoadingKeys(false);
    }
  }, [storeId]);

  // Load Webhooks
  const loadWebhooks = useCallback(async () => {
    setIsLoadingWebhooks(true);
    setWebhookError(null);
    try {
      const data = await apiClient.get<{ subscriptions: WebhookItem[]; deliveries: WebhookDeliveryItem[] }>(
        `/api/v1/stores/${storeId}/webhooks`,
      );
      setWebhooks(data.subscriptions);
      setDeliveries(data.deliveries || []);
    } catch (err: unknown) {
      setWebhookError(err instanceof Error ? err.message : "Failed to load webhooks");
    } finally {
      setIsLoadingWebhooks(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadApiKeys();
    loadWebhooks();
  }, [loadApiKeys, loadWebhooks]);

  // Create Key Handler
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    setIsSubmittingKey(true);
    setKeyError(null);
    try {
      const res = await apiClient.post<{ key: ApiKeyItem; rawKey: string }>(
        `/api/v1/stores/${storeId}/api-keys`,
        {
          name: keyName.trim(),
          scopes: selectedScopes,
        },
      );
      setCreatedRawKey(res.rawKey);
      setApiKeys((prev) => [res.key, ...prev]);
      setKeyName("");
    } catch (err: unknown) {
      setKeyError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsSubmittingKey(false);
    }
  };

  // Revoke Key Handler
  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? Applications using this key will immediately stop working.")) {
      return;
    }
    try {
      await apiClient.delete(`/api/v1/stores/${storeId}/api-keys/${keyId}`);
      setApiKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k)),
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  };

  // Create Webhook Handler
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookName.trim() || !webhookUrl.trim() || selectedEvents.length === 0) return;

    setIsSubmittingWebhook(true);
    setWebhookError(null);
    try {
      const res = await apiClient.post<WebhookItem>(`/api/v1/stores/${storeId}/webhooks`, {
        name: webhookName.trim(),
        url: webhookUrl.trim(),
        eventTypes: selectedEvents,
      });
      setCreatedWebhookSecret(res.secret);
      setWebhooks((prev) => [res, ...prev]);
      setWebhookName("");
      setWebhookUrl("");
    } catch (err: unknown) {
      setWebhookError(err instanceof Error ? err.message : "Failed to create webhook subscription");
    } finally {
      setIsSubmittingWebhook(false);
    }
  };

  // Delete Webhook Handler
  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm("Delete this webhook subscription?")) return;
    try {
      await apiClient.delete(`/api/v1/stores/${storeId}/webhooks/${webhookId}`);
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete webhook");
    }
  };

  const copyToClipboard = (text: string, isKey: boolean) => {
    navigator.clipboard.writeText(text);
    if (isKey) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto pb-12">
      {/* Top Banner / Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border/40">
          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "keys"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Key size={14} />
            API Keys
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
              {apiKeys.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("webhooks")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "webhooks"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Webhook size={14} />
            Webhooks
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
              {webhooks.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "keys" ? (
            <Button
              size="sm"
              onClick={() => {
                setCreatedRawKey(null);
                setIsCreatingKey(true);
              }}
              className="gap-1.5"
            >
              <Plus size={14} />
              Generate API Key
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setCreatedWebhookSecret(null);
                setIsCreatingWebhook(true);
              }}
              className="gap-1.5"
            >
              <Plus size={14} />
              Add Endpoint
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: API KEYS                                                           */}
      {/* ========================================================================= */}
      {activeTab === "keys" && (
        <div className="space-y-6">
          {keyError && (
            <Alert variant="danger" title="API Key Error">
              {keyError}
            </Alert>
          )}

          {/* New Key Revealed Modal / Banner */}
          {createdRawKey && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    <ShieldCheck size={18} />
                    API Key Generated Successfully
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Copy this key immediately. For security reasons, it will never be displayed again.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreatedRawKey(null)}
                >
                  Done
                </Button>
              </div>

              <div className="flex items-center gap-2 bg-background/80 p-2.5 rounded-lg border border-border/80 font-mono text-xs text-foreground">
                <span className="truncate flex-1 select-all">{createdRawKey}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(createdRawKey, true)}
                  className="gap-1 shrink-0"
                >
                  {copiedKey ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedKey ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          {/* Create Key Form Card (Collapsible) */}
          {isCreatingKey && !createdRawKey && (
            <form
              onSubmit={handleCreateKey}
              className="bg-card border border-border/60 rounded-xl p-6 space-y-5 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <h3 className="text-sm font-bold text-foreground">Create API Key</h3>
                <button
                  type="button"
                  onClick={() => setIsCreatingKey(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-2 max-w-md">
                <label className="text-xs font-semibold text-foreground">
                  Key Name / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. ERP Integration, Mobile App, Warehouse Sync"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Allowed Permissions (Scopes)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {AVAILABLE_SCOPES.map((scope) => {
                    const isChecked = selectedScopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-primary/5 border-primary/40 text-foreground"
                            : "bg-background border-border/50 text-muted-foreground hover:border-border"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedScopes([...selectedScopes, scope.id]);
                            } else {
                              setSelectedScopes(selectedScopes.filter((s) => s !== scope.id));
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-foreground">{scope.label}</div>
                          <div className="text-[11px] text-muted-foreground leading-tight">
                            {scope.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingKey(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingKey || !keyName.trim()}
                >
                  {isSubmittingKey ? "Generating..." : "Generate Key"}
                </Button>
              </div>
            </form>
          )}

          {/* Keys Table Card */}
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Store API Keys</h3>
                <p className="text-xs text-muted-foreground">
                  Manage secret API keys for headless storefronts, ERP systems, and warehouse automation.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={loadApiKeys} disabled={isLoadingKeys}>
                <RefreshCw size={12} className={isLoadingKeys ? "animate-spin" : ""} />
              </Button>
            </div>

            {isLoadingKeys ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Spinner size="md" />
                <span className="text-xs">Loading keys...</span>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Key size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No API keys created yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Generate an API key to access the Cal Cart REST API programmatically.
                  </p>
                </div>
                <Button size="sm" onClick={() => setIsCreatingKey(true)}>
                  Generate Key
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/40 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3">Key Name</th>
                      <th className="px-4 py-3">Prefix</th>
                      <th className="px-4 py-3">Scopes</th>
                      <th className="px-4 py-3">Last Used</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {apiKeys.map((key) => {
                      const isRevoked = key.revoked_at !== null;
                      return (
                        <tr key={key.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3.5 font-medium text-foreground">
                            {key.name}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-muted-foreground">
                            {key.key_prefix}••••••••
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {key.scopes.slice(0, 3).map((scope) => (
                                <span
                                  key={scope}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                                >
                                  {scope}
                                </span>
                              ))}
                              {key.scopes.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{key.scopes.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground">
                            {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant={isRevoked ? "danger" : "success"} size="sm">
                              {isRevoked ? "REVOKED" : "ACTIVE"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {!isRevoked && (
                              <button
                                type="button"
                                onClick={() => handleRevokeKey(key.id)}
                                className="text-xs text-rose-600 hover:text-rose-700 font-medium transition-colors"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WEBHOOKS                                                           */}
      {/* ========================================================================= */}
      {activeTab === "webhooks" && (
        <div className="space-y-6">
          {webhookError && (
            <Alert variant="danger" title="Webhook Error">
              {webhookError}
            </Alert>
          )}

          {/* New Webhook Secret Revealed Modal */}
          {createdWebhookSecret && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                    <ShieldCheck size={18} />
                    Webhook Endpoint Registered
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Copy the signing secret below. Use it to verify incoming <code>X-CalCart-Signature</code> headers.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreatedWebhookSecret(null)}
                >
                  Done
                </Button>
              </div>

              <div className="flex items-center gap-2 bg-background/80 p-2.5 rounded-lg border border-border/80 font-mono text-xs text-foreground">
                <span className="truncate flex-1 select-all">{createdWebhookSecret}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(createdWebhookSecret, false)}
                  className="gap-1 shrink-0"
                >
                  {copiedSecret ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedSecret ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          {/* Add Webhook Form (Collapsible) */}
          {isCreatingWebhook && !createdWebhookSecret && (
            <form
              onSubmit={handleCreateWebhook}
              className="bg-card border border-border/60 rounded-xl p-6 space-y-5 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <h3 className="text-sm font-bold text-foreground">Add Webhook Endpoint</h3>
                <button
                  type="button"
                  onClick={() => setIsCreatingWebhook(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">
                    Endpoint Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fulfillment Service, Zapier, Inventory Sync"
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">
                    Payload URL (HTTPS)
                  </label>
                  <input
                    type="url"
                    placeholder="https://api.yourdomain.com/webhooks/calcart"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Subscribed Domain Events
                </label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((event) => {
                    const isChecked = selectedEvents.includes(event.id);
                    return (
                      <label
                        key={event.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-primary/5 border-primary/40 text-foreground"
                            : "bg-background border-border/50 text-muted-foreground hover:border-border"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEvents([...selectedEvents, event.id]);
                            } else {
                              setSelectedEvents(selectedEvents.filter((ev) => ev !== event.id));
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-foreground font-mono">
                            {event.id}
                          </div>
                          <div className="text-xs text-muted-foreground">{event.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingWebhook(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingWebhook || !webhookName.trim() || !webhookUrl.trim() || selectedEvents.length === 0}
                >
                  {isSubmittingWebhook ? "Saving..." : "Save Endpoint"}
                </Button>
              </div>
            </form>
          )}

          {/* Subscriptions Card */}
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Webhook Subscriptions</h3>
                <p className="text-xs text-muted-foreground">
                  Receive near real-time HTTP callbacks when commerce events happen in this store.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={loadWebhooks} disabled={isLoadingWebhooks}>
                <RefreshCw size={12} className={isLoadingWebhooks ? "animate-spin" : ""} />
              </Button>
            </div>

            {isLoadingWebhooks ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Spinner size="md" />
                <span className="text-xs">Loading webhooks...</span>
              </div>
            ) : webhooks.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Webhook size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No webhook endpoints registered</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Subscribe to order, payment, and logistics events to automate downstream workflows.
                  </p>
                </div>
                <Button size="sm" onClick={() => setIsCreatingWebhook(true)}>
                  Add Endpoint
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {webhooks.map((sub) => (
                  <div key={sub.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{sub.name}</span>
                        <Badge variant="success" size="sm">ACTIVE</Badge>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground truncate max-w-lg">
                        {sub.url}
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {sub.event_types.map((ev) => (
                          <span
                            key={ev}
                            className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono font-medium"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteWebhook(sub.id)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
                      >
                        <Trash2 size={12} />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Webhook Delivery Outbox Logs */}
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border/40">
              <h3 className="text-sm font-bold text-foreground">Recent Webhook Deliveries</h3>
              <p className="text-xs text-muted-foreground">
                Audit trail of outgoing webhook HTTP POST deliveries and retry attempts.
              </p>
            </div>

            {deliveries.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No webhook deliveries recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/40 text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Event</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Response</th>
                      <th className="px-4 py-2.5">Attempts</th>
                      <th className="px-4 py-2.5">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {deliveries.map((del) => (
                      <tr key={del.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-foreground">
                          {del.event_type}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              del.status === "SUCCESS"
                                ? "success"
                                : del.status === "PENDING"
                                ? "warning"
                                : "danger"
                            }
                            size="sm"
                          >
                            {del.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {del.response_status_code ? `HTTP ${del.response_status_code}` : del.error_message || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">
                          {del.attempts}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(del.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
