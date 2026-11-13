"use client";

import React, { useState } from "react";
import type { ShippingRateDTO, ShippingZoneDTO } from "@calcart/shipping";
import { Alert, Badge, Button, Dialog, EmptyState, FormField, Input } from "@calcart/ui";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  EMPTY_RATE_FORM,
  EMPTY_ZONE_FORM,
  describeWeightBand,
  describeZone,
  rateFormToPayload,
  rateToForm,
  validateRateForm,
  validateZoneForm,
  zoneFormToPayload,
  zoneToForm,
  type RateFormData,
  type ZoneFormData,
} from "../../../lib/merchant-shipping-helpers";

export interface ShippingZonesEditorProps {
  storeId: string;
  currency: string;
  zones: ShippingZoneDTO[];
  canEdit: boolean;
  /** Reload the zones after any change. */
  onChanged: () => Promise<void>;
}

type ZoneDialogState = { mode: "create" } | { mode: "edit"; zone: ShippingZoneDTO } | null;
type RateDialogState =
  | { mode: "create"; zone: ShippingZoneDTO }
  | { mode: "edit"; zone: ShippingZoneDTO; rate: ShippingRateDTO }
  | null;
type DeleteState =
  | { kind: "zone"; zone: ShippingZoneDTO }
  | { kind: "rate"; rate: ShippingRateDTO }
  | null;

function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

function describeValueBand(rate: ShippingRateDTO, currency: string): string | null {
  const { minSubtotal: min, maxSubtotal: max } = rate;
  if (min > 0 && max !== null) return `Orders ${money(min, currency)} to ${money(max, currency)}`;
  if (max !== null) return `Orders up to ${money(max, currency)}`;
  if (min > 0) return `Orders from ${money(min, currency)}`;
  return null;
}

