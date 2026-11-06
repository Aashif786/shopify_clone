import { ShippingDomainError } from "../domain/shipping-errors.js";

/**
 * What a carrier must accept to open a shipment.
 *
 * The platform does not hold carrier credentials and does not pay a provider.
 * A later provider implements this same function with the merchant's own account.
 * `manual` records the details the merchant typed.
 */
export interface CarrierDispatchInput {
  carrierName: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrierStatus?: string | null;
}

export interface CarrierDispatchResult {
  providerCode: string;
  carrierName: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrierStatus: string | null;
}

export interface CarrierProvider {
  readonly code: string;
  dispatch(input: CarrierDispatchInput): Promise<CarrierDispatchResult>;
}

export class InvalidCarrierDispatchError extends ShippingDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_CARRIER_DISPATCH", 400, details);
  }
}

const CARRIER_NAME_MAX = 120;
const TRACKING_NUMBER_MAX = 80;
const TRACKING_URL_MAX = 500;
const CARRIER_STATUS_MAX = 200;

function requiredText(value: string | null | undefined, field: string, max: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidCarrierDispatchError(`${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new InvalidCarrierDispatchError(`${field} cannot exceed ${max} characters`);
  }
  return trimmed;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  max: number,
): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new InvalidCarrierDispatchError(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) {
    throw new InvalidCarrierDispatchError(`${field} cannot exceed ${max} characters`);
  }
  return trimmed;
}

/**
 * Records a shipment the merchant hands to a carrier themselves.
 * No HTTP call and no credentials. The carrier name is whatever the merchant enters.
 */
export class ManualCarrierProvider implements CarrierProvider {
  readonly code = "manual";

  async dispatch(input: CarrierDispatchInput): Promise<CarrierDispatchResult> {
    const carrierName = requiredText(input.carrierName, "carrierName", CARRIER_NAME_MAX);
    const trackingNumber = optionalText(input.trackingNumber, "trackingNumber", TRACKING_NUMBER_MAX);
    const trackingUrl = optionalText(input.trackingUrl, "trackingUrl", TRACKING_URL_MAX);
    const carrierStatus = optionalText(input.carrierStatus, "carrierStatus", CARRIER_STATUS_MAX);

    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      throw new InvalidCarrierDispatchError("trackingUrl must start with http:// or https://");
    }

    return {
      providerCode: this.code,
      carrierName,
      trackingNumber,
      trackingUrl,
      carrierStatus,
    };
  }
}
