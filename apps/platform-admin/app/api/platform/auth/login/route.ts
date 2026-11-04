import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import {
  PlatformAuthService,
  PLATFORM_ADMIN_SESSION_COOKIE,
  AccountLockedError,
  InvalidCredentialsError,
  InsufficientPlatformPrivilegesError,
  PlatformAuthError,
} from "@calcart/platform-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, mfaCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Email and password are required." } },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
    const userAgent = req.headers.get("user-agent");

    const authService = new PlatformAuthService(getDb());
    const { sessionToken, admin } = await authService.login({
      email,
      password,
      mfaCode,
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json({
      data: {
        admin: {
          id: admin.userId,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          permissions: admin.permissions,
        },
      },
    });

    // Set secure platform admin session cookie
    response.cookies.set({
      name: PLATFORM_ADMIN_SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 3600, // 8 hours
    });

    const isProd = process.env.NODE_ENV === "production";
    response.headers.set(
      "Set-Cookie",
      `${PLATFORM_ADMIN_SESSION_COOKIE}=${sessionToken}; Path=/; Max-Age=${8 * 3600}; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`
    );

    return response;
  } catch (error: unknown) {
    if (
      error instanceof AccountLockedError ||
      (typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "ACCOUNT_LOCKED")
    ) {
      const lockedError = error as AccountLockedError;
      return NextResponse.json(
        {
          error: {
            code: "ACCOUNT_LOCKED",
            message: lockedError.message || "Account is temporarily locked due to multiple failed login attempts.",
            remainingMinutes: lockedError.remainingMinutes,
          },
        },
        { status: 423 }
      );
    }

    if (
      error instanceof InvalidCredentialsError ||
      error instanceof InsufficientPlatformPrivilegesError ||
      (typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "INVALID_CREDENTIALS")
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid platform administrator credentials.",
          },
        },
        { status: 401 }
      );
    }

    if (error instanceof PlatformAuthError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode }
      );
    }

    // Distinguish authentication failures from database or internal server failures
    // Never expose database internals or email existence to client
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[PlatformAuth] Internal error during login processing:", errorMessage);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An internal server error occurred during authentication.",
        },
      },
      { status: 500 }
    );
  }
}
