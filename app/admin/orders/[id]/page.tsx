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
  History,
  Loader2,
  MapPin,
  MessageCircle,
  NotebookPen,
  PackageCheck,
  Phone,
  Save,
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
  delivery_method: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  delivery_note: string | null;
  tracking_number: string | null;
  expected_delivery_time: string | null;
};

type StatusHistoryRow = {
  id: string;
  order_id: string;
  old_status: string | null;
  new_status: string;
  changed_by_email: string | null;
  created_at: string;
};

type AdminNoteRow = {
  id: string;
  order_id: string;
  note: string;
  created_by_email: string | null;
  created_at: string;
};

type DeliveryForm = {
  delivery_method: string;
  rider_name: string;
  rider_phone: string;
  tracking_number: string;
  expected_delivery_time: string;
  delivery_note: string;
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  try {
    return new Date(value).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(date.getTime() - offsetMs);

    return localDate.toISOString().slice(0, 16);
  } catch {
    return "";
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

function getDeliveryMethodLabel(method: string | null | undefined) {
  const normalized = String(method || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

  if (normalized === "rider") return "Rider Delivery";
  if (normalized === "courier") return "Courier Delivery";
  if (normalized === "pickup") return "Store Pickup";

  return "Not Assigned";
}

function normalizeWhatsappPhone(phone: string | null | undefined) {
  const raw = String(phone || "").replace(/\D/g, "");

  if (!raw) return "";

  if (raw.startsWith("92")) {
    return raw;
  }

  if (raw.startsWith("0")) {
    return `92${raw.slice(1)}`;
  }

  if (raw.length === 10 && raw.startsWith("3")) {
    return `92${raw}`;
  }

  return raw;
}

function getCustomerFirstName(name: string | null | undefined) {
  const cleanName = String(name || "Customer").trim();

  if (!cleanName) return "Customer";

  return cleanName.split(" ")[0] || cleanName;
}

function buildWhatsappUrl(phone: string | null | undefined, message: string) {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const encodedMessage = encodeURIComponent(message);

  if (!normalizedPhone) {
    return `https://wa.me/?text=${encodedMessage}`;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

function buildDeliveryLine(order: OrderRow) {
  const lines: string[] = [];

  if (order.delivery_method) {
    lines.push(`Delivery: ${getDeliveryMethodLabel(order.delivery_method)}`);
  }

  if (order.rider_name) {
    lines.push(`Rider/Courier: ${order.rider_name}`);
  }

  if (order.rider_phone) {
    lines.push(`Contact: ${order.rider_phone}`);
  }

  if (order.tracking_number) {
    lines.push(`Tracking: ${order.tracking_number}`);
  }

  if (order.expected_delivery_time) {
    lines.push(`Expected: ${formatDate(order.expected_delivery_time)}`);
  }

  return lines.length ? `\n${lines.join("\n")}\n` : "";
}

function buildWhatsappMessage(
  order: OrderRow,
  totals: { subtotal: number; delivery: number; total: number },
  type:
    | "confirmed"
    | "processing"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
) {
  const name = getCustomerFirstName(order.customer_name);
  const orderNumber = order.sales_order || `Order ${order.id.slice(0, 8)}`;
  const total = `Rs ${formatPKR(totals.total)}`;
  const deliveryLine = buildDeliveryLine(order);

  if (type === "confirmed") {
    return `Assalam o Alaikum ${name},

Your Vape Ustad order has been confirmed.

Order: ${orderNumber}
Status: Confirmed
Total: ${total}

Our team will start preparing your order shortly.

Thank you for shopping with Vape Ustad.`;
  }

  if (type === "processing") {
    return `Assalam o Alaikum ${name},

Your Vape Ustad order is now being prepared.

Order: ${orderNumber}
Status: Processing
Total: ${total}

We will update you once your order is ready for delivery.

Thank you for shopping with Vape Ustad.`;
  }

  if (type === "out_for_delivery") {
    return `Assalam o Alaikum ${name},

Your Vape Ustad order is out for delivery.

Order: ${orderNumber}
Status: Out for Delivery
Total: ${total}${deliveryLine}

Please keep your phone available for the rider/courier.

Thank you for shopping with Vape Ustad.`;
  }

  if (type === "delivered") {
    return `Assalam o Alaikum ${name},

Your Vape Ustad order has been delivered.

Order: ${orderNumber}
Status: Delivered
Total: ${total}

Thank you for shopping with Vape Ustad. We hope to serve you again soon.`;
  }

  return `Assalam o Alaikum ${name},

Your Vape Ustad order has been cancelled.

Order: ${orderNumber}
Status: Cancelled

For any question or support, please contact Vape Ustad.

Thank you.`;
}

function getDeliveryFormFromOrder(order: OrderRow | null): DeliveryForm {
  return {
    delivery_method: order?.delivery_method || "",
    rider_name: order?.rider_name || "",
    rider_phone: order?.rider_phone || "",
    tracking_number: order?.tracking_number || "",
    expected_delivery_time: formatDateTimeLocal(order?.expected_delivery_time),
    delivery_note: order?.delivery_note || "",
  };
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params?.id || "");

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const [loadingOrder, setLoadingOrder] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [history, setHistory] = useState<StatusHistoryRow[]>([]);
  const [notes, setNotes] = useState<AdminNoteRow[]>([]);
  const [noteText, setNoteText] = useState("");

  const [updating, setUpdating] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [noteErrorText, setNoteErrorText] = useState("");
  const [deliveryErrorText, setDeliveryErrorText] = useState("");
  const [deliverySuccessText, setDeliverySuccessText] = useState("");
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(
    getDeliveryFormFromOrder(null)
  );

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadHistory() {
    setLoadingHistory(true);

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace(`/account/login?next=/admin/orders/${orderId}`);
        return;
      }

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load status history.");
      }

      setHistory(Array.isArray(json?.history) ? json.history : []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadNotes() {
    setLoadingNotes(true);
    setNoteErrorText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace(`/account/login?next=/admin/orders/${orderId}`);
        return;
      }

      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load admin notes.");
      }

      setNotes(Array.isArray(json?.notes) ? json.notes : []);
    } catch (error: any) {
      setNoteErrorText(error?.message || "Failed to load admin notes.");
      setNotes([]);
    } finally {
      setLoadingNotes(false);
    }
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

      const loadedOrder = json?.order || null;

      setOrder(loadedOrder);
      setDeliveryForm(getDeliveryFormFromOrder(loadedOrder));
      await loadHistory();
      await loadNotes();
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
        body: JSON.stringify({
          status,
          delivery_method: deliveryForm.delivery_method,
          rider_name: deliveryForm.rider_name,
          rider_phone: deliveryForm.rider_phone,
          tracking_number: deliveryForm.tracking_number,
          expected_delivery_time: deliveryForm.expected_delivery_time,
          delivery_note: deliveryForm.delivery_note,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Status update failed.");
      }

      const updatedOrder = json?.order || null;

      setOrder(updatedOrder);
      setDeliveryForm(getDeliveryFormFromOrder(updatedOrder));
      setHistory(Array.isArray(json?.history) ? json.history : []);
    } catch (error: any) {
      setErrorText(error?.message || "Status update failed.");
    } finally {
      setUpdating(false);
    }
  }

  async function saveDeliveryDetails() {
    if (!order) return;

    setSavingDelivery(true);
    setDeliveryErrorText("");
    setDeliverySuccessText("");

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
        body: JSON.stringify({
          status: normalizeOrderStatus(order.status),
          delivery_method: deliveryForm.delivery_method,
          rider_name: deliveryForm.rider_name,
          rider_phone: deliveryForm.rider_phone,
          tracking_number: deliveryForm.tracking_number,
          expected_delivery_time: deliveryForm.expected_delivery_time,
          delivery_note: deliveryForm.delivery_note,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Delivery details update failed.");
      }

      const updatedOrder = json?.order || null;

      setOrder(updatedOrder);
      setDeliveryForm(getDeliveryFormFromOrder(updatedOrder));
      setHistory(Array.isArray(json?.history) ? json.history : []);
      setDeliverySuccessText("Delivery details saved successfully.");
    } catch (error: any) {
      setDeliveryErrorText(
        error?.message || "Delivery details update failed."
      );
    } finally {
      setSavingDelivery(false);
    }
  }

  async function saveAdminNote() {
    const cleanNote = noteText.trim();

    if (!cleanNote) {
      setNoteErrorText("Note likhna zaroori hai.");
      return;
    }

    setSavingNote(true);
    setNoteErrorText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace(`/account/login?next=/admin/orders/${orderId}`);
        return;
      }

      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: cleanNote }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save admin note.");
      }

      setNotes(Array.isArray(json?.notes) ? json.notes : []);
      setNoteText("");
    } catch (error: any) {
      setNoteErrorText(error?.message || "Failed to save admin note.");
    } finally {
      setSavingNote(false);
    }
  }

  function updateDeliveryForm(key: keyof DeliveryForm, value: string) {
    setDeliveryForm((current) => ({
      ...current,
      [key]: value,
    }));

    setDeliveryErrorText("");
    setDeliverySuccessText("");
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
  const whatsappPhone = normalizeWhatsappPhone(order.customer_phone);
  const hasWhatsappPhone = Boolean(whatsappPhone);

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

        <div className="mt-6 rounded-[26px] border border-blue-200 bg-blue-50/50 p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <Truck className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
                  Delivery Assignment
                </p>
                <h2 className="text-xl font-black text-neutral-950">
                  Rider / Courier Details
                </h2>
              </div>
            </div>

            <span className="rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-black uppercase text-blue-700">
              {getDeliveryMethodLabel(order.delivery_method)}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                Delivery Method
              </label>
              <select
                value={deliveryForm.delivery_method}
                onChange={(event) =>
                  updateDeliveryForm("delivery_method", event.target.value)
                }
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-900 outline-none transition focus:border-blue-500"
              >
                <option value="">Not Assigned</option>
                <option value="rider">Rider Delivery</option>
                <option value="courier">Courier Delivery</option>
                <option value="pickup">Store Pickup</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                Expected Delivery Time
              </label>
              <input
                type="datetime-local"
                value={deliveryForm.expected_delivery_time}
                onChange={(event) =>
                  updateDeliveryForm(
                    "expected_delivery_time",
                    event.target.value
                  )
                }
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-900 outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                Rider / Courier Name
              </label>
              <input
                type="text"
                value={deliveryForm.rider_name}
                onChange={(event) =>
                  updateDeliveryForm("rider_name", event.target.value)
                }
                placeholder="Example: Ali Rider / TCS / Leopard"
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                Rider / Courier Phone
              </label>
              <input
                type="text"
                value={deliveryForm.rider_phone}
                onChange={(event) =>
                  updateDeliveryForm("rider_phone", event.target.value)
                }
                placeholder="Example: 03001234567"
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                Tracking Number / Courier ID
              </label>
              <input
                type="text"
                value={deliveryForm.tracking_number}
                onChange={(event) =>
                  updateDeliveryForm("tracking_number", event.target.value)
                }
                placeholder="Example: TCS123456 / Rider token / manual reference"
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                Delivery Note
              </label>
              <textarea
                value={deliveryForm.delivery_note}
                onChange={(event) =>
                  updateDeliveryForm("delivery_note", event.target.value)
                }
                placeholder="Example: Customer requested evening delivery. Call before dispatch."
                rows={4}
                maxLength={1200}
                className="mt-2 w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-blue-500"
              />
              <div className="mt-2 text-xs font-bold text-neutral-500">
                {deliveryForm.delivery_note.trim().length}/1200 characters
              </div>
            </div>
          </div>

          {deliveryErrorText ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {deliveryErrorText}
            </div>
          ) : null}

          {deliverySuccessText ? (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
              {deliverySuccessText}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-neutral-500">
              Ye details customer order detail page par show ho sakti hain.
              WhatsApp “Out” message me bhi delivery info include hogi.
            </p>

            <button
              type="button"
              disabled={savingDelivery}
              onClick={saveDeliveryDetails}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingDelivery ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Delivery
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[26px] border border-green-200 bg-green-50/40 p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                <MessageCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">
                  Customer Communication
                </p>
                <h2 className="text-xl font-black text-neutral-950">
                  WhatsApp Actions
                </h2>
              </div>
            </div>

            <span className="rounded-full border border-green-200 bg-white px-4 py-2 text-xs font-black uppercase text-green-700">
              {hasWhatsappPhone ? `WA: ${whatsappPhone}` : "No Phone"}
            </span>
          </div>

          {!hasWhatsappPhone ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
              Customer phone number missing/invalid hai. Button WhatsApp open
              karega lekin direct customer chat open nahi hogi.
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <a
              href={buildWhatsappUrl(
                order.customer_phone,
                buildWhatsappMessage(order, totals, "confirmed")
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
            >
              <MessageCircle className="h-4 w-4" />
              Confirm
            </a>

            <a
              href={buildWhatsappUrl(
                order.customer_phone,
                buildWhatsappMessage(order, totals, "processing")
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-amber-700 transition hover:bg-amber-50"
            >
              <MessageCircle className="h-4 w-4" />
              Processing
            </a>

            <a
              href={buildWhatsappUrl(
                order.customer_phone,
                buildWhatsappMessage(order, totals, "out_for_delivery")
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-50"
            >
              <MessageCircle className="h-4 w-4" />
              Out
            </a>

            <a
              href={buildWhatsappUrl(
                order.customer_phone,
                buildWhatsappMessage(order, totals, "delivered")
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-black text-green-700 transition hover:bg-green-50"
            >
              <MessageCircle className="h-4 w-4" />
              Delivered
            </a>

            <a
              href={buildWhatsappUrl(
                order.customer_phone,
                buildWhatsappMessage(order, totals, "cancelled")
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-50"
            >
              <MessageCircle className="h-4 w-4" />
              Cancel
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-[26px] border border-[#a30105]/20 bg-[#fff7f7] p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#a30105]/10 text-[#a30105]">
                <NotebookPen className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a30105]">
                  Internal Use Only
                </p>
                <h2 className="text-xl font-black text-neutral-950">
                  Admin Notes
                </h2>
              </div>
            </div>

            {loadingNotes ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#a30105]" />
            ) : (
              <span className="rounded-full border border-[#a30105]/15 bg-white px-4 py-2 text-xs font-black uppercase text-[#a30105]">
                {notes.length} Notes
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-[#a30105]/15 bg-white p-4">
            <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
              Add Internal Note
            </label>

            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Example: Customer requested evening delivery. Address confirmed on call."
              rows={4}
              maxLength={1200}
              className="mt-3 w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#a30105] focus:bg-white"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-bold text-neutral-500">
                {noteText.trim().length}/1200 characters
              </div>

              <button
                type="button"
                disabled={savingNote}
                onClick={saveAdminNote}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingNote ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <NotebookPen className="h-4 w-4" />
                    Save Note
                  </>
                )}
              </button>
            </div>

            {noteErrorText ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                {noteErrorText}
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            {notes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#a30105]/20 bg-white p-5 text-center text-sm text-neutral-500">
                Abhi koi internal note nahi hai. Note save karne ke baad yahan
                show hoga.
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-4"
                  >
                    <div className="whitespace-pre-wrap text-sm font-medium leading-6 text-neutral-800">
                      {note.note}
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-3 text-xs font-bold text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        Added by{" "}
                        <span className="text-neutral-900">
                          {note.created_by_email || "Admin"}
                        </span>
                      </span>

                      <span>{formatDate(note.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[26px] border border-neutral-200 bg-white p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#a30105]/10 text-[#a30105]">
                <History className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a30105]">
                  Audit Log
                </p>
                <h2 className="text-xl font-black text-neutral-950">
                  Status History
                </h2>
              </div>
            </div>

            {loadingHistory ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#a30105]" />
            ) : (
              <span className="rounded-full bg-neutral-50 px-4 py-2 text-xs font-black uppercase text-neutral-600">
                {history.length} Updates
              </span>
            )}
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center text-sm text-neutral-500">
              Abhi status history available nahi hai. Next status change ke baad
              yahan audit log show hoga.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusClasses(
                          row.old_status
                        )}`}
                      >
                        {getOrderStatusLabel(row.old_status || "placed")}
                      </span>

                      <span className="text-sm font-black text-neutral-400">
                        →
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusClasses(
                          row.new_status
                        )}`}
                      >
                        {getOrderStatusLabel(row.new_status)}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-neutral-500">
                      {formatDate(row.created_at)}
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-neutral-600">
                    Changed by{" "}
                    <span className="font-black text-neutral-950">
                      {row.changed_by_email || "Admin"}
                    </span>
                  </div>
                </div>
              ))}
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