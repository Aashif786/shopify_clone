import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_ORIGINS,
  getImageOrigins,
  normalizeImageOrigin,
  parseImageOrigins,
  toRemotePatterns,
} from "../../apps/web/src/lib/image-origins";
import { buildContentSecurityPolicy } from "../../apps/web/src/lib/security-headers";

function imgSrc(csp: string): string[] {
  const directive = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("img-src "));
  expect(directive).toBeDefined();
  return directive!.slice("img-src ".length).split(" ");
}

describe("normalizeImageOrigin", () => {
  it.each([
    ["https://cdn.shopify.com", "https://cdn.shopify.com"],
    ["  HTTPS://Images.Example.COM  ", "https://images.example.com"],
    ["https://*.s3.ap-south-1.amazonaws.com", "https://*.s3.ap-south-1.amazonaws.com"],
    ["https://cdn.example.com:8443", "https://cdn.example.com:8443"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeImageOrigin(input)).toBe(expected);
  });

  it.each([
    "*",
    "https://*",
    "https:",
    "http://cdn.example.com",
    "data:",
    "blob:",
    "https://cdn.example.com/path",
    "https://cdn.example.com?x=1",
    "https://user:pw@cdn.example.com",
    "https://localhost",
    "https://*.com",
    "https://-bad-.example.com",
    "javascript:alert(1)",
    "",
  ])("rejects %s", (input) => {
    expect(normalizeImageOrigin(input)).toBeNull();
  });
});

describe("parseImageOrigins / getImageOrigins", () => {
  it("keeps valid entries, drops and reports invalid ones", () => {
    const rejected: string[] = [];
    const parsed = parseImageOrigins(
      "https://cdn.shopify.com, *, http://insecure.example.com , https://img.example.org",
      (entry) => rejected.push(entry),
    );
    expect(parsed).toEqual(["https://cdn.shopify.com", "https://img.example.org"]);
    expect(rejected).toEqual(["*", "http://insecure.example.com"]);
  });

  it("returns the platform defaults when nothing is configured", () => {
    expect(getImageOrigins({})).toEqual([...DEFAULT_IMAGE_ORIGINS]);
  });

  it("adds configured origins to the defaults without duplicates", () => {
    const origins = getImageOrigins({
      STOREFRONT_IMAGE_ORIGINS: "https://cdn.shopify.com,https://images.unsplash.com",
    });
    expect(origins).toContain("https://cdn.shopify.com");
    expect(origins.filter((o) => o === "https://images.unsplash.com")).toHaveLength(1);
  });

  it("warns (without throwing) about an invalid configured entry", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getImageOrigins({ STOREFRONT_IMAGE_ORIGINS: "*" });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("maps origins to next/image remote patterns, including wildcard hosts", () => {
    expect(toRemotePatterns(["https://cdn.shopify.com", "https://*.cdn.example.com"])).toEqual([
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.cdn.example.com" },
    ]);
  });
});

describe("Content-Security-Policy img-src", () => {
  const original = process.env.STOREFRONT_IMAGE_ORIGINS;
  function withEnv<T>(value: string | undefined, fn: () => T): T {
    if (value === undefined) delete process.env.STOREFRONT_IMAGE_ORIGINS;
    else process.env.STOREFRONT_IMAGE_ORIGINS = value;
    try {
      return fn();
    } finally {
      if (original === undefined) delete process.env.STOREFRONT_IMAGE_ORIGINS;
      else process.env.STOREFRONT_IMAGE_ORIGINS = original;
    }
  }

  it("allows an approved, configured image origin", () => {
    const sources = withEnv("https://cdn.shopify.com", () =>
      imgSrc(buildContentSecurityPolicy({ isDevelopment: false })),
    );
    expect(sources).toContain("https://cdn.shopify.com");
  });

  it("blocks an origin that is not approved", () => {
    const sources = withEnv("https://cdn.shopify.com", () =>
      imgSrc(buildContentSecurityPolicy({ isDevelopment: false })),
    );
    expect(sources).not.toContain("https://evil.example.net");
    expect(sources).not.toContain("*");
    expect(sources).not.toContain("https:");
    expect(sources).not.toContain("http:");
  });

  it("never widens img-src to a bare wildcard, even if one is configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sources = withEnv("*,https:,data:,http://cdn.example.com", () =>
      imgSrc(buildContentSecurityPolicy({ isDevelopment: false })),
    );
    warn.mockRestore();
    expect(sources).not.toContain("*");
    expect(sources).not.toContain("https:");
    expect(sources).not.toContain("http://cdn.example.com");
  });

  it("keeps first-party, data: and blob: sources and the existing defaults in every environment", () => {
    for (const isDevelopment of [true, false]) {
      const sources = withEnv(undefined, () => imgSrc(buildContentSecurityPolicy({ isDevelopment })));
      expect(sources).toEqual(expect.arrayContaining(["'self'", "data:", "blob:"]));
      expect(sources).toEqual(expect.arrayContaining([...DEFAULT_IMAGE_ORIGINS]));
      expect(sources).toContain("https://*.razorpay.com");
    }
  });
});
