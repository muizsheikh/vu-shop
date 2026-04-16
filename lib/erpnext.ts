import Stripe from "stripe";

const DEFAULT_CURRENCY = "PKR";
const DEFAULT_COUNTRY = "Pakistan";
const DEFAULT_CUSTOMER_GROUP =
  process.env.ERP_CUSTOMER_GROUP || "All Customer Groups";
const DEFAULT_TERRITORY =
  process.env.ERP_TERRITORY || "All Territories";

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
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0, 500)}`);
  }

  if (ct.includes("application/json")) {
    return res.json();
  }

  const txt = await res.text();
  throw new Error(
    `HTTP ${res.status} ${res.statusText} (non-JSON): ${txt.slice(0, 500)}`
  );
}

async function erpFetch(path: string, opts: RequestInit = {}) {
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function sanitizePhone(value: unknown) {
  return sanitizeString(value).slice(0, 50);
}

function toCurrencyCode(value: unknown) {
  const code = sanitizeString(value, DEFAULT_CURRENCY).toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

type ERPItemLine = {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  description?: string;
};

type StripePushParams = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  session_id?: string | null;
  line_items?: Stripe.LineItem[] | null;
  shipping_address?: {
    line1?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
};

/* ---------- Customer ---------- */
export async function findCustomerByEmail(email: string) {
  const filters = enc([["email_id", "=", email]]);
  const fields = enc(["name", "customer_name", "email_id", "mobile_no"]);

  const json = await erpFetch(
    `Customer?fields=${fields}&filters=${filters}&limit_page_length=1`
  );

  return json?.data?.[0] || null;
}

export async function createCustomer(payload: {
  name?: string;
  email: string;
  phone?: string;
}) {
  const body: Record<string, unknown> = {
    customer_name: payload.name || payload.email.split("@")[0],
    customer_type: "Individual",
    customer_group: DEFAULT_CUSTOMER_GROUP,
    territory: DEFAULT_TERRITORY,
    email_id: payload.email,
  };

  if (payload.phone) body.mobile_no = payload.phone;

  const json = await erpFetch("Customer", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return json?.data;
}

export async function updateCustomerIfNeeded(
  customerName: string,
  payload: { name?: string; phone?: string }
) {
  const body: Record<string, unknown> = {};

  if (payload.name) body.customer_name = payload.name;
  if (payload.phone) body.mobile_no = payload.phone;

  if (!Object.keys(body).length) return null;

  const json = await erpFetch(`Customer/${encodeURIComponent(customerName)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return json?.data;
}

export async function ensureCustomer(
  email: string,
  name?: string,
  phone?: string
) {
  const existing = await findCustomerByEmail(email);

  if (existing?.name) {
    await updateCustomerIfNeeded(existing.name, { name, phone }).catch(() => {});
    return existing;
  }

  return createCustomer({ name, email, phone });
}

/* ---------- Address ---------- */
export async function findCustomerShippingAddress(args: {
  customerId: string;
  address_line1: string;
  city: string;
  country: string;
}) {
  const filters = enc([
    ["address_line1", "=", args.address_line1],
    ["city", "=", args.city],
    ["country", "=", args.country],
  ]);

  const fields = enc(["name"]);

  const json = await erpFetch(
    `Address?fields=${fields}&filters=${filters}&limit_page_length=10`
  );

  const rows = Array.isArray(json?.data) ? json.data : [];

  for (const row of rows) {
    const detail = await erpFetch(`Address/${encodeURIComponent(row.name)}`);
    const links = Array.isArray(detail?.data?.links) ? detail.data.links : [];
    const linked = links.some(
      (l: any) =>
        l?.link_doctype === "Customer" &&
        String(l?.link_name || "") === args.customerId
    );
    if (linked) return detail.data.name;
  }

  return null;
}

