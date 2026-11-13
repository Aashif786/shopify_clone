import type { SharedEntrancePreset } from "@calcart/stores/landing-page";

/**
 * Entrance presets offered by the Landing Page editor, for sections and elements alike.
 * The motion for each id lives in `motion.ts`; a test keeps the two in step, so a preset can
 * never be selectable here without animating on the storefront.
 */
export interface EntrancePresetOption {
  value: SharedEntrancePreset;
  label: string;
}

export interface EntrancePresetGroup {
  label: string;
  options: EntrancePresetOption[];
}

export const ENTRANCE_PRESET_GROUPS: EntrancePresetGroup[] = [
  {
    label: "Fade",
    options: [
      { value: "fade-up", label: "Fade Up (Smooth Rise)" },
      { value: "fade-down", label: "Fade Down (Gentle Drop)" },
      { value: "fade-in", label: "Fade In (Gentle Dissolve)" },
    ],
  },
  {
    label: "Slide",
    options: [
      { value: "slide", label: "Slide In (From Left)" },
      { value: "slide-right", label: "Slide In (From Right)" },
    ],
  },
  {
    label: "Zoom & Spring",
    options: [
      { value: "scale-in", label: "Scale In (Zoom Reveal)" },
      { value: "zoom-out", label: "Settle In (Zoom Out)" },
      { value: "spring-pop", label: "Spring Pop (Lively Bounce)" },
      { value: "rotate-in", label: "Twirl In (Soft Rotate)" },
    ],
  },
  {
    label: "Focus & Depth",
    options: [
      { value: "blur-in", label: "Soft Focus (Blur to Sharp)" },
      { value: "rise-blur", label: "Rise & Focus (Float Up)" },
      { value: "flip-up", label: "Tilt Up (3D Flip)" },
    ],
  },
  {
    label: "Reveal",
    options: [
      { value: "wipe-up", label: "Curtain Up (Wipe Reveal)" },
      { value: "wipe-right", label: "Wipe Across (Left to Right)" },
    ],
  },
];

/** Every preset id the editor offers, in display order. */
export const ENTRANCE_PRESET_VALUES: SharedEntrancePreset[] = ENTRANCE_PRESET_GROUPS.flatMap((group) =>
  group.options.map((option) => option.value),
);
