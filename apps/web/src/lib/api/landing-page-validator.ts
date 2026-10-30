import type {
  ValidationError,
  ValidationResult,
  Validator,
} from "@calcart/validation";
import {
  validationFailure,
  validationSuccess,
} from "@calcart/validation";
import type {
  ColorPresetId,
  SectionType,
  StorefrontLandingPageConfig,
} from "@calcart/stores";

const VALID_SECTION_TYPES: Set<SectionType> = new Set([
  "hero",
  "featured_products",
  "product_carousel",
  "collection_showcase",
  "promotional_banner",
  "editorial",
  "asymmetric_showcase",
  "brand_story",
  "testimonials",
  "newsletter",
  "spacer_divider",
  "custom_container",
]);

const VALID_PRESETS: Set<ColorPresetId> = new Set([
  "modern-minimalist",
  "bold-vibrant",
  "editorial-luxury",
  "high-tech",
  "monochromatic",
]);

export interface SaveLandingPageDraftInput {
  draftConfig: StorefrontLandingPageConfig;
}

export class LandingPageDraftValidator implements Validator<SaveLandingPageDraftInput> {
  validate(input: unknown): ValidationResult<SaveLandingPageDraftInput> {
    const errors: ValidationError[] = [];

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }

    const obj = input as Record<string, unknown>;
    const draftConfig = obj.draftConfig;

    if (!draftConfig || typeof draftConfig !== "object" || Array.isArray(draftConfig)) {
      errors.push({ field: "draftConfig", message: "draftConfig must be an object" });
      return validationFailure(errors);
    }

    const config = draftConfig as Record<string, unknown>;

    // 1. Theme validation
    if (!config.theme || typeof config.theme !== "object") {
      errors.push({ field: "draftConfig.theme", message: "Theme configuration is required" });
    } else {
      const theme = config.theme as Record<string, unknown>;
      if (!theme.presetId || typeof theme.presetId !== "string" || !VALID_PRESETS.has(theme.presetId as ColorPresetId)) {
        errors.push({ field: "draftConfig.theme.presetId", message: "Invalid or missing color preset ID" });
      }
      if (!theme.colors || typeof theme.colors !== "object") {
        errors.push({ field: "draftConfig.theme.colors", message: "Theme colors object is required" });
      }
    }

    // 2. Sections validation
    if (!Array.isArray(config.sections)) {
      errors.push({ field: "draftConfig.sections", message: "Sections must be an array" });
    } else {
      config.sections.forEach((sec, idx) => {
        if (!sec || typeof sec !== "object") {
          errors.push({ field: `draftConfig.sections[${idx}]`, message: "Section must be an object" });
          return;
        }
        const s = sec as Record<string, unknown>;
        if (!s.id || typeof s.id !== "string") {
          errors.push({ field: `draftConfig.sections[${idx}].id`, message: "Section id is required" });
        }
        if (!s.type || typeof s.type !== "string" || !VALID_SECTION_TYPES.has(s.type as SectionType)) {
          errors.push({ field: `draftConfig.sections[${idx}].type`, message: `Invalid section type: ${s.type}` });
        }
        if (typeof s.isVisible !== "boolean") {
          errors.push({ field: `draftConfig.sections[${idx}].isVisible`, message: "Section isVisible must be boolean" });
        }
        if (!s.config || typeof s.config !== "object") {
          errors.push({ field: `draftConfig.sections[${idx}].config`, message: "Section config must be an object" });
        }
        if (s.elements !== undefined && !Array.isArray(s.elements)) {
          errors.push({ field: `draftConfig.sections[${idx}].elements`, message: "Section elements must be an array" });
        }
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      draftConfig: draftConfig as StorefrontLandingPageConfig,
    });
  }
}

export const landingPageDraftValidator = new LandingPageDraftValidator();
