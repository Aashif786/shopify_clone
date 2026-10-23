"use client";

import React, { useState, type FormEvent } from "react";
import type { CheckoutAddressDTO } from "@shopify-clone/checkout";
import { validateShippingAddress } from "../../../lib/storefront-checkout-helpers";
import { Spinner } from "@shopify-clone/ui";
import { ArrowRight } from "lucide-react";

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
      className="checkout-form shipping-address-form rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm space-y-6"
      onSubmit={handleSubmit}
      noValidate
      data-testid="shipping-address-form"
    >
      <div className="checkout-form-header space-y-1">
        <h2 className="checkout-form-title text-xl font-extrabold tracking-tight text-foreground">
          Shipping Address
        </h2>
        <p className="checkout-form-subtitle text-muted text-sm text-muted-foreground">
          Enter the delivery address for your physical order.
        </p>
      </div>

      {errors.form && (
        <div className="alert alert--danger p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs" role="alert">
          {errors.form}
        </div>
      )}

      {/* Name row */}
      <div className="form-row form-row--2-col grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-group space-y-1.5">
          <label htmlFor="ship-first-name" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            First name <span className="text-danger text-destructive">*</span>
          </label>
          <input
            id="ship-first-name"
            name="firstName"
            type="text"
            autoComplete="given-name"
            className={`input ${errors.firstName ? "input--error border-destructive" : "border-border/80"} w-full px-3.5 py-2.5 rounded-xl bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
            value={address.firstName || ""}
            onChange={(e) => handleChange("firstName", e.target.value)}
            disabled={isLoading}
            data-testid="first-name-input"
          />
          {errors.firstName && <p className="form-error text-danger text-destructive text-xs">{errors.firstName}</p>}
        </div>

        <div className="form-group space-y-1.5">
          <label htmlFor="ship-last-name" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            Last name <span className="text-danger text-destructive">*</span>
          </label>
          <input
            id="ship-last-name"
            name="lastName"
            type="text"
            autoComplete="family-name"
            className={`input ${errors.lastName ? "input--error border-destructive" : "border-border/80"} w-full px-3.5 py-2.5 rounded-xl bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
            value={address.lastName || ""}
            onChange={(e) => handleChange("lastName", e.target.value)}
            disabled={isLoading}
            data-testid="last-name-input"
          />
          {errors.lastName && <p className="form-error text-danger text-destructive text-xs">{errors.lastName}</p>}
        </div>
      </div>

      {/* Street address lines */}
      <div className="form-group space-y-1.5">
        <label htmlFor="ship-address-line1" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          Street address <span className="text-danger text-destructive">*</span>
        </label>
        <input
          id="ship-address-line1"
          name="addressLine1"
          type="text"
          autoComplete="address-line1"
          placeholder="123 Main St, Apt 4B"
          className={`input ${errors.addressLine1 ? "input--error border-destructive" : "border-border/80"} w-full px-3.5 py-2.5 rounded-xl bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
          value={address.addressLine1 || ""}
          onChange={(e) => handleChange("addressLine1", e.target.value)}
          disabled={isLoading}
          data-testid="address-line1-input"
        />
        {errors.addressLine1 && <p className="form-error text-danger text-destructive text-xs">{errors.addressLine1}</p>}
      </div>

      <div className="form-group space-y-1.5">
        <label htmlFor="ship-address-line2" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          Apartment, suite, unit (optional)
        </label>
        <input
          id="ship-address-line2"
          name="addressLine2"
          type="text"
          autoComplete="address-line2"
          placeholder="Suite, unit, floor, etc."
          className="input w-full px-3.5 py-2.5 rounded-xl bg-background border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          value={address.addressLine2 || ""}
          onChange={(e) => handleChange("addressLine2", e.target.value)}
          disabled={isLoading}
          data-testid="address-line2-input"
        />
      </div>

      {/* City, State, Postal code row */}
      <div className="form-row form-row--3-col grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="form-group space-y-1.5">
          <label htmlFor="ship-city" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            City <span className="text-danger text-destructive">*</span>
          </label>
          <input
            id="ship-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            className={`input ${errors.city ? "input--error border-destructive" : "border-border/80"} w-full px-3.5 py-2.5 rounded-xl bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
            value={address.city || ""}
            onChange={(e) => handleChange("city", e.target.value)}
            disabled={isLoading}
            data-testid="city-input"
          />
          {errors.city && <p className="form-error text-danger text-destructive text-xs">{errors.city}</p>}
        </div>

        <div className="form-group space-y-1.5">
          <label htmlFor="ship-state" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            State / Province
          </label>
          <input
            id="ship-state"
            name="state"
            type="text"
            autoComplete="address-level1"
            className="input w-full px-3.5 py-2.5 rounded-xl bg-background border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            value={address.state || ""}
            onChange={(e) => handleChange("state", e.target.value)}
            disabled={isLoading}
            data-testid="state-input"
          />
        </div>

        <div className="form-group space-y-1.5">
          <label htmlFor="ship-postal-code" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            Postal code <span className="text-danger text-destructive">*</span>
          </label>
          <input
            id="ship-postal-code"
            name="postalCode"
            type="text"
            autoComplete="postal-code"
            className={`input ${errors.postalCode ? "input--error border-destructive" : "border-border/80"} w-full px-3.5 py-2.5 rounded-xl bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
            value={address.postalCode || ""}
            onChange={(e) => handleChange("postalCode", e.target.value)}
            disabled={isLoading}
            data-testid="postal-code-input"
          />
          {errors.postalCode && <p className="form-error text-danger text-destructive text-xs">{errors.postalCode}</p>}
        </div>
      </div>

      {/* Country & Phone row */}
      <div className="form-row form-row--2-col grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-group space-y-1.5">
          <label htmlFor="ship-country" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            Country <span className="text-danger text-destructive">*</span>
          </label>
          <select
            id="ship-country"
            name="country"
            className="select w-full px-3.5 py-2.5 rounded-xl bg-background border border-border/80 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            value={address.country || "US"}
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
          {errors.country && <p className="form-error text-danger text-destructive text-xs">{errors.country}</p>}
        </div>

        <div className="form-group space-y-1.5">
          <label htmlFor="ship-phone" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            Phone <span className="text-muted text-xs text-muted-foreground">(optional)</span>
          </label>
          <input
            id="ship-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="input w-full px-3.5 py-2.5 rounded-xl bg-background border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            value={address.phone || ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            disabled={isLoading}
            data-testid="phone-input"
          />
        </div>
      </div>

      <div className="checkout-actions-row flex items-center justify-between pt-4 border-t border-border/50">
        <button
          type="button"
          className="btn btn-outline btn-sm checkout-back-btn rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          onClick={onBack}
          disabled={isLoading}
          data-testid="back-to-info-btn"
        >
          <span>← Return to Information</span>
        </button>
        <button
          type="submit"
          className="btn btn-primary btn-md checkout-submit-btn rounded-xl px-6 py-2.5 text-xs font-bold shadow-md hover:shadow-primary/20 transition-all inline-flex items-center gap-2"
          disabled={isLoading}
          data-testid="continue-to-delivery-btn"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" />
              <span>Saving Address...</span>
            </>
          ) : (
            <>
              <span>Continue to Delivery</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
