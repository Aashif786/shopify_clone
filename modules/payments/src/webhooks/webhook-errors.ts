import { PaymentDomainError } from "../domain/payment-errors.js";

export class WebhookSignatureVerificationError extends PaymentDomainError {
  constructor(message: string = "Invalid webhook signature", details?: unknown) {
    super(message, "PAYMENT_WEBHOOK_INVALID", 400, details);
  }
}

export class WebhookPayloadValidationError extends PaymentDomainError {
  constructor(message: string = "Invalid webhook payload structure", details?: unknown) {
    super(message, "PAYMENT_WEBHOOK_INVALID", 400, details);
  }
}

export class WebhookDuplicateEventError extends PaymentDomainError {
  constructor(message: string = "Webhook event has already been processed", details?: unknown) {
    super(message, "PAYMENT_WEBHOOK_REPLAYED", 200, details);
  }
}

export class WebhookEntityNotFoundError extends PaymentDomainError {
  constructor(message: string = "Referenced payment or attempt not found", details?: unknown) {
    super(message, "PAYMENT_NOT_FOUND", 404, details);
  }
}

export class WebhookProcessingError extends PaymentDomainError {
  constructor(message: string = "Webhook processing error", details?: unknown) {
    super(message, "PAYMENT_PROVIDER_ERROR", 500, details);
  }
}

export class WebhookSecretConfigurationError extends PaymentDomainError {
  constructor(message: string = "Payment webhook secret is not configured", details?: unknown) {
    super(message, "PAYMENT_WEBHOOK_CONFIG_ERROR", 500, details);
  }
}
