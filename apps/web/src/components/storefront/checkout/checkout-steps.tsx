"use client";

import React from "react";

export type CheckoutStep = "information" | "shipping" | "delivery" | "payment";

export interface CheckoutStepsProps {
  currentStep: CheckoutStep;
  completedSteps?: CheckoutStep[];
  onStepClick?: (step: CheckoutStep) => void;
}

const STEPS: { id: CheckoutStep; label: string; number: number }[] = [
  { id: "information", label: "Information", number: 1 },
  { id: "shipping", label: "Shipping", number: 2 },
  { id: "delivery", label: "Delivery", number: 3 },
  { id: "payment", label: "Payment", number: 4 },
];

export function CheckoutSteps({
  currentStep,
  completedSteps = [],
  onStepClick,
}: CheckoutStepsProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav className="checkout-steps-nav" aria-label="Checkout Progress" data-testid="checkout-steps">
      <ol className="checkout-steps-list">
        {STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = completedSteps.includes(step.id) || index < currentIndex;
          const isClickable = Boolean(onStepClick && isCompleted && !isActive);

          return (
            <li
              key={step.id}
              className={`checkout-step-item ${isActive ? "checkout-step-item--active" : ""} ${
                isCompleted ? "checkout-step-item--completed" : ""
              }`}
              aria-current={isActive ? "step" : undefined}
              data-testid={`step-${step.id}`}
            >
              <div className="checkout-step-content">
                <span className="checkout-step-badge" aria-hidden="true">
                  {isCompleted ? "✓" : step.number}
                </span>
                {isClickable ? (
                  <button
                    type="button"
                    className="checkout-step-button"
                    onClick={() => onStepClick?.(step.id)}
                    data-testid={`step-btn-${step.id}`}
                  >
                    {step.label}
                  </button>
                ) : (
                  <span className="checkout-step-label">{step.label}</span>
                )}
              </div>
              {index < STEPS.length - 1 && (
                <span className="checkout-step-separator" aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
