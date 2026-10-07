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

export interface WorkerConfig {
  jobPollInterval: number;
  jobConcurrency: number;
}

export interface ServerConfig {
  app: AppConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
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
    worker: {
      jobPollInterval: Number(env.JOB_POLL_INTERVAL ?? "5000"),
      jobConcurrency: Number(env.JOB_CONCURRENCY ?? "4"),
    },
  };
}

export function getPublicConfig(): PublicConfig {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}
