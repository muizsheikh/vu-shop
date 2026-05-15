import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import {
  canExportOrders,
  canViewReports,
  normalizeOrderStatus,
} from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ORDER_SELECT =
  "id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, items, created_at";

type DateFilter =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "all_time";

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

function normalizeDateFilter(value: string | null): DateFilter {
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

function getRange(dateFilter: DateFilter) {
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
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function getExportFileName(date: DateFilter) {
  const today = new Date().toISOString().slice(0, 10);
  const datePart = getSafeFilePart(date);

  return `vape-ustad-reports_${datePart}_${today}.csv`;
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

    if (!canViewReports(admin.user.role) || !canExportOrders(admin.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to export reports." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const date = normalizeDateFilter(searchParams.get("date"));
    const range = getRange(date);

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
      return NextResponse.json(
        { error: error.message || "Failed to export reports." },
        { status: 500 }
      );
    }

    const orders = (Array.isArray(data) ? data : []) as OrderRow[];
    const csv = `\ufeff${buildCsv(orders)}`;
    const fileName = getExportFileName(date);

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
          error?.message || "Something went wrong while exporting reports.",
      },
      { status: 500 }
    );
  }
}