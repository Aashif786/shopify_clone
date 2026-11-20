"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { GstProfileDTO } from "@calcart/tax";
import { Alert, Badge, Button, Dialog, FormField, Input } from "@calcart/ui";
import { Edit2, Layers, Percent, Plus, Trash2 } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  bpsToPercentInput,
  formatRatePercent,
  getGstSplitBreakdown,
  percentInputToBps,
} from "../../../lib/merchant-tax-helpers";

export interface GstProfilesManagerProps {
  storeId: string;
  canEdit: boolean;
}

const COMMON_SLABS = [
  { label: "0% Exempt", bps: 0 },
  { label: "3% Precious Metals", bps: 300 },
  { label: "5% Essentials", bps: 500 },
  { label: "12% Standard I", bps: 1200 },
  { label: "18% Standard II", bps: 1800 },
  { label: "28% Luxury", bps: 2800 },
];

export function GstProfilesManager({ storeId, canEdit }: GstProfilesManagerProps) {
  const [profiles, setProfiles] = useState<GstProfileDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<GstProfileDTO | null>(null);
  const [name, setName] = useState("");
  const [ratePercent, setRatePercent] = useState("18");
  const [hsnCode, setHsnCode] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items: GstProfileDTO[] }>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/tax/gst-profiles`,
      );
      setProfiles(res.items || []);
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load GST profiles.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const openCreateDialog = () => {
    setEditingProfile(null);
    setName("");
    setRatePercent("18");
    setHsnCode("");
    setDescription("");
    setIsDefault(profiles.length === 0);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (profile: GstProfileDTO) => {
    setEditingProfile(profile);
    setName(profile.name);
    setRatePercent(bpsToPercentInput(profile.gstRateBps));
    setHsnCode(profile.hsnCode || "");
    setDescription(profile.description || "");
    setIsDefault(profile.isDefault);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Profile name is required");
      return;
    }
    const rateBps = percentInputToBps(ratePercent);
    if (rateBps === null || rateBps < 0 || rateBps > 4000) {
      setFormError("GST rate must be between 0% and 40%");
      return;
    }
    if (hsnCode.trim() && !/^[0-9]{4,8}$/.test(hsnCode.trim())) {
      setFormError("HSN code must be 4 to 8 digits if provided");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingProfile) {
        await apiClient.put(
          `/api/v1/stores/${encodeURIComponent(storeId)}/tax/gst-profiles/${encodeURIComponent(editingProfile.id)}`,
          {
            name: name.trim(),
            gstRateBps: rateBps,
            hsnCode: hsnCode.trim() || null,
            description: description.trim() || null,
            isDefault,
          },
        );
      } else {
        await apiClient.post(
          `/api/v1/stores/${encodeURIComponent(storeId)}/tax/gst-profiles`,
          {
            name: name.trim(),
            gstRateBps: rateBps,
            hsnCode: hsnCode.trim() || null,
            description: description.trim() || null,
            isDefault,
          },
        );
      }
      setIsDialogOpen(false);
      await loadProfiles();
    } catch (err: unknown) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Failed to save GST profile.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm("Are you sure you want to delete this GST slab profile?")) {
      return;
    }
    setDeletingId(profileId);
    try {
      await apiClient.delete(
        `/api/v1/stores/${encodeURIComponent(storeId)}/tax/gst-profiles/${encodeURIComponent(profileId)}`,
      );
      await loadProfiles();
    } catch (err: unknown) {
      alert(err instanceof ApiClientError ? err.message : "Failed to delete profile.");
    } finally {
      setDeletingId(null);
    }
  };

  const splitPreview = getGstSplitBreakdown(ratePercent);

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5" data-testid="gst-profiles-manager">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">GST Tax Profiles &amp; Slabs</h2>
            <Badge variant="neutral" size="sm">
              Custom Rates
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-[65ch]">
            Configure standard GST slabs (e.g. 0%, 5%, 12%, 18%, 28%) and assign them to products. Products will automatically calculate the matching CGST + SGST or IGST split.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={openCreateDialog}
            icon={<Plus size={14} />}
          >
            Create GST Profile
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="danger" title="Unable to load GST profiles">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2 py-3" aria-busy="true">
          <div className="h-10 w-full rounded bg-muted/40 animate-pulse" />
          <div className="h-10 w-full rounded bg-muted/40 animate-pulse" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 p-6 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">No custom GST profiles yet</p>
          <p className="text-xs text-muted-foreground">
            Create profiles like &quot;18% Standard GST&quot; or &quot;5% Apparel / Food&quot; to assign varying tax slabs to your products.
          </p>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openCreateDialog}
              icon={<Plus size={14} />}
              className="mt-2"
            >
              Add First GST Profile
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {profiles.map((p) => {
            const split = getGstSplitBreakdown(p.gstRateBps);
            return (
              <div
                key={p.id}
                className="rounded-lg border border-border/60 bg-background/60 p-4 space-y-3 relative group hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      {p.isDefault && (
                        <Badge variant="success" size="sm">
                          Default
                        </Badge>
                      )}
                    </div>
                    {p.hsnCode && (
                      <p className="text-xs font-mono text-muted-foreground">
                        HSN/SAC: {p.hsnCode}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold font-mono text-primary">
                      {formatRatePercent(p.gstRateBps)}
                    </span>
                  </div>
                </div>

                <div className="rounded bg-muted/30 px-2.5 py-1.5 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                  <span>Intra-state:</span>
                  <span className="text-foreground font-medium">
                    {split ? `${split.formattedCgst} CGST + ${split.formattedSgst} SGST` : "0% CGST + 0% SGST"}
                  </span>
                </div>

                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {p.description}
                  </p>
                )}

                {canEdit && (
                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(p)}
                      icon={<Edit2 size={13} />}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      icon={<Trash2 size={13} className="text-destructive" />}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog for Create / Edit */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={editingProfile ? "Edit GST Profile" : "Create GST Profile / Slab"}
      >
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {formError && (
            <Alert variant="danger" title="Validation Error">
              {formError}
            </Alert>
          )}

          <FormField
            label="Profile / Slab Name"
            htmlFor="profile-name"
            required
            helperText="e.g. 18% Standard Goods, 5% Apparel, 0% Exempt"
          >
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard GST 18%"
              required
            />
          </FormField>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Quick Select Common Indian GST Slabs
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SLABS.map((slab) => {
                const slabPrefix = slab.label.split(" ")[0] || "";
                return (
                  <button
                    key={slab.bps}
                    type="button"
                    onClick={() => {
                      setRatePercent(bpsToPercentInput(slab.bps));
                      if (!name || COMMON_SLABS.some((s) => name.includes(s.label.split(" ")[0] || ""))) {
                        setName(`${slabPrefix} GST Slab`);
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      percentInputToBps(ratePercent) === slab.bps
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {slab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="Total GST Rate (%)"
              htmlFor="profile-rate"
              required
              helperText="0% to 40%"
            >
              <div className="relative">
                <Input
                  id="profile-rate"
                  value={ratePercent}
                  onChange={(e) => setRatePercent(e.target.value)}
                  placeholder="18"
                  inputMode="decimal"
                  className="font-mono pr-8"
                  required
                />
                <Percent className="w-3.5 h-3.5 absolute right-2.5 top-3 text-muted-foreground pointer-events-none" />
              </div>
            </FormField>

            <FormField
              label="Default HSN / SAC Code"
              htmlFor="profile-hsn"
              helperText="Optional 4 to 8 digits"
            >
              <Input
                id="profile-hsn"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="6109"
                inputMode="numeric"
                className="font-mono"
              />
            </FormField>
          </div>

          {splitPreview && (
            <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-1 text-xs">
              <span className="font-semibold text-foreground">Tax Split Breakdown:</span>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground font-mono pt-1">
                <div>
                  <span className="text-foreground">Intra-State: </span>
                  {splitPreview.formattedCgst} CGST + {splitPreview.formattedSgst} SGST
                </div>
                <div>
                  <span className="text-foreground">Inter-State: </span>
                  {splitPreview.formattedIgst} IGST
                </div>
              </div>
            </div>
          )}

          <FormField
            label="Description (Optional)"
            htmlFor="profile-description"
          >
            <Input
              id="profile-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Applies to specific category or product types..."
            />
          </FormField>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="profile-is-default"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="profile-is-default" className="text-xs text-foreground cursor-pointer">
              Set as store default GST profile for new products
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : editingProfile ? "Update Profile" : "Create Profile"}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
