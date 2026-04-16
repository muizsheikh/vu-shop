// /app/api/cod/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CURRENCY = "PKR";
const DEFAULT_COUNTRY = "Pakistan";
const DEFAULT_CUSTOMER_GROUP = process.env.ERP_CUSTOMER_GROUP || "All Customer Groups";
const DEFAULT_TERRITORY = process.env.ERP_TERRITORY || "All Territories";

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

async function findCustomerByEmail(email: string) {
  const filters = encodeURIComponent(JSON.stringify([["email_id", "=", email]]));
  const fields = encodeURIComponent(JSON.stringify(["name", "customer_name", "mobile_no"]));

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
  const payload: Record<string, unknown> = {
    customer_name: input.name,
    customer_type: "Individual",
    email_id: input.email,
    customer_group: DEFAULT_CUSTOMER_GROUP,
    territory: DEFAULT_TERRITORY,
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

async function findShippingAddress(input: {
  customerId: string;
  address_line1: string;
  city: string;
  country: string;
}) {
  const filters = encodeURIComponent(
    JSON.stringify([
      ["address_line1", "=", input.address_line1],
      ["city", "=", input.city],
      ["country", "=", input.country],
    ])
  );

  const fields = encodeURIComponent(JSON.stringify(["name"]));

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
        l?.link_doctype === "Customer" && String(l?.link_name || "") === input.customerId
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

function buildSalesOrderItems(items: NormalizedCartItem[]) {
  return items.map((it) => ({
    item_code: it.item_code,
    qty: it.qty,
    rate: it.rate,
    description: it.item_name,
  }));
}

function buildOrderNote(items: NormalizedCartItem[], customer: { name: string; email: string; phone?: string }) {
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
    "",
    ...lines,
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

    const items = normalizeCartItems(body?.items);

    const customerName =
      sanitizeString(body?.customer?.name, "Guest Checkout").slice(0, 140);
    const customerEmail =
      sanitizeEmail(body?.customer?.email) || "guest@vapeustad.com";
    const customerPhone = sanitizePhone(body?.customer?.phone);

    const addressLine1 = sanitizeString(body?.customer?.address_line1).slice(0, 200);
    const city = sanitizeString(body?.customer?.city).slice(0, 140);
    const country = sanitizeString(body?.customer?.country, DEFAULT_COUNTRY).slice(0, 140);

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
      items: buildSalesOrderItems(items),
      note: buildOrderNote(items, {
        name: customerName,
        email: customerEmail,
        phone: customerPhone || undefined,
      }),
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