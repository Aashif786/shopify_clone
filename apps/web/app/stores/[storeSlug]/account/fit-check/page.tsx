"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@calcart/ui";
import { ShieldCheck, Trash2 } from "lucide-react";
import type { AvatarDTO, BodyProfileDTO } from "@calcart/customers";
import { StorefrontShell } from "../../../../../src/components/storefront/StorefrontShell";
import { useStorefrontIdentity } from "../../../../../src/components/storefront/use-storefront-identity";
import { apiClient, ApiClientError } from "../../../../../src/lib/api-client";

const AvatarViewer = dynamic(
  () => import("../../../../../src/components/storefront/fit-check/avatar-viewer").then((m) => m.AvatarViewer),
  {
    ssr: false,
    loading: () => (
      <p className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground" role="status">
        Loading 3D viewer…
      </p>
    ),
  },
);

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

type Unit = "metric" | "imperial";
type Field = "height" | "weight" | "chest" | "waist" | "hip";
type Values = Record<Field, string>;

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

const FIELDS: Array<{ key: Field; label: string; hint: string }> = [
  { key: "height", label: "Height", hint: "Standing, without shoes" },
  { key: "weight", label: "Weight", hint: "Approximate is fine" },
  { key: "chest", label: "Chest", hint: "Around the fullest part" },
  { key: "waist", label: "Waist", hint: "Around your natural waistline" },
  { key: "hip", label: "Hips", hint: "Around the fullest part" },
];

