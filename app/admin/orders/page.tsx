"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  delivery_method?: string | null;
  rider_name?: string | null;
  rider_phone?: string | null;
  delivery_note?: string | null;
  tracking_number?: string | null;
  expected_delivery_time?: string | null;
};

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
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

type PaginationState = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
};

type SummaryState = {
  total: number;
  pending: number;
  placed: number;
  confirmed: number;
  processing: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
};

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

const LIMIT_OPTIONS = [10, 20, 50, 100];

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  limit: 20,
  total_count: 0,
  total_pages: 1,
  has_next_page: false,
  has_previous_page: false,
};

const DEFAULT_SUMMARY: SummaryState = {
  total: 0,
  pending: 0,
  placed: 0,
  confirmed: 0,
  processing: 0,
  out_for_delivery: 0,
  delivered: 0,
  cancelled: 0,
};

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

function getDateFilterLabel(filter: DateFilter) {
  return DATE_FILTERS.find((item) => item.key === filter)?.label || "All Time";
}

function isValidStatusFilter(value: string | null): value is StatusFilter {
  return STATUS_FILTERS.some((filter) => filter.key === value);
}

function isValidDateFilter(value: string | null): value is DateFilter {
  return DATE_FILTERS.some((filter) => filter.key === value);
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
  searchValue: string
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

function getInitialPage() {
  if (typeof window === "undefined") return 1;

  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("page") || "1");

  if (!Number.isFinite(page) || page < 1) return 1;

  return Math.floor(page);
}

function getInitialLimit() {
  if (typeof window === "undefined") return 20;

  const params = new URLSearchParams(window.location.search);
  const limit = Number(params.get("limit") || "20");

  if (!LIMIT_OPTIONS.includes(limit)) return 20;

  return limit;
}

function updateBrowserUrl(
  searchValue: string,
  statusValue: StatusFilter,
  dateValue: DateFilter,
  pageValue: number,
  limitValue: number
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

  if (pageValue > 1) {
    params.set("page", String(pageValue));
  }

  if (limitValue !== 20) {
    params.set("limit", String(limitValue));
  }

  const query = params.toString();
  const nextUrl = query ? `/admin/orders?${query}` : "/admin/orders";

  window.history.replaceState(null, "", nextUrl);
}

