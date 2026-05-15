"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const DELIVERY_CHARGE = 200;

type Profile = {
  full_name: string | null;
  phone: string | null;
  city: string | null;
  address_line1: string | null;
};

type OrderRow = {
  id: string;
  sales_order: string | null;
  payment_method: string | null;
  status: string | null;
  total_amount: number | null;
  currency: string | null;
  created_at: string;
  items: any[] | null;
};

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

function formatPKR(value: number) {
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

function normalizeStatus(status: string | null) {
  return String(status || "placed")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
}

function getStatusLabel(status: string | null) {
  const normalized = normalizeStatus(status);

  const labels: Record<string, string> = {
    placed: "Placed",
    confirmed: "Confirmed",
    processing: "Processing",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return labels[normalized] || normalized.replaceAll("_", " ");
}

function getStatusBadgeClass(status: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized === "delivered") {
    return "border-green-200 bg-green-50 text-green-700";
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

  return "border-neutral-200 bg-white text-neutral-700";
}

function getOrderCardClass(status: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "cancelled") {
    return "border-red-200 bg-red-50/40";
  }

  if (normalized === "delivered") {
    return "border-green-200 bg-green-50/35";
  }

  if (normalized === "out_for_delivery") {
    return "border-blue-200 bg-blue-50/35";
  }

  if (normalized === "processing") {
    return "border-amber-200 bg-amber-50/35";
  }

  if (normalized === "confirmed") {
    return "border-emerald-200 bg-emerald-50/30";
  }

  return "border-neutral-200 bg-neutral-50";
}

function getStatusMiniText(status: string | null) {
  const normalized = normalizeStatus(status);

  const messages: Record<string, string> = {
    placed: "Order received",
    confirmed: "Order confirmed",
    processing: "Preparing order",
    out_for_delivery: "On the way",
    delivered: "Delivered successfully",
    cancelled: "Order cancelled",
  };

  return messages[normalized] || "Order update";
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

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [errorText, setErrorText] = useState("");

  const hasAdminAccess = Boolean(adminUser?.is_active && adminUser?.role);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function checkAdminAccess() {
    try {
      const token = await getAccessToken();

      if (!token) {
        setAdminUser(null);
        return;
      }

      const res = await fetch("/api/admin/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.allowed) {
        setAdminUser(null);
        return;
      }

      setAdminUser(json.user || null);
    } catch {
      setAdminUser(null);
    }
  }

  async function handleLogout() {
    setSigningOut(true);

    try {
      await supabase.auth.signOut();
      window.location.href = "/account/login";
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    async function loadAccount() {
      setLoading(true);
      setErrorText("");

      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
          setLoading(false);
          return;
        }

        setEmail(user.email || "");

        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, phone, city, address_line1")
          .eq("id", user.id)
          .maybeSingle();

        setProfile(profileData || null);

        const { data: orderData } = await supabase
          .from("orders")
          .select(
            "id, sales_order, payment_method, status, total_amount, currency, created_at, items"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        setOrders(Array.isArray(orderData) ? orderData : []);

        await checkAdminAccess();
      } catch (error: any) {
        setErrorText(error?.message || "Failed to load account.");
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-[30px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-[#a30105]" />
          <p className="mt-4 text-sm font-bold text-neutral-600">
            Loading your account...
          </p>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-[30px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-black text-neutral-950">
            Login Required
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Please login to view your profile, orders and attendance.
          </p>

          <Link
            href="/account/login?next=/account"
            className="mt-6 inline-flex rounded-2xl bg-[#a30105] px-6 py-3 text-sm font-black text-white transition hover:bg-[#8f0104]"
          >
            Login to Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a30105]">
              Vape Ustad Account
            </p>

            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              My Account
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Manage your profile, order history and staff attendance access from one place.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black text-neutral-700">
                {email}
              </span>

              {hasAdminAccess ? (
                <>
                  <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-black uppercase text-green-700">
                    Admin Access Enabled
                  </span>

                  <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase text-blue-700">
                    Role: {adminUser?.role}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out..." : "Logout"}
          </button>
        </div>

        {errorText ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorText}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <h2 className="text-xl font-black text-neutral-950">
              Profile Details
            </h2>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                  Full Name
                </p>
                <p className="mt-1 text-sm font-bold text-neutral-950">
                  {profile?.full_name || "Not added"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                    Phone
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-950">
                    {profile?.phone || "Not added"}
                  </p>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                    City
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-950">
                    {profile?.city || "Not added"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                  Address
                </p>
                <p className="mt-1 text-sm font-bold leading-6 text-neutral-950">
                  {profile?.address_line1 || "Not added"}
                </p>
              </div>
            </div>

            <Link
              href="/account/profile"
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-50"
            >
              Edit Profile
            </Link>
          </div>

          <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <h2 className="text-xl font-black text-neutral-950">
              Quick Actions
            </h2>

            <div className="mt-5 grid gap-3">
              <Link
                href="/attendance"
                className="rounded-2xl border border-[#a30105]/20 bg-[#fff7f7] p-4 transition hover:border-[#a30105] hover:bg-[#fff1f1]"
              >
                <div className="text-sm font-black uppercase tracking-wider text-[#a30105]">
                  My Attendance
                </div>
                <p className="mt-1 text-sm font-bold leading-6 text-neutral-600">
                  Staff check-in / check-out with geo location.
                </p>
              </Link>

              <Link
                href="/account/orders"
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
              >
                <div className="text-sm font-black uppercase tracking-wider text-neutral-900">
                  My Orders
                </div>
                <p className="mt-1 text-sm font-bold leading-6 text-neutral-600">
                  View your full order history and tracking.
                </p>
              </Link>

              <Link
                href="/products"
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
              >
                <div className="text-sm font-black uppercase tracking-wider text-neutral-900">
                  Continue Shopping
                </div>
                <p className="mt-1 text-sm font-bold leading-6 text-neutral-600">
                  Browse latest products on Vape Ustad.
                </p>
              </Link>
            </div>
          </div>

          {hasAdminAccess ? (
            <div className="rounded-[30px] border border-[#a30105]/20 bg-[#fff7f7] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <h2 className="text-xl font-black text-neutral-950">
                Admin Tools
              </h2>

              <p className="mt-2 text-sm font-bold leading-6 text-neutral-600">
                Your account has admin-area access through database role permissions.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-black text-white transition hover:bg-[#8f0104]"
                >
                  Admin Dashboard
                </Link>

                <Link
                  href="/admin/orders"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#a30105]/20 bg-white px-5 py-3 text-sm font-black text-[#a30105] transition hover:bg-[#fff1f1]"
                >
                  Manage Orders
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a30105]">
                Order History
              </p>

              <h2 className="mt-2 text-2xl font-black text-neutral-950">
                Recent Orders
              </h2>
            </div>

            <Link
              href="/account/orders"
              className="inline-flex rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-xs font-black uppercase text-neutral-800 transition hover:bg-neutral-50"
            >
              View All
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
              <h3 className="text-lg font-black text-neutral-950">
                No Orders Yet
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Your recent orders will appear here after checkout.
              </p>

              <Link
                href="/products"
                className="mt-5 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-black text-white transition hover:bg-[#8f0104]"
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {orders.map((order) => {
                const orderNumber =
                  order.sales_order || `Order ${order.id.slice(0, 8)}`;
                const totals = getOrderTotals(order.total_amount);
                const itemCount = Array.isArray(order.items)
                  ? order.items.length
                  : 0;

                return (
                  <Link
                    key={order.id}
                    href={`/account/orders/${order.id}`}
                    className={`block rounded-2xl border p-4 transition hover:border-[#a30105]/30 hover:bg-[#fff7f7] ${getOrderCardClass(
                      order.status
                    )}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-black text-neutral-950">
                          {orderNumber}
                        </div>

                        <div className="mt-1 text-xs font-bold text-neutral-500">
                          {formatDate(order.created_at)}
                        </div>

                        <div className="mt-2 text-xs font-bold text-neutral-500">
                          {itemCount} item{itemCount === 1 ? "" : "s"} •{" "}
                          {order.payment_method || "COD"}
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusBadgeClass(
                            order.status
                          )}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>

                        <div className="mt-2 text-lg font-black text-neutral-950">
                          Rs {formatPKR(totals.total)}
                        </div>

                        <div className="mt-1 text-xs font-bold text-neutral-500">
                          {getStatusMiniText(order.status)}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
