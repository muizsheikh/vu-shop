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

const WEBSITE_WAREHOUSE = (process.env.WEBSITE_WAREHOUSE || "Website Stock - VU").trim();
const WEBSITE_COST_CENTER = (process.env.WEBSITE_COST_CENTER || "Website - VU").trim();
const PRICE_LIST = (process.env.ERP_PRICE_LIST || "Standard Selling").trim();

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

const SALES_ORDER_FIELDS = [
  "name",
  "status",
  "docstatus",
  "cost_center",
  "set_warehouse",
];

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
    throw new Error("ERP credentials missing (ERP_BASE_URL, ERP_API_KEY, ERP_API_SECRET)");
  }

  if (!WEBSITE_WAREHOUSE) {
    throw new Error("WEBSITE_WAREHOUSE env missing");
  }

  if (!WEBSITE_COST_CENTER) {
    throw new Error("WEBSITE_COST_CENTER env missing");
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
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0, 700)}`);
  }

  if (ct.includes("application/json")) return res.json();

  const txt = await res.text();
  throw new Error(`HTTP ${res.status} ${res.statusText} (non-JSON): ${txt.slice(0, 700)}`);
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

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

type IncomingCartItem = {
  item_code?: string;
  id?: string;
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

type ERPBin = {
  item_code: string;
  actual_qty: number;
};

type ERPSalesOrderItem = {
  item_code?: string | null;
  qty?: number | string | null;
  delivered_qty?: number | string | null;
  warehouse?: string | null;
};

type ERPSalesOrder = {
  name?: string | null;
  status?: string | null;
  docstatus?: 0 | 1 | 2;
  cost_center?: string | null;
  set_warehouse?: string | null;
};

type ERPSalesOrderFull = ERPSalesOrder & {
  items?: ERPSalesOrderItem[];
};

function chunk<T>(arr: T[], size = 100) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function aggregateCartItems(items: NormalizedCartItem[]) {
  const map = new Map<string, NormalizedCartItem>();

  for (const item of items) {
    const existing = map.get(item.item_code);

    if (!existing) {
      map.set(item.item_code, { ...item });
      continue;
    }

    existing.qty += item.qty;
    existing.amount = Math.round(existing.qty * existing.rate * 100) / 100;
  }

  return Array.from(map.values());
}

function normalizeCartItems(rawItems: unknown): NormalizedCartItem[] {
  if (!Array.isArray(rawItems)) {
    throw new Error("Invalid payload: items must be an array");
  }

  const items: NormalizedCartItem[] = [];

  for (const raw of rawItems as IncomingCartItem[]) {
    const item_code = sanitizeItemCode(raw?.item_code || raw?.id);
    const item_name = sanitizeItemName(raw?.name || item_code);
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

  const aggregated = aggregateCartItems(items);

  if (!aggregated.length) {
    throw new Error("Cart empty or invalid");
  }

  return aggregated;
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

async function getDoctypeListFiltered(args: {
  doctype: string;
  fields: string[];
  filters?: any[];
  limit?: number;
  start?: number;
  orderBy?: string;
}) {
  const params = [
    `fields=${enc(args.fields)}`,
    `limit_page_length=${args.limit ?? 200}`,
    `limit_start=${args.start ?? 0}`,
  ];

  if (args.filters?.length) {
    params.push(`filters=${enc(args.filters)}`);
  }

  if (args.orderBy) {
    params.push(`order_by=${encodeURIComponent(args.orderBy)}`);
  }

  const json = await erpnextFetch(`${args.doctype}?${params.join("&")}`);

  return Array.isArray(json?.data) ? json.data : [];
}

async function getResource<T>(doctype: string, name: string): Promise<T | null> {
  const json = await erpnextFetch(`${doctype}/${encodeURIComponent(name)}`);
  return json?.data ? (json.data as T) : null;
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

async function loadActualStockMap(itemCodes: string[]) {
  const stockMap = new Map<string, number>();

  for (const part of chunk(itemCodes, 100)) {
    const rows = await getDoctypeListFiltered({
      doctype: "Bin",
      fields: ["item_code", "actual_qty"],
      filters: [
        ["item_code", "in", part],
        ["warehouse", "=", WEBSITE_WAREHOUSE],
      ],
      limit: 2000,
    });

    for (const row of rows as ERPBin[]) {
      const itemCode = sanitizeString(row.item_code);
      if (!itemCode) continue;
      stockMap.set(itemCode, Math.max(toNumber(row.actual_qty, 0), 0));
    }
  }

  return stockMap;
}

function isOpenWebsiteSalesOrder(so: ERPSalesOrder) {
  const name = sanitizeString(so.name);
  const status = sanitizeString(so.status).toLowerCase();
  const docstatus = toNumber(so.docstatus, 0);

  if (!name) return false;
  if (docstatus === 2) return false;

  if (["cancelled", "closed", "completed"].includes(status)) {
    return false;
  }

  if (WEBSITE_COST_CENTER) {
    const soCostCenter = sanitizeString(so.cost_center);
    if (soCostCenter && soCostCenter !== WEBSITE_COST_CENTER) {
      return false;
    }
  }

  return true;
}

async function loadOpenWebsiteSalesOrders() {
  const rows: ERPSalesOrder[] = [];
  const pageSize = 500;

  for (let start = 0; start < 5000; start += pageSize) {
    const filters: any[] = [["docstatus", "in", [0, 1]]];

    if (WEBSITE_COST_CENTER) {
      filters.push(["cost_center", "=", WEBSITE_COST_CENTER]);
    }

    const pageRows = await getDoctypeListFiltered({
      doctype: "Sales Order",
      fields: SALES_ORDER_FIELDS,
      filters,
      limit: pageSize,
      start,
      orderBy: "modified desc",
    });

    const openRows = (pageRows as ERPSalesOrder[]).filter(isOpenWebsiteSalesOrder);
    rows.push(...openRows);

    if (pageRows.length < pageSize) break;
  }

  return rows;
}

async function loadReservedByOpenWebsiteOrdersMap(itemCodes: string[]) {
  const reservedMap = new Map<string, number>();

  if (!itemCodes.length) return reservedMap;

  const itemCodeSet = new Set(itemCodes);
  const openOrders = await loadOpenWebsiteSalesOrders();

  if (!openOrders.length) return reservedMap;

  for (const part of chunk(openOrders, 20)) {
    const fullOrders = await Promise.all(
      part.map((so) => {
        const name = sanitizeString(so.name);
        return name ? getResource<ERPSalesOrderFull>("Sales Order", name) : Promise.resolve(null);
      })
    );

    for (const so of fullOrders) {
      if (!so || !isOpenWebsiteSalesOrder(so)) continue;

      const parentWarehouse = sanitizeString(so.set_warehouse);
      const items = Array.isArray(so.items) ? so.items : [];

      for (const row of items) {
        const itemCode = sanitizeString(row.item_code);
        if (!itemCode || !itemCodeSet.has(itemCode)) continue;

        const rowWarehouse = sanitizeString(row.warehouse) || parentWarehouse;

        if (rowWarehouse && rowWarehouse !== WEBSITE_WAREHOUSE) {
          continue;
        }

        const orderedQty = Math.max(toNumber(row.qty, 0), 0);
        const deliveredQty = Math.max(toNumber(row.delivered_qty, 0), 0);
        const pendingQty = Math.max(orderedQty - deliveredQty, 0);

        if (pendingQty <= 0) continue;

        reservedMap.set(itemCode, (reservedMap.get(itemCode) || 0) + pendingQty);
      }
    }
  }

  return reservedMap;
}

async function validateWebsiteStock(items: NormalizedCartItem[]) {
  const itemCodes = items.map((item) => item.item_code);

  const [actualStockMap, reservedMap] = await Promise.all([
    loadActualStockMap(itemCodes),
    loadReservedByOpenWebsiteOrdersMap(itemCodes),
  ]);

  const errors: Array<{
    item_code: string;
    item_name: string;
    requested_qty: number;
    actual_stock_qty: number;
    reserved_by_website_orders: number;
    available_qty: number;
  }> = [];

  for (const item of items) {
    const actualStock = Math.max(actualStockMap.get(item.item_code) || 0, 0);
    const reservedQty = Math.max(reservedMap.get(item.item_code) || 0, 0);
    const availableQty = Math.max(actualStock - reservedQty, 0);

    if (item.qty > availableQty) {
      errors.push({
        item_code: item.item_code,
        item_name: item.item_name,
        requested_qty: item.qty,
        actual_stock_qty: actualStock,
        reserved_by_website_orders: reservedQty,
        available_qty: availableQty,
      });
    }
  }

  if (errors.length) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    errors: [],
  };
}

function buildSalesOrderItems(items: NormalizedCartItem[], deliveryCharge: number) {
  const productItems = items.map((it) => ({
    item_code: it.item_code,
    qty: it.qty,
    rate: it.rate,
    description: it.item_name,
    warehouse: WEBSITE_WAREHOUSE,
    cost_center: WEBSITE_COST_CENTER,
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
      cost_center: WEBSITE_COST_CENTER,
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
      `- ${it.item_name} (${it.item_code}) x ${it.qty} @ Rs ${it.rate.toLocaleString()} = Rs ${it.amount.toLocaleString()}`
  );

  return [
    "Website COD Order",
    "",
    `Warehouse: ${WEBSITE_WAREHOUSE}`,
    `Cost Center: ${WEBSITE_COST_CENTER}`,
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
          error:
            "Cash on Delivery is currently disabled. Please choose another payment method.",
        },
        { status: 403 }
      );
    }

    const items = normalizeCartItems(body?.items);
    const productTotal = items.reduce((sum, item) => sum + item.amount, 0);

    if (
      settings.minimum_order_amount > 0 &&
      productTotal < settings.minimum_order_amount
    ) {
      return NextResponse.json(
        {
          error: `Minimum order amount is Rs ${settings.minimum_order_amount.toLocaleString()}. Please add more items to continue.`,
          minimum_order_amount: settings.minimum_order_amount,
          current_subtotal: productTotal,
        },
        { status: 400 }
      );
    }

    const stockValidation = await validateWebsiteStock(items);

    if (!stockValidation.ok) {
      return NextResponse.json(
        {
          error: "Some items are no longer available in the requested quantity.",
          code: "INSUFFICIENT_WEBSITE_STOCK",
          items: stockValidation.errors,
        },
        { status: 409 }
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
      selling_price_list: PRICE_LIST,
      set_warehouse: WEBSITE_WAREHOUSE,
      cost_center: WEBSITE_COST_CENTER,
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
      warehouse: WEBSITE_WAREHOUSE,
      cost_center: WEBSITE_COST_CENTER,
      stock_mode: "actual_qty_minus_open_website_sales_orders",
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