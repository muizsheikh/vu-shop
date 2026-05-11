import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isAdminEmail,
  normalizeOrderStatus,
  ORDER_STATUSES,
} from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message: "Missing authorization token.",
    };
  }

  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false as const,
      status: 401,
      message: "Invalid or expired session.",
    };
  }

  if (!isAdminEmail(data.user.email)) {
    return {
      ok: false as const,
      status: 403,
      message: "You are not allowed to update orders.",
    };
  }

  return {
    ok: true as const,
    user: data.user,
  };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.message },
        { status: admin.status }
      );
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => null);

    const requestedStatus = normalizeOrderStatus(body?.status);

    if (!ORDER_STATUSES.includes(requestedStatus)) {
      return NextResponse.json(
        { error: "Invalid order status." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({
        status: requestedStatus,
      })
      .eq("id", id)
      .select(
        "id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, items, created_at"
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Order status update failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order: data,
      message: "Order status updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while updating order status.",
      },
      { status: 500 }
    );
  }
}