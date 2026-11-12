"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion, type Transition } from "framer-motion";

/**
 * Shared storefront motion conventions (composite-only: opacity + transform).
 * - Interactions: 150-300ms, strong ease-out.
 * - Springs are reserved for physical movement (drawers, count badges).
 * - `reducedMotion="user"` makes every framer-motion transform in the storefront
 *   respect `prefers-reduced-motion` (opacity changes still apply).
 */
export const STOREFRONT_EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

export const STOREFRONT_TRANSITION = {
  fast: { duration: 0.15, ease: STOREFRONT_EASE } satisfies Transition,
  base: { duration: 0.22, ease: STOREFRONT_EASE } satisfies Transition,
  slow: { duration: 0.3, ease: STOREFRONT_EASE } satisfies Transition,
  spring: { type: "spring", stiffness: 420, damping: 32, mass: 0.8 } satisfies Transition,
} as const;

export function StorefrontMotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds; keep small so content never feels delayed. */
  delay?: number;
  /** Vertical travel in px. */
  y?: number;
}

/** Scroll-triggered fade/translate reveal that plays once. */
export function Reveal({ children, className, delay = 0, y = 12 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ ...STOREFRONT_TRANSITION.slow, delay }}
    >
      {children}
    </motion.div>
  );
}
