import type { Database, DatabaseClient } from "@calcart/db";
import {
  generateUuidV7,
  StorePaymentGatewayRepository,
  type StorePaymentGatewayRow,
} from "@calcart/db";

export interface MerchantRazorpayConfigDTO {
  id?: string;
  storeId: string;
  provider: "RAZORPAY";
  keyId: string | null;
  keySecretMasked: string | null;
  hasKeySecret: boolean;
  webhookSecretMasked: string | null;
  hasWebhookSecret: boolean;
  isEnabled: boolean;
  isConfigured: boolean;
  status: "ACTIVE" | "INACTIVE" | "NOT_CONFIGURED" | "TEST_MODE";
  updatedAt?: string;
}

export interface SaveMerchantRazorpayInput {
  keyId?: string | null;
  keySecret?: string | null;
  webhookSecret?: string | null;
  isEnabled: boolean;
}

export function maskSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••••••${trimmed.slice(-4)}`;
}

export class StorePaymentGatewayService {
  constructor(
    private readonly repo: StorePaymentGatewayRepository = new StorePaymentGatewayRepository(),
  ) {}

  async getStoreRazorpayConfig(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
  ): Promise<MerchantRazorpayConfigDTO> {
    const row = await this.repo.findByStoreAndProvider(clientOrDb, storeId, "RAZORPAY");
    if (!row) {
      return {
        storeId,
        provider: "RAZORPAY",
        keyId: null,
        keySecretMasked: null,
        hasKeySecret: false,
        webhookSecretMasked: null,
        hasWebhookSecret: false,
        isEnabled: false,
        isConfigured: false,
        status: "NOT_CONFIGURED",
      };
    }

    const hasKeyId = Boolean(row.key_id?.trim());
    const hasKeySecret = Boolean(row.key_secret?.trim());
    const isConfigured = hasKeyId && hasKeySecret;
    const isTestMode = Boolean(row.key_id?.startsWith("rzp_test_"));

    let status: "ACTIVE" | "INACTIVE" | "NOT_CONFIGURED" | "TEST_MODE" = "NOT_CONFIGURED";
    if (isConfigured) {
      if (!row.is_enabled) {
        status = "INACTIVE";
      } else if (isTestMode) {
        status = "TEST_MODE";
      } else {
        status = "ACTIVE";
      }
    }

    return {
      id: row.id,
      storeId: row.store_id,
      provider: "RAZORPAY",
      keyId: row.key_id,
      keySecretMasked: maskSecret(row.key_secret),
      hasKeySecret,
      webhookSecretMasked: maskSecret(row.webhook_secret),
      hasWebhookSecret: Boolean(row.webhook_secret?.trim()),
      isEnabled: row.is_enabled,
      isConfigured,
      status,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  async getRawStoreRazorpayRow(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
  ): Promise<StorePaymentGatewayRow | null> {
    return this.repo.findByStoreAndProvider(clientOrDb, storeId, "RAZORPAY");
  }

  async saveStoreRazorpayConfig(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    input: SaveMerchantRazorpayInput,
  ): Promise<MerchantRazorpayConfigDTO> {
    const existing = await this.repo.findByStoreAndProvider(clientOrDb, storeId, "RAZORPAY");
    const id = existing?.id ?? generateUuidV7();

    const keyId = input.keyId !== undefined ? (input.keyId ? input.keyId.trim() : null) : (existing?.key_id ?? null);
    const keySecret = input.keySecret !== undefined ? (input.keySecret ? input.keySecret.trim() : null) : (existing?.key_secret ?? null);
    const webhookSecret = input.webhookSecret !== undefined ? (input.webhookSecret ? input.webhookSecret.trim() : null) : (existing?.webhook_secret ?? null);

    await this.repo.upsert(clientOrDb, {
      id,
      storeId,
      provider: "RAZORPAY",
      keyId,
      keySecret,
      webhookSecret,
      isEnabled: input.isEnabled,
    });

    return this.getStoreRazorpayConfig(clientOrDb, storeId);
  }
}
