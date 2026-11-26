"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { GarmentAssetDTO } from "@calcart/products";
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
import { ApiClientError, apiClient, resolveApiUrl } from "../../../lib/api-client";

export interface GarmentAssetsCardProps {
  storeId: string;
  productId: string;
  variants: Array<{ id: string; title: string }>;
  /** The product's images; one is chosen as the garment's photo. */
  media: Array<{ id: string; url: string; altText: string | null }>;
  userRole?: "owner" | "admin" | "staff";
}

const SLOTS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "outerwear", label: "Outerwear" },
  { value: "dress", label: "Dress / full body" },
] as const;

const TEMPLATES = [
  { value: "tshirt", label: "T-shirt (short sleeve)" },
  { value: "longsleeve", label: "Long-sleeve top" },
  { value: "jacket", label: "Jacket / coat" },
  { value: "trousers", label: "Trousers" },
  { value: "shorts", label: "Shorts" },
] as const;

const FITS = [
  { value: "slim", label: "Slim" },
  { value: "regular", label: "Regular" },
  { value: "loose", label: "Loose" },
] as const;

const REFERENCE_FIELDS = [
  { key: "referenceHeightCm", label: "Height (cm)", placeholder: "175" },
  { key: "referenceChestCm", label: "Chest (cm)", placeholder: "96" },
  { key: "referenceWaistCm", label: "Waist (cm)", placeholder: "80" },
  { key: "referenceHipCm", label: "Hip (cm)", placeholder: "98" },
] as const;

const MAX_BYTES = 15 * 1024 * 1024;

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  return err instanceof Error ? err.message : fallback;
}

const selectClass = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm";

