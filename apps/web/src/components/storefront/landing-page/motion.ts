import { createContext } from "react";
import type { MotionProps, TargetAndTransition, Transition, Variants } from "framer-motion";
import type {
  ElementAnimationConfig,
  SectionAnimationConfig,
} from "@calcart/stores/landing-page";

/**
 * Single source of truth for landing-page entrance motion.
 *
 * The Studio preview and the published storefront both render through
 * `SectionWrapper` / `ElementRenderer`, which both resolve their motion here, so
 * timing, easing, distance and viewport behavior cannot drift between the two.
 *
 * Most presets animate only `opacity` and `transform` (composite-only). The "focus" presets
 * (`blur-in`, `rise-blur`) also animate `filter`, and the "wipe" presets animate `clip-path`;
 * neither touches layout, so nothing reflows while they play.
 * Every reveal plays once per mount: re-renders never replay it, and the
 * wrappers remount (replay) only when the merchant edits the animation settings.
 */

export type Intensity = "subtle" | "medium" | "expressive";

export type RevealMotionProps = Pick<
  MotionProps,
  "initial" | "whileInView" | "viewport" | "transition" | "variants"
>;

/** Strong ease-out: fast start, long soft settle. */
export const LANDING_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SECTION_DURATION: Record<Intensity, number> = {
  subtle: 0.35,
  medium: 0.5,
  expressive: 0.65,
};
const SECTION_DISTANCE: Record<Intensity, number> = {
  subtle: 16,
  medium: 24,
  expressive: 36,
};
const STAGGER_STEP: Record<Intensity, number> = {
  subtle: 0.08,
  medium: 0.12,
  expressive: 0.2,
};

const SECTION_VIEWPORT = { once: true, margin: "-40px" } as const;
const ELEMENT_VIEWPORT = { once: true, margin: "-20px" } as const;

const DEFAULT_ELEMENT_DURATION = 0.4;
const MAX_ELEMENT_DURATION = 3;
const MAX_ELEMENT_DELAY = 5;

function finiteInRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isIntensity(value: unknown): value is Intensity {
  return value === "subtle" || value === "medium" || value === "expressive";
}

export function resolveIntensity(...candidates: unknown[]): Intensity {
  for (const candidate of candidates) {
    if (isIntensity(candidate)) return candidate;
  }
  return "medium";
}

/**
 * True when a parent section is running a "stagger" reveal. Elements without an
 * animation of their own join it as variant children so they cascade in order.
 */
export const StaggerRevealContext = createContext(false);

/** Which element id is selected in the Studio canvas (null on the live storefront). */
export const ElementSelectionContext = createContext<string | null>(null);

/** Soft-in, decisive-out curve used by the wipe reveals. */
const WIPE_EASE: [number, number, number, number] = [0.77, 0, 0.175, 1];
const PERSPECTIVE = 900;

interface EntranceSpec {
  initial: TargetAndTransition;
  visible: TargetAndTransition;
  /** Physical spring instead of a timed ease; `duration` is ignored. */
  spring?: boolean;
  ease?: Transition["ease"];
}

/**
 * Presets beyond the original five. Sections and elements share these, so a preset looks the
 * same on either; only `distance` differs (sections scale it with their intensity setting).
 */
function extraEntranceSpec(preset: string, distance: number): EntranceSpec | null {
  switch (preset) {
    case "fade-down":
      return { initial: { opacity: 0, y: -distance }, visible: { opacity: 1, y: 0 } };
    case "zoom-out":
      // Starts slightly oversized and settles onto the page.
      return { initial: { opacity: 0, scale: 1.08 }, visible: { opacity: 1, scale: 1 } };
    case "slide-right":
      return { initial: { opacity: 0, x: distance }, visible: { opacity: 1, x: 0 } };
    case "blur-in":
      return {
        initial: { opacity: 0, filter: "blur(12px)" },
        visible: { opacity: 1, filter: "blur(0px)" },
        ease: "easeOut",
      };
    case "rise-blur":
      return {
        initial: { opacity: 0, y: distance, filter: "blur(10px)" },
        visible: { opacity: 1, y: 0, filter: "blur(0px)" },
      };
    case "flip-up":
      return {
        initial: { opacity: 0, rotateX: -18, y: distance * 0.5, transformPerspective: PERSPECTIVE },
        visible: { opacity: 1, rotateX: 0, y: 0, transformPerspective: PERSPECTIVE },
      };
    case "rotate-in":
      return {
        initial: { opacity: 0, rotate: -6, scale: 0.92 },
        visible: { opacity: 1, rotate: 0, scale: 1 },
      };
    case "spring-pop":
      return { initial: { opacity: 0, scale: 0.82 }, visible: { opacity: 1, scale: 1 }, spring: true };
    case "wipe-up":
      // Reveals from the bottom edge upward.
      return {
        initial: { clipPath: "inset(100% 0% 0% 0%)" },
        visible: { clipPath: "inset(0% 0% 0% 0%)" },
        ease: WIPE_EASE,
      };
    case "wipe-right":
      // Reveals from the left edge to the right.
      return {
        initial: { clipPath: "inset(0% 100% 0% 0%)" },
        visible: { clipPath: "inset(0% 0% 0% 0%)" },
        ease: WIPE_EASE,
      };
    default:
      return null;
  }
}