function unitLabel(field: Field, unit: Unit): string {
  if (field === "weight") return unit === "metric" ? "kg" : "lb";
  return unit === "metric" ? "cm" : "in";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toDisplay(profile: BodyProfileDTO, unit: Unit): Values {
  const len = (cm: number) => String(unit === "metric" ? cm : round1(cm / CM_PER_IN));
  const wt = (kg: number) => String(unit === "metric" ? kg : round1(kg / KG_PER_LB));
  return {
    height: len(profile.heightCm),
    weight: wt(profile.weightKg),
    chest: len(profile.chestCm),
    waist: len(profile.waistCm),
    hip: len(profile.hipCm),
  };
}

function convertValues(values: Values, from: Unit, to: Unit): Values {
  if (from === to) return values;
  const out = { ...values };
  (Object.keys(values) as Field[]).forEach((k) => {
    const n = Number(values[k]);
    if (values[k].trim() === "" || !Number.isFinite(n)) return;
    const factor = k === "weight" ? KG_PER_LB : CM_PER_IN;
    out[k] = String(round1(to === "metric" ? n * factor : n / factor));
  });
  return out;
}

const EMPTY: Values = { height: "", weight: "", chest: "", waist: "", hip: "" };

export default function FitCheckProfilePage({ params }: PageProps) {
  const { storeSlug } = use(params);
  const { storeName, theme } = useStorefrontIdentity(storeSlug);
  const base = `/api/v1/storefront/${encodeURIComponent(storeSlug)}`;

  const [status, setStatus] = useState<"loading" | "unavailable" | "guest" | "ready" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [unit, setUnit] = useState<Unit>("metric");
  const [values, setValues] = useState<Values>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [avatar, setAvatar] = useState<AvatarDTO | null>(null);
  const [avatarState, setAvatarState] = useState<"idle" | "loading" | "error">("idle");

  const loadAvatar = useCallback(
    async (regenerate = false) => {
      setAvatarState("loading");
      try {
        const res = regenerate
          ? await apiClient.post<{ avatar: AvatarDTO }>(`${base}/account/avatar`)
          : await apiClient.get<{ avatar: AvatarDTO }>(`${base}/account/avatar`);
        setAvatar(res.avatar);
        setAvatarState("idle");
      } catch {
        setAvatarState("error");
      }
    },
    [base],
  );

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const availability = await apiClient.get<{ active: boolean }>(`${base}/fit-check`);
      if (!availability.active) {
        setStatus("unavailable");
        return;
      }
      const res = await apiClient.get<{ profile: BodyProfileDTO | null }>(
        `${base}/account/body-profile`,
      );
      if (res.profile) {
        setHasProfile(true);
        setUnit(res.profile.unitPreference);
        setValues(toDisplay(res.profile, res.profile.unitPreference));
        void loadAvatar();
      }
      setStatus("ready");
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        (err.status === 401 || err.code === "CUSTOMER_NOT_FOUND")
      ) {
        setStatus("guest");
      } else if (err instanceof ApiClientError && err.code === "FIT_CHECK_UNAVAILABLE") {
        setStatus("unavailable");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load your body profile.");
        setStatus("error");
      }
    }
  }, [base, loadAvatar]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchUnit = (next: Unit) => {
    setValues((v) => convertValues(v, unit, next));
    setUnit(next);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setNotice(null);

    const missing: Record<string, string> = {};
    const numeric = {} as Record<Field, number>;
    for (const f of FIELDS) {
      const raw = values[f.key].trim();
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) missing[f.key] = `${f.label} is required`;
      else numeric[f.key] = n;
    }
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      return;
    }
    if (!hasProfile && !consent) {
      setFormError("Please confirm you understand how your measurements are used.");
      return;
    }

    const lenCm = (n: number) => (unit === "metric" ? n : n * CM_PER_IN);
    setSaving(true);
    try {
      const res = await apiClient.put<{ profile: BodyProfileDTO }>(`${base}/account/body-profile`, {
        heightCm: lenCm(numeric.height),
        weightKg: unit === "metric" ? numeric.weight : numeric.weight * KG_PER_LB,
        chestCm: lenCm(numeric.chest),
        waistCm: lenCm(numeric.waist),
        hipCm: lenCm(numeric.hip),
        unitPreference: unit,
        consentAcknowledged: hasProfile ? undefined : consent,
      });
      setHasProfile(true);
      setValues(toDisplay(res.profile, unit));
      setNotice("Your body profile has been saved and your avatar updated.");
      void loadAvatar();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const fields = (err.details as { fields?: Record<string, string> } | undefined)?.fields;
        if (fields) {
          const mapped: Record<string, string> = {};
          for (const [k, msg] of Object.entries(fields)) {
            mapped[k.replace(/(Cm|Kg)$/, "")] = msg;
          }
          setFieldErrors(mapped);
        }
        setFormError(err.message || "Could not save your body profile.");
      } else {
        setFormError("Could not save your body profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await apiClient.delete(`${base}/account/body-profile`);
      setHasProfile(false);
      setValues(EMPTY);
      setConsent(false);
      setConfirmDelete(false);
      setAvatar(null);
      setAvatarState("idle");
      setNotice("Your body profile and avatar have been deleted.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not delete your body profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug} theme={theme} fullBleed>
      <div className="at-container pb-24 pt-8 sm:pt-12 max-w-2xl">
        <Link
          href={`/stores/${storeSlug}/account`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← My account
        </Link>
        <h1 className="at-display-lg mt-3 text-foreground">Fit Check body profile</h1>

        {status === "loading" && (
          <div
            className="mt-8 h-72 rounded-[var(--ds-radius-card,0)] bg-muted/50"
            role="status"
            aria-busy="true"
            aria-label="Loading body profile"
          />
        )}

        {status === "unavailable" && (
          <Alert variant="info" title="Fit Check isn't available" className="mt-8">
            This store doesn&apos;t offer virtual try-on. Shopping works as usual.
          </Alert>
        )}

        {status === "error" && (
          <Alert
            variant="danger"
            title="Couldn't load your profile"
            className="mt-8"
            action={
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            }
          >
            {errorMessage}
          </Alert>
        )}

        {status === "guest" && (
          <Card className="mt-8 rounded-[var(--ds-radius-card,0)] border border-[color:var(--at-hairline)] bg-transparent">
            <CardHeader>
              <CardTitle>Sign in to save your measurements</CardTitle>
              <CardDescription>
                A body profile is saved to your customer account so it&apos;s there next time.
                You can keep shopping and check out as a guest without one.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link
                className="btn btn-primary"
                href={`/stores/${storeSlug}/login?redirect=/stores/${storeSlug}/account/fit-check`}
              >
                Sign in
              </Link>
              <Link className="btn btn-outline" href={`/stores/${storeSlug}/register`}>
                Create an account
              </Link>
            </CardContent>
          </Card>
        )}

        {status === "ready" && (
          <form onSubmit={save} className="mt-6 space-y-6" noValidate>
            <div className="flex gap-3 rounded-[var(--ds-radius-card,0)] border border-[color:var(--at-hairline)] p-4 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <p>
                Your measurements are used only to shape your 3D try-on avatar in this store.
                They are private to your account, are not shown to the merchant, and you can delete
                them at any time. The avatar is an approximate representation, not an exact scan.
              </p>
            </div>

            {hasProfile && (
              <section aria-label="Your avatar" className="space-y-2">
                <div className="overflow-hidden rounded-[var(--ds-radius-card,0)] border border-[color:var(--at-hairline)] bg-muted/30">
                  {avatar && avatarState !== "error" ? (
                    <AvatarViewer params={avatar.params} className="h-[420px] w-full" />
                  ) : (
                    <div className="flex h-[320px] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                      {avatarState === "error" ? (
                        <>
                          <span role="alert">We couldn&apos;t generate your avatar.</span>
                          <Button type="button" variant="outline" size="sm" onClick={() => void loadAvatar(true)}>
                            Try again
                          </Button>
                        </>
                      ) : (
                        <span role="status">Generating your avatar…</span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Drag to rotate, scroll or pinch to zoom. This is a simplified mannequin scaled
                  from your measurements — an approximation of proportions, not an exact likeness.
                </p>
                {avatar && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void loadAvatar(true)} disabled={avatarState === "loading"}>
                    Regenerate avatar
                  </Button>
                )}
              </section>
            )}

            {notice && <Alert variant="success">{notice}</Alert>}
            {formError && <Alert variant="danger">{formError}</Alert>}

            <fieldset className="flex gap-2" aria-label="Units">
              {(["metric", "imperial"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => switchUnit(u)}
                  aria-pressed={unit === u}
                  className={`btn btn-sm ${unit === u ? "btn-primary" : "btn-outline"}`}
                >
                  {u === "metric" ? "cm / kg" : "in / lb"}
                </button>
              ))}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => {
                const id = `body-${f.key}`;
                const err = fieldErrors[f.key];
                return (
                  <div key={f.key} className="space-y-1">
                    <label htmlFor={id} className="text-sm font-medium">
                      {f.label} ({unitLabel(f.key, unit)})
                    </label>
                    <input
                      id={id}
                      inputMode="decimal"
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      value={values[f.key]}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={`${id}-hint`}
                    />
                    <p
                      id={`${id}-hint`}
                      className={`text-xs ${err ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {err ?? f.hint}
                    </p>
                  </div>
                );
              })}
            </div>

            {!hasProfile && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1"
                />
                <span>I understand how my measurements are used and agree to save them.</span>
              </label>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving…" : hasProfile ? "Update profile" : "Save profile"}
              </Button>
              {hasProfile && !confirmDelete && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                  Delete profile
                </Button>
              )}
              {hasProfile && confirmDelete && (
                <span className="flex items-center gap-2 text-sm">
                  Delete your measurements and avatar?
                  <Button type="button" variant="danger" size="sm" onClick={() => void remove()} disabled={saving}>
                    Yes, delete
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </StorefrontShell>
  );
}