function describeDays(rate: ShippingRateDTO): string | null {
  const { estimatedDaysMin: a, estimatedDaysMax: b } = rate;
  if (a === null && b === null) return null;
  if (a !== null && b !== null) return a === b ? `${a} days` : `${a}–${b} days`;
  return `${a ?? b} days`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ShippingZonesEditor({
  storeId,
  currency,
  zones,
  canEdit,
  onChanged,
}: ShippingZonesEditorProps) {
  const [zoneDialog, setZoneDialog] = useState<ZoneDialogState>(null);
  const [rateDialog, setRateDialog] = useState<RateDialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<DeleteState>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const base = `/api/v1/stores/${encodeURIComponent(storeId)}/shipping`;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === "zone") {
        await apiClient.delete(`${base}/zones/${encodeURIComponent(pendingDelete.zone.id)}`);
      } else {
        await apiClient.delete(`${base}/rates/${encodeURIComponent(pendingDelete.rate.id)}`);
      }
      setPendingDelete(null);
      await onChanged();
    } catch (err: unknown) {
      setPendingDelete(null);
      setPageError(errorMessage(err, "Could not delete. Please try again."));
    }
  };

  return (
    <section className="space-y-4" data-testid="shipping-zones-editor">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Zones and rates</h2>
          <p className="text-xs text-muted-foreground max-w-[65ch]">
            A zone is where you ship. Checkout uses the first zone, by priority, that matches the
            address and has a rate that fits the parcel. A lower priority number goes first.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setZoneDialog({ mode: "create" })}
            data-testid="add-shipping-zone"
          >
            Add zone
          </Button>
        )}
      </div>

      {pageError && (
        <Alert variant="danger" title="Something went wrong">
          {pageError}
        </Alert>
      )}

      {zones.length === 0 ? (
        <EmptyState
          icon={<MapPin size={20} />}
          title="No shipping zones yet"
          description="Add a zone for where you deliver, then give it at least one rate. Until then customers cannot check out once shipping rules are on."
        />
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60" data-testid="shipping-zone-list">
          {zones.map((zone) => (
            <li key={zone.id} className="py-5 space-y-3" data-testid={`shipping-zone-${zone.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{zone.name}</h3>
                    <Badge variant={zone.isActive ? "success" : "neutral"}>
                      {zone.isActive ? "active" : "inactive"}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      priority {zone.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{describeZone(zone)}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      icon={<Pencil size={14} />}
                      onClick={() => setZoneDialog({ mode: "edit", zone })}
                      aria-label={`Edit zone ${zone.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 size={14} />}
                      onClick={() => setPendingDelete({ kind: "zone", zone })}
                      aria-label={`Delete zone ${zone.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              {zone.rates.length === 0 ? (
                <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">
                  No rates yet, so this zone cannot ship anything.
                </p>
              ) : (
                <ul className="divide-y divide-border/40 rounded-lg border border-border/50">
                  {zone.rates.map((rate) => {
                    const bits = [
                      describeWeightBand(rate),
                      describeValueBand(rate, currency),
                      rate.freeOverSubtotal !== null
                        ? `Free over ${money(rate.freeOverSubtotal, currency)}`
                        : null,
                      describeDays(rate),
                    ].filter((bit): bit is string => bit !== null);
                    return (
                      <li
                        key={rate.id}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                        data-testid={`shipping-rate-${rate.id}`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {rate.name}
                            </span>
                            {!rate.isActive && <Badge variant="neutral">inactive</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{bits.join(" · ")}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {money(rate.price, currency)}
                          </span>
                          {canEdit && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setRateDialog({ mode: "edit", zone, rate })}
                                aria-label={`Edit rate ${rate.name}`}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setPendingDelete({ kind: "rate", rate })}
                                aria-label={`Delete rate ${rate.name}`}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={<Plus size={14} />}
                  onClick={() => setRateDialog({ mode: "create", zone })}
                  data-testid={`add-rate-${zone.id}`}
                >
                  Add rate
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {zoneDialog && (
        <ZoneDialog
          base={base}
          state={zoneDialog}
          onClose={() => setZoneDialog(null)}
          onSaved={async () => {
            setZoneDialog(null);
            await onChanged();
          }}
        />
      )}
      {rateDialog && (
        <RateDialog
          base={base}
          state={rateDialog}
          onClose={() => setRateDialog(null)}
          onSaved={async () => {
            setRateDialog(null);
            await onChanged();
          }}
        />
      )}

      <Dialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete?.kind === "zone" ? "Delete this zone?" : "Delete this rate?"}
        description={
          pendingDelete?.kind === "zone"
            ? `"${pendingDelete.zone.name}" and its ${pendingDelete.zone.rates.length} rate(s) will be removed. Customers in progress keep the price they were shown.`
            : pendingDelete?.kind === "rate"
              ? `"${pendingDelete.rate.name}" will be removed. Customers in progress keep the price they were shown.`
              : undefined
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} data-testid="confirm-delete">
              Delete
            </Button>
          </div>
        }
      >
        <span className="sr-only">Confirm deletion</span>
      </Dialog>
    </section>
  );
}

function ZoneDialog({
  base,
  state,
  onClose,
  onSaved,
}: {
  base: string;
  state: NonNullable<ZoneDialogState>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<ZoneFormData>(
    state.mode === "edit" ? zoneToForm(state.zone) : EMPTY_ZONE_FORM,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const set = <K extends keyof ZoneFormData>(key: K, value: ZoneFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problems = validateZoneForm(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setIsSaving(true);
    setApiError(null);
    try {
      const payload = zoneFormToPayload(form);
      if (state.mode === "edit") {
        await apiClient.put(`${base}/zones/${encodeURIComponent(state.zone.id)}`, payload);
      } else {
        await apiClient.post(`${base}/zones`, payload);
      }
      await onSaved();
    } catch (err: unknown) {
      setApiError(errorMessage(err, "Could not save the zone."));
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={isSaving ? () => undefined : onClose}
      title={state.mode === "edit" ? "Edit zone" : "Add a zone"}
      description="Leave countries, states or PIN prefixes empty to match anything."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form="zone-form" variant="primary" loading={isSaving} disabled={isSaving}>
            {state.mode === "edit" ? "Save zone" : "Create zone"}
          </Button>
        </div>
      }
    >
      <form id="zone-form" onSubmit={submit} className="space-y-4" noValidate>
        {apiError && (
          <Alert variant="danger" title="Could not save">
            {apiError}
          </Alert>
        )}
        <FormField label="Name" htmlFor="zone-name" required error={errors.name}>
          <Input
            id="zone-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={!!errors.name}
            placeholder="South India"
            maxLength={100}
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Countries"
            htmlFor="zone-countries"
            error={errors.countries}
            helperText="Comma separated. India matches IN, Bharat, etc."
          >
            <Input id="zone-countries" value={form.countries} onChange={(e) => set("countries", e.target.value)} />
          </FormField>
          <FormField
            label="States"
            htmlFor="zone-states"
            error={errors.states}
            helperText="Names, abbreviations or GST codes: Karnataka, TN, 27"
          >
            <Input id="zone-states" value={form.states} onChange={(e) => set("states", e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="PIN code prefixes"
            htmlFor="zone-prefixes"
            error={errors.postalPrefixes}
            helperText="Comma separated, e.g. 560, 5600"
          >
            <Input
              id="zone-prefixes"
              value={form.postalPrefixes}
              onChange={(e) => set("postalPrefixes", e.target.value)}
              className="font-mono"
            />
          </FormField>
          <FormField
            label="Priority"
            htmlFor="zone-priority"
            error={errors.priority}
            helperText="Lower goes first. Put narrow zones before broad ones."
          >
            <Input
              id="zone-priority"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              inputMode="numeric"
              className="font-mono"
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--primary,currentColor)]"
          />
          Zone is active
        </label>
      </form>
    </Dialog>
  );
}

function RateDialog({
  base,
  state,
  onClose,
  onSaved,
}: {
  base: string;
  state: NonNullable<RateDialogState>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<RateFormData>(
    state.mode === "edit" ? rateToForm(state.rate) : EMPTY_RATE_FORM,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const set = <K extends keyof RateFormData>(key: K, value: RateFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problems = validateRateForm(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setIsSaving(true);
    setApiError(null);
    try {
      const payload = rateFormToPayload(form);
      if (state.mode === "edit") {
        await apiClient.put(`${base}/rates/${encodeURIComponent(state.rate.id)}`, payload);
      } else {
        await apiClient.post(`${base}/zones/${encodeURIComponent(state.zone.id)}/rates`, payload);
      }
      await onSaved();
    } catch (err: unknown) {
      setApiError(errorMessage(err, "Could not save the rate."));
      setIsSaving(false);
    }
  };

  const field = (
    key: keyof RateFormData,
    label: string,
    options: { helper?: string; placeholder?: string; mono?: boolean } = {},
  ) => (
    <FormField label={label} htmlFor={`rate-${key}`} error={errors[key]} helperText={options.helper}>
      <Input
        id={`rate-${key}`}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        error={!!errors[key]}
        placeholder={options.placeholder}
        inputMode="decimal"
        className={options.mono === false ? undefined : "font-mono"}
      />
    </FormField>
  );

  return (
    <Dialog
      isOpen
      onClose={isSaving ? () => undefined : onClose}
      title={state.mode === "edit" ? "Edit rate" : `Add a rate to ${state.zone.name}`}
      description="A rate applies when the parcel weight and the order value are inside its limits. Leave a limit blank for no limit."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form="rate-form" variant="primary" loading={isSaving} disabled={isSaving}>
            {state.mode === "edit" ? "Save rate" : "Create rate"}
          </Button>
        </div>
      }
    >
      <form id="rate-form" onSubmit={submit} className="space-y-4" noValidate>
        {apiError && (
          <Alert variant="danger" title="Could not save">
            {apiError}
          </Alert>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Name" htmlFor="rate-name" required error={errors.name}>
            <Input
              id="rate-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              error={!!errors.name}
              placeholder="Standard"
              maxLength={100}
            />
          </FormField>
          <FormField label="Price" htmlFor="rate-price" required error={errors.price} helperText="In rupees, e.g. 50 or 49.50">
            <Input
              id="rate-price"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              error={!!errors.price}
              inputMode="decimal"
              className="font-mono"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field("minWeight", "Min weight (g)", { placeholder: "0" })}
          {field("maxWeight", "Max weight (g)", { placeholder: "No limit" })}
          {field("minSubtotal", "Min order value", { placeholder: "0" })}
          {field("maxSubtotal", "Max order value", { placeholder: "No limit" })}
        </div>
        {field("freeOver", "Free shipping at or above", {
          helper: "Order value after discount. Blank means never free.",
          placeholder: "Never",
        })}
        <div className="grid grid-cols-2 gap-4">
          {field("daysMin", "Delivery days (from)", { placeholder: "e.g. 3" })}
          {field("daysMax", "Delivery days (to)", { placeholder: "e.g. 5" })}
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--primary,currentColor)]"
          />
          Rate is active
        </label>
      </form>
    </Dialog>
  );
}
