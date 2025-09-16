// /lib/erpnext.ts
const BASE = process.env.ERP_BASE_URL;
const KEY = process.env.ERP_API_KEY;
const SECRET = process.env.ERP_API_SECRET;

const DEFAULT_GROUP = process.env.ERP_CUSTOMER_GROUP || "All Customer";
const DEFAULT_TERRITORY = process.env.ERP_TERRITORY || "All Territories";
const DEFAULT_ITEM_CODE = process.env.ERP_ITEM_CODE || "ONLINE-SALE";

// --- Helpers ---
function okCfg() {
  return !!(BASE && KEY && SECRET);
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `token ${KEY}:${SECRET}`,
  };
}

function enc(obj: any) {
  return encodeURIComponent(JSON.stringify(obj));
}

// --- Customer ---
export async function findCustomerByEmail(email: string) {
  const url =
    `${BASE}/api/resource/Customer?fields=${enc([
      "name",
      "customer_name",
      "email_id",
    ])}` +
    `&filters=${enc([["Customer", "email_id", "=", email]])}&limit_page_length=1`;

  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  const j = await res.json();
  return j?.data?.[0] || null;
}

export async function createCustomer(payload: { name?: string; email: string }) {
  const body = {
    customer_name: payload.name || payload.email.split("@")[0],
    customer_type: "Individual",
    customer_group: "All Customer Groups",
    territory: DEFAULT_TERRITORY,
    email_id: payload.email,
  };
  const res = await fetch(`${BASE}/api/resource/Customer`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.text().catch(() => "");
    throw new Error(`ERP createCustomer failed: ${e || res.statusText}`);
  }
  const j = await res.json();
  return j?.data;
}

export async function ensureCustomer(email: string, name?: string) {
  let c = await findCustomerByEmail(email);
  if (c) return c;
  return await createCustomer({ name, email });
}

// --- Sales Order ---
export async function createSalesOrder(args: {
  customer_name: string;
  amount: number; // in major units
  currency?: string;
  stripe_session_id?: string;
  note?: string;
}) {
  // Sales Order date = today
  const today = new Date();
  const soDate = today.toISOString().slice(0, 10);

  // Delivery date = +1 day (always after SO date)
  const delivery = new Date(today);
  delivery.setDate(today.getDate() + 1);
  const deliveryDate = delivery.toISOString().slice(0, 10);

  const body: any = {
    transaction_date: soDate,
    customer: args.customer_name,
    delivery_date: deliveryDate,
    currency: args.currency || "PKR",
    conversion_rate: 1,
    items: [
      {
        item_code: DEFAULT_ITEM_CODE,
        qty: 1,
        rate: args.amount,
        description:
          args.note ||
          `Stripe Checkout Session ${args.stripe_session_id || ""}`.trim(),
      },
    ],
    remarks:
      (args.stripe_session_id
        ? `Stripe Session: ${args.stripe_session_id}`
        : "") + (args.note ? `\n${args.note}` : ""),
  };

  const res = await fetch(`${BASE}/api/resource/Sales Order`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.text().catch(() => "");
    throw new Error(`ERP createSalesOrder failed: ${e || res.statusText}`);
  }
  const j = await res.json();
  return j?.data;
}

// --- Entry point from webhook ---
export async function pushStripeOrderToERP(params: {
  email?: string | null;
  name?: string | null;
  amount_total?: number | null; // in cents
  currency?: string | null;
  session_id?: string | null;
}) {
  if (!okCfg()) {
    console.warn("ERP config missing, skip ERP push.");
    return { skipped: true };
  }

  const email = params.email || undefined;
  const displayName = (params.name || "").trim() || undefined;

  if (!email) {
    console.warn("Stripe session has no customer email; skipping ERP push.");
    return { skipped: true };
  }

  const cents = params.amount_total ?? 0;
  const major = Math.max(0, cents) / 100;

  const cust = await ensureCustomer(email, displayName);
  const so = await createSalesOrder({
    customer_name: cust.customer_name || cust.name,
    amount: major,
    currency: params.currency || undefined,
    stripe_session_id: params.session_id || undefined,
  });

  return { customer: cust?.name, sales_order: so?.name };
}
