"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  UsersRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type CustomerRow = {
  id: string;
  customer_key: string;
  email: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  address_line1: string | null;
  role: string;
  is_active: boolean;
  profile_updated_at: string | null;
  has_profile: boolean;
  has_auth_user: boolean;
  total_orders: number;
  active_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_spent: number;
  last_order_at: string | null;
};

type SummaryState = {
  total_customers: number;
  registered_customers: number;
  guest_customers: number;
  active_customers: number;
  total_orders: number;
  total_spent: number;
};

type PaginationState = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
};

const DEFAULT_SUMMARY: SummaryState = {
  total_customers: 0,
  registered_customers: 0,
  guest_customers: 0,
  active_customers: 0,
  total_orders: 0,
  total_spent: 0,
};

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  limit: 20,
  total_count: 0,
  total_pages: 1,
  has_next_page: false,
  has_previous_page: false,
};

const LIMIT_OPTIONS = [10, 20, 50, 100];

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

function getInitialSearch() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  return String(params.get("search") || "").trim();
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

function updateBrowserUrl(searchValue: string, pageValue: number, limitValue: number) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();

  if (searchValue.trim()) {
    params.set("search", searchValue.trim());
  }

  if (pageValue > 1) {
    params.set("page", String(pageValue));
  }

  if (limitValue !== 20) {
    params.set("limit", String(limitValue));
  }

  const query = params.toString();
  const nextUrl = query ? `/admin/customers?${query}` : "/admin/customers";

  window.history.replaceState(null, "", nextUrl);
}

