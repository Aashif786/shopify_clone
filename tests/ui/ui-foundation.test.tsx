import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Checkbox,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Dialog,
  ConfirmationDialog,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Alert,
  Spinner,
  Skeleton,
  EmptyState,
  Pagination,
} from "@shopify-clone/ui";
import {
  MerchantShell,
  MERCHANT_NAV_ITEMS,
} from "@/components/merchant/MerchantShell";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";
import { ApiClient, ApiClientError } from "@/lib/api-client";

describe("UI Foundation: Design System & Reusable Components", () => {
  describe("Button Component", () => {
    it("renders with default variant and size", () => {
      const html = renderToStaticMarkup(<Button>Click me</Button>);
      expect(html).toContain('class="btn btn--primary btn--md"');
      expect(html).toContain("Click me");
      expect(html).toContain('type="button"');
    });

    it("renders variants correctly (secondary, outline, ghost, danger)", () => {
      const dangerHtml = renderToStaticMarkup(
        <Button variant="danger" size="sm">
          Delete
        </Button>
      );
      expect(dangerHtml).toContain('class="btn btn--danger btn--sm"');

      const outlineHtml = renderToStaticMarkup(
        <Button variant="outline" size="lg">
          Outline
        </Button>
      );
      expect(outlineHtml).toContain('class="btn btn--outline btn--lg"');
    });

    it("renders loading state with aria-busy and disabled attribute", () => {
      const html = renderToStaticMarkup(
        <Button loading={true}>Saving...</Button>
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("disabled");
      expect(html).toContain('class="spinner"');
    });

    it("renders IconButton with accessible aria-label", () => {
      const html = renderToStaticMarkup(
        <IconButton aria-label="Edit item" icon={<span>✏️</span>} />
      );
      expect(html).toContain('aria-label="Edit item"');
      expect(html).toContain('class="btn btn--ghost btn--md btn--icon-only"');
    });
  });

  describe("Form Inputs & FormField", () => {
    it("renders Input with aria-invalid when invalid", () => {
      const html = renderToStaticMarkup(
        <Input id="sku" error={true} placeholder="Enter SKU" />
      );
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('class="input input--error"');
      expect(html).toContain('placeholder="Enter SKU"');
    });

    it("renders FormField with accessible label, error message, and role=alert", () => {
      const html = renderToStaticMarkup(
        <FormField
          htmlFor="product-title"
          label="Product Title"
          required={true}
          error="Title is required"
        >
          <Input id="product-title" error={true} />
        </FormField>
      );
      expect(html).toContain('for="product-title"');
      expect(html).toContain('class="form-label__required"');
      expect(html).toContain('id="product-title-error"');
      expect(html).toContain('role="alert"');
      expect(html).toContain("Title is required");
    });

    it("renders FormField with helper text", () => {
      const html = renderToStaticMarkup(
        <FormField
          htmlFor="handle"
          label="URL Handle"
          helperText="Unique URL identifier for the product"
        >
          <Input id="handle" />
        </FormField>
      );
      expect(html).toContain('id="handle-helper"');
      expect(html).toContain("Unique URL identifier for the product");
    });

    it("renders Textarea, Select, and Checkbox with accessible attributes", () => {
      const textareaHtml = renderToStaticMarkup(
        <Textarea id="description" error={true} rows={4} placeholder="Product description" />
      );
      expect(textareaHtml).toContain("<textarea");
      expect(textareaHtml).toContain('aria-invalid="true"');
      expect(textareaHtml).toContain('rows="4"');

      const selectHtml = renderToStaticMarkup(
        <Select
          id="status"
          options={[
            { label: "Draft", value: "draft" },
            { label: "Active", value: "active" },
          ]}
        />
      );
      expect(selectHtml).toContain('<select');
      expect(selectHtml).toContain('value="draft"');
      expect(selectHtml).toContain('value="active"');

      const checkboxHtml = renderToStaticMarkup(
        <Checkbox id="track-qty" label="Track quantity" />
      );
      expect(checkboxHtml).toContain('type="checkbox"');
      expect(checkboxHtml).toContain('for="track-qty"');
      expect(checkboxHtml).toContain("Track quantity");
    });
  });

  describe("Card Component", () => {
    it("renders structured card sections and content", () => {
      const html = renderToStaticMarkup(
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Manage price and compare-at price</CardDescription>
          </CardHeader>
          <CardContent>Content body</CardContent>
          <CardFooter>Footer actions</CardFooter>
        </Card>
      );
      expect(html).toContain('class="card card--bordered"');
      expect(html).toContain('class="card__header"');
      expect(html).toContain('class="card__title"');
      expect(html).toContain("Pricing");
      expect(html).toContain('class="card__description"');
      expect(html).toContain('class="card__content"');
      expect(html).toContain('class="card__footer"');
    });
  });

  describe("Badge Component", () => {
    it("renders status badge variants", () => {
      const successHtml = renderToStaticMarkup(
        <Badge variant="success">Fulfilled</Badge>
      );
      expect(successHtml).toContain('class="badge badge--success badge--md"');
      expect(successHtml).toContain("Fulfilled");

      const dangerHtml = renderToStaticMarkup(
        <Badge variant="danger" size="sm">Cancelled</Badge>
      );
      expect(dangerHtml).toContain('class="badge badge--danger badge--sm"');
    });
  });

  describe("Alert Component", () => {
    it("renders role=alert for danger/error alerts", () => {
      const html = renderToStaticMarkup(
        <Alert variant="danger" title="Order Payment Failed">
          Payment gateway returned an error.
        </Alert>
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('class="alert alert--danger"');
      expect(html).toContain("Order Payment Failed");
    });

    it("renders role=status for non-destructive alerts", () => {
      const html = renderToStaticMarkup(
        <Alert variant="info" title="Note">
          Store is currently in test mode.
        </Alert>
      );
      expect(html).toContain('role="status"');
      expect(html).toContain('class="alert alert--info"');
    });
  });

  describe("Dialog Component", () => {
    it("renders null when closed", () => {
      const html = renderToStaticMarkup(
        <Dialog isOpen={false} onClose={() => {}} title="Test">
          Body
        </Dialog>
      );
      expect(html).toBe("");
    });

    it("renders modal dialog with accessibility semantics when open", () => {
      const html = renderToStaticMarkup(
        <Dialog isOpen={true} onClose={() => {}} title="Edit Inventory" description="Update available stock">
          <p>Inventory Form</p>
        </Dialog>
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="dialog-title"');
      expect(html).toContain('aria-describedby="dialog-desc"');
      expect(html).toContain("Edit Inventory");
      expect(html).toContain("Update available stock");
    });

    it("renders ConfirmationDialog with destructive button styling", () => {
      const html = renderToStaticMarkup(
        <ConfirmationDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Delete Product"
          description="Are you sure you want to delete this product?"
          isDestructive={true}
          confirmLabel="Delete"
        />
      );
      expect(html).toContain('class="btn btn--danger btn--md"');
      expect(html).toContain("Delete");
    });
  });

  describe("Table Component", () => {
    it("renders semantic table hierarchy", () => {
      const html = renderToStaticMarkup(
        <Table caption="Product List">
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead align="right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Snowboard</TableCell>
              <TableCell align="right">$499.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
      expect(html).toContain('<caption class="table-caption">Product List</caption>');
      expect(html).toContain('<th scope="col" class="table-head table-align-left"');
      expect(html).toContain('<th scope="col" class="table-head table-align-right"');
      expect(html).toContain('<td class="table-cell table-align-right"');
      expect(html).toContain("Snowboard");
    });
  });

  describe("LoadingIndicator, EmptyState & Pagination", () => {
    it("renders Spinner with status role and screen-reader label", () => {
      const html = renderToStaticMarkup(<Spinner size="md" label="Loading orders" />);
      expect(html).toContain('role="status"');
      expect(html).toContain('class="spinner spinner-md"');
      expect(html).toContain("Loading orders");
    });

    it("renders Skeleton with aria-hidden", () => {
      const html = renderToStaticMarkup(<Skeleton width={200} height={20} />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('class="skeleton"');
      expect(html).toContain("width:200px");
      expect(html).toContain("height:20px");
    });

    it("renders EmptyState with accessible region and title", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="No products yet"
          description="Add your first product to start selling."
          action={<Button>Add product</Button>}
        />
      );
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="No products yet"');
      expect(html).toContain("No products yet");
      expect(html).toContain("Add product");
    });

    it("renders Pagination navigation landmarks and disable states", () => {
      const html = renderToStaticMarkup(
        <Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />
      );
      expect(html).toContain('aria-label="Pagination Navigation"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain("Page 1 of 5");
      // Page 1: previous button must be disabled
      expect(html).toContain('class="btn btn--outline btn--sm pagination__prev"');
      expect(html).toContain("disabled");
    });

    it("renders null for Pagination when totalPages <= 1", () => {
      const html = renderToStaticMarkup(
        <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />
      );
      expect(html).toBe("");
    });
  });
});

describe("UI Foundation: Application Shells", () => {
  describe("MerchantShell", () => {
    it("renders merchant navigation landmarks and title", () => {
      const html = renderToStaticMarkup(
        <MerchantShell
          activePath="/merchant"
          title="Dashboard"
          userName="Alice Merchant"
          userRole="owner"
        >
          <div>Dashboard Body</div>
        </MerchantShell>
      );
      expect(html).toContain('<aside class="merchant-sidebar " aria-label="Merchant Navigation"');
      expect(html).toContain('<header class="merchant-header" role="banner"');
      expect(html).toContain('<main class="merchant-content" role="main"');
      expect(html).toContain("Alice Merchant");
      expect(html).toContain("OWNER");
      expect(html).toContain("Dashboard Body");
    });

    it("respects role-based navigation hierarchy (staff vs admin/owner)", () => {
      // Staff cannot see minRole: "admin" items (Settings)
      const staffHtml = renderToStaticMarkup(
        <MerchantShell userRole="staff">
          <div>Staff content</div>
        </MerchantShell>
      );
      expect(staffHtml).not.toContain("/merchant/settings");

      // Admin can see Settings
      const adminHtml = renderToStaticMarkup(
        <MerchantShell userRole="admin">
          <div>Admin content</div>
        </MerchantShell>
      );
      expect(adminHtml).toContain("/merchant/settings");
    });

    it("renders planned placeholder badges distinguishably", () => {
      expect(MERCHANT_NAV_ITEMS.some((i) => i.isPlaceholder)).toBe(true);
      const html = renderToStaticMarkup(
        <MerchantShell userRole="owner">
          <div>Content</div>
        </MerchantShell>
      );
      expect(html).toContain("Planned");
      expect(html).toContain("/merchant/discounts");
    });

    it("renders store selector when stores list is provided", () => {
      const stores = [
        { id: "store-1", name: "Shoe Store", slug: "shoe-store", role: "owner" as const },
        { id: "store-2", name: "Apparel Store", slug: "apparel-store", role: "admin" as const },
      ];
      const html = renderToStaticMarkup(
        <MerchantShell
          currentStore={stores[0]}
          stores={stores}
          onSelectStore={() => {}}
        >
          <div>Store view</div>
        </MerchantShell>
      );
      expect(html).toContain('id="merchant-store-select"');
      expect(html).toContain("Shoe Store (owner)");
      expect(html).toContain("Apparel Store (admin)");
    });
  });

  describe("StorefrontShell", () => {
    it("renders storefront header, store branding, cart button and count", () => {
      const html = renderToStaticMarkup(
        <StorefrontShell
          storeName="Acme Gear"
          storeSlug="acme-gear"
          cartItemCount={3}
          announcement="Free shipping on orders over $50!"
        >
          <div>Product Catalog</div>
        </StorefrontShell>
      );
      expect(html).toContain('role="region" aria-label="Announcement"');
      expect(html).toContain("Free shipping on orders over $50!");
      expect(html).toContain('class="storefront-brand-name"');
      expect(html).toContain("Acme Gear");
      expect(html).toContain('aria-label="Shopping cart with 3 items"');
      expect(html).toContain('class="storefront-cart-count" aria-hidden="true">3</span>');
      expect(html).toContain("Powered by Shopify Clone");
      expect(html).toContain("Product Catalog");
    });

    it("scopes links to specific store slug preventing tenant mixing", () => {
      const html = renderToStaticMarkup(
        <StorefrontShell
          storeName="Beta Shop"
          storeSlug="beta-shop"
        >
          <div>Catalog</div>
        </StorefrontShell>
      );
      expect(html).toContain('href="/stores/beta-shop"');
      expect(html).toContain('href="/stores/beta-shop/products"');
      expect(html).toContain('href="/stores/beta-shop/collections"');
    });
  });
});

describe("UI Foundation: API Client Integration", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("http://localhost:3000");
    vi.restoreAllMocks();
  });

  it("unwraps ApiSuccessResponse envelope correctly", async () => {
    const mockSuccessResponse = {
      success: true,
      data: {
        id: "prod_1",
        title: "Test Product",
        priceCents: 2000,
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockSuccessResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await client.get<{ id: string; title: string }>("/api/v1/products/prod_1");
    expect(result).toEqual({
      id: "prod_1",
      title: "Test Product",
      priceCents: 2000,
    });
  });

  it("normalizes ApiErrorResponse into typed ApiClientError with code, status, fields", async () => {
    const mockErrorResponse = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid product input",
        requestId: "req-1234",
        fields: {
          title: "Title is required",
        },
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockErrorResponse), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "x-request-id": "req-1234",
        },
      })
    );

    try {
      await client.post("/api/v1/products", { title: "" });
      expect.fail("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe("VALIDATION_ERROR");
      expect(apiErr.message).toBe("Invalid product input");
      expect(apiErr.requestId).toBe("req-1234");
      expect(apiErr.fields).toEqual({ title: "Title is required" });
      expect(apiErr.isValidationError).toBe(true);
    }
  });

  it("passes x-store-id header when storeId option is provided", async () => {
    let capturedHeaders: Headers | undefined;

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await client.get("/api/v1/products", { storeId: "store-99" });
    expect(capturedHeaders?.get("x-store-id")).toBe("store-99");
  });

  it("deduplicates simultaneous identical in-flight requests", async () => {
    let fetchCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      fetchCount++;
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const [res1, res2] = await Promise.all([
      client.get("/api/v1/auth/me"),
      client.get("/api/v1/auth/me"),
    ]);

    expect(fetchCount).toBe(1);
    expect(res1).toEqual({ ok: true });
    expect(res2).toEqual({ ok: true });
  });
});
