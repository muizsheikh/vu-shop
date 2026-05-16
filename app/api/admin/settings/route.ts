import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/adminAuth";
import { canManageSettings } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SettingsPayload = {
  store_name?: string | null;
  support_email?: string | null;
  whatsapp_number?: string | null;
  delivery_charge?: number | string | null;
  minimum_order_amount?: number | string | null;
  cod_enabled?: boolean;
  order_notifications_enabled?: boolean;
  daily_summary_enabled?: boolean;
};

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

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text.length ? text.slice(0, 180) : fallback;
}

function cleanEmail(value: unknown) {
  const text = cleanText(value).toLowerCase();

  if (!text) return "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    return "INVALID_EMAIL";
  }

  return text;
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

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canManageSettings(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to view settings." },
        403
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_settings")
      .select("key, value, created_at, updated_at")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load settings.");
    }

    return jsonResponse({
      admin: admin.user,
      settings: normalizeSettings(data?.value || DEFAULT_SETTINGS),
      meta: {
        key: SETTINGS_KEY,
        created_at: data?.created_at || null,
        updated_at: data?.updated_at || null,
      },
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to load settings." },
      500
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getAdminUserFromRequest(req);

    if (!admin.ok) {
      return jsonResponse({ error: admin.message }, admin.status);
    }

    if (!canManageSettings(admin.user.role)) {
      return jsonResponse(
        { error: "You do not have permission to update settings." },
        403
      );
    }

    const body = (await req.json().catch(() => ({}))) as SettingsPayload;

    const storeName = cleanText(body.store_name, DEFAULT_SETTINGS.store_name);
    const supportEmail = cleanEmail(body.support_email);
    const whatsappNumber = cleanText(body.whatsapp_number);
    const deliveryCharge = cleanMoney(body.delivery_charge, DEFAULT_SETTINGS.delivery_charge);
    const minimumOrderAmount = cleanMoney(
      body.minimum_order_amount,
      DEFAULT_SETTINGS.minimum_order_amount
    );

    if (!storeName) {
      return jsonResponse({ error: "Store name is required." }, 400);
    }

    if (supportEmail === "INVALID_EMAIL") {
      return jsonResponse({ error: "Please enter a valid support email." }, 400);
    }

    const nextSettings = {
      store_name: storeName,
      support_email: supportEmail || DEFAULT_SETTINGS.support_email,
      whatsapp_number: whatsappNumber,
      delivery_charge: deliveryCharge,
      minimum_order_amount: minimumOrderAmount,
      cod_enabled: body.cod_enabled !== false,
      order_notifications_enabled: body.order_notifications_enabled !== false,
      daily_summary_enabled: body.daily_summary_enabled === true,
    };

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("admin_settings")
      .upsert(
        {
          key: SETTINGS_KEY,
          value: nextSettings,
          updated_at: now,
        },
        { onConflict: "key" }
      )
      .select("key, value, created_at, updated_at")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to save settings.");
    }

    return jsonResponse({
      admin: admin.user,
      settings: normalizeSettings(data?.value || nextSettings),
      meta: {
        key: SETTINGS_KEY,
        created_at: data?.created_at || null,
        updated_at: data?.updated_at || now,
      },
      message: "Settings saved successfully.",
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to save settings." },
      500
    );
  }
}
