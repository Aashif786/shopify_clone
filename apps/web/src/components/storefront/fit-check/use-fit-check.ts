"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AvatarDTO } from "@calcart/customers";
import type { ProductDetailDTO } from "@calcart/products";
import { apiClient, ApiClientError, resolveApiUrl } from "../../../lib/api-client";
import type { GarmentReference, GarmentSlot } from "./garment-fit";

export interface CatalogAsset {
  id: string;
  variantId: string | null;
  source: "glb" | "generated";
  slot: GarmentSlot;
  /** Reference body of an uploaded model (glb only). */
  reference: GarmentReference | null;
  /** Generated garments: the cut, the fit, and the product photo they are textured from. */
  template: "tshirt" | "longsleeve" | "jacket" | "trousers" | "shorts" | null;
  fit: "slim" | "regular" | "loose" | null;
  textureUrl: string | null;
}

export type AvatarState = "idle" | "loading" | "ready" | "guest" | "no-profile" | "unavailable" | "error";

export interface FitCheckSelection {
  productId: string;
  slug: string;
  title: string;
}

export interface FitCheckVariantOption {
  id: string;
  title: string;
}

/** Variant asset first, then the product-level asset, else null (no compatible garment). */
export function resolveGarmentAsset(
  assets: CatalogAsset[] | undefined,
  variantId: string | null,
): CatalogAsset | null {
  if (!assets) return null;
  return (
    (variantId ? assets.find((a) => a.variantId === variantId) : undefined) ??
    assets.find((a) => a.variantId === null) ??
    null
  );
}

export function useFitCheck(storeSlug: string) {
  const base = `/api/v1/storefront/${encodeURIComponent(storeSlug)}`;

  const [available, setAvailable] = useState(false);
  const [catalog, setCatalog] = useState<Map<string, CatalogAsset[]>>(new Map());
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState<AvatarDTO | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [selection, setSelection] = useState<FitCheckSelection | null>(null);
  const [variants, setVariants] = useState<FitCheckVariantOption[]>([]);
  const [variantId, setVariantId] = useState<string | null>(null);

  // Every async result is dropped if the store changed (or the hook unmounted) meanwhile.
  const generation = useRef(0);
  const selectionRef = useRef<FitCheckSelection | null>(null);

  // Availability + garment catalog; fully reset when the store changes.
  useEffect(() => {
    const gen = ++generation.current;
    setAvailable(false);
    setCatalog(new Map());
    setOpen(false);
    setAvatar(null);
    setAvatarState("idle");
    selectionRef.current = null;
    setSelection(null);
    setVariants([]);
    setVariantId(null);

    (async () => {
      try {
        const status = await apiClient.get<{ active: boolean }>(`${base}/fit-check`);
        if (gen !== generation.current || !status.active) return;
        const res = await apiClient.get<{ items: Array<{ productId: string; assets: CatalogAsset[] }> }>(
          `${base}/fit-check/garments`,
        );
        if (gen !== generation.current) return;
        setCatalog(new Map(res.items.map((i) => [i.productId, i.assets])));
        setAvailable(true);
      } catch {
        // Fit Check is an enhancement: any failure just hides it and shopping continues.
      }
    })();
    return () => {
      generation.current++;
    };
  }, [base]);

  /** Re-reads the garment catalog (e.g. after a garment was changed or removed while browsing). */
  const refreshCatalog = useCallback(async () => {
    const gen = generation.current;
    try {
      const res = await apiClient.get<{ items: Array<{ productId: string; assets: CatalogAsset[] }> }>(
        `${base}/fit-check/garments`,
      );
      if (gen !== generation.current) return;
      setCatalog(new Map(res.items.map((i) => [i.productId, i.assets])));
    } catch {
      // Keep the current catalog; the garment error state already offers a retry.
    }
  }, [base]);

  const loadAvatar = useCallback(async () => {
    const gen = generation.current;
    setAvatarState((s) => (s === "ready" ? s : "loading"));
    try {
      const res = await apiClient.get<{ avatar: AvatarDTO }>(`${base}/account/avatar`);
      if (gen !== generation.current) return;
      setAvatar(res.avatar);
      setAvatarState("ready");
    } catch (err) {
      if (gen !== generation.current) return;
      setAvatar(null);
      if (err instanceof ApiClientError) {
        if (err.status === 401 || err.code === "CUSTOMER_NOT_FOUND") return setAvatarState("guest");
        if (err.code === "AVATAR_NOT_FOUND" || err.code === "BODY_PROFILE_NOT_FOUND") {
          return setAvatarState("no-profile");
        }
        if (err.code === "FIT_CHECK_UNAVAILABLE") return setAvatarState("unavailable");
      }
      setAvatarState("error");
    }
  }, [base]);

  // Always re-read the avatar when the panel opens, so a changed/deleted profile or a different
  // signed-in customer is reflected, and when the tab regains focus while open.
  useEffect(() => {
    if (!open) return;
    void loadAvatar();
    const onFocus = () => void loadAvatar();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [open, loadAvatar]);

  const loadVariants = useCallback(
    async (slug: string, productId: string) => {
      const gen = generation.current;
      try {
        const detail = await apiClient.get<ProductDetailDTO>(`${base}/products/${encodeURIComponent(slug)}`);
        if (gen !== generation.current) return;
        const active = detail.variants.filter((v) => v.status === "ACTIVE");
        // Ignore a slow response for a product that is no longer selected.
        if (selectionRef.current?.productId !== productId) return;
        setVariants(active.map((v) => ({ id: v.id, title: v.displayTitle || v.title })));
      } catch {
        // Variant controls are optional; the product-level garment still works.
      }
    },
    [base],
  );

  const selectProduct = useCallback(
    (sel: FitCheckSelection) => {
      setOpen(true);
      if (selectionRef.current?.productId === sel.productId) return;
      selectionRef.current = sel;
      setSelection(sel);
      setVariants([]);
      setVariantId(null);
      void loadVariants(sel.slug, sel.productId);
    },
    [loadVariants],
  );

  const close = useCallback(() => setOpen(false), []);

  const assets = selection ? catalog.get(selection.productId) : undefined;
  const asset = useMemo(() => resolveGarmentAsset(assets, variantId), [assets, variantId]);

  return {
    available,
    supports: (productId: string) => catalog.has(productId),
    open,
    close,
    avatar,
    avatarState,
    retryAvatar: loadAvatar,
    refreshCatalog,
    selection,
    selectProduct,
    variants,
    variantId,
    setVariantId,
    asset,
    /** `true` when the product has garments but none applies to the chosen variant. */
    garmentMissing: !!selection && !asset,
    garmentUrl:
      asset?.source === "glb" ? resolveApiUrl(`${base}/fit-check/garments/${asset.id}/file`) : null,
  };
}

export type FitCheckState = ReturnType<typeof useFitCheck>;
