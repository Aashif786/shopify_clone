import { InventoryService, type AdjustmentReason } from "@calcart/inventory";
import {
  apiSuccess,
  handleApiError,
  validateBody,
  validateUuid,
} from "@/lib/api";
import {
  type Validator,
  type ValidationResult,
  type ValidationError,
  validationFailure,
  validationSuccess,
} from "@calcart/validation";
import { requireApiKey } from "@/lib/api/public-auth";
import { getDb } from "@/lib/db";

const inventoryService = new InventoryService();

const VALID_REASONS: AdjustmentReason[] = [
  "INITIAL_STOCK",
  "RESTOCK",
  "MANUAL_CORRECTION",
  "DAMAGED",
  "LOST",
  "RETURNED",
  "OTHER",
];

interface PublicAdjustInventoryDto {
  variantId: string;
  quantityDelta: number;
  reason?: AdjustmentReason;
  referenceType?: string | null;
  referenceId?: string | null;
}

const publicAdjustInventoryValidator: Validator<PublicAdjustInventoryDto> = {
  validate(input: unknown): ValidationResult<PublicAdjustInventoryDto> {
    if (!input || typeof input !== "object") {
      return validationFailure([{ field: "body", message: "Expected JSON object" }]);
    }
    const val = input as Record<string, unknown>;
    const errors: ValidationError[] = [];
    if (!val.variantId || typeof val.variantId !== "string" || !val.variantId.trim()) {
      errors.push({ field: "variantId", message: "variantId is required" });
    }
    if (typeof val.quantityDelta !== "number" || !Number.isInteger(val.quantityDelta) || val.quantityDelta === 0) {
      errors.push({ field: "quantityDelta", message: "quantityDelta must be a non-zero integer" });
    }

    let reason: AdjustmentReason = "MANUAL_CORRECTION";
    if (val.reason) {
      if (typeof val.reason === "string" && VALID_REASONS.includes(val.reason as AdjustmentReason)) {
        reason = val.reason as AdjustmentReason;
      } else {
        errors.push({
          field: "reason",
          message: `reason must be one of: ${VALID_REASONS.join(", ")}`,
        });
      }
    }

    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      variantId: (val.variantId as string).trim(),
      quantityDelta: val.quantityDelta as number,
      reason,
      referenceType: typeof val.referenceType === "string" ? val.referenceType : null,
      referenceId: typeof val.referenceId === "string" ? val.referenceId : null,
    });
  },
};

export async function POST(req: Request) {
  try {
    const { storeId, apiKey } = await requireApiKey(req, "write:inventory");
    const db = getDb();
    const body = await validateBody(req, publicAdjustInventoryValidator);

    validateUuid(body.variantId, "variantId");

    const result = await inventoryService.adjustStock(
      db,
      storeId,
      body.variantId,
      {
        quantityDelta: body.quantityDelta,
        reason: body.reason ?? "MANUAL_CORRECTION",
        referenceType: body.referenceType ?? "public_api",
        referenceId: body.referenceId ?? `api_key:${apiKey.keyId}`,
        createdBy: apiKey.keyId,
      },
    );

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
