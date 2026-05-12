import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { normalizeOrderStatus } from "@/lib/admin";

const ORDER_SELECT =
  "id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, items, created_at, delivery_method, rider_name, rider_phone, delivery_note, tracking_number, expected_delivery_time";

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
  delivery_method: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  delivery_note: string | null;
  tracking_number: string | null;
  expected_delivery_time: string | null;
};

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

function formatPKR(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PK").format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value || "");
  }
}

function getOrderStatusLabel(status: string | null | undefined) {
  const normalized = normalizeOrderStatus(status);

  if (normalized === "out_for_delivery") return "Out for Delivery";

  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function csvCell(value: unknown) {
  let cleanValue = String(value ?? "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^[=+\-@]/.test(cleanValue)) {
    cleanValue = `'${cleanValue}`;
  }

  return `"${cleanValue.replaceAll('"', '""')}"`;
}

function getSafeFilePart(value: string) {
  return String(value || "all")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function getExportFileName(date: DateFilter, status: StatusFilter, search: string) {
  const today = new Date().toISOString().slice(0, 10);
  const datePart = getSafeFilePart(date);
  const statusPart = getSafeFilePart(status);
  const searchPart = search.trim()
    ? `_${getSafeFilePart(search).slice(0, 30)}`
    : "";

  return `vape-ustad-orders-full_${datePart}_${statusPart}${searchPart}_${today}.csv`;
}

function buildItemsText(items: any[] | null) {
  const orderItems = Array.isArray(items) ? items : [];

  return orderItems
    .map((item: any) => {
      const name = item?.name || item?.item_name || item?.id || "Item";
      const qty = Number(item?.qty || 1);
      const price = Number(item?.price || 0);
      return `${name} x ${qty} @ Rs ${formatPKR(price)}`;
    })
    .join(" | ");
}

function buildCsv(orders: OrderRow[]) {
  const headers = [
    "Order No",
    "Date",
    "Customer",
    "Email",
    "Phone",
    "City",
    "Address",
    "Total",
    "Currency",
    "Payment",
    "Status",
    "Delivery Method",
    "Rider / Courier",
    "Rider Phone",
    "Tracking Number",
    "Expected Delivery Time",
    "Delivery Note",
    "Items Count",
    "Items",
  ];

  const rows = orders.map((order) => {
    const orderNumber = order.sales_order || `Order ${order.id.slice(0, 8)}`;
    const orderItems = Array.isArray(order.items) ? order.items : [];

    return [
      orderNumber,
      formatDate(order.created_at),
      order.customer_name || "Customer",
      order.customer_email || "",
      order.customer_phone || "",
      order.city || "",
      order.address_line1 || "",
      Number(order.total_amount || 0),
      order.currency || "PKR",
      order.payment_method || "cod",
      getOrderStatusLabel(order.status),
      order.delivery_method || "",
      order.rider_name || "",
      order.rider_phone || "",
      order.tracking_number || "",
      formatDate(order.expected_delivery_time),
      order.delivery_note || "",
      orderItems.length,
      buildItemsText(order.items),
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map((cell) => csvCell(cell)).join(","))
    .join("\n");
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
    const search = cleanSearchValue(String(searchParams.get("search") || ""));
    const status = normalizeStatusFilter(searchParams.get("status"));
    const date = normalizeDateFilter(searchParams.get("date"));

    let query = supabaseAdmin
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false })
      .range(0, 4999);

    query = applySearchFilter(query, search);
    query = applyDateFilter(query, date);
    query = applyStatusFilter(query, status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to export orders." },
        { status: 500 }
      );
    }

    const orders = (Array.isArray(data) ? data : []) as OrderRow[];
    const csv = `\ufeff${buildCsv(orders)}`;
    const fileName = getExportFileName(date, status, search);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Something went wrong while exporting orders.",
      },
      { status: 500 }
    );
  }
}
