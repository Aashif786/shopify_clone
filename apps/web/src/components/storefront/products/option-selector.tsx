"use client";

import React, { useId } from "react";
import type { ProductOptionDTO } from "@calcart/products";
import type { OptionValueState } from "../../../lib/storefront-variant-selection";

export interface OptionSelectorProps {
  option: ProductOptionDTO;
  /** Currently chosen value, or "" when the customer has not chosen yet. */
  value: string;
  onChange: (optionName: string, value: string) => void;
  /** Reliable state of a value given the other groups' choices. */
  getValueState?: (value: string) => OptionValueState;
  /** Highlights the group as still required. */
  isRequiredMissing?: boolean;
}

/**
 * One selector per option group (Size, Color, ...). Native radio inputs give arrow-key
 * navigation, Space/Enter selection and screen-reader semantics for free; the labels are the
 * visible pills with selected, focus-visible and disabled states. Nothing is preselected unless
 * `value` says so.
 */
export function OptionSelector({
  option,
  value,
  onChange,
  getValueState,
  isRequiredMissing = false,
}: OptionSelectorProps) {
  const groupId = useId();
  const hintId = `${groupId}-hint`;

  return (
    <fieldset
      className="space-y-2 border-0 p-0 m-0 min-w-0"
      data-testid={`quick-view-option-${option.name}`}
      aria-describedby={isRequiredMissing ? hintId : undefined}
    >
      <legend className="text-xs font-semibold text-foreground">
        {option.name}
        {value ? (
          <span className="ml-1.5 font-normal text-muted-foreground" data-testid="option-selected-value">
            {value}
          </span>
        ) : (
          <span id={hintId} className="ml-1.5 font-normal text-muted-foreground">
            Select {option.name}
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {option.values.map((val) => {
          const state = getValueState ? getValueState(val) : "available";
          const isSelected = value.trim().toLowerCase() === val.trim().toLowerCase();
          const inputId = `${groupId}-${val}`;
          return (
            <div key={val} className="relative">
              <input
                id={inputId}
                type="radio"
                name={`${groupId}-${option.name}`}
                value={val}
                checked={isSelected}
                disabled={state === "nonexistent"}
                onChange={() => onChange(option.name, val)}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={`inline-flex cursor-pointer items-center rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-40 peer-disabled:line-through ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${state === "out_of_stock" && !isSelected ? "line-through opacity-60" : ""} ${
                  isRequiredMissing && !isSelected ? "border-dashed" : ""
                }`}
                data-state={state}
              >
                {val}
                {state === "out_of_stock" && <span className="sr-only"> (out of stock)</span>}
                {state === "nonexistent" && <span className="sr-only"> (unavailable with current selection)</span>}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
