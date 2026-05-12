"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  getOrderStatusLabel,
  isAdminEmail,
  normalizeOrderStatus,
  ORDER_STATUSES,
} from "@/lib/admin";

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

type StatusFilter =
  | "all"
  | "pending"
  | "placed"
  | "confirmed"
  | "processing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

type DateFilter =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "all_time";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "placed", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7_days", label: "Last 7 Days" },
  { key: "last_30_days", label: "Last 30 Days" },
  { key: "all_time", label: "All Time" },
];

function formatPKR(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PK").format(Number(value || 0));
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
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

function isOrderInDateFilter(value: string, filter: DateFilter) {
  if (filter === "all_time") return true;

  const orderDate = new Date(value);
  const now = new Date();

  if (Number.isNaN(orderDate.getTime())) return false;

  if (filter === "today") {
    return orderDate >= startOfDay(now) && orderDate <= endOfDay(now);
  }

  if (filter === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    return (
      orderDate >= startOfDay(yesterday) && orderDate <= endOfDay(yesterday)
    );
  }

  if (filter === "last_7_days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 6);

    return orderDate >= start && orderDate <= endOfDay(now);
  }

  if (filter === "last_30_days") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 29);

    return orderDate >= start && orderDate <= endOfDay(now);
  }

  return true;
}

function getDateFilterLabel(filter: DateFilter) {
  return DATE_FILTERS.find((item) => item.key === filter)?.label || "Today";
}

function isValidStatusFilter(value: string | null): value is StatusFilter {
  return STATUS_FILTERS.some((filter) => filter.key === value);
}

function isValidDateFilter(value: string | null): value is DateFilter {
  return DATE_FILTERS.some((filter) => filter.key === value);
}

function isPendingStatus(status: string | null | undefined) {
  const normalized = normalizeOrderStatus(status);

  return (
    normalized === "placed" ||
    normalized === "confirmed" ||
    normalized === "processing" ||
    normalized === "out_for_delivery"
  );
}

function getStatusClasses(status: string | null | undefined) {
  const normalized = normalizeOrderStatus(status);

  if (normalized === "delivered") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (normalized === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized === "out_for_delivery") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (normalized === "processing") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "confirmed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function getFilterButtonClass(active: boolean, status: StatusFilter) {
  if (!active) {
    return "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50";
  }

  if (status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "delivered") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "out_for_delivery") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "processing" || status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "confirmed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "placed") {
    return "border-neutral-300 bg-neutral-100 text-neutral-950";
  }

  return "border-[#a30105]/25 bg-[#fff7f7] text-[#a30105]";
}

function getDateFilterButtonClass(active: boolean) {
  if (active) {
    return "border-[#a30105]/25 bg-[#fff7f7] text-[#a30105]";
  }

  return "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50";
}

function csvCell(value: unknown) {
  const cleanValue = String(value ?? "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `"${cleanValue.replaceAll('"', '""')}"`;
}

function getSafeFilePart(value: string) {
  return String(value || "all")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function getExportFileName(
  dateValue: DateFilter,
  statusValue: StatusFilter,
  searchValue: string,
) {
  const today = new Date().toISOString().slice(0, 10);
  const datePart = getSafeFilePart(dateValue);
  const statusPart = getSafeFilePart(statusValue);
  const searchPart = searchValue.trim()
    ? `_${getSafeFilePart(searchValue).slice(0, 30)}`
    : "";

  return `vape-ustad-orders_${datePart}_${statusPart}${searchPart}_${today}.csv`;
}

function getInitialSearch() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  return String(params.get("search") || "").trim();
}

function getInitialStatusFilter(): StatusFilter {
  if (typeof window === "undefined") return "all";

  const params = new URLSearchParams(window.location.search);
  const status = String(params.get("status") || "all").trim();

  return isValidStatusFilter(status) ? status : "all";
}

function getInitialDateFilter(): DateFilter {
  if (typeof window === "undefined") return "all_time";

  const params = new URLSearchParams(window.location.search);
  const date = String(params.get("date") || "all_time").trim();

  return isValidDateFilter(date) ? date : "all_time";
}

function updateBrowserUrl(
  searchValue: string,
  statusValue: StatusFilter,
  dateValue: DateFilter,
) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();

  if (searchValue.trim()) {
    params.set("search", searchValue.trim());
  }

  if (statusValue !== "all") {
    params.set("status", statusValue);
  }

  if (dateValue !== "all_time") {
    params.set("date", dateValue);
  }

  const query = params.toString();
  const nextUrl = query ? `/admin/orders?${query}` : "/admin/orders";

  window.history.replaceState(null, "", nextUrl);
}

