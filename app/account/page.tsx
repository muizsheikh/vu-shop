"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    async function loadAccount() {
      setLoading(true);

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
        .single();

      setProfile(profileData || null);

      const { data: orderData } = await supabase
        .from("orders")
        .select(
          "id, sales_order, payment_method, status, total_amount, currency, created_at, items"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders((orderData || []) as OrderRow[]);
      setLoading(false);
    }

    loadAccount();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        Loading account...
      </div>
    );
  }

  if (!email) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-black text-neutral-950">
          Customer Account
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Account access ke liay login ya signup karein.
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            href="/account/login"
            className="rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white"
          >
            Login
          </Link>

          <Link
            href="/account/signup"
            className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-900"
          >
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              My Account
            </p>
            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              {profile?.full_name || "Customer"}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{email}</p>
          </div>

          <div className="flex flex-wrap gap-2">
  <Link
    href="/account/profile"
    className="rounded-2xl border border-[#a30105]/15 bg-white px-4 py-2 text-sm font-bold text-neutral-900 transition hover:bg-[#fff7f7]"
  >
    Edit Profile
  </Link>

  <button
    onClick={logout}
    className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-bold text-neutral-800"
  >
    Logout
  </button>
</div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Phone
            </div>
            <div className="mt-1 font-semibold text-neutral-950">
              {profile?.phone || "Not added"}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              City
            </div>
            <div className="mt-1 font-semibold text-neutral-950">
              {profile?.city || "Not added"}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:col-span-2">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Address
            </div>
            <div className="mt-1 font-semibold text-neutral-950">
              {profile?.address_line1 || "Not added"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Order History
            </p>
            <h2 className="mt-2 text-2xl font-black text-neutral-950">
              My Orders
            </h2>
          </div>

          <Link
            href="/products"
            className="rounded-2xl border border-[#a30105]/15 bg-white px-4 py-2 text-sm font-bold text-neutral-900 hover:bg-[#fff7f7]"
          >
            Shop More
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
            Abhi koi order history nahi hai.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((order) => {
              const orderItems = Array.isArray(order.items) ? order.items : [];

              return (
                <div
                  key={order.id}
                  className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-black text-neutral-950">
                        {order.sales_order || `Order ${order.id.slice(0, 8)}`}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {formatDate(order.created_at)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold uppercase text-green-700">
                        {getStatusLabel(order.status)}
                      </span>

                      <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-bold uppercase text-neutral-700">
                        {order.payment_method || "cod"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {orderItems.slice(0, 4).map((it: any, idx: number) => (
                      <div
                        key={`${order.id}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm"
                      >
                        <span className="line-clamp-1 font-medium text-neutral-800">
                          {it?.name || "Item"}
                        </span>
                        <span className="shrink-0 text-neutral-500">
                          × {it?.qty || 1}
                        </span>
                      </div>
                    ))}

                    {orderItems.length > 4 ? (
                      <div className="text-xs font-medium text-neutral-500">
                        + {orderItems.length - 4} more items
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex items-center justify-between gap-4 sm:block">
    <span className="text-sm font-medium text-neutral-500">
      Total
    </span>
    <div className="text-lg font-black text-neutral-950">
      Rs {formatPKR(Number(order.total_amount || 0))}
    </div>
  </div>

  <Link
    href={`/account/orders/${order.id}`}
    className="inline-flex items-center justify-center rounded-2xl border border-[#a30105]/15 bg-white px-4 py-2 text-sm font-bold text-neutral-900 transition hover:bg-[#fff7f7]"
  >
    View Details
  </Link>
</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}