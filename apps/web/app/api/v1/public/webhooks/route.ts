import { WebhookRepository } from "@calcart/db";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  validateBody,
} from "@/lib/api";
import {
  type Validator,
  type ValidationResult,
  type ValidationError,
  validationFailure,
  validationSuccess,
  validateWebhookUrlSyntax,
  validateWebhookUrl,
} from "@calcart/validation";
import { requireApiKey } from "@/lib/api/public-auth";
import { getDb } from "@/lib/db";
import { randomBytes } from "node:crypto";

const webhookRepo = new WebhookRepository();

interface CreateWebhookDto {
  name: string;
  url: string;
  eventTypes: string[];
}

const createWebhookValidator: Validator<CreateWebhookDto> = {
  validate(input: unknown): ValidationResult<CreateWebhookDto> {
    if (!input || typeof input !== "object") {
      return validationFailure([{ field: "body", message: "Expected JSON object" }]);
    }
    const val = input as Record<string, unknown>;
    const errors: ValidationError[] = [];
    if (!val.name || typeof val.name !== "string" || !val.name.trim()) {
      errors.push({ field: "name", message: "Name is required" });
    }
    if (!val.url || typeof val.url !== "string" || !val.url.trim()) {
      errors.push({ field: "url", message: "Valid URL is required" });
    } else {
      const syntax = validateWebhookUrlSyntax(val.url.trim());
      if (!syntax.valid) {
        errors.push({ field: "url", message: syntax.error || "Invalid webhook URL format" });
      }
    }
    if (!Array.isArray(val.eventTypes) || val.eventTypes.length === 0) {
      errors.push({ field: "eventTypes", message: "At least one event type is required" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      name: (val.name as string).trim(),
      url: (val.url as string).trim(),
      eventTypes: (val.eventTypes as unknown[]).map(String),
    });
  },
};

export async function GET(req: Request) {
  try {
    const { storeId } = await requireApiKey(req, "read:webhooks");
    const db = getDb();

    const subscriptions = await webhookRepo.findSubscriptionsByStore(db, storeId);
    return apiSuccess(subscriptions);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const { storeId } = await requireApiKey(req, "write:webhooks");
    const db = getDb();
    const body = await validateBody(req, createWebhookValidator);

    const ssrfCheck = await validateWebhookUrl(body.url);
    if (!ssrfCheck.valid) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", ssrfCheck.error || "Disallowed webhook URL", {
        fields: { url: ssrfCheck.error || "Disallowed webhook URL" },
      });
    }

    const secret = `whsec_${randomBytes(24).toString("hex")}`;

    const created = await webhookRepo.createSubscription(db, {
      storeId,
      name: body.name,
      url: body.url,
      secret,
      eventTypes: body.eventTypes,
      isActive: true,
    });

    return apiSuccess(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
