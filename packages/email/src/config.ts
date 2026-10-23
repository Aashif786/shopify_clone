import {
  InvalidEmailProviderConfigurationError,
  MissingEmailProviderConfigurationError,
} from "./errors.js";

export type EmailDeliveryMode = "resend" | "development" | "test";

export interface EmailConfig {
  apiKey?: string;
  fromEmail: string;
  replyToEmail?: string;
  appUrl: string;
  mode: EmailDeliveryMode;
  timeoutMs: number;
}

export interface ResolveEmailConfigOptions {
  strict?: boolean;
}

const DEFAULT_FROM_EMAIL = "Shopify Clone <onboarding@resend.dev>";
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Validates and normalizes an application base URL.
 * Strictly prevents using arbitrary request host headers by enforcing
 * a configured absolute URL with http:// or https://.
 */
export function validateAppBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new InvalidEmailProviderConfigurationError("Application base URL cannot be empty.");
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new InvalidEmailProviderConfigurationError(
        `Application base URL must use http:// or https:// protocol. Received: "${trimmed}"`
      );
    }
    // Remove trailing slash for consistency
    return parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, ""));
  } catch (err) {
    if (err instanceof InvalidEmailProviderConfigurationError) {
      throw err;
    }
    throw new InvalidEmailProviderConfigurationError(
      `Invalid application base URL: "${trimmed}". Must be a valid absolute URL.`
    );
  }
}

/**
 * Resolves email configuration from environment variables.
 * - In production, strictly requires RESEND_API_KEY unless explicitly relaxed.
 * - In test environment, defaults to 'test' mode.
 * - In development without an API key, defaults to 'development' mode with safe logging.
 */
export function resolveEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
  options?: ResolveEmailConfigOptions
): EmailConfig {
  const nodeEnv = env.NODE_ENV?.toLowerCase() || "development";
  const apiKey = env.RESEND_API_KEY?.trim() || undefined;
  const rawFromEmail = env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
  const replyToEmail = env.RESEND_REPLY_TO_EMAIL?.trim() || undefined;
  const rawAppUrl = env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  const appUrl = validateAppBaseUrl(rawAppUrl);

  // Strict validation if explicitly requested or when in production
  const isStrict = options?.strict !== undefined ? options.strict : nodeEnv === "production";

  // Determine delivery mode
  let mode: EmailDeliveryMode;
  if (nodeEnv === "test") {
    mode = "test";
  } else if (isStrict || apiKey) {
    mode = "resend";
  } else {
    mode = "development";
  }

  if (isStrict) {
    if (!apiKey) {
      throw new MissingEmailProviderConfigurationError("RESEND_API_KEY");
    }
    if (!apiKey.startsWith("re_")) {
      throw new InvalidEmailProviderConfigurationError(
        "RESEND_API_KEY format is invalid. Resend API keys must start with 're_'."
      );
    }
    const lowerKey = apiKey.toLowerCase();
    if (
      lowerKey.includes("placeholder") ||
      lowerKey.includes("<") ||
      lowerKey.includes("example") ||
      lowerKey.includes("your_key")
    ) {
      throw new InvalidEmailProviderConfigurationError(
        "RESEND_API_KEY contains placeholder text. A valid Resend API key is required."
      );
    }
  }

  const timeoutMs = Number(env.RESEND_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  return {
    apiKey,
    fromEmail: rawFromEmail,
    replyToEmail,
    appUrl,
    mode,
    timeoutMs: isNaN(timeoutMs) || timeoutMs <= 0 ? DEFAULT_TIMEOUT_MS : timeoutMs,
  };
}
