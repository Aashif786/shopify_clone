export interface AppConfig {
  env: string;
  port: number;
  appUrl: string;
}

export interface DatabaseConfig {
  url: string;
}

export interface AuthConfig {
  secret: string;
}

export interface PaymentRecoveryConfig {
  enabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  leaseTimeoutMs: number;
}

export interface WorkerConfig {
  jobPollInterval: number;
  jobConcurrency: number;
  paymentRecovery: PaymentRecoveryConfig;
}

export interface EmailConfig {
  apiKey?: string;
  fromEmail: string;
  replyToEmail?: string;
  appUrl: string;
}

export interface ServerConfig {
  app: AppConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  email: EmailConfig;
  worker?: WorkerConfig;
}

export interface PublicConfig {
  appUrl: string;
}

export function getDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env
): DatabaseConfig {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing required server configuration: DATABASE_URL");
  }

  return { url };
}

export function getServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const missing: string[] = [];

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    missing.push("DATABASE_URL");
  }

  const authSecret = env.AUTH_SECRET?.trim();
  if (!authSecret) {
    missing.push("AUTH_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required server configuration: ${missing.join(", ")}`
    );
  }

  const isProduction = env.NODE_ENV === "production";

  if (isProduction) {
    if (databaseUrl!.includes("placeholder") || databaseUrl!.includes("<")) {
      throw new Error("Cannot use placeholder DATABASE_URL in production.");
    }
    if (authSecret!.length < 32) {
      throw new Error("AUTH_SECRET must be at least 32 characters in production.");
    }
    if (
      authSecret === "development_auth_secret_must_be_at_least_32_characters_long" ||
      authSecret!.toLowerCase().includes("placeholder")
    ) {
      throw new Error("Cannot use placeholder AUTH_SECRET in production.");
    }
    const appUrl = env.APP_URL?.trim();
    if (!appUrl || appUrl.startsWith("http://localhost") || appUrl.startsWith("http://127.0.0.1")) {
      throw new Error("Missing or invalid production APP_URL. Production APP_URL must be an HTTPS URL.");
    }
  }

  return {
    app: {
      env: env.NODE_ENV ?? "development",
      port: Number(env.PORT ?? "3000"),
      appUrl: env.APP_URL ?? "http://localhost:3000",
    },
    database: {
      url: databaseUrl!,
    },
    auth: {
      secret: authSecret!,
    },
    email: {
      apiKey: env.RESEND_API_KEY?.trim() || undefined,
      fromEmail: env.RESEND_FROM_EMAIL?.trim() || "Shopify Clone <onboarding@resend.dev>",
      replyToEmail: env.RESEND_REPLY_TO_EMAIL?.trim() || undefined,
      appUrl: env.APP_URL?.trim() || "http://localhost:3000",
    },
    worker: {
      jobPollInterval: Number(env.JOB_POLL_INTERVAL ?? "5000"),
      jobConcurrency: Number(env.JOB_CONCURRENCY ?? "4"),
      paymentRecovery: {
        enabled: env.PAYMENT_RECOVERY_ENABLED !== "false",
        pollIntervalMs: Number(env.PAYMENT_RECOVERY_POLL_INTERVAL ?? env.JOB_POLL_INTERVAL ?? "10000"),
        batchSize: Math.max(1, Math.min(Number(env.PAYMENT_RECOVERY_BATCH_SIZE ?? "50"), 500)),
        leaseTimeoutMs: Math.max(5000, Number(env.PAYMENT_WEBHOOK_LEASE_TIMEOUT ?? "60000")),
      },
    },
  };
}

export function getPublicConfig(): PublicConfig {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}