export default function AdminCustomersPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [summary, setSummary] = useState<SummaryState>(DEFAULT_SUMMARY);
  const [pagination, setPagination] =
    useState<PaginationState>(DEFAULT_PAGINATION);

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function checkAdminAccess() {
    const token = await getAccessToken();

    if (!token) {
      const nextQuery =
        typeof window !== "undefined" && window.location.search
          ? `/admin/customers${window.location.search}`
          : "/admin/customers";

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

  async function loadCustomers(options?: {
    searchValue?: string;
    pageValue?: number;
    limitValue?: number;
    tokenFromCheck?: string;
  }) {
    setLoadingCustomers(true);
    setErrorText("");

    const nextSearch = options?.searchValue ?? search;
    const nextPage = options?.pageValue ?? page;
    const nextLimit = options?.limitValue ?? limit;

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/customers");
        return;
      }

      const params = new URLSearchParams();

      if (nextSearch.trim()) {
        params.set("search", nextSearch.trim());
      }

      params.set("page", String(nextPage));
      params.set("limit", String(nextLimit));

      const res = await fetch(`/api/admin/customers?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load customers.");
      }

      const nextPagination = json?.pagination || DEFAULT_PAGINATION;

      setCustomers(Array.isArray(json?.customers) ? json.customers : []);
      setSummary(json?.summary || DEFAULT_SUMMARY);
      setPagination(nextPagination);
      setPage(Number(nextPagination.page || nextPage));
      setLimit(Number(nextPagination.limit || nextLimit));

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(json.admin.email || "");
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load customers.");
      setCustomers([]);
      setSummary(DEFAULT_SUMMARY);
      setPagination(DEFAULT_PAGINATION);
    } finally {
      setLoadingCustomers(false);
    }
  }

  function submitSearch(nextSearch: string) {
    const cleanSearch = nextSearch.trim();
    const nextPage = 1;

    setSearch(cleanSearch);
    setPage(nextPage);
    updateBrowserUrl(cleanSearch, nextPage, limit);

    loadCustomers({
      searchValue: cleanSearch,
      pageValue: nextPage,
    });
  }

  function resetFilters() {
    setSearch("");
    setPage(1);
    updateBrowserUrl("", 1, limit);

    loadCustomers({
      searchValue: "",
      pageValue: 1,
    });
  }

  function changePage(nextPage: number) {
    const safePage = Math.max(1, Math.min(nextPage, pagination.total_pages || 1));

    setPage(safePage);
    updateBrowserUrl(search, safePage, limit);

    loadCustomers({
      pageValue: safePage,
    });
  }

  function changeLimit(nextLimit: number) {
    const safeLimit = LIMIT_OPTIONS.includes(nextLimit) ? nextLimit : 20;
    const nextPage = 1;

    setLimit(safeLimit);
    setPage(nextPage);
    updateBrowserUrl(search, nextPage, safeLimit);

    loadCustomers({
      limitValue: safeLimit,
      pageValue: nextPage,
    });
  }

  useEffect(() => {
    async function initAdmin() {
      setAuthLoading(true);

      const initialSearch = getInitialSearch();
      const initialPage = getInitialPage();
      const initialLimit = getInitialLimit();

      setSearch(initialSearch);
      setPage(initialPage);
      setLimit(initialLimit);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.access_token) {
        const nextQuery = window.location.search
          ? `/admin/customers${window.location.search}`
          : "/admin/customers";

        router.replace(`/account/login?next=${encodeURIComponent(nextQuery)}`);
        return;
      }

      setAdminEmail(String(session.user?.email || "").trim().toLowerCase());

      const token = await checkAdminAccess();

      setAuthLoading(false);

      if (token) {
        await loadCustomers({
          searchValue: initialSearch,
          pageValue: initialPage,
          limitValue: initialLimit,
          tokenFromCheck: token,
        });
      }
    }

    initAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const stats = useMemo(
    () => [
      {
        label: "Total Customers",
        value: summary.total_customers,
        icon: UsersRound,
        className: "border-neutral-200 bg-white text-neutral-950",
      },
      {
        label: "Registered",
        value: summary.registered_customers,
        icon: CheckCircle2,
        className: "border-green-200 bg-green-50 text-green-700",
      },
      {
        label: "Guest Customers",
        value: summary.guest_customers,
        icon: UserRound,
        className: "border-blue-200 bg-blue-50 text-blue-700",
      },
      {
        label: "Total Spend",
        value: `Rs ${formatPKR(summary.total_spent)}`,
        icon: Wallet,
        className: "border-[#a30105]/20 bg-[#fff7f7] text-[#a30105]",
      },
    ],
    [summary]
  );

  const pageStart =
    pagination.total_count === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;
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
          {accessError || "This account is not allowed to access customers."}
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
              Customer Management
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Review registered and guest customers with order count, total
              spending, last order activity and contact information.
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
            Showing: {pageStart}-{pageEnd} of {pagination.total_count}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className={`rounded-[26px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.05)] ${stat.className}`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75">
                <Icon className="h-5 w-5" />
              </div>

              <div className="mt-5 text-sm font-bold uppercase tracking-wider opacity-80">
                {stat.label}
              </div>

              <div className="mt-2 text-3xl font-black">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
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
              placeholder="Search by name, email, phone, city or address..."
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
            disabled={loadingCustomers}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#a30105] px-6 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingCustomers ? "Loading..." : "Search"}
          </button>

          <button
            type="button"
            disabled={loadingCustomers}
            onClick={resetFilters}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </form>

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
            customers
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loadingCustomers || !pagination.has_previous_page}
              onClick={() => changePage(pagination.page - 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              disabled={loadingCustomers || !pagination.has_next_page}
              onClick={() => changePage(pagination.page + 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loadingCustomers ? (
          <div className="p-10 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
            <p className="mt-3 text-sm font-bold text-neutral-600">
              Loading customers...
            </p>
          </div>
        ) : customers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <h2 className="text-xl font-black text-neutral-950">
              No Customers Found
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Try clearing the search or changing your keyword.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Orders</th>
                  <th className="px-3 py-2">Total Spend</th>
                  <th className="px-3 py-2">Last Order</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.customer_key}>
                    <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#a30105] shadow-sm">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="font-black text-neutral-950">
                            {customer.full_name || "Unnamed Customer"}
                          </div>
                          <div className="mt-1 truncate text-xs font-bold text-neutral-500">
                            {customer.email || "No email"}
                          </div>

                          {!customer.has_profile && customer.has_auth_user ? (
                            <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-700">
                              Missing Profile
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="flex items-center gap-2 font-bold text-neutral-950">
                        <Phone className="h-4 w-4 text-neutral-400" />
                        {customer.phone || "No phone"}
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-xs font-bold text-neutral-500">
                        <Mail className="h-3.5 w-3.5 text-neutral-400" />
                        {customer.email_confirmed_at
                          ? "Email confirmed"
                          : customer.email
                          ? "Email not confirmed"
                          : "No email"}
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="font-bold text-neutral-950">
                        {customer.city || "No city"}
                      </div>
                      <div className="mt-1 line-clamp-1 text-xs text-neutral-500">
                        {customer.address_line1 || "No address"}
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="flex items-center gap-2 font-black text-neutral-950">
                        <ShoppingBag className="h-4 w-4 text-[#a30105]" />
                        {customer.total_orders}
                      </div>

                      <div className="mt-1 text-xs font-bold text-neutral-500">
                        Active: {customer.active_orders} • Delivered:{" "}
                        {customer.delivered_orders}
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="font-black text-neutral-950">
                        Rs {formatPKR(customer.total_spent)}
                      </div>

                      {customer.cancelled_orders > 0 ? (
                        <div className="mt-1 text-xs font-bold text-red-600">
                          Cancelled: {customer.cancelled_orders}
                        </div>
                      ) : null}
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <div className="text-sm font-bold text-neutral-700">
                        {formatDate(customer.last_order_at)}
                      </div>
                    </td>

                    <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      <Link
                     href={`/admin/customers/${encodeURIComponent(
                     customer.customer_key || customer.id
                   )}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#a30105]/20 bg-white px-4 py-2 text-xs font-black uppercase text-[#a30105] transition hover:border-[#a30105] hover:bg-[#fff7f7]"
                  >
                  <Eye className="h-3.5 w-3.5" />
                  View
                  </Link>

                      {!customer.is_active ? (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700">
                          <XCircle className="h-3.5 w-3.5" />
                          Inactive
                        </span>
                      ) : null}
                    </td>

                    <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                      {customer.has_auth_user ? (
                        <Link
                          href={`/admin/users/${customer.id}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#a30105]/20 bg-white px-4 py-2 text-xs font-black uppercase text-[#a30105] transition hover:border-[#a30105] hover:bg-[#fff7f7]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      ) : (
                        <span className="inline-flex rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-black uppercase text-neutral-500">
                          Guest
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
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
              disabled={loadingCustomers || !pagination.has_previous_page}
              onClick={() => changePage(pagination.page - 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              disabled={loadingCustomers || !pagination.has_next_page}
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