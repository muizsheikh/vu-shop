import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminUserFromRequest } from "@/lib/adminAuth";

const ORDER_SELECT =
  "id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, items, created_at, delivery_method, rider_name, rider_phone, delivery_note, tracking_number, expected_delivery_time";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

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
      .select(ORDER_SELECT)
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
            order.delivery_method,
            order.rider_name,
            order.rider_phone,
            order.tracking_number,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle));
        })
      : allOrders;

    return NextResponse.json({
      orders: filteredOrders,
      admin: admin.user,
    });
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