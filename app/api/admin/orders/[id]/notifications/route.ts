import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminUserFromRequest } from "@/lib/adminAuth";

async function loadNotifications(orderId: string) {
  const { data, error } = await supabaseAdmin
    .from("notification_logs")
    .select("id, order_id, type, channel, message, opened_by_email, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load notification logs.");
  }

  return data || [];
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.message },
        { status: admin.status }
      );
    }

    const { id } = await context.params;
    const notifications = await loadNotifications(id);

    return NextResponse.json({
      notifications,
      admin: admin.user,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while loading notification logs.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.message },
        { status: admin.status }
      );
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => null);

    const type = String(body?.type || "").trim().toLowerCase();
    const channel = String(body?.channel || "whatsapp").trim().toLowerCase();
    const message = String(body?.message || "").trim();

    if (!type) {
      return NextResponse.json(
        { error: "Notification type is required." },
        { status: 400 }
      );
    }

    if (channel !== "whatsapp") {
      return NextResponse.json(
        { error: "Invalid notification channel." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("notification_logs").insert({
      order_id: id,
      type,
      channel,
      message: message ? message.slice(0, 4000) : null,
      opened_by_email: admin.user.email,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to save notification log." },
        { status: 500 }
      );
    }

    const notifications = await loadNotifications(id);

    return NextResponse.json({
      notifications,
      admin: admin.user,
      message: "Notification log saved successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while saving notification log.",
      },
      { status: 500 }
    );
  }
}
