"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  UsersRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getOrderStatusLabel, normalizeOrderStatus } from "@/lib/admin";

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

type ReportSummary = {
  total_orders: number;
  total_revenue: number;
  delivered_revenue: number;
  average_order_value: number;
  unique_customers: number;
};

type StatusBreakdown = {
  status: string;
  orders: number;
  revenue: number;
};

type PaymentSummary = {
  payment_method: string;
  orders: number;
  revenue: number;
};

type CitySummary = {
  city: string;
  orders: number;
  revenue: number;
};

type TopCustomer = {
  customer_key: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  orders: number;
  revenue: number;
  last_order_at: string | null;
};

type RecentOrder = {
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

const DEFAULT_SUMMARY: ReportSummary = {
  total_orders: 0,
  total_revenue: 0,
  delivered_revenue: 0,
  average_order_value: 0,
  unique_customers: 0,
};

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

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

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

function getDateFilterButtonClass(active: boolean) {
  if (active) {
    return "border-[#a30105]/25 bg-[#fff7f7] text-[#a30105]";
  }

  return "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50";
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

function getCustomerHref(customerKey: string) {
  return `/admin/customers/${encodeURIComponent(customerKey)}`;
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");

  const [loadingReports, setLoadingReports] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const [summary, setSummary] = useState<ReportSummary>(DEFAULT_SUMMARY);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary[]>([]);
  const [citySummary, setCitySummary] = useState<CitySummary[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadReports(options?: {
    dateValue?: DateFilter;
    tokenFromCheck?: string;
  }) {
    setLoadingReports(true);
    setErrorText("");

    const nextDate = options?.dateValue ?? dateFilter;

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/reports");
        return;
      }

      const params = new URLSearchParams();
      params.set("date", nextDate);

      const res = await fetch(`/api/admin/reports?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setAllowed(false);
        setAccessError(json?.error || "Reports access required.");
        throw new Error(json?.error || "Failed to load reports.");
      }

      setAllowed(true);
      setSummary(json?.summary || DEFAULT_SUMMARY);
      setStatusBreakdown(
        Array.isArray(json?.status_breakdown) ? json.status_breakdown : []
      );
      setPaymentSummary(
        Array.isArray(json?.payment_summary) ? json.payment_summary : []
      );
      setCitySummary(Array.isArray(json?.city_summary) ? json.city_summary : []);
      setTopCustomers(
        Array.isArray(json?.top_customers) ? json.top_customers : []
      );
      setRecentOrders(
        Array.isArray(json?.recent_orders) ? json.recent_orders : []
      );

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load reports.");
      setSummary(DEFAULT_SUMMARY);
      setStatusBreakdown([]);
      setPaymentSummary([]);
      setCitySummary([]);
      setTopCustomers([]);
      setRecentOrders([]);
    } finally {
      setLoadingReports(false);
    }
  }

  function changeDateFilter(nextFilter: DateFilter) {
    setDateFilter(nextFilter);
    loadReports({ dateValue: nextFilter });
  }

  useEffect(() => {
    async function initAdmin() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.access_token) {
        router.replace("/account/login?next=/admin/reports");
        return;
      }

      setAdminEmail(String(session.user?.email || "").trim().toLowerCase());
      setAllowed(true);
      setAuthLoading(false);

      await loadReports({
        dateValue: "today",
        tokenFromCheck: session.access_token,
      });
    }

    initAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const selectedPeriodLabel = getDateFilterLabel(dateFilter);

  const cards = useMemo(
    () => [
      {
        label: "Total Orders",
        value: summary.total_orders,
        sub: selectedPeriodLabel,
        icon: ShoppingBag,
        href: getOrdersHref(dateFilter),
        className: "border-neutral-200 bg-white text-neutral-950",
      },
      {
        label: "Total Revenue",
        value: `Rs ${formatPKR(summary.total_revenue)}`,
        sub: "All statuses",
        icon: Wallet,
        href: getOrdersHref(dateFilter),
        className: "border-[#a30105]/20 bg-[#fff7f7] text-[#a30105]",
      },
      {
        label: "Delivered Revenue",
        value: `Rs ${formatPKR(summary.delivered_revenue)}`,
        sub: "Completed orders",
        icon: CheckCircle2,
        href: getOrdersHref(dateFilter, "delivered"),
        className: "border-green-200 bg-green-50 text-green-700",
      },
      {
        label: "Unique Customers",
        value: summary.unique_customers,
        sub: "Order-based identity",
        icon: UsersRound,
        href: "/admin/customers",
        className: "border-blue-200 bg-blue-50 text-blue-700",
      },
    ],
    [summary, selectedPeriodLabel, dateFilter]
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

  if (!allowed && accessError) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-red-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-2xl font-black text-neutral-950">
          Reports Access Required
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {accessError || "This account is not allowed to access reports."}
        </p>

        <p className="mt-3 rounded-2xl bg-neutral-50 px-4 py-3 text-xs font-bold text-neutral-600">
          Logged in as: {adminEmail || "Unknown"}
        </p>

        <Link
          href="/admin"
          className="mt-6 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white"
        >
          Back to Dashboard
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
              Admin Reports
            </p>

            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              Sales & Customer Reports
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Business reporting foundation for revenue, order status, payment
              methods, cities and top customers. Attendance + ERPNext geo module
              is now part of the roadmap.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadReports()}
              disabled={loadingReports}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingReports ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4" />
              )}
              Refresh
            </button>

            <Link
              href="/admin/orders"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-black text-white transition hover:bg-[#8f0104]"
            >
              Open Orders
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-black uppercase text-green-700">
            Admin: {adminEmail}
          </span>

          <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase text-blue-700">
            Role: {adminUser?.role || "admin"}
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
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.label}
              href={card.href}
              className={`rounded-[26px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_65px_rgba(0,0,0,0.08)] ${card.className}`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75">
                <Icon className="h-5 w-5" />
              </div>

              <div className="mt-5 text-sm font-bold uppercase tracking-wider opacity-80">
                {card.label}
              </div>

              <div className="mt-2 text-3xl font-black">{card.value}</div>

              <div className="mt-2 text-sm font-bold opacity-70">{card.sub}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
            Status
          </p>

          <h2 className="mt-2 text-2xl font-black text-neutral-950">
            Status Breakdown
          </h2>

          <div className="mt-6 space-y-3">
            {statusBreakdown.map((row) => {
              const percent =
                summary.total_orders > 0
                  ? Math.round((row.orders / summary.total_orders) * 100)
                  : 0;

              return (
                <Link
                  key={row.status}
                  href={getOrdersHref(dateFilter, row.status)}
                  className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusClasses(
                          row.status
                        )}`}
                      >
                        {getOrderStatusLabel(row.status)}
                      </span>
                      <div className="mt-2 text-xs font-bold text-neutral-500">
                        Revenue: Rs {formatPKR(row.revenue)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-black text-neutral-950">
                        {row.orders}
                      </div>
                      <div className="text-xs font-bold text-neutral-500">
                        {percent}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
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
            Payments
          </p>

          <h2 className="mt-2 text-2xl font-black text-neutral-950">
            Payment Method Summary
          </h2>

          <div className="mt-6 space-y-3">
            {paymentSummary.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                No payment data found.
              </div>
            ) : (
              paymentSummary.map((row) => (
                <div
                  key={row.payment_method}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-[#a30105]" />
                      <span className="font-black uppercase text-neutral-950">
                        {row.payment_method || "cod"}
                      </span>
                    </div>

                    <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-black uppercase text-neutral-700">
                      {row.orders} Orders
                    </span>
                  </div>

                  <div className="mt-3 text-2xl font-black text-neutral-950">
                    Rs {formatPKR(row.revenue)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
            Locations
          </p>

          <h2 className="mt-2 text-2xl font-black text-neutral-950">
            City-Wise Orders
          </h2>

          <div className="mt-6 space-y-3">
            {citySummary.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                No city data found.
              </div>
            ) : (
              citySummary.map((row) => (
                <Link
                  key={row.city}
                  href={`/admin/orders?search=${encodeURIComponent(row.city)}${
                    dateFilter !== "all_time" ? `&date=${dateFilter}` : ""
                  }`}
                  className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-black text-neutral-950">
                        <MapPin className="h-4 w-4 text-[#a30105]" />
                        {row.city}
                      </div>
                      <div className="mt-1 text-xs font-bold text-neutral-500">
                        {row.orders} orders
                      </div>
                    </div>

                    <div className="text-right font-black text-neutral-950">
                      Rs {formatPKR(row.revenue)}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
            Customers
          </p>

          <h2 className="mt-2 text-2xl font-black text-neutral-950">
            Top Customers
          </h2>

          <div className="mt-6 space-y-3">
            {topCustomers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                No customer data found.
              </div>
            ) : (
              topCustomers.map((row) => (
                <Link
                  key={row.customer_key}
                  href={getCustomerHref(row.customer_key)}
                  className="block rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-black text-neutral-950">
                        {row.name || "Customer"}
                      </div>
                      <div className="mt-1 truncate text-xs font-bold text-neutral-500">
                        {row.phone || row.email || "No contact"}
                      </div>
                      <div className="mt-1 text-xs font-bold text-neutral-500">
                        Last: {formatDate(row.last_order_at)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-neutral-950">
                        Rs {formatPKR(row.revenue)}
                      </div>
                      <div className="mt-1 text-xs font-bold text-neutral-500">
                        {row.orders} orders
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
          Roadmap
        </p>

        <h2 className="mt-2 text-2xl font-black text-neutral-950">
          Next Business Module
        </h2>

        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <PackageCheck className="mt-1 h-5 w-5 text-blue-700" />
            <div>
              <div className="font-black text-blue-800">
                Employee Attendance + ERPNext Sync + Geo Location
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-blue-700">
                Planned module: employee check-in/check-out, branch-wise attendance,
                geo-location validation, ERPNext Employee/Attendance linking,
                late/absent/overtime reports and audit logs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}