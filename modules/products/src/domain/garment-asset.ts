import { ProductDomainError } from "./errors.js";

export const GARMENT_SLOTS = ["top", "bottom", "outerwear", "dress"] as const;
export type GarmentSlot = (typeof GARMENT_SLOTS)[number];

export function isGarmentSlot(value: unknown): value is GarmentSlot {
  return typeof value === "string" && (GARMENT_SLOTS as readonly string[]).includes(value);
}

/**
 * The body the garment model was authored/fitted on. Fit Check scales the garment
 * by the ratio of the customer's avatar to this reference body.
 */
export interface GarmentReferenceBody {
  heightCm: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
}

export const GARMENT_REFERENCE_RANGES: Record<
  keyof GarmentReferenceBody,
  { min: number; max: number; label: string }
> = {
  heightCm: { min: 100, max: 250, label: "Reference height" },
  chestCm: { min: 50, max: 200, label: "Reference chest" },
  waistCm: { min: 40, max: 200, label: "Reference waist" },
  hipCm: { min: 50, max: 220, label: "Reference hip" },
};

export type GarmentSource = "glb" | "generated";

/** Cuts the renderer can generate for a customer's avatar. */
export const GARMENT_TEMPLATES = ["tshirt", "longsleeve", "jacket", "trousers", "shorts"] as const;
export type GarmentTemplate = (typeof GARMENT_TEMPLATES)[number];

export const GARMENT_FITS = ["slim", "regular", "loose"] as const;
export type GarmentFit = (typeof GARMENT_FITS)[number];

export function isGarmentTemplate(value: unknown): value is GarmentTemplate {
  return typeof value === "string" && (GARMENT_TEMPLATES as readonly string[]).includes(value);
}

export function isGarmentFit(value: unknown): value is GarmentFit {
  return typeof value === "string" && (GARMENT_FITS as readonly string[]).includes(value);
}

export function slotForTemplate(template: GarmentTemplate): GarmentSlot {
  if (template === "jacket") return "outerwear";
  if (template === "trousers" || template === "shorts") return "bottom";
  return "top";
}

export interface GarmentAsset {
  id: string;
  storeId: string;
  productId: string;
  /** null = applies to the whole product (used when a variant has no asset of its own). */
  variantId: string | null;
  source: GarmentSource;
  slot: GarmentSlot;
  /** GLB assets only. */
  fileName: string | null;
  originalName: string | null;
  fileSize: number | null;
  sha256: string | null;
  reference: GarmentReferenceBody | null;
  /** Generated assets only. */
  template: GarmentTemplate | null;
  fit: GarmentFit | null;
  /** Photo chosen by the merchant; resolved URL falls back to the product's first image. */
  textureMediaId: string | null;
  textureUrl: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GarmentAssetDTO {
  id: string;
  productId: string;
  variantId: string | null;
  source: GarmentSource;
  slot: GarmentSlot;
  originalName: string | null;
  fileSize: number | null;
  reference: GarmentReferenceBody | null;
  template: GarmentTemplate | null;
  fit: GarmentFit | null;
  textureMediaId: string | null;
  textureUrl: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveGarmentAssetInput {
  variantId?: string | null;
  slot: GarmentSlot;
  fileName: string;
  originalName: string;
  fileSize: number;
  sha256: string;
  reference: GarmentReferenceBody;
}

export interface SaveGeneratedGarmentInput {
  variantId?: string | null;
  template: GarmentTemplate;
  fit: GarmentFit;
  /** One of the product's own images. Omit to use the product's first image. */
  textureMediaId?: string | null;
}

export class InvalidGarmentAssetError extends ProductDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_GARMENT_ASSET", 400, details);
  }
}

export class GarmentAssetNotFoundError extends ProductDomainError {
  constructor() {
    super("Garment asset not found", "GARMENT_ASSET_NOT_FOUND", 404);
  }
}

export function assertValidGarmentReference(ref: GarmentReferenceBody): void {
  const fields: Record<string, string> = {};
  for (const key of Object.keys(GARMENT_REFERENCE_RANGES) as Array<keyof GarmentReferenceBody>) {
    const { min, max, label } = GARMENT_REFERENCE_RANGES[key];
    const v = ref[key];
    if (typeof v !== "number" || !Number.isFinite(v)) fields[key] = `${label} must be a number`;
    else if (v < min || v > max) fields[key] = `${label} must be between ${min} and ${max}`;
  }
  if (Object.keys(fields).length > 0) {
    throw new InvalidGarmentAssetError("Invalid garment reference body", { fields });
  }
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;

export interface GlbInfo {
  meshCount: number;
  nodeCount: number;
}

/**
 * Structural validation of a binary glTF 2.0 file. Garments must be self-contained:
 * external URIs are rejected so a model can never make the viewer fetch third-party
 * resources. This checks structure and safety, not visual fit quality.
 */
export function inspectGlb(buffer: Uint8Array): GlbInfo {
  const fail = (message: string): never => {
    throw new InvalidGarmentAssetError(message, { fields: { file: message } });
  };
  if (buffer.byteLength < 28) return fail("The file is too small to be a GLB model.");
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return fail("The file is not a binary glTF (.glb) model.");
  if (view.getUint32(4, true) !== 2) return fail("Only glTF 2.0 models are supported.");
  if (view.getUint32(8, true) !== buffer.byteLength) return fail("The GLB header length is inconsistent.");

  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON || 20 + jsonLength > buffer.byteLength) {
    return fail("The GLB file is missing its JSON chunk.");
  }

  let json: {
    meshes?: unknown[];
    nodes?: unknown[];
    buffers?: Array<{ uri?: string }>;
    images?: Array<{ uri?: string }>;
  };
  try {
    json = JSON.parse(new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)));
  } catch {
    return fail("The GLB JSON chunk could not be parsed.");
  }

  for (const ref of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (typeof ref.uri === "string" && !ref.uri.startsWith("data:")) {
      return fail("The model references external files. Embed all buffers and textures in the GLB.");
    }
  }
  const meshCount = json.meshes?.length ?? 0;
  if (meshCount === 0) return fail("The model contains no meshes.");
  return { meshCount, nodeCount: json.nodes?.length ?? 0 };
}
