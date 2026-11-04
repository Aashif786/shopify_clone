import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { PlatformAuthService, PLATFORM_ADMIN_SESSION_COOKIE } from "@calcart/platform-admin";

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
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 3600, // 8 hours
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    return NextResponse.json(
      { error: { code: "AUTHENTICATION_FAILED", message } },
      { status: 401 }
    );
  }
}
