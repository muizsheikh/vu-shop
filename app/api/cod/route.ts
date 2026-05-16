import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CURRENCY = "PKR";
const DEFAULT_COUNTRY = "Pakistan";

const DELIVERY_ITEM_CODE = "DELIVERY-CHARGES";
const DELIVERY_ITEM_NAME = "Delivery Charges";
const DEFAULT_DELIVERY_CHARGE = 200;
const MAX_CUSTOMER_NOTE_LENGTH = 500;
const SETTINGS_KEY = "store_order_settings";

const DEFAULT_ORDER_SETTINGS = {
  delivery_charge: DEFAULT_DELIVERY_CHARGE,
  minimum_order_amount: 0,
  cod_enabled: true,
};

const PREFERRED_CUSTOMER_GROUPS = [
  process.env.ERP_CUSTOMER_GROUP || "",
  "Website Customers",
  "Individual",
  "Commercial",
  "All Customer Groups",
].filter(Boolean);

const PREFERRED_TERRITORIES = [
  process.env.ERP_TERRITORY || "",
  "Pakistan",
  "All Territories",
].filter(Boolean);

function normBase(u: string) {
  let x = (u || "").trim();
  if (x && !/^https?:\/\//i.test(x)) x = `https://${x}`;
  return x.replace(/\/+$/, "");
}

function getEnv() {
  const ERP_BASE_URL = normBase(process.env.ERP_BASE_URL || "");
  const ERP_API_KEY = (process.env.ERP_API_KEY || "").trim();
  const ERP_API_SECRET = (process.env.ERP_API_SECRET || "").trim();

  if (!ERP_BASE_URL || !ERP_API_KEY || !ERP_API_SECRET) {
    throw new Error(
      "ERP credentials missing (ERP_BASE_URL, ERP_API_KEY, ERP_API_SECRET)"
    );
  }

  return { ERP_BASE_URL, ERP_API_KEY, ERP_API_SECRET };
}

function authHeaders() {
  const { ERP_API_KEY, ERP_API_SECRET } = getEnv();

  return {
    "Content-Type": "application/json",
    Authorization: `token ${ERP_API_KEY}:${ERP_API_SECRET}`,
  };
}

function buildResourceUrl(path: string) {
  const { ERP_BASE_URL } = getEnv();

  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${ERP_BASE_URL}${path}`;
  return `${ERP_BASE_URL}/api/resource/${path}`;
}

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0, 400)}`);
  }

  if (ct.includes("application/json")) return res.json();

  const txt = await res.text();
  throw new Error(
    `HTTP ${res.status} ${res.statusText} (non-JSON): ${txt.slice(0, 400)}`
  );
}

async function erpnextFetch(path: string, opts: RequestInit = {}) {
  const url = buildResourceUrl(path);

  const res = await fetch(url, {
    ...opts,
    headers: {
      ...authHeaders(),
      ...(opts.headers || {}),
    },
    cache: "no-store",
  });

  return safeJson(res);
}

function enc(value: unknown) {
  return encodeURIComponent(JSON.stringify(value));
}

function sanitizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function sanitizeEmail(value: unknown) {
  const email = sanitizeString(value).toLowerCase();
  if (!email) return "";

  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return ok ? email : "";
}

function sanitizePhone(value: unknown) {
  return sanitizeString(value).slice(0, 50);
}

function sanitizeCustomerNote(value: unknown) {
  return sanitizeString(value).slice(0, MAX_CUSTOMER_NOTE_LENGTH);
}

function sanitizeQty(value: unknown) {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.floor(qty);
}

function sanitizeRate(value: unknown) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) return null;
  return Math.round(rate * 100) / 100;
}

function sanitizeItemCode(value: unknown) {
  return sanitizeString(value).slice(0, 140);
}

function sanitizeItemName(value: unknown) {
  return sanitizeString(value).slice(0, 200);
}

