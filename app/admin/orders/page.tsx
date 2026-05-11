"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Eye,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
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

export default function AdminOrdersPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [search, setSearch] = useState("");
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
        prev.map((order) => (order.id === orderId ? updatedOrder : order))
      );
    } catch (error: any) {
      setErrorText(error?.message || "Status update failed.");
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    async function checkAdmin() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace("/account/login?next=/admin/orders");
        return;
      }

      const email = String(user.email || "").trim().toLowerCase();
      setAdminEmail(email);

      if (!isAdminEmail(email)) {
        setAllowed(false);
        setAuthLoading(false);
        return;
      }

      setAllowed(true);
      setAuthLoading(false);
      await loadOrders();
    }

    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      placed: orders.filter((o) => normalizeOrderStatus(o.status) === "placed")
        .length,
      processing: orders.filter(
        (o) => normalizeOrderStatus(o.status) === "processing"
      ).length,
      delivered: orders.filter(
        (o) => normalizeOrderStatus(o.status) === "delivered"
      ).length,
    };
  }, [orders]);

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

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <PackageCheck className="h-4 w-4" />
              Total Orders
            </div>
            <div className="mt-2 text-2xl font-black text-neutral-950">
              {stats.total}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <CalendarDays className="h-4 w-4" />
              Placed
            </div>
            <div className="mt-2 text-2xl font-black text-neutral-950">
              {stats.placed}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
              <Truck className="h-4 w-4" />
              Processing
            </div>
            <div className="mt-2 text-2xl font-black text-amber-800">
              {stats.processing}
            </div>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-700">
              <PackageCheck className="h-4 w-4" />
              Delivered
            </div>
            <div className="mt-2 text-2xl font-black text-green-800">
              {stats.delivered}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            loadOrders(search);
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
            onClick={() => {
              setSearch("");
              loadOrders("");
            }}
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
        {loadingOrders ? (
          <div className="p-10 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#a30105]" />
            <p className="mt-3 text-sm font-bold text-neutral-600">
              Loading orders...
            </p>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <h2 className="text-xl font-black text-neutral-950">
              No Orders Found
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Search reset kar ke dobara try karo.
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
                {orders.map((order) => {
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
      </div>
    </div>
  );
}