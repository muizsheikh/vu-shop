"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

type StoreSettings = {
  store_name: string;
  support_email: string;
  whatsapp_number: string;
  delivery_charge: number;
  minimum_order_amount: number;
  cod_enabled: boolean;
  order_notifications_enabled: boolean;
  daily_summary_enabled: boolean;
};

const DEFAULT_SETTINGS: StoreSettings = {
  store_name: "Vape Ustad",
  support_email: "info@vapeustad.com",
  whatsapp_number: "",
  delivery_charge: 200,
  minimum_order_amount: 0,
  cod_enabled: true,
  order_notifications_enabled: true,
  daily_summary_enabled: false,
};

function formatPKR(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-PK").format(Number(value || 0));
}

function toSettings(value: any): StoreSettings {
  const source = value && typeof value === "object" ? value : {};

  return {
    store_name: String(source.store_name || DEFAULT_SETTINGS.store_name),
    support_email: String(source.support_email || DEFAULT_SETTINGS.support_email),
    whatsapp_number: String(source.whatsapp_number || DEFAULT_SETTINGS.whatsapp_number),
    delivery_charge: Number(source.delivery_charge ?? DEFAULT_SETTINGS.delivery_charge),
    minimum_order_amount: Number(
      source.minimum_order_amount ?? DEFAULT_SETTINGS.minimum_order_amount
    ),
    cod_enabled: source.cod_enabled !== false,
    order_notifications_enabled: source.order_notifications_enabled !== false,
    daily_summary_enabled: source.daily_summary_enabled === true,
  };
}

function cardClass(className = "") {
  return `rounded-[28px] border bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] ${className}`;
}