export default function AdminOrdersPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all_time");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadOrders(searchValue = "") {
    setLoadingOrders(true);
    setErrorText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/orders");
        return;
      }

      const qs = searchValue.trim()
        ? `?search=${encodeURIComponent(searchValue.trim())}`
        : "";

      const res = await fetch(`/api/admin/orders${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load admin orders.");
      }

      setOrders(Array.isArray(json?.orders) ? json.orders : []);
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load admin orders.");
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId);
    setErrorText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/orders");
        return;
      }

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Status update failed.");
      }

      const updatedOrder = json?.order as OrderRow;

      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? updatedOrder : order)),
      );
    } catch (error: any) {
      setErrorText(error?.message || "Status update failed.");
    } finally {
      setUpdatingId(null);
    }
  }

  function changeFilter(nextFilter: StatusFilter) {
    setActiveFilter(nextFilter);
    updateBrowserUrl(search, nextFilter, dateFilter);
  }

  function changeDateFilter(nextDateFilter: DateFilter) {
    setDateFilter(nextDateFilter);
    updateBrowserUrl(search, activeFilter, nextDateFilter);
  }

  function submitSearch(nextSearch: string) {
    const cleanSearch = nextSearch.trim();

    setSearch(cleanSearch);
    updateBrowserUrl(cleanSearch, activeFilter, dateFilter);
    loadOrders(cleanSearch);
  }

  function resetFilters() {
    setSearch("");
    setActiveFilter("all");
    setDateFilter("all_time");
    updateBrowserUrl("", "all", "all_time");
    loadOrders("");
  }

  useEffect(() => {
    async function checkAdmin() {
      setAuthLoading(true);

      const initialSearch = getInitialSearch();
      const initialStatus = getInitialStatusFilter();
      const initialDate = getInitialDateFilter();

      setSearch(initialSearch);
      setActiveFilter(initialStatus);
      setDateFilter(initialDate);

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        const nextQuery = window.location.search
          ? `/admin/orders${window.location.search}`
          : "/admin/orders";

        router.replace(`/account/login?next=${encodeURIComponent(nextQuery)}`);
        return;
      }

      const email = String(user.email || "")
        .trim()
        .toLowerCase();
      setAdminEmail(email);

      if (!isAdminEmail(email)) {
        setAllowed(false);
        setAuthLoading(false);
        return;
      }

      setAllowed(true);
      setAuthLoading(false);
      await loadOrders(initialSearch);
    }

    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const dateFilteredOrders = useMemo(() => {
    return orders.filter((order) =>
      isOrderInDateFilter(order.created_at, dateFilter),
    );
  }, [orders, dateFilter]);

  const stats = useMemo(() => {
    return {
      total: dateFilteredOrders.length,
      pending: dateFilteredOrders.filter((o) => isPendingStatus(o.status))
        .length,
      placed: dateFilteredOrders.filter(
        (o) => normalizeOrderStatus(o.status) === "placed",
      ).length,
      confirmed: dateFilteredOrders.filter(
        (o) => normalizeOrderStatus(o.status) === "confirmed",
      ).length,
      processing: dateFilteredOrders.filter(
        (o) => normalizeOrderStatus(o.status) === "processing",
      ).length,
      outForDelivery: dateFilteredOrders.filter(
        (o) => normalizeOrderStatus(o.status) === "out_for_delivery",
      ).length,
      delivered: dateFilteredOrders.filter(
        (o) => normalizeOrderStatus(o.status) === "delivered",
      ).length,
      cancelled: dateFilteredOrders.filter(
        (o) => normalizeOrderStatus(o.status) === "cancelled",
      ).length,
    };
  }, [dateFilteredOrders]);

  const displayedOrders = useMemo(() => {
    if (activeFilter === "all") return dateFilteredOrders;

    if (activeFilter === "pending") {
      return dateFilteredOrders.filter((order) =>
        isPendingStatus(order.status),
      );
    }

    return dateFilteredOrders.filter(
      (order) => normalizeOrderStatus(order.status) === activeFilter,
    );
  }, [dateFilteredOrders, activeFilter]);

  function getFilterCount(filter: StatusFilter) {
    if (filter === "all") return stats.total;
    if (filter === "pending") return stats.pending;
    if (filter === "placed") return stats.placed;
    if (filter === "confirmed") return stats.confirmed;
    if (filter === "processing") return stats.processing;
    if (filter === "out_for_delivery") return stats.outForDelivery;
    if (filter === "delivered") return stats.delivered;
    if (filter === "cancelled") return stats.cancelled;
    return 0;
  }

  function exportDisplayedOrdersCsv() {
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

    const rows = displayedOrders.map((order) => {
      const orderNumber = order.sales_order || `Order ${order.id.slice(0, 8)}`;
      const normalizedStatus = normalizeOrderStatus(order.status);
      const orderItems = Array.isArray(order.items) ? order.items : [];
      const itemsText = orderItems
        .map((item: any) => {
          const name = item?.name || item?.item_name || item?.id || "Item";
          const qty = Number(item?.qty || 1);
          const price = Number(item?.price || 0);
          return `${name} x ${qty} @ Rs ${formatPKR(price)}`;
        })
        .join(" | ");

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
        getOrderStatusLabel(normalizedStatus),
        orderItems.length,
        itemsText,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => csvCell(cell)).join(","))
      .join("\n");

    const blob = new Blob([`\ufeff${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = getExportFileName(dateFilter, activeFilter, search);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const selectedDateLabel = getDateFilterLabel(dateFilter);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#a30105]" />
        <p className="mt-3 text-sm font-bold text-neutral-700">
          Checking admin access...
        </p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-red-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-2xl font-black text-neutral-950">
          Admin Access Required
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          This account is not allowed to access admin orders.
        </p>

        <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-3 text-xs font-bold text-neutral-600">
          Logged in as: {adminEmail || "Unknown"}
        </p>

        <Link
          href="/account"
          className="mt-6 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white"
        >
          Back to Account
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Admin Panel
            </p>

            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              Order Status Management
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Yahan se website/customer app orders ka status update hoga.
              Customer ke order detail page par tracking timeline instantly
              updated show hogi.
            </p>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
            Admin: {adminEmail}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase text-neutral-600">
            Search: {search || "None"}
          </span>

          <span className="rounded-full border border-[#a30105]/20 bg-[#fff7f7] px-4 py-2 text-xs font-black uppercase text-[#a30105]">
            Status: {activeFilter.replaceAll("_", " ")}
          </span>

          <span className="rounded-full border border-[#a30105]/20 bg-[#fff7f7] px-4 py-2 text-xs font-black uppercase text-[#a30105]">
            Date: {selectedDateLabel}
          </span>

          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase text-neutral-600">
            Showing: {displayedOrders.length}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <button
            type="button"
            onClick={() => changeFilter("all")}
            className={`rounded-2xl border p-4 text-left transition ${getFilterButtonClass(
              activeFilter === "all",
              "all",
            )}`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <PackageCheck className="h-4 w-4" />
              Total
            </div>
            <div className="mt-2 text-2xl font-black">{stats.total}</div>
          </button>

          <button
            type="button"
            onClick={() => changeFilter("pending")}
            className={`rounded-2xl border p-4 text-left transition ${getFilterButtonClass(
              activeFilter === "pending",
              "pending",
            )}`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Clock3 className="h-4 w-4" />
              Pending
            </div>
            <div className="mt-2 text-2xl font-black">{stats.pending}</div>
          </button>

          <button
            type="button"
            onClick={() => changeFilter("placed")}
            className={`rounded-2xl border p-4 text-left transition ${getFilterButtonClass(
              activeFilter === "placed",
              "placed",
            )}`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <CalendarDays className="h-4 w-4" />
              Placed
            </div>
            <div className="mt-2 text-2xl font-black">{stats.placed}</div>
          </button>

          <button
            type="button"
            onClick={() => changeFilter("confirmed")}
            className={`rounded-2xl border p-4 text-left transition ${getFilterButtonClass(
              activeFilter === "confirmed",
              "confirmed",
            )}`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="h-4 w-4" />
              Confirmed
            </div>
            <div className="mt-2 text-2xl font-black">{stats.confirmed}</div>
          </button>

          <button
            type="button"
            onClick={() => changeFilter("processing")}
            className={`rounded-2xl border p-4 text-left transition ${getFilterButtonClass(
              activeFilter === "processing",
              "processing",
            )}`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Truck className="h-4 w-4" />
              Processing
            </div>
            <div className="mt-2 text-2xl font-black">{stats.processing}</div>
          </button>

          <button
            type="button"
            onClick={() => changeFilter("out_for_delivery")}
            className={`rounded-2xl border p-4 text-left transition ${getFilterButtonClass(
              activeFilter === "out_for_delivery",
              "out_for_delivery",
            )}`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Truck className="h-4 w-4" />
              Out
            </div>
            <div className="mt-2 text-2xl font-black">
              {stats.outForDelivery}
            </div>
          </button>

          <button
            type="button"
            onClick={() => changeFilter("delivered")}
            className={`rounded-2xl border p-4 text-left transition ${getFilterButtonClass(
              activeFilter === "delivered",
              "delivered",
            )}`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <PackageCheck className="h-4 w-4" />
              Delivered
            </div>
            <div className="mt-2 text-2xl font-black">{stats.delivered}</div>
          </button>

          <button
            type="button"
            onClick={() => changeFilter("cancelled")}
            className={`rounded-2xl border p-4 text-left transition ${getFilterButtonClass(
              activeFilter === "cancelled",
              "cancelled",
            )}`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <XCircle className="h-4 w-4" />
              Cancelled
            </div>
            <div className="mt-2 text-2xl font-black">{stats.cancelled}</div>
          </button>
        </div>
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex flex-wrap gap-2">
            {DATE_FILTERS.map((filter) => {
              const active = dateFilter === filter.key;

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => changeDateFilter(filter.key)}
                  className={`rounded-full border px-4 py-2 text-xs font-black uppercase transition ${getDateFilterButtonClass(
                    active,
                  )}`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch(search);
          }}
          className="flex flex-col gap-3 md:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by order, customer, phone, email, city..."
              className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#a30105] focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loadingOrders}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#a30105] px-6 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingOrders ? "Loading..." : "Search"}
          </button>

          <button
            type="button"
            disabled={loadingOrders}
            onClick={resetFilters}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>

          <button
            type="button"
            disabled={loadingOrders || displayedOrders.length === 0}
            onClick={exportDisplayedOrdersCsv}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-6 text-sm font-black text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => {
            const active = activeFilter === filter.key;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => changeFilter(filter.key)}
                className={`rounded-full border px-4 py-2 text-xs font-black uppercase transition ${getFilterButtonClass(
                  active,
                  filter.key,
                )}`}
              >
                {filter.label} ({getFilterCount(filter.key)})
              </button>
            );
          })}
        </div>

        {errorText ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorText}
          </div>
        ) : null}
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        {loadingOrders ? (
          <div className="p-10 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
            <p className="mt-3 text-sm font-bold text-neutral-600">
              Loading orders...
            </p>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <h2 className="text-xl font-black text-neutral-950">
              No Orders Found
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Search reset karo ya status/date filter change karo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Phone / City</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Update</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>

              <tbody>
                {displayedOrders.map((order) => {
                  const orderNumber =
                    order.sales_order || `Order ${order.id.slice(0, 8)}`;
                  const normalizedStatus = normalizeOrderStatus(order.status);
                  const isUpdating = updatingId === order.id;

                  return (
                    <tr key={order.id}>
                      <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="font-black text-neutral-950">
                          {orderNumber}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(order.created_at)}
                        </div>
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="flex items-start gap-2">
                          <UserRound className="mt-0.5 h-4 w-4 text-neutral-400" />
                          <div>
                            <div className="font-bold text-neutral-950">
                              {order.customer_name || "Customer"}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {order.customer_email || "No email"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="font-bold text-neutral-900">
                          {order.customer_phone || "No phone"}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {order.city || "No city"}
                        </div>
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <div className="font-black text-neutral-950">
                          Rs {formatPKR(order.total_amount)}
                        </div>
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-black uppercase text-neutral-700">
                          {order.payment_method || "cod"}
                        </span>
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusClasses(
                            normalizedStatus,
                          )}`}
                        >
                          {getOrderStatusLabel(normalizedStatus)}
                        </span>
                      </td>

                      <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <select
                          value={normalizedStatus}
                          disabled={isUpdating}
                          onChange={(event) =>
                            updateStatus(order.id, event.target.value)
                          }
                          className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-black uppercase text-neutral-800 outline-none focus:border-[#a30105] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {getOrderStatusLabel(status)}
                            </option>
                          ))}
                        </select>

                        {isUpdating ? (
                          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-neutral-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving...
                          </div>
                        ) : null}
                      </td>

                      <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-3 py-2 text-xs font-black text-white transition hover:bg-neutral-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
