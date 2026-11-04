import { NextResponse } from "next/server";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";

export async function GET() {
  try {
    const admin = await requirePlatformAdmin();
    return NextResponse.json({
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
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
