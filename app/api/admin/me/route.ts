import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return NextResponse.json(
        {
          allowed: false,
          error: admin.message,
        },
        { status: admin.status }
      );
    }

    return NextResponse.json({
      allowed: true,
      user: admin.user,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        allowed: false,
        error: error?.message || "Something went wrong while checking admin.",
      },
      { status: 500 }
    );
  }
}