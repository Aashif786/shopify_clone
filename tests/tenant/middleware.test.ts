import { describe, it, expect } from "vitest";
import { NextRequest } from "../../apps/web/node_modules/next/server.js";
import { middleware } from "../../apps/web/middleware";

describe("Next.js Multi-Tenant Domain Middleware", () => {
  function createRequest(url: string, headers: Record<string, string> = {}) {
    return new NextRequest(new URL(url), {
      headers: new Headers(headers),
    });
  }

  it("passes through API routes untouched", () => {
    const req = createRequest("https://souled-store.calcart.com/api/v1/products", {
      host: "souled-store.calcart.com",
    });
    const res = middleware(req);
    // NextResponse.next() returns null headers or status 200 without rewrite
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("passes through apex platform domain (calcart.com)", () => {
    const req = createRequest("https://calcart.com/stores/souled-store/products", {
      host: "calcart.com",
    });
    const res = middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through localhost apex in local development", () => {
    const req = createRequest("http://localhost:3000/stores/souled-store", {
      host: "localhost:3000",
    });
    const res = middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through reserved subdomains without rewriting to store", () => {
    for (const sub of ["www", "admin", "app", "api", "checkout"]) {
      const req = createRequest(`https://${sub}.calcart.com/`, {
        host: `${sub}.calcart.com`,
      });
      const res = middleware(req);
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    }
  });

  it("rewrites root path on merchant subdomain to /stores/[storeSlug]", () => {
    const req = createRequest("https://souled-store.calcart.com/", {
      host: "souled-store.calcart.com",
    });
    const res = middleware(req);
    const rewriteHeader = res.headers.get("x-middleware-rewrite");
    expect(rewriteHeader).toBe("https://souled-store.calcart.com/stores/souled-store");
  });

  it("rewrites subpath on merchant subdomain to /stores/[storeSlug]/[subpath]", () => {
    const req = createRequest("https://souled-store.calcart.com/products/glow-in-the-dark-tee", {
      host: "souled-store.calcart.com",
    });
    const res = middleware(req);
    const rewriteHeader = res.headers.get("x-middleware-rewrite");
    expect(rewriteHeader).toBe("https://souled-store.calcart.com/stores/souled-store/products/glow-in-the-dark-tee");
  });

  it("rewrites local development subdomain (*.localhost:3000) correctly", () => {
    const req = createRequest("http://artisan-store.localhost:3000/collections", {
      host: "artisan-store.localhost:3000",
    });
    const res = middleware(req);
    const rewriteHeader = res.headers.get("x-middleware-rewrite");
    expect(rewriteHeader).toBe("http://artisan-store.localhost:3000/stores/artisan-store/collections");
  });

  it("prevents cross-tenant path traversal on a merchant subdomain", () => {
    // Visiting /stores/other-store while on souled-store.calcart.com
    const req = createRequest("https://souled-store.calcart.com/stores/other-store/products", {
      host: "souled-store.calcart.com",
    });
    const res = middleware(req);
    expect(res.status).toBe(307); // NextResponse.redirect
    expect(res.headers.get("location")).toBe("https://souled-store.calcart.com/");
  });

  it("passes through when pathname already matches tenant store prefix", () => {
    const req = createRequest("https://souled-store.calcart.com/stores/souled-store/products", {
      host: "souled-store.calcart.com",
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
