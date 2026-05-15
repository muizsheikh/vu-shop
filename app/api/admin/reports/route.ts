import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canViewReports, normalizeOrderStatus } from "@/lib/admin";
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

function getCustomerKey(order: OrderRow) {
  const email = String(order.customer_email || "").trim().toLowerCase();

  if (email) return `email:${email}`;

  const phone = String(order.customer_phone || "").replace(/\D/g, "");

  if (phone) return `phone:${phone}`;

  return `order:${order.id}`;
}

function buildSummary(orders: OrderRow[]) {
  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );

  const deliveredRevenue = orders
    .filter((order) => normalizeOrderStatus(order.status) === "delivered")
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  return {
    total_orders: orders.length,
    total_revenue: totalRevenue,
    delivered_revenue: deliveredRevenue,
    average_order_value:
      orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
    unique_customers: new Set(orders.map((order) => getCustomerKey(order))).size,
  };
}

function buildStatusBreakdown(orders: OrderRow[]) {
  const statuses = [
    "placed",
    "confirmed",
    "processing",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ];

  return statuses.map((status) => {
    const filtered = orders.filter(
      (order) => normalizeOrderStatus(order.status) === status
    );

    return {
      status,
      orders: filtered.length,
      revenue: filtered.reduce(
        (sum, order) => sum + Number(order.total_amount || 0),
        0
      ),
    };
  });
}

function buildPaymentSummary(orders: OrderRow[]) {
  const map = new Map<string, { payment_method: string; orders: number; revenue: number }>();

  orders.forEach((order) => {
    const method = String(order.payment_method || "cod").trim().toLowerCase();
    const current =
      map.get(method) || {
        payment_method: method,
        orders: 0,
        revenue: 0,
      };

    current.orders += 1;
    current.revenue += Number(order.total_amount || 0);

    map.set(method, current);
  });

  return Array.from(map.values()).sort(
    (a, b) => b.orders - a.orders || b.revenue - a.revenue
  );
}

function buildCitySummary(orders: OrderRow[]) {
  const map = new Map<string, { city: string; orders: number; revenue: number }>();

  orders.forEach((order) => {
    const city = String(order.city || "Unknown").trim() || "Unknown";
    const key = city.toLowerCase();

    const current =
      map.get(key) || {
        city,
        orders: 0,
        revenue: 0,
      };

    current.orders += 1;
    current.revenue += Number(order.total_amount || 0);

    map.set(key, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
    .slice(0, 20);
}

function buildTopCustomers(orders: OrderRow[]) {
  const map = new Map<
    string,
    {
      customer_key: string;
      name: string;
      email: string;
      phone: string;
      city: string;
      orders: number;
      revenue: number;
      last_order_at: string | null;
    }
  >();

  orders.forEach((order) => {
    const key = getCustomerKey(order);
    const current =
      map.get(key) || {
        customer_key: key,
        name: order.customer_name || "Customer",
        email: order.customer_email || "",
        phone: order.customer_phone || "",
        city: order.city || "",
        orders: 0,
        revenue: 0,
        last_order_at: null,
      };

    current.orders += 1;
    current.revenue += Number(order.total_amount || 0);

    if (!current.last_order_at || order.created_at > current.last_order_at) {
      current.last_order_at = order.created_at;
    }

    map.set(key, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
    .slice(0, 20);
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canViewReports(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to view reports." },
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
      .limit(5000);

    if (range.from) {
      query = query.gte("created_at", range.from);
    }

    if (range.to) {
      query = query.lte("created_at", range.to);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Failed to load reports.");
    }

    const orders = Array.isArray(data) ? (data as OrderRow[]) : [];

    return jsonResponse({
      admin: admin.user,
      filters: {
        date: dateFilter,
      },
      summary: buildSummary(orders),
      status_breakdown: buildStatusBreakdown(orders),
      payment_summary: buildPaymentSummary(orders),
      city_summary: buildCitySummary(orders),
      top_customers: buildTopCustomers(orders),
      recent_orders: orders.slice(0, 20),
      roadmap: {
        upcoming_modules: [
          "Employee Attendance",
          "ERPNext Employee Sync",
          "Geo Location Check-in",
          "Branch Attendance Reports",
        ],
      },
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || "Failed to load reports.",
      },
      500
    );
  }
}