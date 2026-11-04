import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { PlatformAuthService, PLATFORM_ADMIN_SESSION_COOKIE } from "@calcart/platform-admin";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(PLATFORM_ADMIN_SESSION_COOKIE);

  if (sessionCookie?.value) {
    const authService = new PlatformAuthService(getDb());
    await authService.logout(sessionCookie.value);
  }

  const response = NextResponse.json({ data: { success: true } });
  response.cookies.delete(PLATFORM_ADMIN_SESSION_COOKIE);
  return response;
}