export function GarmentAssetsCard({
  storeId,
  productId,
  variants,
  media,
  userRole = "owner",
}: GarmentAssetsCardProps) {
  const [assets, setAssets] = useState<GarmentAssetDTO[]>([]);
  const [fitCheckActive, setFitCheckActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<"photo" | "glb">("photo");
  const [scope, setScope] = useState("");
  // photo mode
  const [template, setTemplate] = useState<string>("tshirt");
  const [fit, setFit] = useState<string>("regular");
  const [mediaId, setMediaId] = useState<string>("");
  // glb mode
  const [slot, setSlot] = useState<string>("top");
  const [reference, setReference] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);

  const canEdit = userRole === "owner" || userRole === "admin";
  const base = `/api/v1/stores/${storeId}/products/${productId}/garments`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<{ assets: GarmentAssetDTO[]; fitCheckActive: boolean }>(base, {
        storeId,
      });
      setAssets(data.assets);
      setFitCheckActive(data.fitCheckActive);
    } catch (err) {
      setError(messageOf(err, "Failed to load garments."));
    } finally {
      setLoading(false);
    }
  }, [base, storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scopeLabel = (variantId: string | null) =>
    variantId ? (variants.find((v) => v.id === variantId)?.title ?? "Variant") : "Whole product";

  const describe = (a: GarmentAssetDTO) => {
    if (a.source === "generated") {
      const t = TEMPLATES.find((x) => x.value === a.template)?.label ?? a.template;
      return `${scopeLabel(a.variantId)} · Auto-fit ${t}, ${a.fit} fit`;
    }
    const slotLabel = SLOTS.find((s) => s.value === a.slot)?.label;
    const mb = a.fileSize ? (a.fileSize / 1024 / 1024).toFixed(1) : "?";
    return `${scopeLabel(a.variantId)} · 3D model · ${slotLabel} · ${mb} MB · reference ${a.reference?.heightCm ?? "?"} cm`;
  };

  const submitPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (media.length === 0) return setError("Add a product image first; the garment is textured from it.");
    setBusy(true);
    try {
      await apiClient.post(
        base,
        {
          variantId: scope || null,
          template,
          fit,
          textureMediaId: mediaId || null,
        },
        { storeId },
      );
      setNotice("Garment saved. Customers will see it fitted to their own body.");
      await load();
    } catch (err) {
      setError(messageOf(err, "Could not save the garment."));
    } finally {
      setBusy(false);
    }
  };

  const submitGlb = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!file) return setError("Choose a .glb model to upload.");
    if (!file.name.toLowerCase().endsWith(".glb")) return setError("Only binary glTF (.glb) models are supported.");
    if (file.size > MAX_BYTES) return setError("Garment models are limited to 15MB.");
    for (const f of REFERENCE_FIELDS) {
      if (!reference[f.key]?.trim()) return setError(`${f.label} of the reference body is required.`);
    }

    const form = new FormData();
    form.append("file", file);
    form.append("slot", slot);
    if (scope) form.append("variantId", scope);
    for (const f of REFERENCE_FIELDS) form.append(f.key, reference[f.key]!.trim());

    setBusy(true);
    try {
      await apiClient.post(base, form, { storeId });
      setNotice("Garment uploaded.");
      setFile(null);
      (document.getElementById("garment-file") as HTMLInputElement | null)?.form?.reset();
      await load();
    } catch (err) {
      setError(messageOf(err, "Upload failed."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (asset: GarmentAssetDTO) => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.patch(`${base}/${asset.id}`, { isEnabled: !asset.isEnabled }, { storeId });
      await load();
    } catch (err) {
      setError(messageOf(err, "Could not update the garment."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (asset: GarmentAssetDTO) => {
    if (!window.confirm(`Delete the garment for "${scopeLabel(asset.variantId)}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`${base}/${asset.id}`, { storeId });
      setNotice("Garment deleted.");
      await load();
    } catch (err) {
      setError(messageOf(err, "Could not delete the garment."));
    } finally {
      setBusy(false);
    }
  };

  const scopeField = (
    <label className="space-y-1 text-sm">
      <span className="font-medium">Applies to</span>
      <select className={selectClass} value={scope} onChange={(e) => setScope(e.target.value)}>
        <option value="">Whole product (all variants)</option>
        {variants.map((v) => (
          <option key={v.id} value={v.id}>
            Variant: {v.title}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">
        A variant&apos;s own garment is used instead of the product one. Saving again replaces the garment for the
        same target.
      </span>
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fit Check garment (3D)</CardTitle>
        <CardDescription>
          Let customers try this product on their own avatar. Products without a garment don&apos;t show Fit Check.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && <Spinner size="sm" label="Loading garments..." />}
        {error && <Alert variant="danger">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {!loading && !fitCheckActive && (
          <Alert variant="info" title="Fit Check isn't active for this store">
            Set a clothing / fashion store type and enable Fit Check in Store Settings to add garments.
          </Alert>
        )}

        {assets.length > 0 && (
          <ul className="divide-y divide-border/60 rounded-md border border-border/60">
            {assets.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  {a.source === "generated" && a.textureUrl && (
                    <img
                      src={resolveApiUrl(a.textureUrl)}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded border border-border/60 object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {a.source === "generated" ? "Auto-fit from product photo" : a.originalName}
                    </p>
                    <p className="text-xs text-muted-foreground">{describe(a)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.isEnabled ? "success" : "neutral"}>{a.isEnabled ? "Live" : "Disabled"}</Badge>
                  {canEdit && (
                    <>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggle(a)}>
                        {a.isEnabled ? "Disable" : "Enable"}
                      </Button>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => void remove(a)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canEdit && fitCheckActive && (
          <div className="space-y-4 border-t border-border/60 pt-4">
            <div role="radiogroup" aria-label="Garment source" className="flex flex-wrap gap-2">
              {(
                [
                  ["photo", "Auto-fit from product photo (recommended)"],
                  ["glb", "Upload a 3D model (.glb)"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={`btn btn-sm ${mode === value ? "btn-primary" : "btn-outline"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "photo" ? (
              <form onSubmit={submitPhoto} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  The garment is built to wrap each customer&apos;s avatar, so it follows their body shape, and is
                  textured from the product photo you choose. Pick a front-facing photo of the garment on a plain
                  background with the whole garment visible. Collars, pockets and patterns appear only as far as the
                  front of the photo shows them.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {scopeField}
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Garment type</span>
                    <select className={selectClass} value={template} onChange={(e) => setTemplate(e.target.value)}>
                      {TEMPLATES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Fit</span>
                    <select className={selectClass} value={fit} onChange={(e) => setFit(e.target.value)}>
                      {FITS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Product photo</legend>
                  {media.length === 0 ? (
                    <p className="text-xs text-muted-foreground">This product has no images yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {media.map((m, index) => {
                        const selected = mediaId ? mediaId === m.id : index === 0;
                        return (
                          <label
                            key={m.id}
                            className={`cursor-pointer rounded-md border-2 p-0.5 ${
                              selected ? "border-primary" : "border-transparent"
                            }`}
                          >
                            <input
                              type="radio"
                              name="garment-photo"
                              className="sr-only"
                              checked={selected}
                              onChange={() => setMediaId(m.id)}
                            />
                            <img
                              src={resolveApiUrl(m.url)}
                              alt={m.altText || `Product image ${index + 1}`}
                              className="h-20 w-20 rounded object-cover"
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>

                <Button type="submit" disabled={busy || media.length === 0}>
                  {busy ? "Saving…" : "Save garment"}
                </Button>
              </form>
            ) : (
              <form onSubmit={submitGlb} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  For merchants with a modelled garment. The model is scaled from the reference body it was made for
                  to each customer&apos;s avatar; it is not reshaped to their body.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {scopeField}
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Garment type</span>
                    <select className={selectClass} value={slot} onChange={(e) => setSlot(e.target.value)}>
                      {SLOTS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Reference body the model was made for</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {REFERENCE_FIELDS.map((f) => (
                      <label key={f.key} className="space-y-1 text-xs">
                        <span>{f.label}</span>
                        <input
                          inputMode="decimal"
                          placeholder={f.placeholder}
                          className={selectClass}
                          value={reference[f.key] ?? ""}
                          onChange={(e) => setReference((r) => ({ ...r, [f.key]: e.target.value }))}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-1">
                  <label htmlFor="garment-file" className="text-sm font-medium">
                    Model file (.glb, up to 15MB, textures embedded)
                  </label>
                  <input
                    id="garment-file"
                    type="file"
                    accept=".glb,model/gltf-binary"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm"
                  />
                </div>

                <Button type="submit" disabled={busy}>
                  {busy ? "Uploading…" : "Upload garment"}
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