export default function AdminOrdersPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all_time");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION);
  const [summary, setSummary] = useState<SummaryState>(DEFAULT_SUMMARY);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exportingFullCsv, setExportingFullCsv] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function checkAdminAccess() {
    const token = await getAccessToken();

    if (!token) {
      const nextQuery =
        typeof window !== "undefined" && window.location.search
          ? `/admin/orders${window.location.search}`
          : "/admin/orders";

      router.replace(`/account/login?next=${encodeURIComponent(nextQuery)}`);
      return null;
    }

    const res = await fetch("/api/admin/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.allowed) {
      setAllowed(false);
      setAccessError(json?.error || "Admin access required.");
      setAdminUser(json?.user || null);
      setAdminEmail(json?.user?.email || "");
      return null;
    }

    const user = json.user as AdminUser;
    setAllowed(true);
    setAdminUser(user);
    setAdminEmail(user.email || "");

    return token;
  }

  async function loadOrders(options?: {
    searchValue?: string;
    statusValue?: StatusFilter;
    dateValue?: DateFilter;
    pageValue?: number;
    limitValue?: number;
    tokenFromCheck?: string;
  }) {
    setLoadingOrders(true);
    setErrorText("");

    const nextSearch = options?.searchValue ?? search;
    const nextStatus = options?.statusValue ?? activeFilter;
    const nextDate = options?.dateValue ?? dateFilter;
    const nextPage = options?.pageValue ?? page;
    const nextLimit = options?.limitValue ?? limit;

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/orders");
        return;
      }

      const params = new URLSearchParams();

      if (nextSearch.trim()) {
        params.set("search", nextSearch.trim());
      }

      if (nextStatus !== "all") {
        params.set("status", nextStatus);
      }

      if (nextDate !== "all_time") {
        params.set("date", nextDate);
      }

      params.set("page", String(nextPage));
      params.set("limit", String(nextLimit));

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load admin orders.");
      }

      const nextPagination = json?.pagination || DEFAULT_PAGINATION;

      setOrders(Array.isArray(json?.orders) ? json.orders : []);
      setPagination(nextPagination);
      setSummary(json?.summary || DEFAULT_SUMMARY);
      setPage(Number(nextPagination.page || nextPage));
      setLimit(Number(nextPagination.limit || nextLimit));

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load admin orders.");
      setOrders([]);
      setPagination(DEFAULT_PAGINATION);
      setSummary(DEFAULT_SUMMARY);
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

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }

      await loadOrders({ tokenFromCheck: token });
    } catch (error: any) {
      setErrorText(error?.message || "Status update failed.");
    } finally {
      setUpdatingId(null);
    }
  }

  function changeFilter(nextFilter: StatusFilter) {
    const nextPage = 1;

    setActiveFilter(nextFilter);
    setPage(nextPage);
    updateBrowserUrl(search, nextFilter, dateFilter, nextPage, limit);
    loadOrders({
      statusValue: nextFilter,
      pageValue: nextPage,
    });
  }

  function changeDateFilter(nextDateFilter: DateFilter) {
    const nextPage = 1;

    setDateFilter(nextDateFilter);
    setPage(nextPage);
    updateBrowserUrl(search, activeFilter, nextDateFilter, nextPage, limit);
    loadOrders({
      dateValue: nextDateFilter,
      pageValue: nextPage,
    });
  }

  function changePage(nextPage: number) {
    const safePage = Math.max(1, Math.min(nextPage, pagination.total_pages || 1));

    setPage(safePage);
    updateBrowserUrl(search, activeFilter, dateFilter, safePage, limit);
    loadOrders({
      pageValue: safePage,
    });
  }

  function changeLimit(nextLimit: number) {
    const safeLimit = LIMIT_OPTIONS.includes(nextLimit) ? nextLimit : 20;
    const nextPage = 1;

    setLimit(safeLimit);
    setPage(nextPage);
    updateBrowserUrl(search, activeFilter, dateFilter, nextPage, safeLimit);
    loadOrders({
      limitValue: safeLimit,
      pageValue: nextPage,
    });
  }

  function submitSearch(nextSearch: string) {
    const cleanSearch = nextSearch.trim();
    const nextPage = 1;

    setSearch(cleanSearch);
    setPage(nextPage);
    updateBrowserUrl(cleanSearch, activeFilter, dateFilter, nextPage, limit);
    loadOrders({
      searchValue: cleanSearch,
      pageValue: nextPage,
    });
  }

  function resetFilters() {
    setSearch("");
    setActiveFilter("all");
    setDateFilter("all_time");
    setPage(1);
    updateBrowserUrl("", "all", "all_time", 1, limit);
    loadOrders({
      searchValue: "",
      statusValue: "all",
      dateValue: "all_time",
      pageValue: 1,
    });
  }

  useEffect(() => {
    async function initAdmin() {
      setAuthLoading(true);

      const initialSearch = getInitialSearch();
      const initialStatus = getInitialStatusFilter();
      const initialDate = getInitialDateFilter();
      const initialPage = getInitialPage();
      const initialLimit = getInitialLimit();

      setSearch(initialSearch);
      setActiveFilter(initialStatus);
      setDateFilter(initialDate);
      setPage(initialPage);
      setLimit(initialLimit);

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        const nextQuery = window.location.search
          ? `/admin/orders${window.location.search}`
          : "/admin/orders";

        router.replace(`/account/login?next=${encodeURIComponent(nextQuery)}`);
        return;
      }

      setAdminEmail(String(user.email || "").trim().toLowerCase());

      const token = await checkAdminAccess();

      setAuthLoading(false);

      if (token) {
        await loadOrders({
          searchValue: initialSearch,
          statusValue: initialStatus,
          dateValue: initialDate,
          pageValue: initialPage,
          limitValue: initialLimit,
          tokenFromCheck: token,
        });
      }
    }

    initAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const displayedOrders = orders;

  function getFilterCount(filter: StatusFilter) {
    if (filter === "all") return summary.total;
    if (filter === "pending") return summary.pending;
    if (filter === "placed") return summary.placed;
    if (filter === "confirmed") return summary.confirmed;
    if (filter === "processing") return summary.processing;
    if (filter === "out_for_delivery") return summary.out_for_delivery;
    if (filter === "delivered") return summary.delivered;
    if (filter === "cancelled") return summary.cancelled;
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



  async function exportFullOrdersCsv() {
    setExportingFullCsv(true);
    setErrorText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/orders");
        return;
      }

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (activeFilter !== "all") {
        params.set("status", activeFilter);
      }

      if (dateFilter !== "all_time") {
        params.set("date", dateFilter);
      }

      const res = await fetch(`/api/admin/orders/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Full CSV export failed.");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const fileName =
        fileNameMatch?.[1] ||
        getExportFileName(dateFilter, activeFilter, search).replace(
          "vape-ustad-orders_",
          "vape-ustad-orders-full_"
        );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setErrorText(error?.message || "Full CSV export failed.");
    } finally {
      setExportingFullCsv(false);
    }
  }

  const selectedDateLabel = getDateFilterLabel(dateFilter);
  const pageStart =
    pagination.total_count === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const pageEnd = Math.min(
    pagination.page * pagination.limit,
    pagination.total_count
  );

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
          {accessError || "This account is not allowed to access admin orders."}
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
              Orders ab server-side search, status filter, date filter aur
              pagination ke sath load ho rahe hain.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
              Admin: {adminEmail}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold uppercase text-blue-700">
              Role: {adminUser?.role || "admin"}
            </div>
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
            Showing: {pageStart}-{pageEnd} of {pagination.total_count}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {STATUS_FILTERS.map((filter) => {
            const active = activeFilter === filter.key;
            const count = getFilterCount(filter.key);

            const icon =
              filter.key === "all" ? (
                <PackageCheck className="h-4 w-4" />
              ) : filter.key === "pending" ? (
                <Clock3 className="h-4 w-4" />
              ) : filter.key === "placed" ? (
                <CalendarDays className="h-4 w-4" />
              ) : filter.key === "confirmed" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : filter.key === "delivered" ? (
                <PackageCheck className="h-4 w-4" />
              ) : filter.key === "cancelled" ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <Truck className="h-4 w-4" />
              );

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => changeFilter(filter.key)}
                className={`rounded-2xl border p-4 text-left transition ${getFilterButtonClass(
                  active,
                  filter.key
                )}`}
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  {icon}
                  {filter.key === "out_for_delivery" ? "Out" : filter.label}
                </div>
                <div className="mt-2 text-2xl font-black">{count}</div>
              </button>
            );
          })}
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
                    active
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

          <select
            value={limit}
            onChange={(event) => changeLimit(Number(event.target.value))}
            className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-neutral-800 outline-none focus:border-[#a30105]"
          >
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} / page
              </option>
            ))}
          </select>

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
            Export Page CSV
          </button>

          <button
            type="button"
            disabled={loadingOrders || exportingFullCsv || pagination.total_count === 0}
            onClick={exportFullOrdersCsv}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#a30105]/20 bg-[#fff7f7] px-6 text-sm font-black text-[#a30105] transition hover:bg-[#fff1f1] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportingFullCsv ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportingFullCsv ? "Exporting..." : "Export Full CSV"}
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
                  filter.key
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-bold text-neutral-600">
            Page{" "}
            <span className="font-black text-neutral-950">
              {pagination.page}
            </span>{" "}
            of{" "}
            <span className="font-black text-neutral-950">
              {pagination.total_pages}
            </span>{" "}
            • Total{" "}
            <span className="font-black text-neutral-950">
              {pagination.total_count}
            </span>{" "}
            orders
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loadingOrders || !pagination.has_previous_page}
              onClick={() => changePage(pagination.page - 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              disabled={loadingOrders || !pagination.has_next_page}
              onClick={() => changePage(pagination.page + 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

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
                            normalizedStatus
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

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-bold text-neutral-600">
            Showing {pageStart}-{pageEnd} of {pagination.total_count}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loadingOrders || !pagination.has_previous_page}
              onClick={() => changePage(pagination.page - 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              disabled={loadingOrders || !pagination.has_next_page}
              onClick={() => changePage(pagination.page + 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}