"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Eye,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  ShieldCheck,
  ShoppingBag,
  UserRound,
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

type CustomerDetail = {
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
};

type CustomerOrder = {
  id: string;
  user_id: string | null;
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
  customer_note: string | null;
  items: any[] | null;
  created_at: string | null;
  delivery_method: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  delivery_note: string | null;
  tracking_number: string | null;
  expected_delivery_time: string | null;
};

type CustomerSummary = {
  total_orders: number;
  active_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_spent: number;
  last_order_at: string | null;
};

const DEFAULT_SUMMARY: CustomerSummary = {
  total_orders: 0,
  active_orders: 0,
  delivered_orders: 0,
  cancelled_orders: 0,
  total_spent: 0,
  last_order_at: null,
};

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

function normalizeWhatsappPhone(phone: string | null | undefined) {
  const raw = String(phone || "").replace(/\D/g, "");

  if (!raw) return "";

  if (raw.startsWith("92")) return raw;

  if (raw.startsWith("0")) return `92${raw.slice(1)}`;

  if (raw.length === 10 && raw.startsWith("3")) return `92${raw}`;

  return raw;
}

function buildWhatsappUrl(phone: string | null | undefined, name: string | null | undefined) {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const cleanName = String(name || "Customer").trim() || "Customer";

  const message = encodeURIComponent(
    `Assalam o Alaikum ${cleanName},\n\nThis is Vape Ustad customer support. How can we help you?`
  );

  if (!normalizedPhone) {
    return `https://wa.me/?text=${message}`;
  }

  return `https://wa.me/${normalizedPhone}?text=${message}`;
}

function getDeliveryLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "rider") return "Rider";
  if (normalized === "courier") return "Courier";
  if (normalized === "pickup") return "Pickup";

  return "Not assigned";
}

