export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 60;

try {
  const { setDefaultResultOrder } = await import("node:dns");
  setDefaultResultOrder?.("ipv4first");
} catch {}

import { NextResponse } from "next/server";

function normBase(u: string) {
  let x = (u || "").trim();
  if (x && !/^https?:\/\//i.test(x)) x = `https://${x}`;
  return x.replace(/\/+$/, "");
}

const ERP_BASE = normBase(process.env.ERP_BASE_URL || "");
const ERP_KEY = (process.env.ERP_API_KEY || "").trim();
const ERP_SECRET = (process.env.ERP_API_SECRET || "").trim();
const PRICE_LIST = (process.env.ERP_PRICE_LIST || "Standard Selling").trim();
const WEBSITE_WAREHOUSE = (process.env.WEBSITE_WAREHOUSE || "").trim();
const WEBSITE_COST_CENTER = (process.env.WEBSITE_COST_CENTER || "").trim();
const STRICT_PUBLISH = (process.env.VU_STRICT_PUBLISH || "1").trim() === "1";
const PLACEHOLDER_IMAGE = "/images/placeholder.png";

const ITEM_BASE_FIELDS = [
  "item_code",
  "item_name",
  "image",
  "item_group",
  "brand",
  "description",
  "disabled",
];

const ITEM_OPTIONAL_FIELDS = [
  "custom_website_category",
  "custom_homepage_section",
  "custom_homepage_sort_order",
  "vu_show_in_website",
];

const GALLERY_FIELDS = [
  "parent",
  "image",
  "alt_text",
  "sort_order",
  "is_primary",
];

const SALES_ORDER_ITEM_FIELDS = [
  "parent",
  "item_code",
  "qty",
  "delivered_qty",
  "warehouse",
  "docstatus",
];

const SALES_ORDER_FIELDS = [
  "name",
  "status",
  "docstatus",
  "cost_center",
];

function assertEnv() {
  if (!ERP_BASE || !ERP_KEY || !ERP_SECRET) {
    throw new Error("ERP env missing");
  }
  if (!WEBSITE_WAREHOUSE) {
    throw new Error("WEBSITE_WAREHOUSE env not set");
  }
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `token ${ERP_KEY}:${ERP_SECRET}`,
  };
}

type ERPItem = {
  item_code: string;
  item_name?: string | null;
  image?: string | null;
  item_group?: string | null;
  brand?: string | null;
  description?: string | null;
  custom_website_category?: string | null;
  custom_homepage_section?: string | null;
  custom_homepage_sort_order?: number | null;
  disabled?: 0 | 1;
  vu_show_in_website?: 0 | 1;
};

type ERPItemPrice = {
  item_code: string;
  price_list_rate: number;
  currency: string;
};

type ERPBin = {
  item_code: string;
  actual_qty: number;
};

type ERPGalleryRow = {
  parent?: string | null;
  image?: string | null;
  alt_text?: string | null;
  sort_order?: number | null;
  is_primary?: 0 | 1;
};

type ERPSalesOrderItem = {
  parent?: string | null;
  item_code?: string | null;
  qty?: number | string | null;
  delivered_qty?: number | string | null;
  warehouse?: string | null;
  docstatus?: 0 | 1 | 2;
};

type ERPSalesOrder = {
  name?: string | null;
  status?: string | null;
  docstatus?: 0 | 1 | 2;
  cost_center?: string | null;
};

type GalleryImage = {
  image: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
};

type Product = {
  id: string;
  name: string;
  item_code: string;
  item_name: string;
  description: string;
  image: string;
  images: string[];
  gallery: GalleryImage[];
  price: number | null;
  currency: string;
  stock: number;
  stock_qty: number;
  actual_stock_qty: number;
  reserved_by_website_orders: number;
  brand: string;
  item_group: string;
  category: string;
  homepage_section: string;
  homepage_sort_order: number | null;
  slug: string;
  route: string;
  in_stock: boolean;
};

function chunk<T>(arr: T[], size = 100) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function safeJson(res: Response) {
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 700)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();

  const txt = await res.text();
  throw new Error(`Non JSON response: ${txt.slice(0, 700)}`);
}

