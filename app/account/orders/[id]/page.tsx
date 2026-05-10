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
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Truck,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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

function normalizeStatus(status: string | null) {
  return String(status || "placed")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
}

function getStatusLabel(status: string | null) {
  const normalized = normalizeStatus(status);
  const found = STATUS_STEPS.find((s) => s.key === normalized);
  if (found) return found.label;
  return normalized.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();

  const orderId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderRow | null>(null);

  useEffect(() => {
    async function loadOrder() {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/account/login?next=/account");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, sales_order, payment_method, status, total_amount, currency, customer_name, customer_email, customer_phone, city, address_line1, items, created_at"
        )
        .eq("id", orderId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        setOrder(null);
        setLoading(false);
        return;
      }

      setOrder(data as OrderRow);
      setLoading(false);
    }

    if (orderId) loadOrder();
  }, [orderId, router]);

  const activeStatusIndex = useMemo(() => {
    const normalized = normalizeStatus(order?.status || "placed");
    const idx = STATUS_STEPS.findIndex((s) => s.key === normalized);
    return idx >= 0 ? idx : 0;
  }, [order?.status]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        Loading order...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-black text-neutral-950">Order Not Found</h1>
        <p className="mt-2 text-sm text-neutral-500">
          This order is not available or is not linked with your account.
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

  const orderItems = Array.isArray(order.items) ? order.items : [];
  const orderNumber = order.sales_order || `Order ${order.id.slice(0, 8)}`;

  const whatsappMessage = encodeURIComponent(
    `Assalam o Alaikum, mujhe apne Vape Ustad order ke bare me help chahiye.\nOrder: ${orderNumber}`
  );

  const whatsappUrl = `https://wa.me/923015554249?text=${whatsappMessage}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/account"
          className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-900 transition hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Account
        </Link>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 transition hover:bg-green-100"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp Support
        </a>
      </div>

      <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Order Detail
            </p>
            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              {orderNumber}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
              <CalendarDays className="h-4 w-4" />
              {formatDate(order.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-black uppercase text-green-700">
              {getStatusLabel(order.status)}
            </span>

            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase text-neutral-700">
              {order.payment_method || "cod"}
            </span>
          </div>
        </div>

        <div className="mt-7 rounded-[26px] border border-neutral-200 bg-neutral-50 p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a30105]">
                Tracking
              </p>
              <h2 className="mt-1 text-xl font-black text-neutral-950">
                Order Status
              </h2>
            </div>

            <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase text-neutral-700 shadow-sm">
              {getStatusLabel(order.status)}
            </span>
          </div>

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

          <p className="mt-4 text-sm leading-6 text-neutral-500">
            Status updates are shown here. In the next phase, this can be synced
            automatically with ERPNext order status.
          </p>
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
          <div className="flex items-center justify-between text-sm text-neutral-600">
            <span>Total Amount</span>
            <span className="text-xl font-black text-neutral-950">
              Rs {formatPKR(Number(order.total_amount || 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}