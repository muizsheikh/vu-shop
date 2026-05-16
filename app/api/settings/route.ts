import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTINGS_KEY = "store_order_settings";

const DEFAULT_SETTINGS = {
  store_name: "Vape Ustad",
  support_email: "info@vapeustad.com",
  whatsapp_number: "",
  delivery_charge: 200,
  minimum_order_amount: 0,
  cod_enabled: true,
  order_notifications_enabled: true,
  daily_summary_enabled: false,
};

function cleanText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text.length ? text.slice(0, 180) : fallback;
}

function cleanMoney(value: unknown, fallback = 0) {
  const number = Number(value ?? fallback);

  if (!Number.isFinite(number)) return fallback;

  return Math.max(0, Math.round(number));
}

function normalizeSettings(value: any) {
  const source = value && typeof value === "object" ? value : {};

  return {
    store_name: cleanText(source.store_name, DEFAULT_SETTINGS.store_name),
    support_email: cleanText(source.support_email, DEFAULT_SETTINGS.support_email).toLowerCase(),
    whatsapp_number: cleanText(source.whatsapp_number, DEFAULT_SETTINGS.whatsapp_number),
    delivery_charge: cleanMoney(source.delivery_charge, DEFAULT_SETTINGS.delivery_charge),
    minimum_order_amount: cleanMoney(
      source.minimum_order_amount,
      DEFAULT_SETTINGS.minimum_order_amount
    ),
    cod_enabled: source.cod_enabled !== false,
    order_notifications_enabled: source.order_notifications_enabled !== false,
    daily_summary_enabled: source.daily_summary_enabled === true,
  };
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_settings")
      .select("value, updated_at")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load store settings.");
    }

    const settings = normalizeSettings(data?.value || DEFAULT_SETTINGS);

    return NextResponse.json({
      settings: {
        store_name: settings.store_name,
        support_email: settings.support_email,
        whatsapp_number: settings.whatsapp_number,
        delivery_charge: settings.delivery_charge,
        minimum_order_amount: settings.minimum_order_amount,
        cod_enabled: settings.cod_enabled,
      },
      meta: {
        updated_at: data?.updated_at || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      settings: DEFAULT_SETTINGS,
      error: error?.message || "Failed to load store settings.",
    });
  }
}
