"use client";

import React from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

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
    <nav className="checkout-steps-nav w-full pb-4 pt-0" aria-label="Checkout Progress" data-testid="checkout-steps">
      <ol className="checkout-steps-list flex items-center justify-between list-none p-0 m-0">
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
                  className={`checkout-step-badge w-6 h-6 border flex items-center justify-center at-num text-[11px] transition-colors duration-200 ${
                    isCompleted
                      ? "bg-foreground text-background border-foreground"
                      : isActive
                      ? "border-foreground text-foreground"
                      : "border-[color:var(--at-hairline)] text-muted-foreground"
                  }`}
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    <>
                      <Check size={12} strokeWidth={2} />
                      <span className="sr-only">✓</span>
                    </>
                  ) : (
                    step.number
                  )}
                </span>

                {isClickable ? (
                  <button
                    type="button"
                    className="checkout-step-button hidden sm:inline text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => onStepClick?.(step.id)}
                    data-testid={`step-btn-${step.id}`}
                  >
                    {step.label}
                  </button>
                ) : (
                  <span
                    className={`checkout-step-label text-xs font-semibold ${
                      isActive ? "text-foreground font-bold" : "hidden sm:inline text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                )}
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className="checkout-step-separator flex-1 h-px mx-2 sm:mx-3 bg-[color:var(--at-hairline)] overflow-hidden"
                  aria-hidden="true"
                >
                  <motion.div
                    className="h-full w-full origin-left bg-primary"
                    initial={false}
                    animate={{ scaleX: isCompleted ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
