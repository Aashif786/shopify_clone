"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { ShippingSettingsDTO, ShippingZoneDTO } from "@calcart/shipping";
import { hasRoleAtLeast } from "@calcart/tenant";
import { Alert, Button } from "@calcart/ui";
import { RefreshCw } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { useStore } from "../../../context/store-context";
import { ProductWeightEditor } from "./product-weight-editor";
import { ShippingSettingsCard } from "./shipping-settings-card";
import { ShippingZonesEditor } from "./shipping-zones-editor";

function ViewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading shipping settings">
      <div className="h-5 w-64 rounded bg-muted/60 animate-pulse" />
      <div className="h-9 w-48 rounded bg-muted/40 animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded bg-muted/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function ShippingView() {
  const { activeStore } = useStore();
  const storeId = activeStore?.id ?? null;
  const currency = activeStore?.currency ?? "INR";
  const canEdit = hasRoleAtLeast(activeStore?.role ?? "staff", "admin");

  const [settings, setSettings] = useState<ShippingSettingsDTO | null>(null);
  const [zones, setZones] = useState<ShippingZoneDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadZones = useCallback(async () => {
    if (!storeId) return;
    const res = await apiClient.get<{ zones: ShippingZoneDTO[] }>(
      `/api/v1/stores/${encodeURIComponent(storeId)}/shipping/zones`,
    );
    setZones(res.zones);
  }, [storeId]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [loadedSettings] = await Promise.all([
        apiClient.get<ShippingSettingsDTO>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/shipping/settings`,
        ),
        loadZones(),
      ]);
      setSettings(loadedSettings);
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : "Could not load shipping settings.");
    } finally {
      setIsLoading(false);
    }
  }, [storeId, loadZones]);

  useEffect(() => {
    load();
  }, [load]);

  const hasUsableRate = zones.some((zone) => zone.isActive && zone.rates.some((rate) => rate.isActive));

  return (
    <div className="space-y-10 max-w-5xl" data-testid="shipping-view">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Shipping</h1>
        <p className="text-sm text-muted-foreground max-w-[65ch]">
          Decide where you deliver and what it costs. Customers see the options for their address
          at checkout, and GST is charged on shipping at the same time as on the goods.
        </p>
      </header>

      {!storeId && (
        <Alert variant="info" title="No store selected">
          Choose a store to manage its shipping.
        </Alert>
      )}

      {error && (
        <Alert variant="danger" title="Unable to load shipping settings">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={load} icon={<RefreshCw size={14} />}>
              Try again
            </Button>
          </div>
        </Alert>
      )}

      {storeId && isLoading && <ViewSkeleton />}

      {storeId && !isLoading && settings && (
        <>
          <ShippingSettingsCard
            storeId={storeId}
            settings={settings}
            canEdit={canEdit}
            onSaved={setSettings}
          />

          {settings.isEnabled && !hasUsableRate && (
            <Alert variant="warning" title="Customers cannot check out yet">
              Shipping rules are on, but no active zone has an active rate. Until you add one,
              every checkout is refused with &ldquo;we cannot ship this order to that address&rdquo;.
            </Alert>
          )}

          <ShippingZonesEditor
            storeId={storeId}
            currency={currency}
            zones={zones}
            canEdit={canEdit}
            onChanged={loadZones}
          />

          <ProductWeightEditor
            storeId={storeId}
            canEdit={canEdit}
            defaultWeightGrams={settings.defaultWeightGrams}
          />
        </>
      )}
    </div>
  );
}
