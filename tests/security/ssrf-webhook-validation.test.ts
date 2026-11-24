import { describe, expect, it } from "vitest";
import {
  isBlockedIPv4,
  isBlockedIPv6,
  validateWebhookUrlSyntax,
  validateWebhookUrl,
} from "../../packages/validation/src/webhook-url-validator.js";

describe("SSRF Webhook URL Validation Tests", () => {
  describe("IPv4 Range Blocklist (isBlockedIPv4)", () => {
    it("blocks 0.0.0.0/8 (current network)", () => {
      expect(isBlockedIPv4("0.0.0.0")).toBe(true);
      expect(isBlockedIPv4("0.255.255.255")).toBe(true);
    });

    it("blocks 10.0.0.0/8 (RFC 1918 private)", () => {
      expect(isBlockedIPv4("10.0.0.1")).toBe(true);
      expect(isBlockedIPv4("10.254.1.1")).toBe(true);
      expect(isBlockedIPv4("10.255.255.255")).toBe(true);
    });

    it("blocks 100.64.0.0/10 (carrier-grade NAT)", () => {
      expect(isBlockedIPv4("100.64.0.1")).toBe(true);
      expect(isBlockedIPv4("100.127.255.255")).toBe(true);
      expect(isBlockedIPv4("100.63.255.255")).toBe(false);
      expect(isBlockedIPv4("100.128.0.0")).toBe(false);
    });

    it("blocks 127.0.0.0/8 (loopback)", () => {
      expect(isBlockedIPv4("127.0.0.1")).toBe(true);
      expect(isBlockedIPv4("127.0.1.1")).toBe(true);
      expect(isBlockedIPv4("127.255.255.255")).toBe(true);
    });

    it("blocks 169.254.0.0/16 (link-local and cloud metadata)", () => {
      expect(isBlockedIPv4("169.254.169.254")).toBe(true);
      expect(isBlockedIPv4("169.254.0.1")).toBe(true);
      expect(isBlockedIPv4("169.253.1.1")).toBe(false);
    });

    it("blocks 172.16.0.0/12 (RFC 1918 private)", () => {
      expect(isBlockedIPv4("172.16.0.1")).toBe(true);
      expect(isBlockedIPv4("172.31.255.255")).toBe(true);
      expect(isBlockedIPv4("172.15.255.255")).toBe(false);
      expect(isBlockedIPv4("172.32.0.1")).toBe(false);
    });

    it("blocks 192.0.0.0/24 (IETF protocol assignments)", () => {
      expect(isBlockedIPv4("192.0.0.1")).toBe(true);
      expect(isBlockedIPv4("192.0.0.255")).toBe(true);
      expect(isBlockedIPv4("192.0.1.1")).toBe(false);
    });

    it("blocks 192.168.0.0/16 (RFC 1918 private)", () => {
      expect(isBlockedIPv4("192.168.0.1")).toBe(true);
      expect(isBlockedIPv4("192.168.1.1")).toBe(true);
      expect(isBlockedIPv4("192.168.255.255")).toBe(true);
      expect(isBlockedIPv4("192.169.0.1")).toBe(false);
    });

    it("blocks 198.18.0.0/15 (benchmark testing)", () => {
      expect(isBlockedIPv4("198.18.0.1")).toBe(true);
      expect(isBlockedIPv4("198.19.255.255")).toBe(true);
      expect(isBlockedIPv4("198.17.255.255")).toBe(false);
      expect(isBlockedIPv4("198.20.0.1")).toBe(false);
    });

    it("blocks 224.0.0.0/4 (multicast) and 240.0.0.0/4 (reserved)", () => {
      expect(isBlockedIPv4("224.0.0.1")).toBe(true);
      expect(isBlockedIPv4("239.255.255.255")).toBe(true);
      expect(isBlockedIPv4("240.0.0.1")).toBe(true);
      expect(isBlockedIPv4("255.255.255.255")).toBe(true);
    });

    it("allows routable public IPv4 addresses", () => {
      expect(isBlockedIPv4("8.8.8.8")).toBe(false);
      expect(isBlockedIPv4("1.1.1.1")).toBe(false);
      expect(isBlockedIPv4("93.184.216.34")).toBe(false);
      expect(isBlockedIPv4("104.26.10.123")).toBe(false);
    });
  });

  describe("IPv6 Range Blocklist (isBlockedIPv6)", () => {
    it("blocks :: (unspecified)", () => {
      expect(isBlockedIPv6("::")).toBe(true);
      expect(isBlockedIPv6("0000:0000:0000:0000:0000:0000:0000:0000")).toBe(true);
    });

    it("blocks ::1 (loopback)", () => {
      expect(isBlockedIPv6("::1")).toBe(true);
      expect(isBlockedIPv6("0:0:0:0:0:0:0:1")).toBe(true);
      expect(isBlockedIPv6("[::1]")).toBe(true);
    });

    it("blocks fc00::/7 (unique local address - ULA)", () => {
      expect(isBlockedIPv6("fc00::1")).toBe(true);
      expect(isBlockedIPv6("fd12:3456:789a::1")).toBe(true);
      expect(isBlockedIPv6("fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toBe(true);
    });

    it("blocks fe80::/10 (link-local)", () => {
      expect(isBlockedIPv6("fe80::1")).toBe(true);
      expect(isBlockedIPv6("fe80::200:5aee:feaa:20a2")).toBe(true);
      expect(isBlockedIPv6("febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toBe(true);
    });

    it("blocks ff00::/8 (multicast)", () => {
      expect(isBlockedIPv6("ff00::1")).toBe(true);
      expect(isBlockedIPv6("ff02::1")).toBe(true);
      expect(isBlockedIPv6("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toBe(true);
    });

    it("blocks IPv4-mapped IPv6 pointing to private addresses", () => {
      expect(isBlockedIPv6("::ffff:127.0.0.1")).toBe(true);
      expect(isBlockedIPv6("::ffff:10.0.0.1")).toBe(true);
      expect(isBlockedIPv6("::ffff:192.168.1.1")).toBe(true);
      expect(isBlockedIPv6("::ffff:169.254.169.254")).toBe(true);
    });

    it("allows IPv4-mapped IPv6 pointing to public addresses", () => {
      expect(isBlockedIPv6("::ffff:8.8.8.8")).toBe(false);
      expect(isBlockedIPv6("::ffff:1.1.1.1")).toBe(false);
    });

    it("allows routable public IPv6 addresses", () => {
      expect(isBlockedIPv6("2001:4860:4860::8888")).toBe(false);
      expect(isBlockedIPv6("2606:4700:4700::1111")).toBe(false);
    });
  });

  describe("Synchronous URL Syntax Validation (validateWebhookUrlSyntax)", () => {
    it("rejects non-string or empty input", () => {
      expect(validateWebhookUrlSyntax("").valid).toBe(false);
      expect(validateWebhookUrlSyntax("   ").valid).toBe(false);
    });

    it("rejects invalid URL strings", () => {
      expect(validateWebhookUrlSyntax("not-a-url").valid).toBe(false);
      expect(validateWebhookUrlSyntax("htp://invalid").valid).toBe(false);
    });

    it("rejects embedded user credentials", () => {
      const res = validateWebhookUrlSyntax("https://user:pass@example.com/webhook");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("embedded user credentials");
    });

    it("rejects forbidden hostnames (localhost, *.local, *.internal)", () => {
      expect(validateWebhookUrlSyntax("https://localhost/webhook").valid).toBe(false);
      expect(validateWebhookUrlSyntax("https://api.localhost/webhook").valid).toBe(false);
      expect(validateWebhookUrlSyntax("https://service.local/webhook").valid).toBe(false);
      expect(validateWebhookUrlSyntax("https://db.internal/webhook").valid).toBe(false);
    });

    it("rejects private IPv4 literals directly in URL", () => {
      expect(validateWebhookUrlSyntax("https://127.0.0.1/hook").valid).toBe(false);
      expect(validateWebhookUrlSyntax("https://10.0.0.1/hook").valid).toBe(false);
      expect(validateWebhookUrlSyntax("https://169.254.169.254/latest/meta-data").valid).toBe(false);
      expect(validateWebhookUrlSyntax("https://192.168.1.1/hook").valid).toBe(false);
    });

    it("rejects private IPv6 literals directly in URL", () => {
      expect(validateWebhookUrlSyntax("https://[::1]/hook").valid).toBe(false);
      expect(validateWebhookUrlSyntax("https://[fe80::1]/hook").valid).toBe(false);
      expect(validateWebhookUrlSyntax("https://[fc00::1]/hook").valid).toBe(false);
    });

    it("allows valid public URLs with HTTPS", () => {
      const res = validateWebhookUrlSyntax("https://api.example.com/webhooks/receive");
      expect(res.valid).toBe(true);
      expect(res.url?.hostname).toBe("api.example.com");
    });
  });

  describe("Async DNS Resolution Validation (validateWebhookUrl)", () => {
    it("validates and accepts public domain with routable IPs", async () => {
      const res = await validateWebhookUrl("https://example.com/webhooks");
      expect(res.valid).toBe(true);
      expect(res.resolvedIps?.length).toBeGreaterThan(0);
    });

    it("rejects loopback and private literal addresses", async () => {
      const res = await validateWebhookUrl("https://127.0.0.1:8080/hook");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("blocked or private IPv4");
    });
  });
});