export default function AdminSettingsPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [accessError, setAccessError] = useState("");

  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function loadSettings(options?: { tokenFromCheck?: string }) {
    setLoadingSettings(true);
    setErrorText("");
    setSuccessText("");

    try {
      const token = options?.tokenFromCheck || (await getAccessToken());

      if (!token) {
        router.replace("/account/login?next=/admin/settings");
        return;
      }

      const res = await fetch("/api/admin/settings", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setAllowed(false);
        setAccessError(json?.error || "Settings access required.");
        throw new Error(json?.error || "Failed to load settings.");
      }

      setAllowed(true);
      setSettings(toSettings(json?.settings));
      setUpdatedAt(json?.meta?.updated_at || null);

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(String(json.admin.email || "").toLowerCase());
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to load settings.");
    } finally {
      setLoadingSettings(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    setErrorText("");
    setSuccessText("");

    try {
      const token = await getAccessToken();

      if (!token) {
        router.replace("/account/login?next=/admin/settings");
        return;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save settings.");
      }

      setSettings(toSettings(json?.settings));
      setUpdatedAt(json?.meta?.updated_at || new Date().toISOString());
      setSuccessText(json?.message || "Settings saved successfully.");

      if (json?.admin) {
        setAdminUser(json.admin);
        setAdminEmail(String(json.admin.email || "").toLowerCase());
      }
    } catch (error: any) {
      setErrorText(error?.message || "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  function updateSetting<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setErrorText("");
    setSuccessText("");
  }

  useEffect(() => {
    async function initSettings() {
      setAuthLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.access_token) {
        router.replace("/account/login?next=/admin/settings");
        return;
      }

      setAdminEmail(String(session.user?.email || "").trim().toLowerCase());
      setAllowed(true);
      setAuthLoading(false);

      await loadSettings({ tokenFromCheck: session.access_token });
    }

    initSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const statusCards = useMemo(
    () => [
      {
        label: "Store Name",
        value: settings.store_name || "Not set",
        icon: Store,
        className: "border-neutral-200 text-neutral-950",
      },
      {
        label: "Delivery Charge",
        value: `Rs ${formatPKR(settings.delivery_charge)}`,
        icon: Truck,
        className: "border-[#a30105]/20 bg-[#fff7f7] text-[#a30105]",
      },
      {
        label: "COD Status",
        value: settings.cod_enabled ? "Enabled" : "Disabled",
        icon: CreditCard,
        className: settings.cod_enabled
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700",
      },
      {
        label: "Daily Summary",
        value: settings.daily_summary_enabled ? "Enabled" : "Disabled",
        icon: Bell,
        className: settings.daily_summary_enabled
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-neutral-200 bg-white text-neutral-700",
      },
    ],
    [settings]
  );

  if (authLoading) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#a30105]" />
        <p className="mt-3 text-sm font-bold text-neutral-700">
          Checking settings access...
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
          Settings Access Required
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">{accessError}</p>
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
              Admin Settings
            </p>
            <h1 className="mt-3 text-3xl font-black text-neutral-950">
              Store & Order Settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Manage the core business settings used for store identity, customer support, delivery charges and checkout controls.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadSettings()}
              disabled={loadingSettings || savingSettings}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-black text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>

            <button
              type="button"
              onClick={saveSettings}
              disabled={savingSettings || loadingSettings}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-black text-white transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-black text-green-700">
            Admin: {adminEmail || "admin"}
          </span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase text-blue-700">
            Role: {adminUser?.role || "admin"}
          </span>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black text-neutral-600">
            Updated: {updatedAt ? new Date(updatedAt).toLocaleString("en-PK") : "Not saved yet"}
          </span>
        </div>

        {successText ? (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
            {successText}
          </div>
        ) : null}

        {errorText ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorText}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-[26px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.05)] ${card.className}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-5 text-xs font-black uppercase tracking-wider opacity-80">
                {card.label}
              </div>
              <div className="mt-2 text-2xl font-black">{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={cardClass("border-neutral-200")}>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff7f7] text-[#a30105]">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a30105]">
                Store Identity
              </p>
              <h2 className="mt-2 text-2xl font-black text-neutral-950">
                Store Details
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                Store Name
              </label>
              <input
                value={settings.store_name}
                onChange={(event) => updateSetting("store_name", event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-bold outline-none transition focus:border-[#a30105] focus:bg-white"
                placeholder="Vape Ustad"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                Support Email
              </label>
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={settings.support_email}
                  onChange={(event) => updateSetting("support_email", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-[#a30105] focus:bg-white"
                  placeholder="info@vapeustad.com"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                WhatsApp Number
              </label>
              <div className="relative mt-2">
                <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={settings.whatsapp_number}
                  onChange={(event) => updateSetting("whatsapp_number", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-[#a30105] focus:bg-white"
                  placeholder="923XXXXXXXXX"
                />
              </div>
            </div>
          </div>
        </div>

        <div className={cardClass("border-neutral-200")}>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#a30105]">
                Checkout Controls
              </p>
              <h2 className="mt-2 text-2xl font-black text-neutral-950">
                Order Settings
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                  Delivery Charge
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.delivery_charge}
                  onChange={(event) => updateSetting("delivery_charge", Number(event.target.value || 0))}
                  className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-bold outline-none transition focus:border-[#a30105] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-neutral-500">
                  Minimum Order Amount
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.minimum_order_amount}
                  onChange={(event) => updateSetting("minimum_order_amount", Number(event.target.value || 0))}
                  className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-bold outline-none transition focus:border-[#a30105] focus:bg-white"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:bg-white">
              <div>
                <div className="text-sm font-black text-neutral-950">Cash on Delivery</div>
                <div className="mt-1 text-xs font-bold text-neutral-500">
                  Allow customers to place COD orders.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.cod_enabled}
                onChange={(event) => updateSetting("cod_enabled", event.target.checked)}
                className="h-5 w-5"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:bg-white">
              <div>
                <div className="text-sm font-black text-neutral-950">Order Notifications</div>
                <div className="mt-1 text-xs font-bold text-neutral-500">
                  Enable notifications for new website orders.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.order_notifications_enabled}
                onChange={(event) =>
                  updateSetting("order_notifications_enabled", event.target.checked)
                }
                className="h-5 w-5"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:bg-white">
              <div>
                <div className="text-sm font-black text-neutral-950">Daily Summary</div>
                <div className="mt-1 text-xs font-bold text-neutral-500">
                  Enable daily business summary notifications.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.daily_summary_enabled}
                onChange={(event) => updateSetting("daily_summary_enabled", event.target.checked)}
                className="h-5 w-5"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-blue-200 bg-blue-50 p-5 text-sm font-bold leading-6 text-blue-700">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            These settings are now stored in Supabase and can be reused by checkout, notifications and future ERP integrations. The next phase can connect these values directly to COD checkout and website display logic.
          </div>
        </div>
      </div>
    </div>
  );
}
