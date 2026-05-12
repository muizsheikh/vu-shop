import { NextRequest, NextResponse } from "next/server";
import {
  normalizeOrderStatus,
  ORDER_STATUSES,
} from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminUserFromRequest } from "@/lib/adminAuth";

const ORDER_SELECT =
  "id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, items, created_at, delivery_method, rider_name, rider_phone, delivery_note, tracking_number, expected_delivery_time";

const DELIVERY_METHODS = ["", "rider", "courier", "pickup"];

function cleanText(value: unknown) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

function cleanDeliveryMethod(value: unknown) {
  const method = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

  if (!DELIVERY_METHODS.includes(method)) {
    return {
      ok: false as const,
      value: null,
      message: "Invalid delivery method.",
    };
  }

  return {
    ok: true as const,
    value: method || null,
  };
}

function cleanExpectedDeliveryTime(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return null;

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "INVALID_DATE";
  }

  return date.toISOString();
}

async function loadHistory(orderId: string) {
  const { data, error } = await supabaseAdmin
    .from("order_status_history")
    .select("id, order_id, old_status, new_status, changed_by_email, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    return [];
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
    const history = await loadHistory(id);

    return NextResponse.json({
      history,
      admin: admin.user,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while loading order status history.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { data: currentOrder, error: currentError } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", id)
      .single();

    if (currentError || !currentOrder) {
      return NextResponse.json(
        { error: currentError?.message || "Order not found." },
        { status: 404 }
      );
    }

    const oldStatus = normalizeOrderStatus(currentOrder.status);
    const requestedStatus =
      body.status === undefined || body.status === null || body.status === ""
        ? oldStatus
        : normalizeOrderStatus(body.status);

    if (!ORDER_STATUSES.includes(requestedStatus)) {
      return NextResponse.json(
        { error: "Invalid order status." },
        { status: 400 }
      );
    }

    const deliveryMethod = cleanDeliveryMethod(body.delivery_method);

    if (!deliveryMethod.ok) {
      return NextResponse.json(
        { error: deliveryMethod.message },
        { status: 400 }
      );
    }

    const expectedDeliveryTime = cleanExpectedDeliveryTime(
      body.expected_delivery_time
    );

    if (expectedDeliveryTime === "INVALID_DATE") {
      return NextResponse.json(
        { error: "Invalid expected delivery time." },
        { status: 400 }
      );
    }

    const updatePayload = {
      status: requestedStatus,
      delivery_method: deliveryMethod.value,
      rider_name: cleanText(body.rider_name),
      rider_phone: cleanText(body.rider_phone),
      delivery_note: cleanText(body.delivery_note),
      tracking_number: cleanText(body.tracking_number),
      expected_delivery_time: expectedDeliveryTime,
    };

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .select(ORDER_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Order update failed." },
        { status: 500 }
      );
    }

    if (oldStatus !== requestedStatus) {
      await supabaseAdmin.from("order_status_history").insert({
        order_id: id,
        old_status: oldStatus,
        new_status: requestedStatus,
        changed_by_email: admin.user.email,
      });
    }

    const history = await loadHistory(id);

    return NextResponse.json({
      order: data,
      history,
      admin: admin.user,
      message:
        oldStatus === requestedStatus
          ? "Order updated successfully."
          : "Order status updated successfully.",
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