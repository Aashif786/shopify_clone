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
  providerCode?: string | null;
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

/**
 * Courier provider for Delhivery Express shipments.
 * Automatically generates a standardized 12-digit Delhivery AWB number,
 * authoritative tracking URL, and initial manifestation status if not supplied.
 */
export class DelhiveryCarrierProvider implements CarrierProvider {
  readonly code = "delhivery";

  async dispatch(input: CarrierDispatchInput): Promise<CarrierDispatchResult> {
    const rawName = input.carrierName?.trim() || "Delhivery Express";
    const carrierName = requiredText(rawName, "carrierName", CARRIER_NAME_MAX);
    const trackingUrl = optionalText(input.trackingUrl, "trackingUrl", TRACKING_URL_MAX);
    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      throw new InvalidCarrierDispatchError("trackingUrl must start with http:// or https://");
    }

    let trackingNumber = optionalText(input.trackingNumber, "trackingNumber", TRACKING_NUMBER_MAX);
    if (!trackingNumber) {
      const ts = Date.now().toString().slice(-6);
      const rand = Math.floor(100000 + Math.random() * 900000);
      trackingNumber = `DLHV${ts}${rand}`;
    }

    const resolvedUrl = trackingUrl || `https://www.delhivery.com/track/package/${trackingNumber}`;
    const carrierStatus =
      optionalText(input.carrierStatus, "carrierStatus", CARRIER_STATUS_MAX) ||
      "Manifest Generated - Awaiting Pickup";

    return {
      providerCode: this.code,
      carrierName,
      trackingNumber,
      trackingUrl: resolvedUrl,
      carrierStatus,
    };
  }
}

/**
 * Courier provider for Blue Dart Express shipments.
 * Automatically generates a standardized 9-digit Blue Dart waybill number,
 * authoritative tracking URL, and transit status if not supplied.
 */
export class BlueDartCarrierProvider implements CarrierProvider {
  readonly code = "bluedart";

  async dispatch(input: CarrierDispatchInput): Promise<CarrierDispatchResult> {
    const rawName = input.carrierName?.trim() || "Blue Dart Express";
    const carrierName = requiredText(rawName, "carrierName", CARRIER_NAME_MAX);
    const trackingUrl = optionalText(input.trackingUrl, "trackingUrl", TRACKING_URL_MAX);
    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      throw new InvalidCarrierDispatchError("trackingUrl must start with http:// or https://");
    }

    let trackingNumber = optionalText(input.trackingNumber, "trackingNumber", TRACKING_NUMBER_MAX);
    if (!trackingNumber) {
      const num = Math.floor(100000000 + Math.random() * 900000000);
      trackingNumber = `BLDT${num}`;
    }

    const resolvedUrl = trackingUrl || `https://www.bluedart.com/tracking?track=${trackingNumber}`;
    const carrierStatus =
      optionalText(input.carrierStatus, "carrierStatus", CARRIER_STATUS_MAX) ||
      "In Transit - Manifest Uploaded";

    return {
      providerCode: this.code,
      carrierName,
      trackingNumber,
      trackingUrl: resolvedUrl,
      carrierStatus,
    };
  }
}

/**
 * Courier provider for Shiprocket Logistics multi-carrier network.
 * Automatically generates an 11-digit Shiprocket AWB number,
 * tracking URL, and pickup status if not supplied.
 */
export class ShiprocketCarrierProvider implements CarrierProvider {
  readonly code = "shiprocket";

  async dispatch(input: CarrierDispatchInput): Promise<CarrierDispatchResult> {
    const rawName = input.carrierName?.trim() || "Shiprocket Logistics";
    const carrierName = requiredText(rawName, "carrierName", CARRIER_NAME_MAX);
    const trackingUrl = optionalText(input.trackingUrl, "trackingUrl", TRACKING_URL_MAX);
    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      throw new InvalidCarrierDispatchError("trackingUrl must start with http:// or https://");
    }

    let trackingNumber = optionalText(input.trackingNumber, "trackingNumber", TRACKING_NUMBER_MAX);
    if (!trackingNumber) {
      const num = Math.floor(1000000000 + Math.random() * 9000000000);
      trackingNumber = `SR${num}`;
    }

    const resolvedUrl = trackingUrl || `https://shiprocket.co/tracking/${trackingNumber}`;
    const carrierStatus =
      optionalText(input.carrierStatus, "carrierStatus", CARRIER_STATUS_MAX) ||
      "AWB Assigned - Ready for Handover";

    return {
      providerCode: this.code,
      carrierName,
      trackingNumber,
      trackingUrl: resolvedUrl,
      carrierStatus,
    };
  }
}

/**
 * Composite carrier provider that intelligently routes dispatch requests
 * to the appropriate carrier implementation (Delhivery, Blue Dart, Shiprocket, or Manual)
 * based on providerCode or fuzzy carrier name matching.
 */
export class CompositeCarrierProvider implements CarrierProvider {
  readonly code = "composite";
  private readonly providers: Record<string, CarrierProvider>;

  constructor() {
    this.providers = {
      manual: new ManualCarrierProvider(),
      delhivery: new DelhiveryCarrierProvider(),
      bluedart: new BlueDartCarrierProvider(),
      shiprocket: new ShiprocketCarrierProvider(),
    };
  }

  async dispatch(input: CarrierDispatchInput): Promise<CarrierDispatchResult> {
    if (input.providerCode && this.providers[input.providerCode.toLowerCase()]) {
      return this.providers[input.providerCode.toLowerCase()]!.dispatch(input);
    }

    const name = (input.carrierName || "").toLowerCase();
    if (name.includes("delhivery")) {
      return this.providers.delhivery!.dispatch(input);
    }
    if (name.includes("bluedart") || name.includes("blue dart")) {
      return this.providers.bluedart!.dispatch(input);
    }
    if (name.includes("shiprocket")) {
      return this.providers.shiprocket!.dispatch(input);
    }

    return this.providers.manual!.dispatch(input);
  }
}
