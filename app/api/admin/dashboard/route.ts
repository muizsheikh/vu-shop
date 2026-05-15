import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import {
  canViewCustomers,
  canViewOrders,
  canViewReports,
  normalizeOrderStatus,
} from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ORDER_SELECT =
  "id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, items, created_at";

type OrderRow = {
  id: string;
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
  items: any[] | null;
  created_at: string;
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function startOfDay(date: Date) {
  const cloned = new Date(date);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

function endOfDay(date: Date) {
  const cloned = new Date(date);
  cloned.setHours(23, 59, 59, 999);
  return cloned;
}

function getRange(dateFilter: string) {
  const now = new Date();

  if (dateFilter === "today") {
    return {
      from: startOfDay(now).toISOString(),
      to: endOfDay(now).toISOString(),
    };
  }

  if (dateFilter === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    return {
      from: startOfDay(yesterday).toISOString(),
      to: endOfDay(yesterday).toISOString(),
    };
  }

  if (dateFilter === "last_7_days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 6);

    return {
      from: start.toISOString(),
      to: endOfDay(now).toISOString(),
    };
  }

  if (dateFilter === "last_30_days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 29);

    return {
      from: start.toISOString(),
      to: endOfDay(now).toISOString(),
    };
  }

  return {
    from: null,
    to: null,
  };
}

function normalizeDateFilter(value: string | null) {
  const clean = String(value || "today").trim().toLowerCase();

  if (
    clean === "today" ||
    clean === "yesterday" ||
    clean === "last_7_days" ||
    clean === "last_30_days" ||
    clean === "all_time"
  ) {
    return clean;
  }

  return "today";
}

function getCustomerKey(order: OrderRow) {
  const email = String(order.customer_email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  const phone = String(order.customer_phone || "").replace(/\D/g, "");
  if (phone) return `phone:${phone}`;

  return `order:${order.id}`;
}

function buildStats(orders: OrderRow[]) {
  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );

  const deliveredRevenue = orders
    .filter((order) => normalizeOrderStatus(order.status) === "delivered")
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  const placed = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "placed"
  ).length;

  const confirmed = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "confirmed"
  ).length;

  const processing = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "processing"
  ).length;

  const outForDelivery = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "out_for_delivery"
  ).length;

  const delivered = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "delivered"
  ).length;

  const cancelled = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "cancelled"
  ).length;

  return {
    total_orders: orders.length,
    period_revenue: totalRevenue,
    delivered_revenue: deliveredRevenue,
    pending: placed + confirmed + processing + outForDelivery,
    placed,
    confirmed,
    processing,
    out_for_delivery: outForDelivery,
    delivered,
    cancelled,
  };
}

function buildTopCities(orders: OrderRow[]) {
  const cityMap = new Map<string, { city: string; orders: number; revenue: number }>();

  orders.forEach((order) => {
    const city = String(order.city || "Unknown").trim() || "Unknown";
    const current =
      cityMap.get(city.toLowerCase()) || {
        city,
        orders: 0,
        revenue: 0,
      };

    current.orders += 1;
    current.revenue += Number(order.total_amount || 0);

    cityMap.set(city.toLowerCase(), current);
  });

  return Array.from(cityMap.values())
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
    .slice(0, 6);
}

function buildCustomerSummary(orders: OrderRow[]) {
  const keys = new Set<string>();

  orders.forEach((order) => {
    keys.add(getCustomerKey(order));
  });

  return {
    total_customers_in_period: keys.size,
  };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canViewOrders(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to view dashboard data." },
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const dateFilter = normalizeDateFilter(searchParams.get("date"));
    const range = getRange(dateFilter);

    let query = supabaseAdmin
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (range.from) {
      query = query.gte("created_at", range.from);
    }

    if (range.to) {
      query = query.lte("created_at", range.to);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Failed to load dashboard orders.");
    }

    const orders = Array.isArray(data) ? (data as OrderRow[]) : [];
    const recentOrders = orders.slice(0, 8);

    return jsonResponse({
      admin: admin.user,
      permissions: {
        can_view_orders: canViewOrders(admin.user.role),
        can_view_customers: canViewCustomers(admin.user.role),
        can_view_reports: canViewReports(admin.user.role),
      },
      filters: {
        date: dateFilter,
      },
      stats: buildStats(orders),
      customer_summary: buildCustomerSummary(orders),
      top_cities: buildTopCities(orders),
      recent_orders: recentOrders,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || "Failed to load dashboard data.",
      },
      500
    );
  }
}