export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 60;

try {
  // @ts-ignore
  const { setDefaultResultOrder } = await import("node:dns");
  setDefaultResultOrder?.("ipv4first");
} catch {}

import { NextResponse } from "next/server";

/* ---------- ENV ---------- */
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
const STRICT_PUBLISH = (process.env.VU_STRICT_PUBLISH || "1").trim() === "1";
const PLACEHOLDER_IMAGE = "/images/placeholder.png";

function assertEnv() {
  if (!ERP_BASE || !ERP_KEY || !ERP_SECRET) {
    throw new Error("ERP env missing (ERP_BASE_URL, ERP_API_KEY, ERP_API_SECRET)");
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

/* ---------- Types ---------- */
type ERPItem = {
  name?: string;
  item_code: string;
  item_name?: string | null;
  image?: string | null;
  item_group?: string | null;
  brand?: string | null;
  description?: string | null;
  disabled?: 0 | 1;
  vu_show_in_website?: 0 | 1;
};

type ERPItemPrice = {
  item_code: string;
  price_list: string;
  price_list_rate: number;
  currency: string;
};

type ERPBin = {
  item_code: string;
  warehouse: string;
  actual_qty: number;
};

type ERPFile = {
  file_url: string;
  is_private: 0 | 1;
  attached_to_name?: string | null;
};

type Product = {
  item_code: string;
  item_name: string;
  description: string;
  image: string;
  price: number | null;
  currency: string;
  stock: number;
  brand: string;
  item_group: string;
  slug: string;
  route: string;
  in_stock: boolean;
};

/* ---------- Helpers ---------- */
function chunk<T>(arr: T[], size = 100) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0, 400)}`);
  }

  if (ct.includes("application/json")) return res.json();

  const txt = await res.text();
  throw new Error(`HTTP ${res.status} ${res.statusText} (non-JSON): ${txt.slice(0, 400)}`);
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

function parsePositiveNumber(value: string | null) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

  const url = buildApiUrl(`/api/resource/${encodeURIComponent(doctype)}`, params);
  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const json = await safeJson(res);
  return Array.isArray(json?.data) ? (json.data as T[]) : [];
}

async function loadPublicFilesForItems(itemCodes: string[]) {
  const map = new Map<string, string>();

  for (const part of chunk(itemCodes, 100)) {
    const files = await erpResourceList<ERPFile>("File", {
      fields: ["file_url", "is_private", "attached_to_name"],
      filters: [
        ["attached_to_doctype", "=", "Item"],
        ["attached_to_name", "in", part],
        ["is_private", "=", 0],
      ],
      order_by: "modified desc",
      limit_page_length: 1000,
    });

    for (const f of files) {
      const code = sanitizeString(f.attached_to_name);
      if (!code || f.is_private) continue;
      if (!map.has(code)) {
        const abs = resolveAbsolute(f.file_url);
        if (abs) map.set(code, abs);
      }
    }
  }

  return map;
}

function matchesSearch(p: Product, q: string) {
  const qq = q.toLowerCase();
  return (
    p.item_name.toLowerCase().includes(qq) ||
    p.item_code.toLowerCase().includes(qq) ||
    p.slug.toLowerCase().includes(qq) ||
    p.brand.toLowerCase().includes(qq) ||
    p.item_group.toLowerCase().includes(qq) ||
    p.description.toLowerCase().includes(qq)
  );
}

/* ---------- GET ---------- */
export async function GET(req: Request) {
  try {
    assertEnv();

    const url = new URL(req.url);
    const brand = sanitizeString(url.searchParams.get("brand"));
    const group = sanitizeString(url.searchParams.get("group"));
    const q = sanitizeString(url.searchParams.get("q"));
    const minPrice = parsePositiveNumber(url.searchParams.get("min_price"));
    const maxPrice = parsePositiveNumber(url.searchParams.get("max_price"));
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "12", 10) || 12, 1),
      200
    );

    const filters: any[] = [["disabled", "=", 0]];
    if (STRICT_PUBLISH) {
      filters.push(["vu_show_in_website", "=", 1]);
    }
    if (brand) filters.push(["brand", "=", brand]);
    if (group) filters.push(["item_group", "=", group]);

    const items = await erpResourceList<ERPItem>("Item", {
      fields: [
        "name",
        "item_code",
        "item_name",
        "image",
        "item_group",
        "brand",
        "description",
        "disabled",
        "vu_show_in_website",
      ],
      filters,
      order_by: "item_name asc",
      limit_page_length: 2000,
    });

    if (!items.length) {
      return NextResponse.json(
        {
          products: [],
          meta: {
            page,
            limit,
            total: 0,
            pages: 0,
            filters: {
              brand,
              group,
              q,
              min_price: minPrice,
              max_price: maxPrice,
            },
          },
        },
        {
          headers: {
            "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
          },
        }
      );
    }

    const codes = items.map((it) => it.item_code).filter(Boolean);

    const priceChunks = await Promise.all(
      chunk(codes).map((part) =>
        erpResourceList<ERPItemPrice>("Item Price", {
          fields: ["item_code", "price_list", "price_list_rate", "currency"],
          filters: [
            ["item_code", "in", part],
            ["price_list", "=", PRICE_LIST],
          ],
          limit_page_length: 2000,
        })
      )
    );
    const prices = priceChunks.flat();
    const priceMap = new Map(prices.map((p) => [p.item_code, p]));

    const binChunks = await Promise.all(
      chunk(codes).map((part) =>
        erpResourceList<ERPBin>("Bin", {
          fields: ["item_code", "warehouse", "actual_qty"],
          filters: [
            ["item_code", "in", part],
            ["warehouse", "=", WEBSITE_WAREHOUSE],
          ],
          limit_page_length: 2000,
        })
      )
    );
    const bins = binChunks.flat();
    const stockMap = new Map(bins.map((b) => [b.item_code, Number(b.actual_qty || 0)]));

    const publicFileMap = await loadPublicFilesForItems(codes);

    let products: Product[] = items.map((it) => {
      const stock = stockMap.get(it.item_code) ?? 0;
      const rawImg = it.image || null;
      const useItemImg = rawImg && !isPrivatePath(rawImg) ? resolveAbsolute(rawImg) : null;
      const fileImg = publicFileMap.get(it.item_code) || null;

      const priceRow = priceMap.get(it.item_code);
      const price = priceRow ? Number(priceRow.price_list_rate) : null;

      const item_name = sanitizeString(it.item_name, it.item_code);
      const slug = toSlug(item_name || it.item_code);

      return {
        item_code: it.item_code,
        item_name,
        description: sanitizeString(it.description),
        image: useItemImg || fileImg || PLACEHOLDER_IMAGE,
        price,
        currency: sanitizeString(priceRow?.currency, "PKR"),
        stock,
        brand: sanitizeString(it.brand),
        item_group: sanitizeString(it.item_group),
        slug,
        route: `/products/${slug}`,
        in_stock: stock > 0,
      };
    });

    if (minPrice != null || maxPrice != null) {
      products = products.filter((p) => {
        if (p.price == null) return false;
        if (minPrice != null && p.price < minPrice) return false;
        if (maxPrice != null && p.price > maxPrice) return false;
        return true;
      });
    }

    if (q) {
      products = products.filter((p) => matchesSearch(p, q));
    }

    products.sort((a, b) => {
      if (a.in_stock !== b.in_stock) return a.in_stock ? -1 : 1;
      return a.item_name.localeCompare(b.item_name);
    });

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
          filters: {
            brand,
            group,
            q,
            min_price: minPrice,
            max_price: maxPrice,
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