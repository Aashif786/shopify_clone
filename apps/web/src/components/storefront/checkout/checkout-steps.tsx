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
    <nav className="checkout-steps-nav w-full py-4" aria-label="Checkout Progress" data-testid="checkout-steps">
      <ol className="checkout-steps-list flex items-center justify-between max-w-2xl mx-auto list-none p-0 m-0">
        {STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = completedSteps.includes(step.id) || index < currentIndex;
          const isClickable = Boolean(onStepClick && isCompleted && !isActive);

          return (
            <li
              key={step.id}
              className={`checkout-step-item flex-1 flex items-center ${
                isActive ? "checkout-step-item--active" : ""
              } ${isCompleted ? "checkout-step-item--completed" : ""}`}
              aria-current={isActive ? "step" : undefined}
              data-testid={`step-${step.id}`}
            >
              <div className="checkout-step-content flex items-center gap-2">
                <span
                  className={`checkout-step-badge w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-md"
                      : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden="true"
                >
                  {isCompleted ? "✓" : step.number}
                </span>

                {isClickable ? (
                  <button
                    type="button"
                    className="checkout-step-button text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    onClick={() => onStepClick?.(step.id)}
                    data-testid={`step-btn-${step.id}`}
                  >
                    {step.label}
                  </button>
                ) : (
                  <span
                    className={`checkout-step-label text-xs font-semibold ${
                      isActive ? "text-foreground font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                )}
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`checkout-step-separator flex-1 h-0.5 mx-3 rounded-full transition-colors ${
                    isCompleted ? "bg-primary" : "bg-border/60"
                  }`}
                  aria-hidden="true"
                >
                  <span className="sr-only">›</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
