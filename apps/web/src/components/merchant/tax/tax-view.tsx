"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { TaxSettingsDTO } from "@calcart/tax";
import { hasRoleAtLeast } from "@calcart/tenant";
import { Alert, Button } from "@calcart/ui";
import { RefreshCw } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { useStore } from "../../../context/store-context";
import { ProductTaxEditor } from "./product-tax-editor";
import { TaxSettingsForm } from "./tax-settings-form";

function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading tax settings">
      <div className="h-5 w-64 rounded bg-muted/60 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted/50 animate-pulse" />
            <div className="h-9 rounded bg-muted/40 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaxView() {
  const { activeStore } = useStore();
  const storeId = activeStore?.id ?? null;
  const canEdit = hasRoleAtLeast(activeStore?.role ?? "staff", "admin");

  const [settings, setSettings] = useState<TaxSettingsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    setError(null);
    try {
      setSettings(
        await apiClient.get<TaxSettingsDTO>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/tax/settings`,
        ),
      );
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError ? err.message : "Could not load tax settings.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-10 max-w-5xl" data-testid="tax-view">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary">
            Compliance
          </span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Tax and GST
        </h1>
        <p className="text-sm text-muted-foreground max-w-[65ch]">
          Charge GST at checkout, split into CGST and SGST or IGST by delivery
          state, and issue a numbered tax invoice for every paid order.
        </p>
      </header>

      {!storeId && (
        <Alert variant="info" title="No store selected">
          Choose a store to manage its tax settings.
        </Alert>
      )}

      {error && (
        <Alert variant="danger" title="Unable to load tax settings">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={load}
              icon={<RefreshCw size={14} />}
            >
              Try again
            </Button>
          </div>
        </Alert>
      )}

      {storeId && isLoading && <SettingsSkeleton />}

      {storeId && !isLoading && settings && (
        <>
          <TaxSettingsForm
            storeId={storeId}
            settings={settings}
            canEdit={canEdit}
            onSaved={setSettings}
          />
          {settings.isEnabled ? (
            <ProductTaxEditor
              storeId={storeId}
              canEdit={canEdit}
              defaultRateBps={settings.defaultGstRateBps}
            />
          ) : (
            <p className="text-xs text-muted-foreground border-t border-border/50 pt-6 max-w-[65ch]">
              Product tax rates appear here once GST is switched on.
            </p>
          )}
        </>
      )}
    </div>
  );
}
