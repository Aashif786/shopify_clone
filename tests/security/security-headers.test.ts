import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "../../apps/web/node_modules/next/server.js";
import { middleware } from "../../apps/web/middleware";
import {
  buildContentSecurityPolicy,
  getSecurityHeaders,
} from "../../apps/web/src/lib/security-headers";

describe("GAP-09: Content Security Policy & HTTP Security Headers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createRequest(url: string, headers: Record<string, string> = {}) {
    return new NextRequest(new URL(url), {
      headers: new Headers(headers),
    });
  }

  describe("buildContentSecurityPolicy() unit tests", () => {
    it("includes required default-src fallback", () => {
      const csp = buildContentSecurityPolicy();
      expect(csp).toContain("default-src 'self';");
    });

    it("whitelists Razorpay checkout and script allowances in dev, restricting unsafe-eval in prod", () => {
      const devCsp = buildContentSecurityPolicy({ isDevelopment: true });
      expect(devCsp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com;");

      const prodCsp = buildContentSecurityPolicy({ isDevelopment: false });
      expect(prodCsp).toContain("script-src 'self' 'unsafe-inline' https://checkout.razorpay.com;");
      expect(prodCsp).not.toContain("'unsafe-eval'");
    });

    it("whitelists Razorpay API endpoints and lumberjack telemetry in connect-src", () => {
      const csp = buildContentSecurityPolicy({ isDevelopment: false });
      expect(csp).toContain("connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://lumberjack-cx.razorpay.com;");
    });

    it("includes development WebSockets for Next.js HMR when in dev mode", () => {
      const devCsp = buildContentSecurityPolicy({ isDevelopment: true });
      expect(devCsp).toContain("connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://lumberjack-cx.razorpay.com ws: wss:;");

      const prodCsp = buildContentSecurityPolicy({ isDevelopment: false });
      expect(prodCsp).not.toContain("ws:");
      expect(prodCsp).not.toContain("wss:");
    });

    it("whitelists Razorpay iframe and video embeds in frame-src", () => {
      const csp = buildContentSecurityPolicy();
      expect(csp).toContain("frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.youtube.com https://player.vimeo.com;");
    });

    it("whitelists catalog and Razorpay image sources in img-src", () => {
      const csp = buildContentSecurityPolicy();
      expect(csp).toContain("https://images.unsplash.com");
      expect(csp).toContain("https://images.pexels.com");
      expect(csp).toContain("https://*.razorpay.com");
      expect(csp).toContain("data:");
      expect(csp).toContain("blob:");
    });

    it("blocks untrusted plugins and restricts base-uri and form-action", () => {
      const csp = buildContentSecurityPolicy();
      expect(csp).toContain("object-src 'none';");
      expect(csp).toContain("base-uri 'self';");
      expect(csp).toContain("form-action 'self' https://api.razorpay.com;");
      expect(csp).toContain("frame-ancestors 'self';");
    });
  });

  describe("getSecurityHeaders() unit tests", () => {
    it("returns all standard OWASP security headers in development", () => {
      const headers = getSecurityHeaders({ isDevelopment: true });

      expect(headers["Content-Security-Policy"]).toBeDefined();
      expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
      expect(headers["X-XSS-Protection"]).toBe("0");
      // HSTS omitted in dev
      expect(headers["Strict-Transport-Security"]).toBeUndefined();
    });

    it("includes Strict-Transport-Security in production", () => {
      const headers = getSecurityHeaders({ isDevelopment: false });
      expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains; preload");
    });
  });

  describe("Next.js Middleware Integration", () => {
    it("attaches security headers to pass-through API routes", async () => {
      const req = createRequest("https://souled-store.calcart.com/api/v1/products", {
        host: "souled-store.calcart.com",
      });
      const res = await middleware(req);

      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(res.headers.get("Content-Security-Policy")).toContain("https://checkout.razorpay.com");
    });

    it("attaches security headers to platform apex routes", async () => {
      const req = createRequest("https://calcart.com/", {
        host: "calcart.com",
      });
      const res = await middleware(req);

      expect(res.headers.get("Content-Security-Policy")).toBeDefined();
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    });

    it("attaches security headers to merchant admin routes", async () => {
      const req = createRequest("https://calcart.com/merchant/settings", {
        host: "calcart.com",
      });
      const res = await middleware(req);

      expect(res.headers.get("Content-Security-Policy")).toBeDefined();
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("attaches security headers to rewritten storefront routes", async () => {
      const req = createRequest("https://souled-store.calcart.com/products/graphic-tee", {
        host: "souled-store.calcart.com",
      });
      const res = await middleware(req);

      expect(res.headers.get("Content-Security-Policy")).toContain("https://checkout.razorpay.com");
      expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(res.headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    });

    it("attaches security headers to cross-tenant redirect responses (307)", async () => {
      const req = createRequest("https://souled-store.calcart.com/stores/other-store/products", {
        host: "souled-store.calcart.com",
      });
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
      expect(res.headers.get("Content-Security-Policy")).toBeDefined();
    });

    it("allows Razorpay payment iframe and scripts on checkout route", async () => {
      const req = createRequest("https://souled-store.calcart.com/stores/souled-store/checkout", {
        host: "souled-store.calcart.com",
      });
      const res = await middleware(req);

      const csp = res.headers.get("Content-Security-Policy") || "";
      expect(csp).toContain("https://checkout.razorpay.com");
      expect(csp).toContain("https://api.razorpay.com");
      expect(csp).toContain("frame-src");
      expect(csp).toContain("connect-src");
    });
  });
});
