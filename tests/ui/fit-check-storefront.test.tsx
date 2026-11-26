import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductSummaryDTO } from "@calcart/products";
import { ProductCard } from "@/components/storefront/products/product-card";
import { ProductGrid } from "@/components/storefront/products/product-grid";
import { FitCheckPanel } from "@/components/storefront/fit-check/fit-check-panel";
import type { AvatarState, FitCheckState } from "@/components/storefront/fit-check/use-fit-check";

// The web app resolves `next` from its own node_modules, so both specifiers are mocked.
const { navigationMock } = vi.hoisted(() => ({
  navigationMock: () => ({
    useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, back: () => undefined }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
  }),
}));
vi.mock("next/navigation", navigationMock);
vi.mock("../../apps/web/node_modules/next/navigation", navigationMock);

const product = (id: string, title: string): ProductSummaryDTO => ({
  id,
  storeId: "store_fit",
  title,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  status: "ACTIVE",
  publishedAt: "2026-01-01T00:00:00Z",
  variantsCount: 1,
  mediaCount: 0,
  price: 4900,
  currency: "USD",
  isOutOfStock: false,
  variantId: `v_${id}`,
  purchasableVariantCount: 1,
  purchasableVariantId: `v_${id}`,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("Fit Check on product cards", () => {
  it("shows the Fit Check action only when the product supports it", () => {
    const supported = renderToStaticMarkup(
      <ProductCard
        product={product("a", "Linen Shirt")}
        storeSlug="s"
        fitCheck={{ onTry: () => undefined, isSelected: false }}
      />,
    );
    expect(supported).toContain('aria-label="Try on Linen Shirt with Fit Check"');
    expect(supported).toContain('data-testid="product-card-fit-check"');
    expect(supported).toContain('aria-pressed="false"');

    const unsupported = renderToStaticMarkup(<ProductCard product={product("a", "Linen Shirt")} storeSlug="s" />);
    expect(unsupported).not.toContain("Fit Check");
  });

  it("marks the product currently being tried on", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={product("a", "Linen Shirt")}
        storeSlug="s"
        fitCheck={{ onTry: () => undefined, isSelected: true }}
      />,
    );
    expect(html).toContain('aria-pressed="true"');
  });

  it("keeps Add to cart, Quick View and product navigation alongside Fit Check", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={product("a", "Linen Shirt")}
        storeSlug="my-store"
        onQuickView={() => undefined}
        fitCheck={{ onTry: () => undefined, isSelected: false }}
      />,
    );
    expect(html).toContain("Add to cart");
    expect(html).toContain('aria-label="Quick view Linen Shirt"');
    expect(html).toContain('href="/stores/my-store/products/linen-shirt');
    expect(html).toContain('data-testid="product-card-main-action"');
  });

  it("renders Fit Check only for the grid products the resolver accepts", () => {
    const products = [product("a", "Linen Shirt"), product("b", "Silk Scarf"), product("c", "Wool Trousers")];
    const html = renderToStaticMarkup(
      <ProductGrid
        products={products}
        storeSlug="s"
        getFitCheck={(p) => (p.id === "b" ? undefined : { onTry: () => undefined, isSelected: false })}
      />,
    );
    expect(html).toContain("Try on Linen Shirt with Fit Check");
    expect(html).toContain("Try on Wool Trousers with Fit Check");
    expect(html).not.toContain("Try on Silk Scarf");
  });

  it("renders no Fit Check controls when the grid has no resolver (Fit Check off)", () => {
    const html = renderToStaticMarkup(<ProductGrid products={[product("a", "Linen Shirt")]} storeSlug="s" />);
    expect(html).not.toContain("Fit Check");
    expect(html).toContain("Add to cart");
  });
});

describe("Fit Check panel states and layout", () => {
  const stub = (over: Partial<FitCheckState> & { avatarState: AvatarState }): FitCheckState =>
    ({
      available: true,
      supports: () => true,
      open: true,
      close: () => undefined,
      avatar: null,
      retryAvatar: async () => undefined,
      refreshCatalog: async () => undefined,
      selection: null,
      selectProduct: () => undefined,
      variants: [],
      variantId: null,
      setVariantId: () => undefined,
      asset: null,
      garmentMissing: false,
      garmentUrl: null,
      ...over,
    }) as FitCheckState;

  const render = (over: Partial<FitCheckState> & { avatarState: AvatarState }) =>
    renderToStaticMarkup(<FitCheckPanel storeSlug="my-store" fitCheck={stub(over)} />);

  it("asks guests to sign in without blocking shopping", () => {
    const html = render({ avatarState: "guest" });
    expect(html).toContain("Sign in to create your body profile");
    expect(html).toContain("keep shopping as a guest");
    expect(html).toContain("/stores/my-store/login?redirect=");
  });

  it("guides customers without a body profile to create one", () => {
    const html = render({ avatarState: "no-profile" });
    expect(html).toContain("Create body profile");
    expect(html).toContain('href="/stores/my-store/account/fit-check"');
  });

  it("offers recovery when the avatar fails to load", () => {
    const html = render({ avatarState: "error" });
    expect(html).toContain("couldn&#x27;t load your avatar");
    expect(html).toContain("Try again");
  });

  it("shows loading and unavailable states", () => {
    expect(render({ avatarState: "loading" })).toContain("Loading your avatar");
    expect(render({ avatarState: "unavailable" })).toContain("isn&#x27;t available right now");
  });

  it("tells the customer what to do next, and when a selection has no garment", () => {
    const avatar = { params: {}, generatorVersion: 1, generatedAt: "", updatedAt: "" } as never;
    expect(render({ avatarState: "ready", avatar })).toContain("Tap the hanger on a product");
    const html = render({
      avatarState: "ready",
      avatar,
      selection: { productId: "p", slug: "scarf", title: "Silk Scarf" },
    });
    expect(html).toContain("Silk Scarf");
    expect(html).toContain("no 3D garment yet");
    expect(html).toContain("Approximate fit");
    expect(html).toContain("Edit measurements");
  });

  it("shows a variant selector only for products with several variants", () => {
    const avatar = { params: {}, generatorVersion: 1, generatedAt: "", updatedAt: "" } as never;
    const selection = { productId: "p", slug: "shirt", title: "Shirt" };
    expect(render({ avatarState: "ready", avatar, selection })).not.toContain('aria-label="Variant"');
    const html = render({
      avatarState: "ready",
      avatar,
      selection,
      variants: [
        { id: "v1", title: "S" },
        { id: "v2", title: "M" },
      ],
    });
    expect(html).toContain('aria-label="Variant"');
    expect(html).toContain(">M</option>");
  });

  it("is a sticky side panel on desktop and a bottom sheet on mobile", () => {
    const html = render({ avatarState: "guest" });
    expect(html).toContain('data-testid="fit-check-panel"');
    // Mobile: fixed to the bottom so the grid above stays usable.
    expect(html).toContain("fixed inset-x-0 bottom-0");
    expect(html).toContain("h-[52vh]");
    // Desktop: sticky beside the grid.
    expect(html).toContain("lg:sticky");
    expect(html).toContain("lg:top-24");
    expect(html).toContain('aria-label="Close fitting room"');
  });
});
