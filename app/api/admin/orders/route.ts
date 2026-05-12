import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { normalizeOrderStatus, ORDER_STATUSES } from "@/lib/admin";

const ORDER_SELECT =
  "id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, customer_note, items, created_at, delivery_method, rider_name, rider_phone, delivery_note, tracking_number, expected_delivery_time";

const STATUS_FILTERS = [
  "all",
  "pending",
  "placed",
  "confirmed",
  "processing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

const DATE_FILTERS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "all_time",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type DateFilter = (typeof DATE_FILTERS)[number];

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function normalizeStatusFilter(value: string | null): StatusFilter {
  const clean = String(value || "all").trim().toLowerCase();

  if (STATUS_FILTERS.includes(clean as StatusFilter)) {
    return clean as StatusFilter;
  }

  return "all";
}

function normalizeDateFilter(value: string | null): DateFilter {
  const clean = String(value || "all_time").trim().toLowerCase();

  if (DATE_FILTERS.includes(clean as DateFilter)) {
    return clean as DateFilter;
  }

  return "all_time";
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

function getDateRange(filter: DateFilter) {
  if (filter === "all_time") {
    return {
      from: null,
      to: null,
    };
  }

  const now = new Date();

  if (filter === "today") {
    return {
      from: startOfDay(now).toISOString(),
      to: endOfDay(now).toISOString(),
    };
  }

  if (filter === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    return {
      from: startOfDay(yesterday).toISOString(),
      to: endOfDay(yesterday).toISOString(),
    };
  }

  if (filter === "last_7_days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 6);

    return {
      from: start.toISOString(),
      to: endOfDay(now).toISOString(),
    };
  }

  if (filter === "last_30_days") {
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

function cleanSearchValue(value: string) {
  return String(value || "")
    .trim()
    .replace(/[,%]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function applySearchFilter(query: any, search: string) {
  const cleanSearch = cleanSearchValue(search);

  if (!cleanSearch) return query;

  const needle = `%${cleanSearch}%`;

  return query.or(
    [
      `sales_order.ilike.${needle}`,
      `customer_name.ilike.${needle}`,
      `customer_email.ilike.${needle}`,
      `customer_phone.ilike.${needle}`,
      `city.ilike.${needle}`,
      `status.ilike.${needle}`,
      `delivery_method.ilike.${needle}`,
      `rider_name.ilike.${needle}`,
      `rider_phone.ilike.${needle}`,
      `tracking_number.ilike.${needle}`,
    ].join(",")
  );
}

function applyDateFilter(query: any, dateFilter: DateFilter) {
  const range = getDateRange(dateFilter);

  let nextQuery = query;

  if (range.from) {
    nextQuery = nextQuery.gte("created_at", range.from);
  }

  if (range.to) {
    nextQuery = nextQuery.lte("created_at", range.to);
  }

  return nextQuery;
}

function applyStatusFilter(query: any, statusFilter: StatusFilter) {
  if (statusFilter === "all") return query;

  if (statusFilter === "pending") {
    return query.in("status", [
      "placed",
      "confirmed",
      "processing",
      "out_for_delivery",
    ]);
  }

  return query.eq("status", normalizeOrderStatus(statusFilter));
}

function getBaseOrdersQuery(search: string, dateFilter: DateFilter) {
  let query = supabaseAdmin.from("orders").select(ORDER_SELECT);

  query = applySearchFilter(query, search);
  query = applyDateFilter(query, dateFilter);

  return query;
}

function getCountQuery(search: string, dateFilter: DateFilter) {
  let query = supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true });

  query = applySearchFilter(query, search);
  query = applyDateFilter(query, dateFilter);

  return query;
}

async function getFilteredCount(
  search: string,
  dateFilter: DateFilter,
  statusFilter: StatusFilter
) {
  let query = getCountQuery(search, dateFilter);
  query = applyStatusFilter(query, statusFilter);

  const { count, error } = await query;

  if (error) return 0;

  return count || 0;
}

async function getSummary(search: string, dateFilter: DateFilter) {
  const [
    total,
    pending,
    placed,
    confirmed,
    processing,
    outForDelivery,
    delivered,
    cancelled,
  ] = await Promise.all([
    getFilteredCount(search, dateFilter, "all"),
    getFilteredCount(search, dateFilter, "pending"),
    getFilteredCount(search, dateFilter, "placed"),
    getFilteredCount(search, dateFilter, "confirmed"),
    getFilteredCount(search, dateFilter, "processing"),
    getFilteredCount(search, dateFilter, "out_for_delivery"),
    getFilteredCount(search, dateFilter, "delivered"),
    getFilteredCount(search, dateFilter, "cancelled"),
  ]);

  return {
    total,
    pending,
    placed,
    confirmed,
    processing,
    out_for_delivery: outForDelivery,
    delivered,
    cancelled,
  };
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

    const { searchParams } = new URL(req.url);

    const id = searchParams.get("id");
    const search = cleanSearchValue(String(searchParams.get("search") || ""));
    const status = normalizeStatusFilter(searchParams.get("status"));
    const date = normalizeDateFilter(searchParams.get("date"));
    const page = clampNumber(searchParams.get("page"), 1, 1, 999999);
    const limit = clampNumber(searchParams.get("limit"), 20, 5, 100);

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Order not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        order: data,
        admin: admin.user,
      });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = getBaseOrdersQuery(search, date);
    query = applyStatusFilter(query, status);
    query = query
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data, error, count } = await query.select(ORDER_SELECT, {
      count: "exact",
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load orders." },
        { status: 500 }
      );
    }

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const summary = await getSummary(search, date);

    return NextResponse.json({
      orders: Array.isArray(data) ? data : [],
      admin: admin.user,
      pagination: {
        page,
        limit,
        total_count: totalCount,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_previous_page: page > 1,
      },
      filters: {
        search,
        status,
        date,
      },
      summary,
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