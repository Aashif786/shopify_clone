/**
 * Email Service Domain Errors
 */

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailError";
  }
}

export class MissingEmailProviderConfigurationError extends EmailError {
  constructor(missingKey = "RESEND_API_KEY") {
    super(
      `Email provider configuration is missing required environment variable: ${missingKey}. ` +
      `Configure ${missingKey} in your environment or .env file.`
    );
    this.name = "MissingEmailProviderConfigurationError";
  }
}

export class InvalidEmailProviderConfigurationError extends EmailError {
  constructor(reason: string) {
    super(`Invalid email provider configuration: ${reason}`);
    this.name = "InvalidEmailProviderConfigurationError";
  }
}

export class EmailDeliveryError extends EmailError {
  public readonly causeError?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "EmailDeliveryError";
    this.causeError = cause;
  }
}

export type EmailErrorCategory =
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "INVALID_ADDRESS"
  | "PROVIDER_ERROR"
  | "AUTHENTICATION_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface CategorizedEmailError {
  category: EmailErrorCategory;
  isTransient: boolean;
  message: string;
}

/**
 * Categorizes an error message or exception into standardized operational failure categories.
 * Distinguishes retryable transient failures from permanent terminal failures.
 */
export function categorizeEmailError(err: unknown): CategorizedEmailError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("429")
  ) {
    return { category: "RATE_LIMIT", isTransient: true, message };
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborterror") ||
    lower.includes("etimedout")
  ) {
    return { category: "TIMEOUT", isTransient: true, message };
  }

  if (
    lower.includes("invalid email") ||
    lower.includes("invalid recipient") ||
    lower.includes("missing recipient") ||
    lower.includes("missing or invalid") ||
    lower.includes("rfc 5322") ||
    lower.includes("not a valid email")
  ) {
    return { category: "INVALID_ADDRESS", isTransient: false, message };
  }

  if (
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return { category: "AUTHENTICATION_ERROR", isTransient: false, message };
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("dns") ||
    lower.includes("enotfound")
  ) {
    return { category: "NETWORK_ERROR", isTransient: true, message };
  }

  if (
    lower.includes("resend") ||
    lower.includes("provider") ||
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504")
  ) {
    return { category: "PROVIDER_ERROR", isTransient: true, message };
  }

  return { category: "UNKNOWN", isTransient: true, message };
}
