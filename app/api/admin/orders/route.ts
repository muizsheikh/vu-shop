import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";
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
      message: "You are not allowed to access admin orders.",
    };
  }

  return {
    ok: true as const,
    user: data.user,
  };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.message },
        { status: admin.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const search = String(searchParams.get("search") || "").trim();

    let query = supabaseAdmin
      .from("orders")
      .select(
        "id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, items, created_at"
      )
      .order("created_at", { ascending: false });

    if (id) {
      const { data, error } = await query.eq("id", id).single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Order not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({ order: data });
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load orders." },
        { status: 500 }
      );
    }

    const allOrders = Array.isArray(data) ? data : [];

    const filteredOrders = search
      ? allOrders.filter((order: any) => {
          const needle = search.toLowerCase();

          return [
            order.sales_order,
            order.customer_name,
            order.customer_email,
            order.customer_phone,
            order.city,
            order.status,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle));
        })
      : allOrders;

    return NextResponse.json({ orders: filteredOrders });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while loading admin orders.",
      },
      { status: 500 }
    );
  }
}