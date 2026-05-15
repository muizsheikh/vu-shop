"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getOrderStatusLabel, normalizeOrderStatus } from "@/lib/admin";

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

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type DateFilter =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "all_time";

type DashboardStats = {
  total_orders: number;
  period_revenue: number;
  delivered_revenue: number;
  pending: number;
  placed: number;
  confirmed: number;
  processing: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
};

type CustomerSummary = {
  total_customers_in_period: number;
};

type TopCity = {
  city: string;
  orders: number;
  revenue: number;
};

type DashboardPermissions = {
  can_view_orders: boolean;
  can_view_customers: boolean;
  can_view_reports: boolean;
};

const DEFAULT_STATS: DashboardStats = {
  total_orders: 0,
  period_revenue: 0,
  delivered_revenue: 0,
  pending: 0,
  placed: 0,
  confirmed: 0,
  processing: 0,
  out_for_delivery: 0,
  delivered: 0,
  cancelled: 0,
};

const DEFAULT_CUSTOMER_SUMMARY: CustomerSummary = {
  total_customers_in_period: 0,
};

const DEFAULT_PERMISSIONS: DashboardPermissions = {
  can_view_orders: false,
  can_view_customers: false,
  can_view_reports: false,
};

const DATE_FILTERS: { key: DateFilter; label: string; shortLabel: string }[] = [
  { key: "today", label: "Today", shortLabel: "Today" },
  { key: "yesterday", label: "Yesterday", shortLabel: "Yesterday" },
  { key: "last_7_days", label: "Last 7 Days", shortLabel: "7 Days" },
  { key: "last_30_days", label: "Last 30 Days", shortLabel: "30 Days" },
  { key: "all_time", label: "All Time", shortLabel: "All Time" },
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

function getDateFilterLabel(filter: DateFilter) {
  return DATE_FILTERS.find((item) => item.key === filter)?.label || "Today";
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

function getDateFilterButtonClass(active: boolean) {
  if (active) {
    return "border-[#a30105]/25 bg-[#fff7f7] text-[#a30105]";
  }

  return "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50";
}

function clickableCardClass(extra = "") {
  return `block rounded-[26px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_65px_rgba(0,0,0,0.08)] ${extra}`;
}

function getOrdersHref(dateFilter: DateFilter, status?: string) {
  const params = new URLSearchParams();

  if (dateFilter !== "all_time") {
    params.set("date", dateFilter);
  }

  if (status) {
    params.set("status", status);
  }

  const query = params.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");

  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary>(
    DEFAULT_CUSTOMER_SUMMARY
  );
  const [permissions, setPermissions] =
    useState<DashboardPermissions>(DEFAULT_PERMISSIONS);
  const [topCities, setTopCities] = useState<TopCity[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadDashboard(options?: {
    dateValue?: DateFilter;
    tokenFromCheck?: string;
  }) {
    setLoadingDashboard(true);
    setErrorText("");

    const nextDate = options?.dateValue ?? dateFilter;

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin");
        return;
      }

      const params = new URLSearchParams();
      params.set("date", nextDate);

      const res = await fetch(`/api/admin/dashboard?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setAllowed(false);
        setAccessError(json?.error || "Admin access required.");
        throw new Error(json?.error || "Failed to load dashboard data.");
      }

      setAllowed(true);
      setStats(json?.stats || DEFAULT_STATS);
      setCustomerSummary(json?.customer_summary || DEFAULT_CUSTOMER_SUMMARY);
      setPermissions(json?.permissions || DEFAULT_PERMISSIONS);
      setTopCities(Array.isArray(json?.top_cities) ? json.top_cities : []);
      setRecentOrders(
        Array.isArray(json?.recent_orders) ? json.recent_orders : []
      );

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load dashboard data.");
      setStats(DEFAULT_STATS);
      setCustomerSummary(DEFAULT_CUSTOMER_SUMMARY);
      setPermissions(DEFAULT_PERMISSIONS);
      setTopCities([]);
      setRecentOrders([]);
    } finally {
      setLoadingDashboard(false);
    }
  }

  function changeDateFilter(nextFilter: DateFilter) {
    setDateFilter(nextFilter);
    loadDashboard({ dateValue: nextFilter });
  }

  useEffect(() => {
    async function initAdmin() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.access_token) {
        router.replace("/account/login?next=/admin");
        return;
      }

      setAdminEmail(String(session.user?.email || "").trim().toLowerCase());
      setAllowed(true);
      setAuthLoading(false);

      await loadDashboard({
        dateValue: "today",
        tokenFromCheck: session.access_token,
      });
    }

    initAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const statusBreakdown = [
    { key: "placed", label: "Placed", value: stats.placed },
    { key: "confirmed", label: "Confirmed", value: stats.confirmed },
    { key: "processing", label: "Processing", value: stats.processing },
    {
      key: "out_for_delivery",
      label: "Out for Delivery",
      value: stats.out_for_delivery,
    },
    { key: "delivered", label: "Delivered", value: stats.delivered },
    { key: "cancelled", label: "Cancelled", value: stats.cancelled },
  ];

  const selectedPeriodLabel = getDateFilterLabel(dateFilter);
  const periodOrdersHref = getOrdersHref(dateFilter);
  const pendingOrdersHref = getOrdersHref(dateFilter, "pending");
  const deliveredOrdersHref = getOrdersHref(dateFilter, "delivered");
  const cancelledOrdersHref = getOrdersHref(dateFilter, "cancelled");

  const periodCustomersHref =
    dateFilter === "all_time"
      ? "/admin/customers"
      : `/admin/customers?date=${dateFilter}`;

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

  if (!allowed && accessError) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-red-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-2xl font-black text-neutral-950">
          Admin Access Required
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {accessError || "This account is not allowed to access admin dashboard."}
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
              Vape Ustad Admin
            </p>

            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              Dashboard Summary
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              API-powered dashboard for website orders, revenue, workload,
              customer activity and city performance.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={periodOrdersHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#a30105] px-4 py-3 text-sm font-black text-white transition hover:bg-[#8f0104]"
            >
              Manage Orders
              <ArrowRight className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={() => loadDashboard()}
              disabled={loadingDashboard}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingDashboard ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clock3 className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-black uppercase text-green-700">
            Admin: {adminEmail}
          </span>

          <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase text-blue-700">
            Role: {adminUser?.role || "admin"}
          </span>

          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase text-neutral-600">
            Recent Orders: {recentOrders.length}
          </span>

          <span className="rounded-full border border-[#a30105]/20 bg-[#fff7f7] px-4 py-2 text-xs font-black uppercase text-[#a30105]">
            Period: {selectedPeriodLabel}
          </span>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
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

        {errorText ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorText}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href={periodOrdersHref}
          className={clickableCardClass("border-neutral-200 bg-white")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#a30105]/10 text-[#a30105]">
              <CalendarDays className="h-5 w-5" />
            </div>

            <span className="rounded-full bg-neutral-50 px-3 py-1 text-xs font-black uppercase text-neutral-500">
              {selectedPeriodLabel}
            </span>
          </div>

          <div className="mt-5 text-sm font-bold uppercase tracking-wider text-neutral-500">
            Period Orders
          </div>

          <div className="mt-2 text-3xl font-black text-neutral-950">
            {stats.total_orders}
          </div>

          <div className="mt-2 text-sm text-neutral-500">
            Revenue:{" "}
            <span className="font-black text-neutral-950">
              Rs {formatPKR(stats.period_revenue)}
            </span>
          </div>

          <div className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase text-[#a30105]">
            Open {selectedPeriodLabel} Orders
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        <Link
          href={pendingOrdersHref}
          className={clickableCardClass("border-neutral-200 bg-white")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Clock3 className="h-5 w-5" />
            </div>

            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">
              Active
            </span>
          </div>

          <div className="mt-5 text-sm font-bold uppercase tracking-wider text-neutral-500">
            Pending Orders
          </div>

          <div className="mt-2 text-3xl font-black text-neutral-950">
            {stats.pending}
          </div>

          <div className="mt-2 text-sm text-neutral-500">
            Placed / Confirmed / Processing / Out
          </div>

          <div className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase text-amber-700">
            View {selectedPeriodLabel} Pending
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        <Link
          href={deliveredOrdersHref}
          className={clickableCardClass("border-green-200 bg-green-50/40")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-green-700">
              Delivered
            </span>
          </div>

          <div className="mt-5 text-sm font-bold uppercase tracking-wider text-green-700">
            Delivered Revenue
          </div>

          <div className="mt-2 text-3xl font-black text-green-800">
            Rs {formatPKR(stats.delivered_revenue)}
          </div>

          <div className="mt-2 text-sm text-green-700">
            Delivered Orders: {stats.delivered}
          </div>

          <div className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase text-green-700">
            View {selectedPeriodLabel} Delivered
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        <Link
          href={cancelledOrdersHref}
          className={clickableCardClass("border-red-200 bg-red-50/40")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <XCircle className="h-5 w-5" />
            </div>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-red-700">
              Cancelled
            </span>
          </div>

          <div className="mt-5 text-sm font-bold uppercase tracking-wider text-red-700">
            Cancelled Orders
          </div>

          <div className="mt-2 text-3xl font-black text-red-800">
            {stats.cancelled}
          </div>

          <div className="mt-2 text-sm text-red-700">
            Period Orders: {stats.total_orders}
          </div>

          <div className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase text-red-700">
            View {selectedPeriodLabel} Cancelled
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
                Latest
              </p>

              <h2 className="mt-2 text-2xl font-black text-neutral-950">
                Recent Orders
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                Showing latest orders for {selectedPeriodLabel}.
              </p>
            </div>

            <Link
              href={periodOrdersHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-900 transition hover:bg-neutral-50"
            >
              View {selectedPeriodLabel} Orders
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loadingDashboard ? (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#a30105]" />
              <p className="mt-3 text-sm font-bold text-neutral-600">
                Loading latest orders...
              </p>
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
              No orders found for {selectedPeriodLabel}.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {recentOrders.map((order) => {
                const orderNumber =
                  order.sales_order || `Order ${order.id.slice(0, 8)}`;
                const status = normalizeOrderStatus(order.status);

                return (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-black text-neutral-950">
                          {orderNumber}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-neutral-500">
                          <span>{formatDate(order.created_at)}</span>
                          <span>•</span>
                          <span>{order.customer_name || "Customer"}</span>
                          <span>•</span>
                          <span>{order.customer_phone || "No phone"}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusClasses(
                            status
                          )}`}
                        >
                          {getOrderStatusLabel(status)}
                        </span>

                        <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-black uppercase text-neutral-700">
                          Rs {formatPKR(order.total_amount)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Status
            </p>

            <h2 className="mt-2 text-2xl font-black text-neutral-950">
              Breakdown
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Based on {selectedPeriodLabel}.
            </p>

            <div className="mt-6 space-y-3">
              {statusBreakdown.map((item) => {
                const percent =
                  stats.total_orders > 0
                    ? Math.round((item.value / stats.total_orders) * 100)
                    : 0;

                return (
                  <Link
                    key={item.key}
                    href={getOrdersHref(dateFilter, item.key)}
                    className="block rounded-2xl border border-transparent p-2 transition hover:border-neutral-200 hover:bg-neutral-50"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-neutral-700">
                        {item.label}
                      </span>
                      <span className="font-black text-neutral-950">
                        {item.value}
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-[#a30105]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Revenue
            </p>

            <h2 className="mt-2 text-2xl font-black text-neutral-950">
              Period Summary
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Showing {selectedPeriodLabel} performance.
            </p>

            <div className="mt-6 space-y-4">
              <Link
                href={periodOrdersHref}
                className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                  <CreditCard className="h-4 w-4" />
                  Period Revenue
                </div>
                <div className="mt-2 text-2xl font-black text-neutral-950">
                  Rs {formatPKR(stats.period_revenue)}
                </div>
              </Link>

              <Link
                href={periodOrdersHref}
                className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                  <ShoppingBag className="h-4 w-4" />
                  Period Orders
                </div>
                <div className="mt-2 text-2xl font-black text-neutral-950">
                  {stats.total_orders}
                </div>
              </Link>

              <Link
                href={pendingOrdersHref}
                className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                  <Truck className="h-4 w-4" />
                  Active Workload
                </div>
                <div className="mt-2 text-2xl font-black text-neutral-950">
                  {stats.pending}
                </div>
              </Link>
            </div>
          </div>

          <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Customers
            </p>

            <h2 className="mt-2 text-2xl font-black text-neutral-950">
              Customer Activity
            </h2>

            <div className="mt-6 grid gap-3">
              {permissions.can_view_customers ? (
                <Link
                  href={periodCustomersHref}
                  className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                    <UsersRound className="h-4 w-4" />
                    Customers In Period
                  </div>
                  <div className="mt-2 text-2xl font-black text-neutral-950">
                    {customerSummary.total_customers_in_period}
                  </div>
                </Link>
              ) : null}

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Selected Period
                </div>
                <div className="mt-2 text-lg font-black text-neutral-950">
                  {selectedPeriodLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Cities
            </p>

            <h2 className="mt-2 text-2xl font-black text-neutral-950">
              Top Cities
            </h2>

            <div className="mt-6 space-y-3">
              {topCities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center text-sm text-neutral-500">
                  No city data for this period.
                </div>
              ) : (
                topCities.map((city) => (
                  <Link
                    key={city.city}
                    href={`/admin/orders?search=${encodeURIComponent(
                      city.city
                    )}${dateFilter !== "all_time" ? `&date=${dateFilter}` : ""}`}
                    className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-black text-neutral-950">
                          <MapPin className="h-4 w-4 text-[#a30105]" />
                          {city.city}
                        </div>
                        <div className="mt-1 text-xs font-bold text-neutral-500">
                          {city.orders} orders
                        </div>
                      </div>

                      <div className="text-right text-sm font-black text-neutral-950">
                        Rs {formatPKR(city.revenue)}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}