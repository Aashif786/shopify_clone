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
