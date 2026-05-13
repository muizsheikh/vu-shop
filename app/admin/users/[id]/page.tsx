"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Eye,
  History,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type UserDetail = {
  id: string;
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
};

type UserOrder = {
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
  created_at: string | null;
  delivery_method: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  tracking_number: string | null;
  expected_delivery_time: string | null;
  customer_note: string | null;
};

type RoleHistoryRow = {
  id: string;
  target_user_id: string;
  old_role: string | null;
  new_role: string | null;
  old_is_active: boolean | null;
  new_is_active: boolean | null;
  changed_by_user_id: string | null;
  changed_by_email: string | null;
  created_at: string | null;
};

type OrderSummary = {
  total_orders: number;
  active_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_spent: number;
};

const DEFAULT_ORDER_SUMMARY: OrderSummary = {
  total_orders: 0,
  active_orders: 0,
  delivered_orders: 0,
  cancelled_orders: 0,
  total_spent: 0,
};

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

function formatMoney(value: number | null | undefined, currency = "PKR") {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: currency || "PKR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || "PKR"} ${amount.toLocaleString("en-PK")}`;
  }
}

function getRoleLabel(role: string | null | undefined) {
  const normalized = String(role || "customer").trim().toLowerCase();

  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRoleClasses(role: string | null | undefined) {
  const normalized = String(role || "customer").toLowerCase();

  if (normalized === "admin") {
    return "border-[#a30105]/20 bg-[#fff7f7] text-[#a30105]";
  }

  if (normalized === "manager") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (normalized === "support") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function getStatusLabel(status: string | null | undefined) {
  const normalized = String(status || "placed").trim().toLowerCase();

  if (normalized === "out_for_delivery") return "Out for Delivery";

  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getOrderStatusClasses(status: string | null | undefined) {
  const normalized = String(status || "placed").trim().toLowerCase();

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
    return "border-[#a30105]/20 bg-[#fff7f7] text-[#a30105]";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function getStatusText(value: boolean | null | undefined) {
  if (value === true) return "Active";
  if (value === false) return "Inactive";
  return "Not Set";
}

function getStatusClasses(value: boolean | null | undefined) {
  if (value === true) {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (value === false) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = String(params?.id || "").trim();

  const [authLoading, setAuthLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");
  const [errorText, setErrorText] = useState("");

  const [user, setUser] = useState<UserDetail | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [orderSummary, setOrderSummary] = useState<OrderSummary>(
    DEFAULT_ORDER_SUMMARY
  );
  const [roleHistory, setRoleHistory] = useState<RoleHistoryRow[]>([]);
  const [canManageUsers, setCanManageUsers] = useState(false);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadUserDetail(tokenFromCheck?: string) {
    setLoadingDetail(true);
    setErrorText("");

    try {
      const token = tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace(`/account/login?next=/admin/users/${userId}`);
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.allowed) {
        throw new Error(json?.error || "Failed to load user detail.");
      }

      setAllowed(true);
      setAdminUser(json?.admin || null);
      setAdminEmail(json?.admin?.email || "");
      setCanManageUsers(Boolean(json?.can_manage_users));
      setUser(json?.user || null);
      setOrders(Array.isArray(json?.orders) ? json.orders : []);
      setOrderSummary(json?.order_summary || DEFAULT_ORDER_SUMMARY);
      setRoleHistory(
        Array.isArray(json?.role_history) ? json.role_history : []
      );
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load user detail.");
      setUser(null);
      setOrders([]);
      setOrderSummary(DEFAULT_ORDER_SUMMARY);
      setRoleHistory([]);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function checkAdminAccess() {
    const token = await getAccessToken();

    if (!token) {
      router.replace(`/account/login?next=/admin/users/${userId}`);
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

    setAllowed(true);
    setAdminUser(json?.user || null);
    setAdminEmail(json?.user?.email || "");

    return token;
  }

  useEffect(() => {
    async function initAdmin() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getUser();
      const currentUser = data.user;

      if (!currentUser) {
        router.replace(`/account/login?next=/admin/users/${userId}`);
        return;
      }

      setAdminEmail(String(currentUser.email || "").trim().toLowerCase());

      const token = await checkAdminAccess();

      setAuthLoading(false);

      if (token) {
        await loadUserDetail(token);
      }
    }

    if (userId) {
      initAdmin();
    } else {
      setAuthLoading(false);
      setErrorText("User ID is missing.");
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, userId]);

  const stats = useMemo(
    () => [
      {
        label: "Total Orders",
        value: orderSummary.total_orders,
        icon: ShoppingBag,
        className: "border-neutral-200 bg-white text-neutral-950",
      },
      {
        label: "Active Orders",
        value: orderSummary.active_orders,
        icon: ClipboardList,
        className: "border-blue-200 bg-blue-50 text-blue-700",
      },
      {
        label: "Delivered",
        value: orderSummary.delivered_orders,
        icon: PackageCheck,
        className: "border-green-200 bg-green-50 text-green-700",
      },
      {
        label: "Cancelled",
        value: orderSummary.cancelled_orders,
        icon: XCircle,
        className: "border-red-200 bg-red-50 text-red-700",
      },
    ],
    [orderSummary]
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
          Admin Access Required
        </h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {accessError}
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase text-neutral-700 transition hover:border-[#a30105]/30 hover:bg-[#fff7f7] hover:text-[#a30105]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Users
            </Link>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              User Management
            </p>

            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              User Detail
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Review customer profile, account access, order activity and
              role/status audit history in one professional admin view.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
              Admin: {adminEmail || adminUser?.email || "Unknown"}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold uppercase text-blue-700">
              Role: {adminUser?.role || "admin"}
            </div>
          </div>
        </div>
      </div>

      {loadingDetail ? (
        <div className="rounded-[30px] border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
          <p className="mt-3 text-sm font-bold text-neutral-600">
            Loading user detail...
          </p>
        </div>
      ) : errorText ? (
        <div className="rounded-[30px] border border-red-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto h-8 w-8 text-red-600" />
          <h2 className="mt-4 text-xl font-black text-neutral-950">
            Unable to Load User
          </h2>
          <p className="mt-2 text-sm text-neutral-500">{errorText}</p>

          <button
            type="button"
            onClick={() => loadUserDetail()}
            className="mt-5 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-black text-white"
          >
            Try Again
          </button>
        </div>
      ) : !user ? (
        <div className="rounded-[30px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <UserRound className="mx-auto h-8 w-8 text-neutral-400" />
          <h2 className="mt-4 text-xl font-black text-neutral-950">
            User Not Found
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            This user may not exist or may have been removed.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-[#fff7f7] text-[#a30105] shadow-sm">
                  <UserRound className="h-9 w-9" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black text-neutral-950">
                      {user.full_name || "Unnamed User"}
                    </h2>

                    {user.has_profile ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-black uppercase text-green-700">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Profile Found
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase text-amber-700">
                        <XCircle className="h-3.5 w-3.5" />
                        Missing Profile
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
                      <Mail className="h-4 w-4 text-[#a30105]" />
                      <span className="truncate">{user.email || "No email"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
                      <Phone className="h-4 w-4 text-[#a30105]" />
                      <span>{user.phone || "No phone"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
                      <MapPin className="h-4 w-4 text-[#a30105]" />
                      <span>{user.city || "No city"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
                      <CalendarClock className="h-4 w-4 text-[#a30105]" />
                      <span>Joined: {formatDate(user.created_at)}</span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                      Address
                    </p>
                    <p className="mt-1 text-sm font-bold leading-6 text-neutral-800">
                      {user.address_line1 || "No address available."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <h2 className="text-lg font-black text-neutral-950">
                Account Access
              </h2>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                    Current Role
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getRoleClasses(
                      user.role
                    )}`}
                  >
                    {getRoleLabel(user.role)}
                  </span>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                    Account Status
                  </p>

                  {user.is_active ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black uppercase text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Active
                    </span>
                  ) : (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700">
                      <XCircle className="h-3.5 w-3.5" />
                      Inactive
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                      Email Status
                    </p>
                    <p className="mt-2 text-sm font-black text-neutral-950">
                      {user.email_confirmed_at ? "Confirmed" : "Not Confirmed"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                      Last Sign In
                    </p>
                    <p className="mt-2 text-sm font-black text-neutral-950">
                      {formatDate(user.last_sign_in_at)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                    Profile Updated
                  </p>
                  <p className="mt-2 text-sm font-black text-neutral-950">
                    {formatDate(user.profile_updated_at)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#a30105]/20 bg-[#fff7f7] p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-[#a30105]">
                    User Management Permission
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6 text-neutral-700">
                    {canManageUsers
                      ? "Current admin can manage user roles and active status from Users & Roles page."
                      : "Current admin can view this information but cannot manage user roles."}
                  </p>
                </div>
              </div>
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

          <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
                  Customer Activity
                </p>
                <h2 className="mt-2 text-2xl font-black text-neutral-950">
                  Order History
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Latest 25 orders linked with this customer account.
                </p>
              </div>

              <div className="rounded-2xl border border-[#a30105]/20 bg-[#fff7f7] px-4 py-3 text-sm font-black text-[#a30105]">
                Total Spend:{" "}
                {formatMoney(orderSummary.total_spent, "PKR")}
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
                <ShoppingBag className="mx-auto h-8 w-8 text-neutral-400" />
                <h3 className="mt-3 text-lg font-black text-neutral-950">
                  No Orders Found
                </h3>
                <p className="mt-2 text-sm text-neutral-500">
                  This user has not placed any orders yet.
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[980px] border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Payment</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Delivery</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="font-black text-neutral-950">
                            {order.sales_order || order.id.slice(0, 8)}
                          </div>
                          <div className="mt-1 text-xs font-bold text-neutral-500">
                            {order.customer_name || user.full_name || "Customer"}
                          </div>
                        </td>

                        <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="text-sm font-bold text-neutral-700">
                            {formatDate(order.created_at)}
                          </div>
                        </td>

                        <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="text-sm font-black uppercase text-neutral-800">
                            {order.payment_method || "COD"}
                          </div>
                        </td>

                        <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getOrderStatusClasses(
                              order.status
                            )}`}
                          >
                            {getStatusLabel(order.status)}
                          </span>
                        </td>

                        <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="text-sm font-bold text-neutral-800">
                            {order.delivery_method || "Not assigned"}
                          </div>
                          {order.tracking_number ? (
                            <div className="mt-1 text-xs font-bold text-neutral-500">
                              Tracking: {order.tracking_number}
                            </div>
                          ) : null}
                        </td>

                        <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <div className="text-sm font-black text-neutral-950">
                            {formatMoney(
                              order.total_amount,
                              order.currency || "PKR"
                            )}
                          </div>
                        </td>

                        <td className="rounded-r-2xl border-y border-r border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#a30105]/20 bg-white px-4 py-2 text-xs font-black uppercase text-[#a30105] transition hover:border-[#a30105] hover:bg-[#fff7f7]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff7f7] text-[#a30105]">
                <History className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
                  Audit Trail
                </p>
                <h2 className="mt-2 text-2xl font-black text-neutral-950">
                  Role & Status History
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Shows role changes, account activation changes, admin email
                  and timestamp for this user.
                </p>
              </div>
            </div>

            {roleHistory.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
                <History className="mx-auto h-8 w-8 text-neutral-400" />
                <h3 className="mt-3 text-lg font-black text-neutral-950">
                  No Audit History Found
                </h3>
                <p className="mt-2 text-sm text-neutral-500">
                  No role or active status changes have been recorded for this
                  user yet.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {roleHistory.map((history) => (
                  <div
                    key={history.id}
                    className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="grid flex-1 gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                          <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                            Role Change
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getRoleClasses(
                                history.old_role
                              )}`}
                            >
                              {history.old_role
                                ? getRoleLabel(history.old_role)
                                : "Not Set"}
                            </span>

                            <span className="text-xs font-black text-neutral-400">
                              →
                            </span>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getRoleClasses(
                                history.new_role
                              )}`}
                            >
                              {history.new_role
                                ? getRoleLabel(history.new_role)
                                : "Not Set"}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                          <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                            Account Status
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusClasses(
                                history.old_is_active
                              )}`}
                            >
                              {getStatusText(history.old_is_active)}
                            </span>

                            <span className="text-xs font-black text-neutral-400">
                              →
                            </span>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusClasses(
                                history.new_is_active
                              )}`}
                            >
                              {getStatusText(history.new_is_active)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-[240px] rounded-2xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                          Changed By
                        </p>
                        <p className="mt-2 break-all text-sm font-black text-neutral-950">
                          {history.changed_by_email || "Unknown admin"}
                        </p>
                        <p className="mt-2 text-xs font-bold text-neutral-500">
                          {formatDate(history.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}