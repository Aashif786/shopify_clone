import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "./db";
import {
  PlatformAuthService,
  PLATFORM_ADMIN_SESSION_COOKIE,
  type AuthenticatedPlatformAdmin,
  type PlatformPermission,
  hasPlatformPermission,
} from "@calcart/platform-admin";

export class PlatformAuthError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "ACCOUNT_LOCKED" = "UNAUTHENTICATED",
    public readonly status: number = 401
  ) {
    super(message);
    this.name = "PlatformAuthError";
  }
}

export function getPlatformAuthService(): PlatformAuthService {
  return new PlatformAuthService(getDb());
}

export async function getPlatformAdminSession(): Promise<AuthenticatedPlatformAdmin | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(PLATFORM_ADMIN_SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return null;
  }

  const authService = getPlatformAuthService();
  return authService.validateSessionToken(sessionCookie.value);
}

export async function requirePlatformAdmin(
  requiredPermission?: PlatformPermission
): Promise<AuthenticatedPlatformAdmin> {
  const admin = await getPlatformAdminSession();

  if (!admin) {
    throw new PlatformAuthError("Authentication required for platform administration", "UNAUTHENTICATED", 401);
  }

  if (requiredPermission && !hasPlatformPermission(admin.role, requiredPermission)) {
    throw new PlatformAuthError(
      `Forbidden: Administrator role '${admin.role}' lacks permission '${requiredPermission}'`,
      "FORBIDDEN",
      403
    );
  }

  return admin;
}

export function formatAuthErrorResponse(error: unknown): NextResponse {
  if (error instanceof PlatformAuthError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "An unexpected platform administration error occurred",
      },
    },
    { status: 500 }
  );
}