function entranceTransition(spec: EntranceSpec, duration: number, delay: number): Transition {
  if (spec.spring) {
    return { type: "spring", stiffness: 260, damping: 20, mass: 0.9, delay };
  }
  return { duration, delay, ease: spec.ease ?? LANDING_EASE };
}

interface SectionMotionInput {
  preset: SectionAnimationConfig["preset"] | undefined;
  intensity: Intensity;
  enabled: boolean;
  reduced: boolean | null;
  hasElements: boolean;
  isPreview?: boolean;
}

export interface SectionMotion {
  props: RevealMotionProps;
  stagger: boolean;
}

export function getSectionMotion(input: SectionMotionInput): SectionMotion | null {
  const { preset, intensity, enabled, reduced, hasElements, isPreview = false } = input;
  if (reduced || !enabled || !preset || preset === "none") return null;

  const duration = SECTION_DURATION[intensity];
  const distance = SECTION_DISTANCE[intensity];
  const viewport = isPreview ? { once: false, margin: "0px" } : SECTION_VIEWPORT;

  switch (preset) {
    case "fade-up":
      return {
        stagger: false,
        props: {
          initial: { opacity: 0, y: distance },
          whileInView: { opacity: 1, y: 0 },
          viewport,
          transition: { duration, ease: LANDING_EASE },
        },
      };
    case "fade-in":
      return {
        stagger: false,
        props: {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport,
          transition: { duration, ease: "easeOut" },
        },
      };
    case "scale-in":
      return {
        stagger: false,
        props: {
          initial: { opacity: 0, scale: 0.96 },
          whileInView: { opacity: 1, scale: 1 },
          viewport,
          transition: { duration, ease: LANDING_EASE },
        },
      };
    case "slide":
    case "slide-left":
      return {
        stagger: false,
        props: {
          initial: { opacity: 0, x: -distance },
          whileInView: { opacity: 1, x: 0 },
          viewport,
          transition: { duration, ease: LANDING_EASE },
        },
      };
    case "stagger": {
      // Parent orchestrates; element children (see getElementMotion) carry the
      // visible movement. Legacy sections with no element tree have no variant
      // children, so the parent must reveal itself instead.
      const variants: Variants = hasElements
        ? {
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                duration: 0.25,
                ease: "easeOut",
                staggerChildren: STAGGER_STEP[intensity],
                delayChildren: 0.05,
              },
            },
          }
        : {
            hidden: { opacity: 0, y: distance * 0.75 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration, ease: LANDING_EASE },
            },
          };
      return {
        stagger: hasElements,
        props: {
          initial: "hidden",
          whileInView: "visible",
          viewport,
          variants,
        },
      };
    }
    default: {
      const spec = extraEntranceSpec(preset, distance);
      if (!spec) return null;
      return {
        stagger: false,
        props: {
          initial: spec.initial,
          whileInView: spec.visible,
          viewport,
          transition: entranceTransition(spec, duration, 0),
        },
      };
    }
  }
}

interface ElementMotionInput {
  animation: ElementAnimationConfig | undefined;
  enabled: boolean;
  reduced: boolean | null;
  /** A parent section is staggering and this element has no preset of its own. */
  joinStagger: boolean;
  intensity: Intensity;
  isPreview?: boolean;
}

export function getElementMotion(input: ElementMotionInput): RevealMotionProps | null {
  const { animation, enabled, reduced, joinStagger, intensity, isPreview = false } = input;
  if (reduced || !enabled) return null;

  const viewport = isPreview ? { once: false, margin: "0px" } : ELEMENT_VIEWPORT;

  const preset = animation?.preset ?? "none";

  if (preset === "none") {
    if (!joinStagger) return null;
    const distance = SECTION_DISTANCE[intensity] * 0.6;
    return {
      variants: {
        hidden: { opacity: 0, y: distance },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: SECTION_DURATION[intensity], ease: LANDING_EASE },
        },
      },
    };
  }

  const duration = finiteInRange(
    animation?.duration,
    0.05,
    MAX_ELEMENT_DURATION,
    DEFAULT_ELEMENT_DURATION,
  );
  const delay = finiteInRange(animation?.delay, 0, MAX_ELEMENT_DELAY, 0);
  const transition = { duration, delay, ease: LANDING_EASE };

  switch (preset) {
    case "fade-up":
      return {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport,
        transition,
      };
    case "fade-in":
      return {
        initial: { opacity: 0 },
        whileInView: { opacity: 1 },
        viewport,
        transition: { duration, delay, ease: "easeOut" },
      };
    case "scale-in":
      return {
        initial: { opacity: 0, scale: 0.95 },
        whileInView: { opacity: 1, scale: 1 },
        viewport,
        transition,
      };
    case "slide":
    case "slide-left":
      return {
        initial: { opacity: 0, x: -20 },
        whileInView: { opacity: 1, x: 0 },
        viewport,
        transition,
      };
    case "slide-right":
      return {
        initial: { opacity: 0, x: 20 },
        whileInView: { opacity: 1, x: 0 },
        viewport,
        transition,
      };
    default: {
      const spec = extraEntranceSpec(preset, 20);
      if (!spec) return null;
      return {
        initial: spec.initial,
        whileInView: spec.visible,
        viewport,
        transition: entranceTransition(spec, duration, delay),
      };
    }
  }
}