function cleanMoney(value: unknown, fallback = 0) {
  const number = Number(value ?? fallback);

  if (!Number.isFinite(number)) return fallback;

  return Math.max(0, Math.round(number));
}

type IncomingCartItem = {
  item_code?: string;
  name?: string;
  qty?: number;
  price?: number;
};

type NormalizedCartItem = {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
};

type OrderSettings = {
  delivery_charge: number;
  minimum_order_amount: number;
  cod_enabled: boolean;
};

function normalizeCartItems(rawItems: unknown): NormalizedCartItem[] {
  if (!Array.isArray(rawItems)) {
    throw new Error("Invalid payload: items must be an array");
  }

  const items: NormalizedCartItem[] = [];

  for (const raw of rawItems as IncomingCartItem[]) {
    const item_code = sanitizeItemCode(raw?.item_code);
    const item_name = sanitizeItemName(raw?.name);
    const qty = sanitizeQty(raw?.qty);
    const rate = sanitizeRate(raw?.price);

    if (!item_code || !item_name || !qty || rate === null) continue;

    items.push({
      item_code,
      item_name,
      qty,
      rate,
      amount: Math.round(qty * rate * 100) / 100,
    });
  }

  if (!items.length) {
    throw new Error("Cart empty or invalid");
  }

  return items;
}

async function getOrderSettings(): Promise<OrderSettings> {
  const { data, error } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load order settings.");
  }

  const value = data?.value && typeof data.value === "object" ? data.value : {};

  return {
    delivery_charge: cleanMoney(
      (value as any).delivery_charge,
      DEFAULT_ORDER_SETTINGS.delivery_charge
    ),
    minimum_order_amount: cleanMoney(
      (value as any).minimum_order_amount,
      DEFAULT_ORDER_SETTINGS.minimum_order_amount
    ),
    cod_enabled: (value as any).cod_enabled !== false,
  };
}

/* ---------- Dynamic ERP link resolution ---------- */
async function getDoctypeList(
  doctype: string,
  fields: string[] = ["name"],
  limit = 200
) {
  const json = await erpnextFetch(
    `${doctype}?fields=${enc(fields)}&limit_page_length=${limit}`
  );

  return Array.isArray(json?.data) ? json.data : [];
}

async function resolvePreferredLinkName(args: {
  doctype: string;
  preferredNames: string[];
  preferNonGroup?: boolean;
}) {
  const rows = await getDoctypeList(args.doctype, ["name", "is_group"], 200);

  if (!rows.length) {
    throw new Error(`No records found in ERP doctype: ${args.doctype}`);
  }

  for (const preferred of args.preferredNames) {
    const exact = rows.find(
      (row: any) => String(row?.name || "").trim() === preferred
    );
    if (exact?.name) return exact.name;
  }

  if (args.preferNonGroup) {
    const nonGroup = rows.find((row: any) => Number(row?.is_group || 0) !== 1);
    if (nonGroup?.name) return nonGroup.name;
  }

  if (rows[0]?.name) return rows[0].name;

  throw new Error(`Could not resolve valid ${args.doctype}`);
}

let customerGroupCache: string | null = null;
let territoryCache: string | null = null;

async function getResolvedCustomerGroup() {
  if (customerGroupCache) return customerGroupCache;

  customerGroupCache = await resolvePreferredLinkName({
    doctype: "Customer Group",
    preferredNames: PREFERRED_CUSTOMER_GROUPS,
    preferNonGroup: true,
  });

  return customerGroupCache;
}

async function getResolvedTerritory() {
  if (territoryCache) return territoryCache;

  territoryCache = await resolvePreferredLinkName({
    doctype: "Territory",
    preferredNames: PREFERRED_TERRITORIES,
    preferNonGroup: true,
  });

  return territoryCache;
}

/* ---------- Customer ---------- */
async function findCustomerByEmail(email: string) {
  const filters = enc([["email_id", "=", email]]);
  const fields = enc(["name", "customer_name", "mobile_no"]);

  const json = await erpnextFetch(
    `Customer?filters=${filters}&fields=${fields}&limit_page_length=1`
  );

  return json?.data?.[0] || null;
}

