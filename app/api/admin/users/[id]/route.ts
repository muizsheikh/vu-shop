import { NextRequest, NextResponse } from "next/server";
import {
  canManageUsers,
  canViewUsers,
  normalizeRole,
} from "@/lib/admin";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function buildUserRow(authUser: any, profile: any) {
  return {
    id: authUser?.id || profile?.id || "",
    email: authUser?.email || "",
    created_at: authUser?.created_at || null,
    last_sign_in_at: authUser?.last_sign_in_at || null,
    email_confirmed_at: authUser?.email_confirmed_at || null,

    full_name: profile?.full_name || null,
    phone: profile?.phone || null,
    city: profile?.city || null,
    address_line1: profile?.address_line1 || null,
    role: normalizeRole(profile?.role),
    is_active: normalizeBoolean(profile?.is_active, true),
    profile_updated_at: profile?.updated_at || null,
    has_profile: Boolean(profile?.id),
  };
}

function summarizeOrders(orders: any[]) {
  const safeOrders = Array.isArray(orders) ? orders : [];

  return safeOrders.reduce(
    (summary, order) => {
      const status = String(order?.status || "placed").toLowerCase();
      const amount = Number(order?.total_amount || 0);

      summary.total_orders += 1;
      summary.total_spent += Number.isFinite(amount) ? amount : 0;

      if (status === "delivered") {
        summary.delivered_orders += 1;
      }

      if (status === "cancelled") {
        summary.cancelled_orders += 1;
      }

      if (status !== "delivered" && status !== "cancelled") {
        summary.active_orders += 1;
      }

      return summary;
    },
    {
      total_orders: 0,
      active_orders: 0,
      delivered_orders: 0,
      cancelled_orders: 0,
      total_spent: 0,
    }
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const userId = String(id || "").trim();

    if (!userId) {
      return jsonResponse({ error: "User ID is required." }, 400);
    }

    const adminCheck = await getAdminUserFromRequest(request);

    if (!adminCheck.ok) {
      return jsonResponse(
        {
          allowed: false,
          error: adminCheck.message || "Admin access required.",
          admin: null,
        },
        adminCheck.status || 403
      );
    }

    const adminUser = adminCheck.user;
    const userCanViewUsers = canViewUsers(adminUser.role);
    const userCanManageUsers = canManageUsers(adminUser.role);

    if (!userCanViewUsers) {
      return jsonResponse(
        {
          allowed: false,
          error: "You do not have permission to view user details.",
          admin: adminUser,
        },
        403
      );
    }

    const { data: authResult, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError || !authResult?.user) {
      return jsonResponse(
        {
          error: authError?.message || "User not found.",
          admin: adminUser,
        },
        404
      );
    }

    const authUser = authResult.user;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, phone, city, address_line1, updated_at, role, is_active"
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return jsonResponse(
        {
          error: profileError.message || "Failed to load user profile.",
          admin: adminUser,
        },
        500
      );
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        [
          "id",
          "sales_order",
          "payment_method",
          "status",
          "total_amount",
          "currency",
          "customer_name",
          "customer_email",
          "customer_phone",
          "city",
          "address_line1",
          "created_at",
          "delivery_method",
          "rider_name",
          "rider_phone",
          "tracking_number",
          "expected_delivery_time",
          "customer_note",
        ].join(", ")
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (ordersError) {
      return jsonResponse(
        {
          error: ordersError.message || "Failed to load user orders.",
          admin: adminUser,
        },
        500
      );
    }

    const { data: roleHistory, error: roleHistoryError } = await supabaseAdmin
      .from("user_role_history")
      .select(
        [
          "id",
          "target_user_id",
          "old_role",
          "new_role",
          "old_is_active",
          "new_is_active",
          "changed_by_user_id",
          "changed_by_email",
          "created_at",
        ].join(", ")
      )
      .eq("target_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (roleHistoryError) {
      return jsonResponse(
        {
          error:
            roleHistoryError.message || "Failed to load user role history.",
          admin: adminUser,
        },
        500
      );
    }

    const user = buildUserRow(authUser, profile);
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeRoleHistory = Array.isArray(roleHistory) ? roleHistory : [];

    return jsonResponse({
      allowed: true,
      admin: adminUser,
      can_view_users: userCanViewUsers,
      can_manage_users: userCanManageUsers,
      user,
      orders: safeOrders,
      order_summary: summarizeOrders(safeOrders),
      role_history: safeRoleHistory,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error:
          error?.message || "Something went wrong while loading user detail.",
      },
      500
    );
  }
}