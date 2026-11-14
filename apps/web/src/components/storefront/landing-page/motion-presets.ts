import type { SharedEntrancePreset } from "@calcart/stores/landing-page";

/**
 * Entrance presets offered by the Landing Page Studio, for sections and elements alike.
 * The motion for each id lives in `motion.ts`; automated regression tests ensure that
 * every preset selectable here animates smoothly and without layout shifts on the storefront.
 */
export interface EntrancePresetOption {
  value: SharedEntrancePreset;
  label: string;
  category: string;
  description: string;
  tags?: string[];
}

export interface EntrancePresetGroup {
  label: string;
  category: string;
  options: EntrancePresetOption[];
}

export const ENTRANCE_PRESET_GROUPS: EntrancePresetGroup[] = [
  {
    label: "Fade & Dissolve",
    category: "fade",
    options: [
      {
        value: "fade-up",
        label: "Fade Up (Smooth Rise)",
        category: "fade",
        description: "Fades in while gently ascending from bottom",
        tags: ["subtle", "clean", "rise", "classic", "modern"],
      },
      {
        value: "fade-down",
        label: "Fade Down (Gentle Drop)",
        category: "fade",
        description: "Fades in while descending from top",
        tags: ["subtle", "drop", "header", "soft"],
      },
      {
        value: "fade-in",
        label: "Fade In (Pure Dissolve)",
        category: "fade",
        description: "Pure opacity transition with no positional movement",
        tags: ["dissolve", "still", "minimal", "universal"],
      },
      {
        value: "fade-left",
        label: "Fade Left (From Right)",
        category: "fade",
        description: "Fades in while gliding from right to left",
        tags: ["slide", "directional", "horizontal"],
      },
      {
        value: "fade-right",
        label: "Fade Right (From Left)",
        category: "fade",
        description: "Fades in while gliding from left to right",
        tags: ["slide", "directional", "horizontal"],
      },
    ],
  },
  {
    label: "Directional Slide",
    category: "slide",
    options: [
      {
        value: "slide-left",
        label: "Slide From Left",
        category: "slide",
        description: "Smooth horizontal entrance moving from left",
        tags: ["slide", "lateral", "nav", "asymmetric"],
      },
      {
        value: "slide-right",
        label: "Slide From Right",
        category: "slide",
        description: "Smooth horizontal entrance moving from right",
        tags: ["slide", "lateral", "panel"],
      },
      {
        value: "slide-top",
        label: "Slide From Top",
        category: "slide",
        description: "Vertical downward slide entrance",
        tags: ["slide", "vertical", "header", "banner"],
      },
      {
        value: "slide-bottom",
        label: "Slide From Bottom",
        category: "slide",
        description: "Vertical upward slide entrance",
        tags: ["slide", "vertical", "bottom", "rise"],
      },
    ],
  },
  {
    label: "Zoom & Pop",
    category: "zoom",
    options: [
      {
        value: "pop-in",
        label: "Pop In (Spring Scale)",
        category: "zoom",
        description: "Snappy physical spring scale-up",
        tags: ["spring", "scale", "button", "badge", "snappy"],
      },
      {
        value: "pop-out",
        label: "Pop Out (Oversize Settle)",
        category: "zoom",
        description: "Starts slightly oversized and pops down to scale",
        tags: ["spring", "oversize", "impact", "modal"],
      },
      {
        value: "scale-in",
        label: "Scale In (Zoom Reveal)",
        category: "zoom",
        description: "Subtle zoom from 95% scale to full size",
        tags: ["zoom", "smooth", "card", "image"],
      },
      {
        value: "zoom-in",
        label: "Zoom In (Dramatic Rise)",
        category: "zoom",
        description: "Deeper zoom reveal from 88% scale",
        tags: ["zoom", "hero", "prominent"],
      },
      {
        value: "zoom-out",
        label: "Settle In (Zoom Out)",
        category: "zoom",
        description: "Starts slightly oversized and gently settles onto the page",
        tags: ["zoom", "settle", "luxury", "smooth"],
      },
      {
        value: "spring-pop",
        label: "Spring Pop (Lively Bounce)",
        category: "zoom",
        description: "Energetic natural spring physics entrance",
        tags: ["spring", "bounce", "cta", "playful"],
      },
    ],
  },
  {
    label: "Flip & Rotate",
    category: "rotate",
    options: [
      {
        value: "flip-up",
        label: "Tilt Up (3D Flip)",
        category: "rotate",
        description: "3D tilt upward with true perspective",
        tags: ["3d", "tilt", "perspective", "card"],
      },
      {
        value: "flip-down",
        label: "Tilt Down (3D Reverse)",
        category: "rotate",
        description: "3D tilt downward with perspective",
        tags: ["3d", "tilt", "perspective"],
      },
      {
        value: "flip-left",
        label: "Flip Left (3D Turn)",
        category: "rotate",
        description: "Horizontal 3D rotation from left",
        tags: ["3d", "flip", "door", "perspective"],
      },
      {
        value: "flip-right",
        label: "Flip Right (3D Turn)",
        category: "rotate",
        description: "Horizontal 3D rotation from right",
        tags: ["3d", "flip", "door", "perspective"],
      },
      {
        value: "rotate-in",
        label: "Twirl In (Clockwise)",
        category: "rotate",
        description: "Soft rotational entrance turning clockwise",
        tags: ["rotation", "twirl", "badge", "icon"],
      },
      {
        value: "rotate-in-ccw",
        label: "Reverse Twirl (Counter-Clockwise)",
        category: "rotate",
        description: "Soft rotational entrance turning counter-clockwise",
        tags: ["rotation", "twirl", "icon"],
      },
      {
        value: "swing",
        label: "Pendulum Swing",
        category: "rotate",
        description: "Tactile top-hinged swing settling into place",
        tags: ["swing", "pendulum", "tactile", "hanging"],
      },
    ],
  },
  {
    label: "Bounce & Dynamic",
    category: "dynamic",
    options: [
      {
        value: "bounce",
        label: "Bounce In (Physical Overshoot)",
        category: "dynamic",
        description: "Dynamic landing with natural spring bounce",
        tags: ["bounce", "impact", "overshoot", "lively"],
      },
      {
        value: "elastic",
        label: "Elastic (High Spring)",
        category: "dynamic",
        description: "Stretchy elastic spring entrance with rebound",
        tags: ["elastic", "spring", "rubber", "expressive"],
      },
      {
        value: "float",
        label: "Float Up (Airy Drift)",
        category: "dynamic",
        description: "Weightless buoyant rise with long deceleration",
        tags: ["float", "airy", "ethereal", "luxury"],
      },
    ],
  },
  {
    label: "Focus & Blur",
    category: "focus",
    options: [
      {
        value: "blur-in",
        label: "Soft Focus (Blur to Sharp)",
        category: "focus",
        description: "Defocus fade revealing crisp typography",
        tags: ["blur", "focus", "modern", "cinematic", "lens"],
      },
      {
        value: "rise-blur",
        label: "Rise & Focus (Float Up)",
        category: "focus",
        description: "Combines upward movement with focus sharpen",
        tags: ["blur", "rise", "cinematic", "headline"],
      },
      {
        value: "blur-slide-up",
        label: "Blur Slide Up (Cinematic)",
        category: "focus",
        description: "Deeper cinematic motion blur rise",
        tags: ["blur", "slide", "cinematic", "hero"],
      },
    ],
  },
  {
    label: "Curtain & Reveal",
    category: "reveal",
    options: [
      {
        value: "wipe-up",
        label: "Curtain Up (Wipe Up)",
        category: "reveal",
        description: "Sharp clip-path reveal sweeping upward",
        tags: ["wipe", "curtain", "clip-path", "clean"],
      },
      {
        value: "wipe-down",
        label: "Curtain Down (Wipe Down)",
        category: "reveal",
        description: "Sharp clip-path reveal sweeping downward",
        tags: ["wipe", "curtain", "clip-path"],
      },
      {
        value: "wipe-left",
        label: "Wipe Left (Right to Left)",
        category: "reveal",
        description: "Horizontal wipe reveal moving leftward",
        tags: ["wipe", "clip-path", "lateral"],
      },
      {
        value: "wipe-right",
        label: "Wipe Across (Left to Right)",
        category: "reveal",
        description: "Horizontal wipe reveal moving rightward",
        tags: ["wipe", "clip-path", "curtain", "lateral"],
      },
      {
        value: "typewriter",
        label: "Typewriter Reveal",
        category: "reveal",
        description: "Stepped text reveal effect reminiscent of typesetting",
        tags: ["typewriter", "text", "reveal", "editorial", "retro"],
      },
    ],
  },
];

/** Every preset id the editor offers, in display order. */
export const ENTRANCE_PRESET_VALUES: SharedEntrancePreset[] = ENTRANCE_PRESET_GROUPS.flatMap((group) =>
  group.options.map((option) => option.value),
);

/** Map for quick lookup of preset metadata by id */
export const ENTRANCE_PRESET_MAP: Record<string, EntrancePresetOption> = Object.fromEntries(
  ENTRANCE_PRESET_GROUPS.flatMap((g) => g.options.map((o) => [o.value, o])),
);
