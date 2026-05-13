import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canViewCustomers, normalizeRole } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  city: string | null;
  address_line1: string | null;
  total_amount: number | null;
  status: string | null;
  created_at: string | null;
};

function cleanSearchValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[,%]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function clampNumber(
  value: string | null,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value || fallback);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function customerMatchesSearch(customer: any, search: string) {
  if (!search) return true;

  const haystack = [
    customer.id,
    customer.email,
    customer.full_name,
    customer.phone,
    customer.city,
    customer.address_line1,
    customer.role,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return haystack.includes(search);
}

function getCustomerKey(order: OrderRow) {
  if (order.user_id) return `user:${order.user_id}`;

  const email = String(order.customer_email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  const phone = String(order.customer_phone || "").replace(/\D/g, "");
  if (phone) return `phone:${phone}`;

  return `order:${order.id}`;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.message },
        { status: admin.status }
      );
    }

    if (!canViewCustomers(admin.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view customers." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = cleanSearchValue(searchParams.get("search"));
    const page = clampNumber(searchParams.get("page"), 1, 1, 999999);
    const limit = clampNumber(searchParams.get("limit"), 20, 5, 100);

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authError) {
      throw new Error(authError.message || "Failed to load auth users.");
    }

    const authUsers = Array.isArray(authData?.users) ? authData.users : [];
    const userIds = authUsers.map((user) => user.id).filter(Boolean);

    let profiles: ProfileRow[] = [];

    if (userIds.length > 0) {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, phone, city, address_line1, role, is_active, updated_at"
        )
        .in("id", userIds);

      if (profileError) {
        throw new Error(profileError.message || "Failed to load profiles.");
      }

      profiles = Array.isArray(profileData) ? profileData : [];
    }

    const profileMap = new Map<string, ProfileRow>();

    profiles.forEach((profile) => {
      profileMap.set(profile.id, profile);
    });

    const { data: orderData, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, user_id, customer_name, customer_email, customer_phone, city, address_line1, total_amount, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(5000);

    if (ordersError) {
      throw new Error(ordersError.message || "Failed to load customer orders.");
    }

    const orders = Array.isArray(orderData) ? (orderData as OrderRow[]) : [];
    const orderStats = new Map<string, any>();

    orders.forEach((order) => {
      const key = getCustomerKey(order);
      const current =
        orderStats.get(key) || {
          key,
          user_id: order.user_id || null,
          fallback_name: order.customer_name || null,
          fallback_email: order.customer_email || null,
          fallback_phone: order.customer_phone || null,
          fallback_city: order.city || null,
          fallback_address: order.address_line1 || null,
          total_orders: 0,
          active_orders: 0,
          delivered_orders: 0,
          cancelled_orders: 0,
          total_spent: 0,
          last_order_at: null,
        };

      const status = String(order.status || "placed").toLowerCase();
      const amount = Number(order.total_amount || 0);

      current.total_orders += 1;
      current.total_spent += Number.isFinite(amount) ? amount : 0;

      if (status === "delivered") {
        current.delivered_orders += 1;
      } else if (status === "cancelled") {
        current.cancelled_orders += 1;
      } else {
        current.active_orders += 1;
      }

      if (!current.last_order_at || String(order.created_at || "") > current.last_order_at) {
        current.last_order_at = order.created_at || null;
      }

      orderStats.set(key, current);
    });

    const authCustomers = authUsers.map((user) => {
      const profile = profileMap.get(user.id);
      const key = `user:${user.id}`;
      const stats = orderStats.get(key);

      return {
        id: user.id,
        customer_key: key,
        email: String(user.email || "").trim().toLowerCase(),
        created_at: user.created_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        full_name: profile?.full_name || stats?.fallback_name || null,
        phone: profile?.phone || stats?.fallback_phone || null,
        city: profile?.city || stats?.fallback_city || null,
        address_line1: profile?.address_line1 || stats?.fallback_address || null,
        role: normalizeRole(profile?.role),
        is_active: profile?.is_active !== false,
        profile_updated_at: profile?.updated_at || null,
        has_profile: Boolean(profile),
        has_auth_user: true,
        total_orders: stats?.total_orders || 0,
        active_orders: stats?.active_orders || 0,
        delivered_orders: stats?.delivered_orders || 0,
        cancelled_orders: stats?.cancelled_orders || 0,
        total_spent: stats?.total_spent || 0,
        last_order_at: stats?.last_order_at || null,
      };
    });

    const authUserIds = new Set(authUsers.map((user) => user.id));
    const guestCustomers = Array.from(orderStats.values())
      .filter((stats) => !stats.user_id || !authUserIds.has(stats.user_id))
      .map((stats) => ({
        id: stats.user_id || stats.key,
        customer_key: stats.key,
        email: stats.fallback_email || "",
        created_at: null,
        last_sign_in_at: null,
        email_confirmed_at: null,
        full_name: stats.fallback_name || "Guest Customer",
        phone: stats.fallback_phone || null,
        city: stats.fallback_city || null,
        address_line1: stats.fallback_address || null,
        role: "customer",
        is_active: true,
        profile_updated_at: null,
        has_profile: false,
        has_auth_user: false,
        total_orders: stats.total_orders || 0,
        active_orders: stats.active_orders || 0,
        delivered_orders: stats.delivered_orders || 0,
        cancelled_orders: stats.cancelled_orders || 0,
        total_spent: stats.total_spent || 0,
        last_order_at: stats.last_order_at || null,
      }));

    const allCustomers = [...authCustomers, ...guestCustomers]
      .filter((customer) => normalizeRole(customer.role) === "customer")
      .filter((customer) => customerMatchesSearch(customer, search))
      .sort((a, b) => {
        const dateA = new Date(a.last_order_at || a.created_at || 0).getTime();
        const dateB = new Date(b.last_order_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });

    const totalCount = allCustomers.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * limit;
    const to = from + limit;

    const customers = allCustomers.slice(from, to);

    const summary = {
      total_customers: totalCount,
      registered_customers: allCustomers.filter((customer) => customer.has_auth_user)
        .length,
      guest_customers: allCustomers.filter((customer) => !customer.has_auth_user)
        .length,
      active_customers: allCustomers.filter((customer) => customer.is_active).length,
      total_orders: allCustomers.reduce(
        (sum, customer) => sum + Number(customer.total_orders || 0),
        0
      ),
      total_spent: allCustomers.reduce(
        (sum, customer) => sum + Number(customer.total_spent || 0),
        0
      ),
    };

    return NextResponse.json({
      admin: admin.user,
      customers,
      summary,
      filters: {
        search,
      },
      pagination: {
        page: safePage,
        limit,
        total_count: totalCount,
        total_pages: totalPages,
        has_next_page: safePage < totalPages,
        has_previous_page: safePage > 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to load customers.",
      },
      { status: 500 }
    );
  }
}