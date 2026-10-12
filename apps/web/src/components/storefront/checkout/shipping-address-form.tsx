"use client";

import React, { useState, type FormEvent } from "react";
import type { CheckoutAddressDTO } from "@shopify-clone/checkout";
import { validateShippingAddress } from "../../../lib/storefront-checkout-helpers";
import { Spinner } from "@shopify-clone/ui";

export interface ShippingAddressFormProps {
  initialAddress?: Partial<CheckoutAddressDTO> | null;
  onSubmit: (address: CheckoutAddressDTO) => Promise<void> | void;
  onBack: () => void;
  isLoading?: boolean;
}

export function ShippingAddressForm({
  initialAddress,
  onSubmit,
  onBack,
  isLoading = false,
}: ShippingAddressFormProps) {
  const [address, setAddress] = useState<Partial<CheckoutAddressDTO>>({
    firstName: initialAddress?.firstName || "",
    lastName: initialAddress?.lastName || "",
    addressLine1: initialAddress?.addressLine1 || "",
    addressLine2: initialAddress?.addressLine2 || "",
    city: initialAddress?.city || "",
    state: initialAddress?.state || "",
    postalCode: initialAddress?.postalCode || "",
    country: initialAddress?.country || "US",
    phone: initialAddress?.phone || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof CheckoutAddressDTO, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validation = validateShippingAddress(address);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    await onSubmit({
      firstName: address.firstName?.trim() || "",
      lastName: address.lastName?.trim() || "",
      addressLine1: address.addressLine1?.trim() || "",
      addressLine2: address.addressLine2?.trim() || null,
      city: address.city?.trim() || "",
      state: address.state?.trim() || null,
      postalCode: address.postalCode?.trim() || "",
      country: address.country?.trim() || "US",
      phone: address.phone?.trim() || null,
    });
  };

  return (
    <form
      className="checkout-form shipping-address-form"
      onSubmit={handleSubmit}
      noValidate
      data-testid="shipping-address-form"
    >
      <div className="checkout-form-header">
        <h2 className="checkout-form-title">Shipping Address</h2>
        <p className="checkout-form-subtitle text-muted text-sm">
          Enter the delivery address for your physical order.
        </p>
      </div>

      {errors.form && (
        <div className="alert alert--danger" role="alert" style={{ marginBottom: "var(--space-4)" }}>
          {errors.form}
        </div>
      )}

      {/* Name row */}
      <div className="form-row form-row--2-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <div className="form-group">
          <label htmlFor="ship-first-name" className="form-label font-medium">
            First name <span className="text-danger">*</span>
          </label>
          <input
            id="ship-first-name"
            name="firstName"
            type="text"
            autoComplete="given-name"
            className={`input ${errors.firstName ? "input--error" : ""}`}
            value={address.firstName || ""}
            onChange={(e) => handleChange("firstName", e.target.value)}
            disabled={isLoading}
            data-testid="first-name-input"
          />
          {errors.firstName && <p className="form-error text-danger text-xs">{errors.firstName}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="ship-last-name" className="form-label font-medium">
            Last name <span className="text-danger">*</span>
          </label>
          <input
            id="ship-last-name"
            name="lastName"
            type="text"
            autoComplete="family-name"
            className={`input ${errors.lastName ? "input--error" : ""}`}
            value={address.lastName || ""}
            onChange={(e) => handleChange("lastName", e.target.value)}
            disabled={isLoading}
            data-testid="last-name-input"
          />
          {errors.lastName && <p className="form-error text-danger text-xs">{errors.lastName}</p>}
        </div>
      </div>

      {/* Address line 1 */}
      <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
        <label htmlFor="ship-address-line1" className="form-label font-medium">
          Address <span className="text-danger">*</span>
        </label>
        <input
          id="ship-address-line1"
          name="addressLine1"
          type="text"
          autoComplete="address-line1"
          placeholder="Street address or P.O. Box"
          className={`input ${errors.addressLine1 ? "input--error" : ""}`}
          value={address.addressLine1}
          onChange={(e) => handleChange("addressLine1", e.target.value)}
          disabled={isLoading}
          data-testid="address-line1-input"
        />
        {errors.addressLine1 && <p className="form-error text-danger text-xs">{errors.addressLine1}</p>}
      </div>

      {/* Address line 2 */}
      <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
        <label htmlFor="ship-address-line2" className="form-label font-medium">
          Apartment, suite, etc. <span className="text-muted text-xs">(optional)</span>
        </label>
        <input
          id="ship-address-line2"
          name="addressLine2"
          type="text"
          autoComplete="address-line2"
          className="input"
          value={address.addressLine2 || ""}
          onChange={(e) => handleChange("addressLine2", e.target.value)}
          disabled={isLoading}
          data-testid="address-line2-input"
        />
      </div>

      {/* City, State, ZIP row */}
      <div className="form-row form-row--3-col" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <div className="form-group">
          <label htmlFor="ship-city" className="form-label font-medium">
            City <span className="text-danger">*</span>
          </label>
          <input
            id="ship-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            className={`input ${errors.city ? "input--error" : ""}`}
            value={address.city}
            onChange={(e) => handleChange("city", e.target.value)}
            disabled={isLoading}
            data-testid="city-input"
          />
          {errors.city && <p className="form-error text-danger text-xs">{errors.city}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="ship-state" className="form-label font-medium">
            State
          </label>
          <input
            id="ship-state"
            name="state"
            type="text"
            autoComplete="address-level1"
            className="input"
            value={address.state || ""}
            onChange={(e) => handleChange("state", e.target.value)}
            disabled={isLoading}
            data-testid="state-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ship-postal-code" className="form-label font-medium">
            Postal code <span className="text-danger">*</span>
          </label>
          <input
            id="ship-postal-code"
            name="postalCode"
            type="text"
            autoComplete="postal-code"
            className={`input ${errors.postalCode ? "input--error" : ""}`}
            value={address.postalCode}
            onChange={(e) => handleChange("postalCode", e.target.value)}
            disabled={isLoading}
            data-testid="postal-code-input"
          />
          {errors.postalCode && <p className="form-error text-danger text-xs">{errors.postalCode}</p>}
        </div>
      </div>

      {/* Country & Phone */}
      <div className="form-row form-row--2-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <div className="form-group">
          <label htmlFor="ship-country" className="form-label font-medium">
            Country <span className="text-danger">*</span>
          </label>
          <select
            id="ship-country"
            name="country"
            autoComplete="country-name"
            className={`select ${errors.country ? "select--error" : ""}`}
            value={address.country}
            onChange={(e) => handleChange("country", e.target.value)}
            disabled={isLoading}
            data-testid="country-select"
          >
            <option value="US">United States (US)</option>
            <option value="CA">Canada (CA)</option>
            <option value="GB">United Kingdom (GB)</option>
            <option value="IN">India (IN)</option>
            <option value="AU">Australia (AU)</option>
          </select>
          {errors.country && <p className="form-error text-danger text-xs">{errors.country}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="ship-phone" className="form-label font-medium">
            Phone <span className="text-muted text-xs">(optional)</span>
          </label>
          <input
            id="ship-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="input"
            value={address.phone || ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            disabled={isLoading}
            data-testid="phone-input"
          />
        </div>
      </div>

      <div className="checkout-actions-row">
        <button
          type="button"
          className="btn btn-outline btn-sm checkout-back-btn"
          onClick={onBack}
          disabled={isLoading}
          data-testid="back-to-info-btn"
        >
          ← Return to Information
        </button>
        <button
          type="submit"
          className="btn btn-primary btn-md checkout-submit-btn"
          disabled={isLoading}
          data-testid="continue-to-delivery-btn"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" />
              <span style={{ marginLeft: "var(--space-2)" }}>Saving Address...</span>
            </>
          ) : (
            "Continue to Delivery"
          )}
        </button>
      </div>
    </form>
  );
}
