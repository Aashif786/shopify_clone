import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "../../apps/web/node_modules/next/server.js";
import { middleware } from "../../apps/web/middleware";

describe("Next.js Multi-Tenant Domain Middleware", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createRequest(url: string, headers: Record<string, string> = {}) {
    return new NextRequest(new URL(url), {
      headers: new Headers(headers),
    });
  }

  it("passes through API routes untouched", async () => {
    const req = createRequest("https://souled-store.calcart.com/api/v1/products", {
      host: "souled-store.calcart.com",
    });
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("passes through apex platform domain (calcart.com)", async () => {
    const req = createRequest("https://calcart.com/stores/souled-store/products", {
      host: "calcart.com",
    });
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through localhost apex in local development", async () => {
    const req = createRequest("http://localhost:3000/stores/souled-store", {
      host: "localhost:3000",
    });
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through reserved subdomains without rewriting to store", async () => {
    for (const sub of ["www", "admin", "app", "api", "checkout"]) {
      const req = createRequest(`https://${sub}.calcart.com/`, {
        host: `${sub}.calcart.com`,
      });
      const res = await middleware(req);
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    }
  });

  it("rewrites root path on merchant subdomain to /stores/[storeSlug]", async () => {
    const req = createRequest("https://souled-store.calcart.com/", {
      host: "souled-store.calcart.com",
    });
    const res = await middleware(req);
    const rewriteHeader = res.headers.get("x-middleware-rewrite");
    expect(rewriteHeader).toBe("https://souled-store.calcart.com/stores/souled-store");
  });

  it("rewrites subpath on merchant subdomain to /stores/[storeSlug]/[subpath]", async () => {
    const req = createRequest("https://souled-store.calcart.com/products/glow-in-the-dark-tee", {
      host: "souled-store.calcart.com",
    });
    const res = await middleware(req);
    const rewriteHeader = res.headers.get("x-middleware-rewrite");
    expect(rewriteHeader).toBe("https://souled-store.calcart.com/stores/souled-store/products/glow-in-the-dark-tee");
  });

  it("rewrites local development subdomain (*.localhost:3000) correctly", async () => {
    const req = createRequest("http://artisan-store.localhost:3000/collections", {
      host: "artisan-store.localhost:3000",
    });
    const res = await middleware(req);
    const rewriteHeader = res.headers.get("x-middleware-rewrite");
    expect(rewriteHeader).toBe("http://artisan-store.localhost:3000/stores/artisan-store/collections");
  });

  it("prevents cross-tenant path traversal on a merchant subdomain", async () => {
    const req = createRequest("https://souled-store.calcart.com/stores/other-store/products", {
      host: "souled-store.calcart.com",
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://souled-store.calcart.com/");
  });

  it("passes through when pathname already matches tenant store prefix", async () => {
    const req = createRequest("https://souled-store.calcart.com/stores/souled-store/products", {
      host: "souled-store.calcart.com",
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("resolves and rewrites verified custom domain to matching store", async () => {
    // Mock global fetch for the internal resolver API
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("hostname=shop.souledstore.com")) {
        return {
          ok: true,
          json: async () => ({
            data: {
              storeSlug: "souled-store",
              storeId: "store-123",
              domain: "shop.souledstore.com",
            },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    }) as unknown as typeof fetch;

    const req = createRequest("https://shop.souledstore.com/products", {
      host: "shop.souledstore.com",
    });
    const res = await middleware(req);
    const rewriteHeader = res.headers.get("x-middleware-rewrite");
    expect(rewriteHeader).toBe("https://shop.souledstore.com/stores/souled-store/products");
  });

  it("prevents cross-tenant traversal on custom domains", async () => {
    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          data: {
            storeSlug: "souled-store",
            storeId: "store-123",
          },
        }),
      };
    }) as unknown as typeof fetch;

    const req = createRequest("https://shop.souledstore.com/stores/rival-store/cart", {
      host: "shop.souledstore.com",
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://shop.souledstore.com/");
  });
});