async function createCustomer(input: {
  name: string;
  email: string;
  phone?: string;
}) {
  const customerGroup = await getResolvedCustomerGroup();
  const territory = await getResolvedTerritory();

  const payload: Record<string, unknown> = {
    customer_name: input.name,
    customer_type: "Individual",
    email_id: input.email,
    customer_group: customerGroup,
    territory,
  };

  if (input.phone) payload.mobile_no = input.phone;

  const json = await erpnextFetch("Customer", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return json?.data;
}

async function updateCustomerIfNeeded(
  customerName: string,
  input: { name: string; phone?: string }
) {
  const payload: Record<string, unknown> = {};

  if (input.name) payload.customer_name = input.name;
  if (input.phone) payload.mobile_no = input.phone;

  if (!Object.keys(payload).length) return;

  await erpnextFetch(`Customer/${encodeURIComponent(customerName)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function ensureCustomer(input: {
  name: string;
  email: string;
  phone?: string;
}) {
  const existing = await findCustomerByEmail(input.email);

  if (existing?.name) {
    await updateCustomerIfNeeded(existing.name, {
      name: input.name,
      phone: input.phone,
    }).catch(() => {});
    return existing.name as string;
  }

  const created = await createCustomer(input);

  if (!created?.name) {
    throw new Error("Failed to create customer");
  }

  return created.name as string;
}

/* ---------- Address ---------- */
async function findShippingAddress(input: {
  customerId: string;
  address_line1: string;
  city: string;
  country: string;
}) {
  const filters = enc([
    ["address_line1", "=", input.address_line1],
    ["city", "=", input.city],
    ["country", "=", input.country],
  ]);

  const fields = enc(["name"]);

  const json = await erpnextFetch(
    `Address?filters=${filters}&fields=${fields}&limit_page_length=10`
  );

  const rows = Array.isArray(json?.data) ? json.data : [];
  if (!rows.length) return null;

  for (const row of rows) {
    const detail = await erpnextFetch(`Address/${encodeURIComponent(row.name)}`);
    const links = Array.isArray(detail?.data?.links) ? detail.data.links : [];

    const linked = links.some(
      (l: any) =>
        l?.link_doctype === "Customer" &&
        String(l?.link_name || "") === input.customerId
    );

    if (linked) return detail.data.name;
  }

  return null;
}

async function createShippingAddress(input: {
  customerId: string;
  title: string;
  phone?: string;
  address_line1: string;
  city: string;
  country: string;
}) {
  const payload: Record<string, unknown> = {
    address_title: input.title,
    address_type: "Shipping",
    address_line1: input.address_line1,
    city: input.city,
    country: input.country,
    links: [{ link_doctype: "Customer", link_name: input.customerId }],
  };

  if (input.phone) payload.phone = input.phone;

  const json = await erpnextFetch("Address", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return json?.data?.name || null;
}

async function ensureShippingAddress(input: {
  customerId: string;
  title: string;
  phone?: string;
  address_line1: string;
  city: string;
  country: string;
}) {
  if (!input.address_line1 || !input.city) return undefined;

  const existing = await findShippingAddress(input);
  if (existing) return existing;

  return createShippingAddress(input);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildSalesOrderItems(items: NormalizedCartItem[], deliveryCharge: number) {
  const productItems = items.map((it) => ({
    item_code: it.item_code,
    qty: it.qty,
    rate: it.rate,
    description: it.item_name,
  }));

  if (deliveryCharge <= 0) {
    return productItems;
  }

  return [
    ...productItems,
    {
      item_code: DELIVERY_ITEM_CODE,
      qty: 1,
      rate: deliveryCharge,
      description: DELIVERY_ITEM_NAME,
    },
  ];
}

function buildOrderRemarks(
  items: NormalizedCartItem[],
  customer: { name: string; email: string; phone?: string },
  settings: OrderSettings,
  customerNote?: string
) {
  const productTotal = items.reduce((sum, it) => sum + it.amount, 0);
  const grandTotal = productTotal + settings.delivery_charge;

  const lines = items.map(
    (it) =>
      `• ${it.item_name} (${it.item_code}) × ${it.qty} @ Rs ${it.rate.toLocaleString()} = Rs ${it.amount.toLocaleString()}`
  );

  return [
    "Website COD Order",
    "",
    `Customer: ${customer.name}`,
    `Email: ${customer.email}`,
    customer.phone ? `Phone: ${customer.phone}` : "",
    customerNote ? `Customer Note: ${customerNote}` : "",
    "",
    ...lines,
    "",
    `Delivery Charges: Rs ${settings.delivery_charge.toLocaleString()}`,
    `Grand Total: Rs ${grandTotal.toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function createSalesOrder(payload: Record<string, unknown>) {
  const json = await erpnextFetch("Sales Order", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return json?.data;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const settings = await getOrderSettings();

    if (!settings.cod_enabled) {
      return NextResponse.json(
        {
          error: "Cash on Delivery is currently disabled. Please choose another payment method.",
        },
        { status: 403 }
      );
    }

    const items = normalizeCartItems(body?.items);
    const productTotal = items.reduce((sum, item) => sum + item.amount, 0);

    if (settings.minimum_order_amount > 0 && productTotal < settings.minimum_order_amount) {
      return NextResponse.json(
        {
          error: `Minimum order amount is Rs ${settings.minimum_order_amount.toLocaleString()}. Please add more items to continue.`,
          minimum_order_amount: settings.minimum_order_amount,
          current_subtotal: productTotal,
        },
        { status: 400 }
      );
    }

    const customerNote = sanitizeCustomerNote(body?.customer_note);

    const customerName = sanitizeString(
      body?.customer?.name,
      "Guest Checkout"
    ).slice(0, 140);

    const customerEmail =
      sanitizeEmail(body?.customer?.email) || "guest@vapeustad.com";

    const customerPhone = sanitizePhone(body?.customer?.phone);

    const addressLine1 = sanitizeString(body?.customer?.address_line1).slice(
      0,
      200
    );

    const city = sanitizeString(body?.customer?.city).slice(0, 140);

    const country = sanitizeString(
      body?.customer?.country,
      DEFAULT_COUNTRY
    ).slice(0, 140);

    const customerId = await ensureCustomer({
      name: customerName,
      email: customerEmail,
      phone: customerPhone || undefined,
    });

    const shippingAddressName = await ensureShippingAddress({
      customerId,
      title: customerName || customerId,
      phone: customerPhone || undefined,
      address_line1: addressLine1,
      city,
      country,
    });

    const soPayload: Record<string, unknown> = {
      customer: customerId,
      transaction_date: getTodayDate(),
      delivery_date: getTomorrowDate(),
      currency: DEFAULT_CURRENCY,
      conversion_rate: 1,
      items: buildSalesOrderItems(items, settings.delivery_charge),
      remarks: buildOrderRemarks(
        items,
        {
          name: customerName,
          email: customerEmail,
          phone: customerPhone || undefined,
        },
        settings,
        customerNote || undefined
      ),
    };

    if (shippingAddressName) {
      soPayload.shipping_address_name = shippingAddressName;
    }

    const so = await createSalesOrder(soPayload);

    if (!so?.name) {
      throw new Error("Sales Order created but no name returned");
    }

    return NextResponse.json({
      success: true,
      so: so.name,
      settings: {
        delivery_charge: settings.delivery_charge,
        minimum_order_amount: settings.minimum_order_amount,
        cod_enabled: settings.cod_enabled,
      },
    });
  } catch (err: any) {
    console.error("POST /api/cod failed:", err);

    return NextResponse.json(
      {
        error: err?.message || "COD failed",
      },
      { status: 500 }
    );
  }
}
