import { describe, it, expect, afterEach } from "vitest";
import { generateUuidV7, runMigrations } from "@calcart/db";
import {
  StoreService,
  DomainConflictError,
  InvalidDomainError,
  DomainNotVerifiedError,
  CannotDeleteDefaultSubdomainError,
  } from "@calcart/stores";
import { ForbiddenError } from "@calcart/tenant";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Store Custom Domains Phase 2 Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb() {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function createTestUser(
    db: Awaited<ReturnType<typeof setupDb>>,
    email = "merchant@example.com",
  ): Promise<string> {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [userId, email, "Test User", "hashed_password"],
    );
    return userId;
  }

  it("adds a custom domain with normalized hostname and generates DNS instructions", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "owner@example.com");

    const store = await storeService.createStore(db, ownerId, {
      name: "Acme Store",
      slug: "acme-store",
      status: "ACTIVE",
    });

    // Test input with uppercase, protocol, trailing slash
    const domainDto = await storeService.addCustomDomain(db, store.id, ownerId, {
      domain: "  HTTPS://Shop.AcmeBrand.COM/path  ",
    });

    expect(domainDto.domain).toBe("shop.acmebrand.com");
    expect(domainDto.type).toBe("CUSTOM");
    expect(domainDto.status).toBe("PENDING");
    expect(domainDto.isPrimary).toBe(false);
    expect(domainDto.dnsInstructions).toBeDefined();
    expect(domainDto.dnsInstructions!.length).toBeGreaterThanOrEqual(1);

    const cnameInstruction = domainDto.dnsInstructions!.find((i) => i.type === "CNAME");
    expect(cnameInstruction).toBeDefined();
    expect(cnameInstruction?.value).toContain("vercel-dns.com");

    const txtInstruction = domainDto.dnsInstructions!.find((i) => i.type === "TXT");
    expect(txtInstruction).toBeDefined();
    expect(txtInstruction?.value).toContain("calcart-verify-");
  });

  it("rejects invalid domain formats and platform reserved hostnames", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "owner2@example.com");

    const store = await storeService.createStore(db, ownerId, {
      name: "Format Test Store",
      slug: "format-test-store",
      status: "ACTIVE",
    });

    // 1. Single word without dot
    await expect(
      storeService.addCustomDomain(db, store.id, ownerId, { domain: "invalidhostname" }),
    ).rejects.toThrow(InvalidDomainError);

    // 2. Special invalid characters
    await expect(
      storeService.addCustomDomain(db, store.id, ownerId, { domain: "not@valid!.com" }),
    ).rejects.toThrow(InvalidDomainError);

    // 3. Platform apex domain
    await expect(
      storeService.addCustomDomain(db, store.id, ownerId, { domain: "calcart.com" }),
    ).rejects.toThrow(InvalidDomainError);

    // 4. Subdomain of platform domain
    await expect(
      storeService.addCustomDomain(db, store.id, ownerId, { domain: "fake.calcart.com" }),
    ).rejects.toThrow(InvalidDomainError);
  });

  it("prevents duplicate domain registration across stores", async () => {
    const db = await setupDb();
    const ownerA = await createTestUser(db, "owner-a@example.com");
    const ownerB = await createTestUser(db, "owner-b@example.com");

    const storeA = await storeService.createStore(db, ownerA, {
      name: "Store A",
      slug: "store-a",
      status: "ACTIVE",
    });

    const storeB = await storeService.createStore(db, ownerB, {
      name: "Store B",
      slug: "store-b",
      status: "ACTIVE",
    });

    // Store A registers shop.brand.com
    await storeService.addCustomDomain(db, storeA.id, ownerA, {
      domain: "shop.brand.com",
    });

    // Store B attempts to register the same domain
    await expect(
      storeService.addCustomDomain(db, storeB.id, ownerB, {
        domain: "shop.brand.com",
      }),
    ).rejects.toThrow(DomainConflictError);
  });

  it("performs real verification check and honestly reports DNS failure when records are absent", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "verifier@example.com");

    const store = await storeService.createStore(db, ownerId, {
      name: "Verify Store",
      slug: "verify-store",
      status: "ACTIVE",
    });

    // Register a non-existent test domain
    const created = await storeService.addCustomDomain(db, store.id, ownerId, {
      domain: "non-existent-domain-test-xyz-12345.com",
    });

    // Verify DNS
    const result = await storeService.verifyCustomDomain(db, store.id, ownerId, created.id);

    // Must NOT fake verification! Must honestly report failure
    expect(result.verified).toBe(false);
    expect(result.domain.status).toBe("FAILED");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("No A record pointing to 76.76.21.21");
  });

  it("prevents designating an unverified domain as primary", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "primary-tester@example.com");

    const store = await storeService.createStore(db, ownerId, {
      name: "Primary Store",
      slug: "primary-store",
      status: "ACTIVE",
    });

    const created = await storeService.addCustomDomain(db, store.id, ownerId, {
      domain: "shop.brand.com",
    });

    // Attempt to set unverified domain as primary
    await expect(
      storeService.setPrimaryStoreDomain(db, store.id, ownerId, created.id),
    ).rejects.toThrow(DomainNotVerifiedError);
  });

  it("transactionally switches primary domain once verified and updates fallback safely", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "switcher@example.com");

    const store = await storeService.createStore(db, ownerId, {
      name: "Switch Store",
      slug: "switch-store",
      status: "ACTIVE",
    });

    const created = await storeService.addCustomDomain(db, store.id, ownerId, {
      domain: "shop.switchbrand.com",
    });

    // Manually mark verified in test database to simulate verified provider state
    await db.query(
      `UPDATE store_domains
       SET status = 'ACTIVE', verified_at = NOW(), ssl_status = 'ACTIVE'
       WHERE id = $1`,
      [created.id],
    );

    // Set as primary
    const primaryRes = await storeService.setPrimaryStoreDomain(db, store.id, ownerId, created.id);
    expect(primaryRes.success).toBe(true);
    expect(primaryRes.primaryDomain).toBe("shop.switchbrand.com");

    // Verify domains list: custom domain is primary, default subdomain is not primary
    const domainsData = await storeService.getStoreDomains(db, store.id, ownerId);
    const customDom = domainsData.domains.find((d) => d.id === created.id);
    const subDom = domainsData.domains.find((d) => d.type === "SUBDOMAIN");

    expect(customDom?.isPrimary).toBe(true);
    expect(subDom?.isPrimary).toBe(false);

    // Safely remove custom domain: must revert default subdomain to primary!
    const removeRes = await storeService.removeCustomDomain(db, store.id, ownerId, created.id);
    expect(removeRes.success).toBe(true);

    const domainsDataAfter = await storeService.getStoreDomains(db, store.id, ownerId);
    const subDomAfter = domainsDataAfter.domains.find((d) => d.type === "SUBDOMAIN");
    expect(subDomAfter?.isPrimary).toBe(true);
  });

  it("disallows deleting the default platform subdomain", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "nodelete@example.com");

    const store = await storeService.createStore(db, ownerId, {
      name: "No Delete Store",
      slug: "no-delete-store",
      status: "ACTIVE",
    });

    const domainsData = await storeService.getStoreDomains(db, store.id, ownerId);
    const subDom = domainsData.domains.find((d) => d.type === "SUBDOMAIN");
    expect(subDom).toBeDefined();

    await expect(
      storeService.removeCustomDomain(db, store.id, ownerId, subDom!.id),
    ).rejects.toThrow(CannotDeleteDefaultSubdomainError);
  });

  it("strictly enforces tenant boundary: unauthorized merchant cannot manage store domains", async () => {
    const db = await setupDb();
    const ownerA = await createTestUser(db, "owner-tenant-a@example.com");
    const userB = await createTestUser(db, "user-tenant-b@example.com");

    const storeA = await storeService.createStore(db, ownerA, {
      name: "Tenant A Store",
      slug: "tenant-a-store",
      status: "ACTIVE",
    });

    // User B cannot add domain to Store A
    await expect(
      storeService.addCustomDomain(db, storeA.id, userB, { domain: "hacked.com" }),
    ).rejects.toThrow(ForbiddenError);

    // Add valid domain as Owner A
    const domain = await storeService.addCustomDomain(db, storeA.id, ownerA, {
      domain: "legit.com",
    });

    // User B cannot verify Store A's domain
    await expect(
      storeService.verifyCustomDomain(db, storeA.id, userB, domain.id),
    ).rejects.toThrow(ForbiddenError);

    // User B cannot delete Store A's domain
    await expect(
      storeService.removeCustomDomain(db, storeA.id, userB, domain.id),
    ).rejects.toThrow(ForbiddenError);
  });
});
