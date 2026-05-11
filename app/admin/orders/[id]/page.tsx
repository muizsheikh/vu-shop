"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
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

const DELIVERY_CHARGE = 200;

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

const STATUS_STEPS = [
  { key: "placed", label: "Placed", icon: CheckCircle2 },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: Clock3 },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
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

function getOrderTotals(totalAmount: number | null) {
  const total = Number(totalAmount || 0);
  const delivery = total > 0 ? DELIVERY_CHARGE : 0;
  const subtotal = Math.max(0, total - delivery);

  return {
    subtotal,
    delivery,
    total,
  };
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

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params?.id || "");

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const [loadingOrder, setLoadingOrder] = useState(false);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [updating, setUpdating] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadOrder() {
    setLoadingOrder(true);
    setErrorText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace(`/account/login?next=/admin/orders/${orderId}`);
        return;
      }

      const res = await fetch(
        `/api/admin/orders?id=${encodeURIComponent(orderId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load order.");
      }

      setOrder(json?.order || null);
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load order.");
      setOrder(null);
    } finally {
      setLoadingOrder(false);
    }
  }

  async function updateStatus(status: string) {
    if (!order) return;

    setUpdating(true);
    setErrorText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace(`/account/login?next=/admin/orders/${orderId}`);
        return;
      }

      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
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

      setOrder(json?.order || null);
    } catch (error: any) {
      setErrorText(error?.message || "Status update failed.");
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    async function checkAdmin() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace(`/account/login?next=/admin/orders/${orderId}`);
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
      await loadOrder();
    }

    if (orderId) checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, router]);

  const activeStatusIndex = useMemo(() => {
    const normalized = normalizeOrderStatus(order?.status || "placed");
    const idx = STATUS_STEPS.findIndex((s) => s.key === normalized);
    return idx >= 0 ? idx : 0;
  }, [order?.status]);

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
          This account is not allowed to access this admin page.
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

  if (loadingOrder) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#a30105]" />
        <p className="mt-3 text-sm font-bold text-neutral-700">
          Loading order...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-black text-neutral-950">
          Order Not Found
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          This order is not available.
        </p>

        {errorText ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorText}
          </div>
        ) : null}

        <Link
          href="/admin/orders"
          className="mt-6 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white"
        >
          Back to Admin Orders
        </Link>
      </div>
    );
  }

  const orderItems = Array.isArray(order.items) ? order.items : [];
  const orderNumber = order.sales_order || `Order ${order.id.slice(0, 8)}`;
  const totals = getOrderTotals(order.total_amount);
  const normalizedStatus = normalizeOrderStatus(order.status);
  const isCancelled = normalizedStatus === "cancelled";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-900 transition hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Orders
        </Link>

        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
          Admin: {adminEmail}
        </div>
      </div>

      {errorText ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorText}
        </div>
      ) : null}

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Admin Order Detail
            </p>

            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              {orderNumber}
            </h1>

            <p className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
              <CalendarDays className="h-4 w-4" />
              {formatDate(order.created_at)}
            </p>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
              Update Order Status
            </label>

            <div className="mt-3 flex gap-2">
              <select
                value={normalizedStatus}
                disabled={updating}
                onChange={(event) => updateStatus(event.target.value)}
                className="h-12 flex-1 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black uppercase text-neutral-800 outline-none focus:border-[#a30105] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {getOrderStatusLabel(status)}
                  </option>
                ))}
              </select>

              <div
                className={`flex h-12 items-center rounded-2xl border px-4 text-xs font-black uppercase ${getStatusClasses(
                  normalizedStatus
                )}`}
              >
                {updating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  getOrderStatusLabel(normalizedStatus)
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 rounded-[26px] border border-neutral-200 bg-neutral-50 p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a30105]">
                Tracking
              </p>

              <h2 className="mt-1 text-xl font-black text-neutral-950">
                Customer Visible Status
              </h2>
            </div>

            <span
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase ${getStatusClasses(
                normalizedStatus
              )}`}
            >
              {getOrderStatusLabel(normalizedStatus)}
            </span>
          </div>

          {isCancelled ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-red-700">
              <XCircle className="mx-auto h-10 w-10" />
              <div className="mt-3 text-sm font-black uppercase">
                This order is cancelled
              </div>
              <p className="mt-2 text-sm leading-6 text-red-600">
                Customer ke order detail page par bhi cancelled status show
                hoga.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-5">
              {STATUS_STEPS.map((step, index) => {
                const active = index <= activeStatusIndex;
                const CurrentIcon = active ? step.icon : Circle;

                return (
                  <div
                    key={step.key}
                    className={`rounded-2xl border p-4 text-center transition ${
                      active
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-neutral-200 bg-white text-neutral-400"
                    }`}
                  >
                    <div
                      className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${
                        active ? "bg-green-100" : "bg-neutral-100"
                      }`}
                    >
                      <CurrentIcon className="h-5 w-5" />
                    </div>

                    <div className="mt-3 text-xs font-black uppercase">
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <UserRound className="h-4 w-4" />
              Customer
            </div>

            <div className="mt-2 font-black text-neutral-950">
              {order.customer_name || "Customer"}
            </div>

            <div className="mt-1 text-sm text-neutral-500">
              {order.customer_email || "No email"}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <Phone className="h-4 w-4" />
              Phone
            </div>

            <div className="mt-2 font-black text-neutral-950">
              {order.customer_phone || "Not added"}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <CreditCard className="h-4 w-4" />
              Payment
            </div>

            <div className="mt-2 font-black uppercase text-neutral-950">
              {order.payment_method || "cod"}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:col-span-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </div>

            <div className="mt-2 font-black text-neutral-950">
              {order.address_line1 || "Not added"}
            </div>

            <div className="mt-1 text-sm text-neutral-500">
              {order.city || "No city"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#a30105]/10 text-[#a30105]">
            <PackageCheck className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Items
            </p>

            <h2 className="text-2xl font-black text-neutral-950">
              Order Summary
            </h2>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {orderItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center text-sm text-neutral-500">
              No item detail available.
            </div>
          ) : (
            orderItems.map((it: any, index: number) => (
              <div
                key={`${order.id}-${it?.id || it?.name || index}`}
                className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="h-16 w-16 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it?.image || "/images/placeholder.png"}
                    alt={it?.name || "Item"}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 font-bold text-neutral-950">
                    {it?.name || "Item"}
                  </div>

                  <div className="mt-1 text-sm text-neutral-500">
                    Qty: {it?.qty || 1} × Rs {formatPKR(Number(it?.price || 0))}
                  </div>
                </div>

                <div className="text-right font-black text-neutral-950">
                  Rs {formatPKR(Number(it?.price || 0) * Number(it?.qty || 1))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-neutral-600">
              <span>Subtotal</span>
              <span>Rs {formatPKR(totals.subtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-sm text-neutral-600">
              <span>Delivery Charges</span>
              <span>Rs {formatPKR(totals.delivery)}</span>
            </div>

            <div className="border-t border-neutral-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-500">
                  Total Amount
                </span>

                <span className="text-xl font-black text-neutral-950">
                  Rs {formatPKR(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}