export default function AdminCustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = String(params?.id || "").trim();

  const [authLoading, setAuthLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");
  const [errorText, setErrorText] = useState("");

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [summary, setSummary] = useState<CustomerSummary>(DEFAULT_SUMMARY);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadCustomerDetail(tokenFromCheck?: string) {
    setLoadingDetail(true);
    setErrorText("");

    try {
      const token = tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace(`/account/login?next=/admin/customers/${encodeURIComponent(customerId)}`);
        return;
      }

      const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load customer detail.");
      }

      setAllowed(true);
      setAdminUser(json?.admin || null);
      setAdminEmail(json?.admin?.email || "");
      setCustomer(json?.customer || null);
      setOrders(Array.isArray(json?.orders) ? json.orders : []);
      setSummary(json?.summary || DEFAULT_SUMMARY);
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load customer detail.");
      setCustomer(null);
      setOrders([]);
      setSummary(DEFAULT_SUMMARY);
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    async function initAdmin() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.access_token) {
        router.replace(`/account/login?next=/admin/customers/${encodeURIComponent(customerId)}`);
        return;
      }

      setAdminEmail(String(session.user?.email || "").trim().toLowerCase());
      setAllowed(true);
      setAuthLoading(false);

      await loadCustomerDetail(session.access_token);
    }

    if (customerId) {
      initAdmin();
    } else {
      setAuthLoading(false);
      setErrorText("Customer ID is missing.");
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, customerId]);

  const stats = useMemo(
    () => [
      {
        label: "Total Orders",
        value: summary.total_orders,
        icon: ShoppingBag,
        className: "border-neutral-200 bg-white text-neutral-950",
      },
      {
        label: "Active Orders",
        value: summary.active_orders,
        icon: CalendarClock,
        className: "border-blue-200 bg-blue-50 text-blue-700",
      },
      {
        label: "Delivered",
        value: summary.delivered_orders,
        icon: PackageCheck,
        className: "border-green-200 bg-green-50 text-green-700",
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
              href="/admin/customers"
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase text-neutral-700 transition hover:border-[#a30105]/30 hover:bg-[#fff7f7] hover:text-[#a30105]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Customers
            </Link>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
              Customer Management
            </p>

            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              Customer Detail
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Review customer profile, contact details, spending summary and latest order activity.
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
            Loading customer detail...
          </p>
        </div>
      ) : errorText ? (
        <div className="rounded-[30px] border border-red-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto h-8 w-8 text-red-600" />
          <h2 className="mt-4 text-xl font-black text-neutral-950">
            Unable to Load Customer
          </h2>
          <p className="mt-2 text-sm text-neutral-500">{errorText}</p>

          <button
            type="button"
            onClick={() => loadCustomerDetail()}
            className="mt-5 inline-flex rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-black text-white"
          >
            Try Again
          </button>
        </div>
      ) : !customer ? (
        <div className="rounded-[30px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <UserRound className="mx-auto h-8 w-8 text-neutral-400" />
          <h2 className="mt-4 text-xl font-black text-neutral-950">
            Customer Not Found
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            This customer may not exist or may have been removed.
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
                      {customer.full_name || "Unnamed Customer"}
                    </h2>

                    {customer.has_auth_user ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-black uppercase text-green-700">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Registered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase text-blue-700">
                        <UserRound className="h-3.5 w-3.5" />
                        Guest
                      </span>
                    )}

                    {!customer.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-black uppercase text-red-700">
                        <XCircle className="h-3.5 w-3.5" />
                        Inactive
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
                      <Mail className="h-4 w-4 text-[#a30105]" />
                      <span className="truncate">{customer.email || "No email"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
                      <Phone className="h-4 w-4 text-[#a30105]" />
                      <span>{customer.phone || "No phone"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
                      <MapPin className="h-4 w-4 text-[#a30105]" />
                      <span>{customer.city || "No city"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
                      <CalendarClock className="h-4 w-4 text-[#a30105]" />
                      <span>Last Order: {formatDate(summary.last_order_at)}</span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                      Address
                    </p>
                    <p className="mt-1 text-sm font-bold leading-6 text-neutral-800">
                      {customer.address_line1 || "No address available."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <h2 className="text-lg font-black text-neutral-950">
                Customer Account
              </h2>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                    Customer Type
                  </p>
                  <p className="mt-2 text-sm font-black text-neutral-950">
                    {customer.has_auth_user ? "Registered Customer" : "Guest / Order-Based Customer"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                      Joined
                    </p>
                    <p className="mt-2 text-sm font-black text-neutral-950">
                      {formatDate(customer.created_at)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
                      Last Sign In
                    </p>
                    <p className="mt-2 text-sm font-black text-neutral-950">
                      {formatDate(customer.last_sign_in_at)}
                    </p>
                  </div>
                </div>

                <a
                  href={buildWhatsappUrl(customer.phone, customer.full_name)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-black text-green-700 transition hover:bg-green-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp Customer
                </a>

                {customer.has_auth_user ? (
                  <Link
                    href={`/admin/users/${customer.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#a30105]/20 bg-[#fff7f7] px-5 py-3 text-sm font-black text-[#a30105] transition hover:bg-[#fff1f1]"
                  >
                    <UserRound className="h-4 w-4" />
                    View User Profile
                  </Link>
                ) : null}
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
                  Latest 100 orders linked with this customer profile or contact identity.
                </p>
              </div>

              <div className="rounded-2xl border border-[#a30105]/20 bg-[#fff7f7] px-4 py-3 text-sm font-black text-[#a30105]">
                Total Spend: Rs {formatPKR(summary.total_spent)}
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
                <ShoppingBag className="mx-auto h-8 w-8 text-neutral-400" />
                <h3 className="mt-3 text-lg font-black text-neutral-950">
                  No Orders Found
                </h3>
                <p className="mt-2 text-sm text-neutral-500">
                  This customer has no linked order history yet.
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[1080px] border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-black uppercase tracking-wider text-neutral-500">
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Payment</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Delivery</th>
                      <th className="px-3 py-2">Items</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => {
                      const orderItems = Array.isArray(order.items) ? order.items : [];

                      return (
                        <tr key={order.id}>
                          <td className="rounded-l-2xl border-y border-l border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                            <div className="font-black text-neutral-950">
                              {order.sales_order || `Order ${order.id.slice(0, 8)}`}
                            </div>
                            <div className="mt-1 text-xs font-bold text-neutral-500">
                              {order.customer_name || customer.full_name || "Customer"}
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
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusClasses(
                                order.status
                              )}`}
                            >
                              {getOrderStatusLabel(order.status)}
                            </span>
                          </td>

                          <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                            <div className="text-sm font-bold text-neutral-800">
                              {getDeliveryLabel(order.delivery_method)}
                            </div>
                            {order.tracking_number ? (
                              <div className="mt-1 text-xs font-bold text-neutral-500">
                                Tracking: {order.tracking_number}
                              </div>
                            ) : null}
                          </td>

                          <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                            <div className="text-sm font-black text-neutral-950">
                              {orderItems.length}
                            </div>
                          </td>

                          <td className="border-y border-neutral-200 bg-neutral-50 px-3 py-4 align-top">
                            <div className="text-sm font-black text-neutral-950">
                              Rs {formatPKR(order.total_amount)}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}