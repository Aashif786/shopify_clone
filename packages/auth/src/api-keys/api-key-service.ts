import { randomBytes, createHash } from "node:crypto";
import { ApiKeyRepository, type DatabaseClient, type StoreApiKeyRow } from "@calcart/db";

export interface GeneratedApiKey {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
}

export interface VerifiedApiKeyContext {
  storeId: string;
  keyId: string;
  name: string;
  scopes: string[];
}

export class ApiKeyService {
  constructor(private readonly repo: ApiKeyRepository = new ApiKeyRepository()) {}

  /**
   * Generates a new secure API key with prefix and SHA-256 hash.
   * Format: cc_live_<32 hex chars>
   */
  generateApiKey(mode: "live" | "test" = "live"): GeneratedApiKey {
    const entropy = randomBytes(16).toString("hex"); // 32 hex chars
    const rawKey = `cc_${mode}_${entropy}`;
    const keyPrefix = rawKey.slice(0, 12); // e.g. "cc_live_a1b2"
    const keyHash = this.hashKey(rawKey);

    return {
      rawKey,
      keyPrefix,
      keyHash,
    };
  }

  /**
   * Hashes a raw API key using SHA-256.
   */
  hashKey(rawKey: string): string {
    return createHash("sha256").update(rawKey.trim()).digest("hex");
  }

  /**
   * Verifies an incoming bearer API key against persisted keys.
   * Ensures the key exists, is not revoked, is not expired, and contains the required scope.
   */
  async verifyApiKey(
    client: DatabaseClient,
    rawKey: string,
    requiredScope?: string,
  ): Promise<VerifiedApiKeyContext | null> {
    if (!rawKey || typeof rawKey !== "string") {
      return null;
    }

    const trimmed = rawKey.trim();
    if (!trimmed.startsWith("cc_live_") && !trimmed.startsWith("cc_test_")) {
      return null;
    }

    const keyHash = this.hashKey(trimmed);
    const row = await this.repo.findByKeyHash(client, keyHash);

    if (!row) {
      return null;
    }

    // Check revocation
    if (row.revoked_at !== null) {
      return null;
    }

    // Check expiration
    if (row.expires_at && new Date() > new Date(row.expires_at)) {
      return null;
    }

    // Check required scope
    if (requiredScope && !row.scopes.includes(requiredScope) && !row.scopes.includes("admin")) {
      return null;
    }

    // Record last used asynchronously (non-blocking)
    void this.repo.recordUsage(client, row.id).catch((err) => {
      console.error(`[ApiKeyService] Failed to record usage for key ${row.id}:`, err);
    });

    return {
      storeId: row.store_id,
      keyId: row.id,
      name: row.name,
      scopes: row.scopes,
    };
  }

  /**
   * Creates an API key record for a store.
   */
  async createApiKeyForStore(
    client: DatabaseClient,
    input: {
      storeId: string;
      name: string;
      scopes?: string[];
      expiresAt?: Date | null;
      mode?: "live" | "test";
    },
  ): Promise<{ rawKey: string; record: StoreApiKeyRow }> {
    const { rawKey, keyPrefix, keyHash } = this.generateApiKey(input.mode ?? "live");

    const record = await this.repo.create(client, {
      storeId: input.storeId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
    });

    return {
      rawKey,
      record,
    };
  }

  async listStoreApiKeys(client: DatabaseClient, storeId: string): Promise<StoreApiKeyRow[]> {
    return this.repo.findByStoreId(client, storeId);
  }

  async revokeApiKey(
    client: DatabaseClient,
    storeId: string,
    keyId: string,
  ): Promise<StoreApiKeyRow | null> {
    return this.repo.revoke(client, storeId, keyId);
  }
}