function extractBadQueryField(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err || "");
  const match = msg.match(/Field not permitted in query:\s*([A-Za-z0-9_]+)/i);
  return match?.[1] || null;
}

function filterUsesField(filter: any, fieldname: string): boolean {
  if (!Array.isArray(filter)) return false;
  return filter.some((part) => part === fieldname);
}

function removeFiltersUsingField(filters: any[] | undefined, fieldname: string) {
  if (!Array.isArray(filters)) return filters;
  return filters.filter((f) => !filterUsesField(f, fieldname));
}

function resolveAbsolute(raw?: string | null) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${ERP_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function isPrivatePath(p?: string | null) {
  if (!p) return false;
  return /^\/?private\//i.test(p) || p.includes("/private/files/");
}

function toSlug(s: string) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function sanitizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePositiveNumber(value: string | null) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseInteger(value: string | null, fallback: number) {
  const n = Number.parseInt(value || "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function buildApiUrl(path: string, params?: Record<string, string>) {
  const url = new URL(`${ERP_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function erpResourceList<T>(
  doctype: string,
  opts: {
    fields?: string[];
    filters?: any[];
    or_filters?: any[];
    order_by?: string;
    limit_page_length?: number;
    limit_start?: number;
  } = {}
): Promise<T[]> {
  const params: Record<string, string> = {};

  if (opts.fields?.length) params.fields = JSON.stringify(opts.fields);
  if (opts.filters?.length) params.filters = JSON.stringify(opts.filters);
  if (opts.or_filters?.length) params.or_filters = JSON.stringify(opts.or_filters);
  if (opts.order_by) params.order_by = opts.order_by;
  if (typeof opts.limit_page_length === "number") {
    params.limit_page_length = String(opts.limit_page_length);
  }
  if (typeof opts.limit_start === "number") {
    params.limit_start = String(opts.limit_start);
  }

  const res = await fetch(buildApiUrl(`/api/resource/${encodeURIComponent(doctype)}`, params), {
    headers: authHeaders(),
    cache: "no-store",
  });

  const json = await safeJson(res);
  return Array.isArray(json?.data) ? (json.data as T[]) : [];
}

async function erpResourceListSafeFields<T>(
  doctype: string,
  opts: {
    fields: string[];
    filters?: any[];
    or_filters?: any[];
    order_by?: string;
    limit_page_length?: number;
    limit_start?: number;
    required_fields?: string[];
  }
): Promise<{ rows: T[]; fieldsUsed: Set<string>; fieldsDropped: Set<string> }> {
  let fields = [...opts.fields];
  let filters = opts.filters ? [...opts.filters] : undefined;
  let orFilters = opts.or_filters ? [...opts.or_filters] : undefined;
  let orderBy = opts.order_by;
  const dropped = new Set<string>();
  const required = new Set(opts.required_fields || []);

  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const rows = await erpResourceList<T>(doctype, {
        fields,
        filters,
        or_filters: orFilters,
        order_by: orderBy,
        limit_page_length: opts.limit_page_length,
        limit_start: opts.limit_start,
      });

      return {
        rows,
        fieldsUsed: new Set(fields),
        fieldsDropped: dropped,
      };
    } catch (err) {
      const badField = extractBadQueryField(err);

      if (!badField || required.has(badField)) {
        throw err;
      }

      dropped.add(badField);
      fields = fields.filter((field) => field !== badField);
      filters = removeFiltersUsingField(filters, badField);
      orFilters = removeFiltersUsingField(orFilters, badField);

      if (orderBy && orderBy.includes(badField)) {
        orderBy = undefined;
      }

      console.warn(`${doctype}: dropped unavailable ERP field "${badField}" and retried query`);
    }
  }

  throw new Error(`${doctype}: too many field retry attempts`);
}

async function loadGalleryMap(itemCodes: string[]) {
  const map = new Map<string, GalleryImage[]>();

  try {
    for (const part of chunk(itemCodes, 100)) {
      const result = await erpResourceListSafeFields<ERPGalleryRow>("VU Item Gallery Image", {
        fields: GALLERY_FIELDS,
        required_fields: ["parent", "image"],
        filters: [["parent", "in", part]],
        order_by: "sort_order asc, idx asc",
        limit_page_length: 1000,
      });

      for (const row of result.rows) {
        const parent = sanitizeString(row.parent);
        const abs = resolveAbsolute(row.image);

        if (!parent || !abs || isPrivatePath(row.image)) continue;

        const current = map.get(parent) || [];
        current.push({
          image: abs,
          alt_text: sanitizeString(row.alt_text),
          sort_order: Number(row.sort_order || 0),
          is_primary: row.is_primary === 1,
        });
        map.set(parent, current);
      }
    }

    for (const [key, rows] of map.entries()) {
      rows.sort((a, b) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        return a.sort_order - b.sort_order;
      });
      map.set(key, rows);
    }
  } catch (err) {
    console.warn("Gallery load skipped:", err);
  }

  return map;
}

async function loadWebsiteOpenOrderQtyMap(itemCodes: string[]) {
  const reservedMap = new Map<string, number>();

  if (!itemCodes.length) return reservedMap;

  const allOrderItemRows: ERPSalesOrderItem[] = [];
  const parentNames = new Set<string>();

  for (const part of chunk(itemCodes, 100)) {
    const result = await erpResourceListSafeFields<ERPSalesOrderItem>("Sales Order Item", {
      fields: SALES_ORDER_ITEM_FIELDS,
      required_fields: ["parent", "item_code", "qty"],
      filters: [
        ["item_code", "in", part],
        ["warehouse", "=", WEBSITE_WAREHOUSE],
        ["docstatus", "in", [0, 1]],
      ],
      limit_page_length: 5000,
    });

    for (const row of result.rows) {
      const parent = sanitizeString(row.parent);
      const itemCode = sanitizeString(row.item_code);

      if (!parent || !itemCode) continue;

      allOrderItemRows.push(row);
      parentNames.add(parent);
    }
  }

  if (!parentNames.size || !allOrderItemRows.length) {
    return reservedMap;
  }

  const openParents = new Set<string>();

  for (const part of chunk(Array.from(parentNames), 100)) {
    const result = await erpResourceListSafeFields<ERPSalesOrder>("Sales Order", {
      fields: SALES_ORDER_FIELDS,
      required_fields: ["name"],
      filters: [
        ["name", "in", part],
        ["docstatus", "in", [0, 1]],
      ],
      limit_page_length: 1000,
    });

    const fieldsUsed = result.fieldsUsed;

    for (const so of result.rows) {
      const name = sanitizeString(so.name);
      const status = sanitizeString(so.status).toLowerCase();
      const docstatus = toNumber(so.docstatus, 0);

      if (!name) continue;
      if (docstatus === 2) continue;

      if (["cancelled", "closed", "completed"].includes(status)) {
        continue;
      }

      if (
        WEBSITE_COST_CENTER &&
        fieldsUsed.has("cost_center") &&
        sanitizeString(so.cost_center) &&
        sanitizeString(so.cost_center) !== WEBSITE_COST_CENTER
      ) {
        continue;
      }

      openParents.add(name);
    }
  }

  for (const row of allOrderItemRows) {
    const parent = sanitizeString(row.parent);
    const itemCode = sanitizeString(row.item_code);

    if (!parent || !itemCode || !openParents.has(parent)) continue;

    const orderedQty = Math.max(toNumber(row.qty, 0), 0);
    const deliveredQty = Math.max(toNumber(row.delivered_qty, 0), 0);
    const pendingQty = Math.max(orderedQty - deliveredQty, 0);

    if (pendingQty <= 0) continue;

    reservedMap.set(itemCode, (reservedMap.get(itemCode) || 0) + pendingQty);
  }

  return reservedMap;
}

function matchesSearch(p: Product, q: string) {
  const qq = q.toLowerCase();
  return (
    p.item_name.toLowerCase().includes(qq) ||
    p.item_code.toLowerCase().includes(qq) ||
    p.slug.toLowerCase().includes(qq) ||
    p.brand.toLowerCase().includes(qq) ||
    p.item_group.toLowerCase().includes(qq) ||
    p.category.toLowerCase().includes(qq) ||
    p.homepage_section.toLowerCase().includes(qq) ||
    p.description.toLowerCase().includes(qq)
  );
}

export async function GET(req: Request) {
  try {
    assertEnv();

    const url = new URL(req.url);

    const brand = sanitizeString(url.searchParams.get("brand"));
    const group = sanitizeString(url.searchParams.get("group"));
    const category = sanitizeString(url.searchParams.get("category"));
    const homepageSection = sanitizeString(url.searchParams.get("homepage_section"));
    const q = sanitizeString(url.searchParams.get("q"));
    const minPrice = parsePositiveNumber(url.searchParams.get("min_price"));
    const maxPrice = parsePositiveNumber(url.searchParams.get("max_price"));
    const sort = sanitizeString(url.searchParams.get("sort"));
    const page = Math.max(parseInteger(url.searchParams.get("page"), 1), 1);
    const limit = Math.min(Math.max(parseInteger(url.searchParams.get("limit"), 12), 1), 200);

    const itemFields = [...ITEM_BASE_FIELDS, ...ITEM_OPTIONAL_FIELDS];

    const filters: any[] = [["disabled", "=", 0]];

    if (STRICT_PUBLISH) {
      filters.push(["vu_show_in_website", "=", 1]);
    }

    if (brand) filters.push(["brand", "=", brand]);
    if (group) filters.push(["item_group", "=", group]);
    if (category) filters.push(["custom_website_category", "=", category]);
    if (homepageSection) filters.push(["custom_homepage_section", "=", homepageSection]);

    const itemResult = await erpResourceListSafeFields<ERPItem>("Item", {
      fields: itemFields,
      required_fields: ["item_code"],
      filters,
      order_by: "item_name asc",
      limit_page_length: 2000,
    });

    const items = itemResult.rows;
    const itemFieldsUsed = itemResult.fieldsUsed;

    if (!items.length) {
      return NextResponse.json({
        products: [],
        meta: {
          page,
          limit,
          total: 0,
          pages: 0,
          warehouse: WEBSITE_WAREHOUSE,
          cost_center: WEBSITE_COST_CENTER,
          dropped_fields: Array.from(itemResult.fieldsDropped),
        },
      });
    }

    const codes = items.map((it) => it.item_code).filter(Boolean);

    const [priceChunks, binChunks, galleryMap, websiteReservedMap] = await Promise.all([
      Promise.all(
        chunk(codes).map((part) =>
          erpResourceList<ERPItemPrice>("Item Price", {
            fields: ["item_code", "price_list_rate", "currency"],
            filters: [
              ["item_code", "in", part],
              ["price_list", "=", PRICE_LIST],
            ],
            limit_page_length: 2000,
          })
        )
      ),
      Promise.all(
        chunk(codes).map((part) =>
          erpResourceList<ERPBin>("Bin", {
            fields: ["item_code", "actual_qty"],
            filters: [
              ["item_code", "in", part],
              ["warehouse", "=", WEBSITE_WAREHOUSE],
            ],
            limit_page_length: 2000,
          })
        )
      ),
      loadGalleryMap(codes),
      loadWebsiteOpenOrderQtyMap(codes),
    ]);

    const prices = priceChunks.flat();
    const bins = binChunks.flat();

    const priceMap = new Map(prices.map((p) => [p.item_code, p]));
    const stockMap = new Map(bins.map((b) => [b.item_code, Number(b.actual_qty || 0)]));

    let products: Product[] = items.map((it) => {
      const itemName = sanitizeString(it.item_name, it.item_code);
      const slug = toSlug(itemName || it.item_code);

      const actualStock = Math.max(stockMap.get(it.item_code) ?? 0, 0);
      const reservedByWebsiteOrders = Math.max(websiteReservedMap.get(it.item_code) ?? 0, 0);
      const availableStock = Math.max(actualStock - reservedByWebsiteOrders, 0);

      const priceRow = priceMap.get(it.item_code);
      const price = priceRow ? Number(priceRow.price_list_rate) : null;

      const rawItemImage = it.image && !isPrivatePath(it.image) ? resolveAbsolute(it.image) : null;
      const gallery = galleryMap.get(it.item_code) || [];

      const firstGalleryImage = gallery[0]?.image || null;
      const mainImage = firstGalleryImage || rawItemImage || PLACEHOLDER_IMAGE;

      const images = Array.from(
        new Set([mainImage, ...gallery.map((g) => g.image), rawItemImage].filter(Boolean) as string[])
      );

      const homepageSortRaw = Number(it.custom_homepage_sort_order);
      const homepageSort = Number.isFinite(homepageSortRaw) ? homepageSortRaw : null;

      return {
        id: it.item_code,
        name: itemName,
        item_code: it.item_code,
        item_name: itemName,
        description: sanitizeString(it.description),
        image: mainImage,
        images,
        gallery,
        price,
        currency: sanitizeString(priceRow?.currency, "PKR"),

        stock: availableStock,
        stock_qty: availableStock,
        actual_stock_qty: actualStock,
        reserved_by_website_orders: reservedByWebsiteOrders,

        brand: sanitizeString(it.brand),
        item_group: sanitizeString(it.item_group),
        category: itemFieldsUsed.has("custom_website_category")
          ? sanitizeString(it.custom_website_category)
          : "",
        homepage_section: itemFieldsUsed.has("custom_homepage_section")
          ? sanitizeString(it.custom_homepage_section)
          : "",
        homepage_sort_order: itemFieldsUsed.has("custom_homepage_sort_order")
          ? homepageSort
          : null,
        slug,
        route: `/products/${slug}`,
        in_stock: availableStock > 0,
      };
    });

    products = products.filter((p) => p.stock_qty > 0);

    if (category && itemFieldsUsed.has("custom_website_category")) {
      products = products.filter((p) => p.category === category);
    }

    if (homepageSection && itemFieldsUsed.has("custom_homepage_section")) {
      products = products.filter((p) => p.homepage_section === homepageSection);
    }

    if (minPrice != null || maxPrice != null) {
      products = products.filter((p) => {
        if (p.price == null) return false;
        if (minPrice != null && p.price < minPrice) return false;
        if (maxPrice != null && p.price > maxPrice) return false;
        return true;
      });
    }

    if (q) products = products.filter((p) => matchesSearch(p, q));

    if (sort === "price_asc") {
      products.sort((a, b) => {
        const ap = typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
        const bp = typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;
        return ap - bp;
      });
    } else if (sort === "price_desc") {
      products.sort((a, b) => {
        const ap = typeof a.price === "number" ? a.price : Number.NEGATIVE_INFINITY;
        const bp = typeof b.price === "number" ? b.price : Number.NEGATIVE_INFINITY;
        return bp - ap;
      });
    } else if (sort === "homepage") {
      products.sort((a, b) => {
        const ao =
          typeof a.homepage_sort_order === "number"
            ? a.homepage_sort_order
            : Number.POSITIVE_INFINITY;
        const bo =
          typeof b.homepage_sort_order === "number"
            ? b.homepage_sort_order
            : Number.POSITIVE_INFINITY;

        if (ao !== bo) return ao - bo;
        if (a.in_stock !== b.in_stock) return a.in_stock ? -1 : 1;
        return a.item_name.localeCompare(b.item_name);
      });
    } else {
      products.sort((a, b) => {
        if (a.in_stock !== b.in_stock) return a.in_stock ? -1 : 1;
        return a.item_name.localeCompare(b.item_name);
      });
    }

    const total = products.length;
    const pages = total > 0 ? Math.ceil(total / limit) : 0;
    const start = (page - 1) * limit;
    const paged = products.slice(start, start + limit);

    return NextResponse.json(
      {
        products: paged,
        meta: {
          page,
          limit,
          total,
          pages,
          warehouse: WEBSITE_WAREHOUSE,
          cost_center: WEBSITE_COST_CENTER,
          price_list: PRICE_LIST,
          stock_mode: "actual_qty_minus_open_website_sales_orders",
          dropped_fields: Array.from(itemResult.fieldsDropped),
          filters: {
            brand,
            group,
            category,
            homepage_section: homepageSection,
            q,
            min_price: minPrice,
            max_price: maxPrice,
            sort,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (e: any) {
    console.error("GET /api/products failed:", e);

    return NextResponse.json(
      { error: e?.message || "Failed to load products" },
      { status: 500 }
    );
  }
}