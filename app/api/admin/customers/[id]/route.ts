import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canViewCustomers, normalizeRole } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  address_line1: string | null;
  role: string | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type OrderRow = {
  id: string;
  user_id: string | null;
  sales_order: string | null;
  payment_method: string | null;
  status: string | null;
  total_amount: number | null;
  currency: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  city: string | null;
  address_line1: string | null;
  customer_note: string | null;
  items: any[] | null;
  created_at: string | null;
  delivery_method: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  delivery_note: string | null;
  tracking_number: string | null;
  expected_delivery_time: string | null;
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function decodeCustomerId(value: string) {
  return decodeURIComponent(String(value || "").trim());
}

function getCustomerKeyFromOrder(order: OrderRow) {
  if (order.user_id) return `user:${order.user_id}`;

  const email = String(order.customer_email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  const phone = String(order.customer_phone || "").replace(/\D/g, "");
  if (phone) return `phone:${phone}`;

  return `order:${order.id}`;
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function summarizeOrders(orders: OrderRow[]) {
  return orders.reduce(
    (summary, order) => {
      const status = String(order.status || "placed").toLowerCase();
      const amount = Number(order.total_amount || 0);

      summary.total_orders += 1;
      summary.total_spent += Number.isFinite(amount) ? amount : 0;

      if (status === "delivered") {
        summary.delivered_orders += 1;
      } else if (status === "cancelled") {
        summary.cancelled_orders += 1;
      } else {
        summary.active_orders += 1;
      }

      if (!summary.last_order_at || String(order.created_at || "") > summary.last_order_at) {
        summary.last_order_at = order.created_at || null;
      }

      return summary;
    },
    {
      total_orders: 0,
      active_orders: 0,
      delivered_orders: 0,
      cancelled_orders: 0,
      total_spent: 0,
      last_order_at: null as string | null,
    }
  );
}

function buildCustomerFromRegisteredUser(authUser: any, profile: ProfileRow | null, orders: OrderRow[]) {
  const firstOrder = orders[0] || null;

  return {
    id: authUser?.id || profile?.id || "",
    customer_key: `user:${authUser?.id || profile?.id || ""}`,
    email: String(authUser?.email || firstOrder?.customer_email || "").trim().toLowerCase(),
    created_at: authUser?.created_at || null,
    last_sign_in_at: authUser?.last_sign_in_at || null,
    email_confirmed_at: authUser?.email_confirmed_at || null,
    full_name: profile?.full_name || firstOrder?.customer_name || null,
    phone: profile?.phone || firstOrder?.customer_phone || null,
    city: profile?.city || firstOrder?.city || null,
    address_line1: profile?.address_line1 || firstOrder?.address_line1 || null,
    role: normalizeRole(profile?.role),
    is_active: profile?.is_active !== false,
    profile_updated_at: profile?.updated_at || null,
    has_profile: Boolean(profile?.id),
    has_auth_user: true,
  };
}

function buildCustomerFromGuestKey(customerKey: string, orders: OrderRow[]) {
  const firstOrder = orders[0] || null;

  return {
    id: customerKey,
    customer_key: customerKey,
    email: String(firstOrder?.customer_email || "").trim().toLowerCase(),
    created_at: null,
    last_sign_in_at: null,
    email_confirmed_at: null,
    full_name: firstOrder?.customer_name || "Guest Customer",
    phone: firstOrder?.customer_phone || null,
    city: firstOrder?.city || null,
    address_line1: firstOrder?.address_line1 || null,
    role: "customer",
    is_active: true,
    profile_updated_at: null,
    has_profile: false,
    has_auth_user: false,
  };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const customerId = decodeCustomerId(id);

    if (!customerId) {
      return jsonResponse({ error: "Customer ID is required." }, 400);
    }

    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canViewCustomers(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to view customer details." },
        403
      );
    }

    const ORDER_SELECT =
      "id, user_id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, customer_note, items, created_at, delivery_method, rider_name, rider_phone, delivery_note, tracking_number, expected_delivery_time";

    let authUser: any = null;
    let profile: ProfileRow | null = null;
    let orders: OrderRow[] = [];
    let customer: any = null;

    const isUserKey = customerId.startsWith("user:");
    const isEmailKey = customerId.startsWith("email:");
    const isPhoneKey = customerId.startsWith("phone:");

    if (isUserKey || isUuidLike(customerId)) {
      const userId = isUserKey ? customerId.replace("user:", "") : customerId;

      const { data: authResult } = await supabaseAdmin.auth.admin.getUserById(userId);
      authUser = authResult?.user || null;

      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, city, address_line1, role, is_active, updated_at")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message || "Failed to load customer profile.");
      }

      profile = profileData || null;

      const { data: orderData, error: ordersError } = await supabaseAdmin
        .from("orders")
        .select(ORDER_SELECT)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (ordersError) {
        throw new Error(ordersError.message || "Failed to load customer orders.");
      }

      orders = Array.isArray(orderData) ? (orderData as OrderRow[]) : [];

      if (!authUser && !profile && orders.length === 0) {
        return jsonResponse({ error: "Customer not found.", admin: admin.user }, 404);
      }

      customer = buildCustomerFromRegisteredUser(authUser, profile, orders);
    } else if (isEmailKey) {
      const email = customerId.replace("email:", "").trim().toLowerCase();

      const { data: orderData, error: ordersError } = await supabaseAdmin
        .from("orders")
        .select(ORDER_SELECT)
        .ilike("customer_email", email)
        .order("created_at", { ascending: false })
        .limit(100);

      if (ordersError) {
        throw new Error(ordersError.message || "Failed to load guest customer orders.");
      }

      orders = Array.isArray(orderData) ? (orderData as OrderRow[]) : [];

      if (orders.length === 0) {
        return jsonResponse({ error: "Customer not found.", admin: admin.user }, 404);
      }

      customer = buildCustomerFromGuestKey(customerId, orders);
    } else if (isPhoneKey) {
      const phone = normalizePhone(customerId.replace("phone:", ""));

      const { data: orderData, error: ordersError } = await supabaseAdmin
        .from("orders")
        .select(ORDER_SELECT)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (ordersError) {
        throw new Error(ordersError.message || "Failed to load guest customer orders.");
      }

      const allOrders = Array.isArray(orderData) ? (orderData as OrderRow[]) : [];

      orders = allOrders
        .filter((order) => normalizePhone(order.customer_phone) === phone)
        .slice(0, 100);

      if (orders.length === 0) {
        return jsonResponse({ error: "Customer not found.", admin: admin.user }, 404);
      }

      customer = buildCustomerFromGuestKey(customerId, orders);
    } else {
      const { data: orderData, error: ordersError } = await supabaseAdmin
        .from("orders")
        .select(ORDER_SELECT)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (ordersError) {
        throw new Error(ordersError.message || "Failed to load customer orders.");
      }

      const allOrders = Array.isArray(orderData) ? (orderData as OrderRow[]) : [];

      orders = allOrders
        .filter((order) => getCustomerKeyFromOrder(order) === customerId)
        .slice(0, 100);

      if (orders.length === 0) {
        return jsonResponse({ error: "Customer not found.", admin: admin.user }, 404);
      }

      customer = buildCustomerFromGuestKey(customerId, orders);
    }

    return jsonResponse({
      admin: admin.user,
      customer,
      orders,
      summary: summarizeOrders(orders),
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || "Failed to load customer detail.",
      },
      500
    );
  }
}