export async function createCustomerShippingAddress(args: {
  customerId: string;
  title: string;
  phone?: string;
  address_line1: string;
  city: string;
  country: string;
}) {
  const body: Record<string, unknown> = {
    address_title: args.title,
    address_type: "Shipping",
    address_line1: args.address_line1,
    city: args.city,
    country: args.country || DEFAULT_COUNTRY,
    links: [{ link_doctype: "Customer", link_name: args.customerId }],
  };

  if (args.phone) body.phone = args.phone;

  const json = await erpFetch("Address", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return json?.data?.name || null;
}

export async function ensureCustomerShippingAddress(args: {
  customerId: string;
  title: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  country?: string;
}) {
  const address_line1 = sanitizeString(args.address_line1);
  const city = sanitizeString(args.city);
  const country = sanitizeString(args.country, DEFAULT_COUNTRY);

  if (!address_line1 || !city) return undefined;

  const existing = await findCustomerShippingAddress({
    customerId: args.customerId,
    address_line1,
    city,
    country,
  });

  if (existing) return existing;

  return createCustomerShippingAddress({
    customerId: args.customerId,
    title: args.title,
    phone: args.phone,
    address_line1,
    city,
    country,
  });
}

/* ---------- Stripe line items -> ERP lines ---------- */
function normalizeStripeLineItems(
  lineItems: Stripe.LineItem[] | null | undefined
): ERPItemLine[] {
  const items: ERPItemLine[] = [];

  for (const li of lineItems || []) {
    const qty = Math.max(1, Math.floor(Number(li.quantity || 1)));
    const amountTotal = Number(li.amount_total || 0);
    const unitAmount =
      qty > 0 ? Math.round((amountTotal / qty) * 100) / 100 : 0;

    const itemCode =
      sanitizeString(li.price?.product_metadata?.item_code) ||
      sanitizeString(li.price?.product_metadata?.itemCode);

    const itemName =
      sanitizeString(li.description) ||
      sanitizeString(li.price?.product_metadata?.item_name) ||
      itemCode;

    if (!itemCode || !itemName || unitAmount < 0) continue;

    items.push({
      item_code: itemCode,
      item_name: itemName,
      qty,
      rate: unitAmount,
      amount: Math.round(qty * unitAmount * 100) / 100,
      description: itemName,
    });
  }

  return items;
}

function buildFallbackSingleLine(params: {
  amount_total?: number | null;
  currency?: string | null;
  session_id?: string | null;
}): ERPItemLine[] {
  const totalMinor = Math.max(0, Number(params.amount_total || 0));
  const totalMajor = Math.round(totalMinor) / 100;

  const fallbackCode = process.env.ERP_ITEM_CODE || "ONLINE-SALE";

  return [
    {
      item_code: fallbackCode,
      item_name: fallbackCode,
      qty: 1,
      rate: totalMajor,
      amount: totalMajor,
      description: `Stripe Checkout Session ${params.session_id || ""}`.trim(),
    },
  ];
}

/* ---------- Sales Order ---------- */
export async function createSalesOrder(args: {
  customer_name: string;
  currency?: string;
  stripe_session_id?: string;
  note?: string;
  items: ERPItemLine[];
  shipping_address_name?: string;
}) {
  const body: Record<string, unknown> = {
    transaction_date: getTodayDate(),
    delivery_date: getTomorrowDate(),
    customer: args.customer_name,
    currency: toCurrencyCode(args.currency),
    conversion_rate: 1,
    items: args.items.map((it) => ({
      item_code: it.item_code,
      qty: it.qty,
      rate: it.rate,
      description: it.description || it.item_name,
    })),
  };

  const remarks = [
    args.stripe_session_id ? `Stripe Session: ${args.stripe_session_id}` : "",
    args.note || "",
  ]
    .filter(Boolean)
    .join("\n");

  if (remarks) body.remarks = remarks;
  if (args.shipping_address_name) {
    body.shipping_address_name = args.shipping_address_name;
  }

  const json = await erpFetch("Sales Order", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return json?.data;
}

/* ---------- Entry point from webhook ---------- */
export async function pushStripeOrderToERP(params: StripePushParams) {
  const email = sanitizeEmail(params.email);
  const displayName = sanitizeString(params.name) || undefined;
  const phone = sanitizePhone(params.phone) || undefined;

  if (!email) {
    throw new Error("Stripe session has no valid customer email");
  }

  const customer = await ensureCustomer(email, displayName, phone);

  if (!customer?.name) {
    throw new Error("Failed to ensure ERP customer");
  }

  const shippingAddressName = await ensureCustomerShippingAddress({
    customerId: customer.name,
    title: displayName || customer.customer_name || customer.name,
    phone,
    address_line1: params.shipping_address?.line1 || undefined,
    city: params.shipping_address?.city || undefined,
    country: params.shipping_address?.country || undefined,
  });

  const normalizedItems = normalizeStripeLineItems(params.line_items);
  const items =
    normalizedItems.length > 0
      ? normalizedItems
      : buildFallbackSingleLine({
          amount_total: params.amount_total,
          currency: params.currency,
          session_id: params.session_id,
        });

  const noteLines = items.map(
    (it) =>
      `• ${it.item_name} (${it.item_code}) × ${it.qty} @ ${it.rate.toLocaleString()} ${toCurrencyCode(
        params.currency
      )} = ${it.amount.toLocaleString()} ${toCurrencyCode(params.currency)}`
  );

  const so = await createSalesOrder({
    customer_name: customer.name,
    currency: params.currency || DEFAULT_CURRENCY,
    stripe_session_id: params.session_id || undefined,
    note: ["Website Stripe Order", "", ...noteLines].join("\n"),
    items,
    shipping_address_name,
  });

  return {
    customer: customer?.name,
    sales_order: so?.name,
    item_count: items.length,
    used_fallback_line: normalizedItems.length === 0,
  };
}