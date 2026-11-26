"use client";

import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Shirt, X } from "lucide-react";
import type { FitCheckState } from "./use-fit-check";
import type { GarmentStatus } from "./avatar-viewer";
import { resolveApiUrl } from "../../../lib/api-client";

const AvatarViewer = dynamic(() => import("./avatar-viewer").then((m) => m.AvatarViewer), {
  ssr: false,
  loading: () => (
    <p className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground" role="status">
      Loading 3D viewer…
    </p>
  ),
});

export interface FitCheckPanelProps {
  storeSlug: string;
  fitCheck: FitCheckState;
}

/**
 * Persistent try-on panel. Sticky beside the product grid on desktop; a bottom sheet on mobile so the
 * grid above stays scrollable and usable.
 */
export function FitCheckPanel({ storeSlug, fitCheck }: FitCheckPanelProps) {
  const [garmentStatus, setGarmentStatus] = useState<GarmentStatus>("none");
  const [retry, setRetry] = useState(0);
  const { avatar, avatarState, selection, asset, garmentUrl } = fitCheck;
  const profileHref = `/stores/${storeSlug}/account/fit-check`;
  const signInHref = `/stores/${storeSlug}/login?redirect=${encodeURIComponent(profileHref)}`;

  const cta = (message: string, label: string, href: string) => (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link href={href} className="ds-btn ds-btn-primary">
        {label}
      </Link>
    </div>
  );

  let body: React.ReactNode;
  if (avatarState === "loading" || avatarState === "idle") {
    body = (
      <p className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground" role="status">
        Loading your avatar…
      </p>
    );
  } else if (avatarState === "guest") {
    body = cta(
      "Sign in to create your body profile and try clothes on your own 3D avatar. You can keep shopping as a guest.",
      "Sign in",
      signInHref,
    );
  } else if (avatarState === "no-profile") {
    body = cta(
      "Add your height, weight and a few measurements to build your avatar.",
      "Create body profile",
      profileHref,
    );
  } else if (avatarState === "unavailable") {
    body = (
      <p className="flex h-full min-h-[240px] items-center justify-center p-6 text-center text-sm text-muted-foreground" role="status">
        Fit Check isn&apos;t available right now.
      </p>
    );
  } else if (avatarState === "error" || !avatar) {
    body = (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground" role="alert">
          We couldn&apos;t load your avatar.
        </p>
        <button type="button" className="ds-btn ds-btn-outline" onClick={() => void fitCheck.retryAvatar()}>
          Try again
        </button>
      </div>
    );
  } else {
    body = (
      <AvatarViewer
        params={avatar.params}
        garment={
          asset && asset.source === "glb" && garmentUrl && asset.reference
            ? {
                id: `${asset.id}:${retry}`,
                kind: "glb",
                url: garmentUrl,
                slot: asset.slot,
                reference: asset.reference,
              }
            : asset && asset.source === "generated" && asset.template && asset.fit
              ? {
                  id: `${asset.id}:${retry}`,
                  kind: "generated",
                  template: asset.template,
                  fit: asset.fit,
                  textureUrl: asset.textureUrl ? resolveApiUrl(asset.textureUrl) : null,
                }
              : null
        }
        onGarmentStatus={setGarmentStatus}
        className="h-full w-full"
      />
    );
  }

  // Message under the viewer about the selected product.
  let status: React.ReactNode = null;
  if (avatarState === "ready" && !selection) {
    status = <span>Tap the hanger on a product to try it on.</span>;
  } else if (avatarState === "ready" && selection && !asset) {
    status = <span>This option has no 3D garment yet, so it can&apos;t be tried on.</span>;
  } else if (garmentStatus === "loading") {
    status = <span role="status">Fitting garment…</span>;
  } else if (garmentStatus === "error") {
    status = (
      <span role="alert">
        The garment couldn&apos;t be loaded.{" "}
        <button type="button" className="underline" onClick={() => {
            void fitCheck.refreshCatalog();
            setRetry((r) => r + 1);
          }}>
          Try again
        </button>
      </span>
    );
  }

  return (
    <aside
      aria-label="Fit Check fitting room"
      data-testid="fit-check-panel"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[52vh] flex-col border-t border-[color:var(--at-hairline)] bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.12)] lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-24 lg:z-auto lg:h-[calc(100vh-8rem)] lg:border lg:shadow-none"
    >
      <header className="flex items-center justify-between gap-2 border-b border-[color:var(--at-hairline)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Shirt size={16} strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-sm font-medium">Fitting room</h2>
        </div>
        <button
          type="button"
          onClick={fitCheck.close}
          aria-label="Close fitting room"
          className="flex h-8 w-8 items-center justify-center"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 bg-muted/30">{body}</div>

      <footer className="space-y-2 border-t border-[color:var(--at-hairline)] px-4 py-3 text-xs">
        {selection && (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate font-medium" data-testid="fit-check-selected">
              {selection.title}
            </p>
            {fitCheck.variants.length > 1 && (
              <select
                aria-label="Variant"
                className="h-8 max-w-[45%] rounded border border-border bg-background px-2 text-xs"
                value={fitCheck.variantId ?? ""}
                onChange={(e) => fitCheck.setVariantId(e.target.value || null)}
              >
                <option value="">Default</option>
                {fitCheck.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <p className="min-h-4 text-muted-foreground" aria-live="polite">
          {status}
        </p>
        {avatarState === "ready" && (
          <p className="flex items-center justify-between text-muted-foreground">
            <span>Approximate fit — proportions only.</span>
            <Link href={profileHref} className="underline">
              Edit measurements
            </Link>
          </p>
        )}
      </footer>
    </aside>
  );
}
