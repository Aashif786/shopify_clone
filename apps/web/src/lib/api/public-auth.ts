import { ApiKeyService, type VerifiedApiKeyContext } from "@calcart/auth";
import { getDb } from "../db";
import { ApiHttpError } from "./errors";

export interface PublicRequestContext {
  readonly req: Request;
  readonly apiKey: VerifiedApiKeyContext;
  readonly storeId: string;
}

const apiKeyService = new ApiKeyService();

/**
 * Extracts and verifies the bearer API key or X-CalCart-API-Key header.
 * Enforces scope requirement and returns the validated store and API key context.
 */
export async function requireApiKey(
  req: Request,
  requiredScope?: string,
): Promise<PublicRequestContext> {
  let token: string | null = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    token = req.headers.get("x-calcart-api-key")?.trim() || null;
  }

  if (!token) {
    throw new ApiHttpError(
      401,
      "UNAUTHORIZED",
      "API key required. Provide via 'Authorization: Bearer <key>' or 'X-CalCart-API-Key' header.",
    );
  }

  const db = getDb();
  const verified = await apiKeyService.verifyApiKey(db, token, requiredScope);

  if (!verified) {
    throw new ApiHttpError(
      401,
      "INVALID_API_KEY",
      "Invalid, expired, revoked, or insufficient-scope API key.",
    );
  }

  return {
    req,
    apiKey: verified,
    storeId: verified.storeId,
  };
}
