// /app/api/products/route.ts
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
const ERP_KEY = process.env.ERP_API_KEY || "";
const ERP_SECRET = process.env.ERP_API_SECRET || "";
const PRICE_LIST = process.env.ERP_PRICE_LIST || "Standard Selling";
const WEBSITE_WAREHOUSE = process.env.WEBSITE_WAREHOUSE || "";
const VU_STRICT_PUBLISH = (process.env.VU_STRICT_PUBLISH ?? "1").trim();

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

/* ---------- Helpers ---------- */
function chunk<T>(arr: T[], size = 100) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const txt = await res.text();
  throw new Error(`HTTP ${res.status} ${res.statusText} (non-JSON): ${txt.slice(0, 300)}`);
}

function resolveAbsolute(raw?: string | null) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${ERP_BASE}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function isPrivatePath(p?: string | null) {
  if (!p) return false;
  return /^\/?private\//i.test(p);
}

function toSlug(s: string) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
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
  return (json?.data ?? []) as T[];
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
      const code = (f.attached_to_name || "").trim();
      if (!code || f.is_private) continue;
      if (!map.has(code)) {
        map.set(code, resolveAbsolute(f.file_url) || "");
      }
    }
  }

  return map;
}

/* ---------- GET ---------- */
export async function GET(req: Request) {
  try {
    assertEnv();

    const url = new URL(req.url);
    const brand = (url.searchParams.get("brand") || "").trim();
    const group = (url.searchParams.get("group") || "").trim();
    const q = (url.searchParams.get("q") || "").trim();
    const minPrice = url.searchParams.get("min_price");
    const maxPrice = url.searchParams.get("max_price");
    const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "12", 10) || 12, 1), 200);

    const filters: any[] = [["disabled", "=", 0]];
    if (VU_STRICT_PUBLISH !== "0") {
      filters.push(["vu_show_in_website", "=", 1]);
    }
    if (brand) filters.push(["brand", "like", `%${brand}%`]);
    if (group) filters.push(["item_group", "like", `%${group}%`]);

    const or_filters = q
      ? [
          ["item_name", "like", `%${q}%`],
          ["item_code", "like", `%${q}%`],
          ["brand", "like", `%${q}%`],
        ]
      : undefined;

    const items = await erpResourceList<ERPItem>("Item", {
      fields: [
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
      ...(or_filters ? { or_filters } : {}),
      order_by: "item_name asc",
      limit_page_length: 2000,
    });

    if (!items.length) {
      return NextResponse.json({
        products: [],
        meta: {
          page,
          limit,
          total: 0,
          pages: 0,
          filters: { brand, group, q, min_price: minPrice, max_price: maxPrice },
        },
      });
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

    let products = items.map((it) => {
      const stockQty = stockMap.get(it.item_code) ?? 0;
      const rawImg = it.image || null;
      const useItemImg = rawImg && !isPrivatePath(rawImg) ? resolveAbsolute(rawImg) : null;
      const fileImg = publicFileMap.get(it.item_code) || null;

      const price = priceMap.get(it.item_code);
      const priceNum = price ? Number(price.price_list_rate) : null;

      const slug = toSlug(it.item_name || it.item_code);
      const websiteRoute = `/products/${slug}`;

      return {
        id: it.item_code,
        slug,
        route: websiteRoute,
        name: it.item_name ?? it.item_code,
        image: useItemImg || fileImg || null,
        price: priceNum,
        currency: price?.currency || "PKR",
        item_group: it.item_group ?? null,
        brand: it.brand ?? null,
        description: it.description ?? null,
        stock_qty: stockQty,
        in_stock: stockQty > 0,
        disabled: !!(it.disabled ?? 0),
      };
    });

    const minP = minPrice ? Number(minPrice) : null;
    const maxP = maxPrice ? Number(maxPrice) : null;

    if (minP != null || maxP != null) {
      products = products.filter((p) => {
        if (p.price == null) return false;
        if (minP != null && p.price < minP) return false;
        if (maxP != null && p.price > maxP) return false;
        return true;
      });
    }

    if (q) {
      const qq = q.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(qq) ||
          p.id.toLowerCase().includes(qq) ||
          p.slug.toLowerCase().includes(qq) ||
          (p.brand ?? "").toLowerCase().includes(qq) ||
          (p.item_group ?? "").toLowerCase().includes(qq)
      );
    }

    products.sort((a, b) => {
      if (a.in_stock !== b.in_stock) return a.in_stock ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const total = products.length;
    const pages = Math.max(Math.ceil(total / limit), 0);
    const start = (page - 1) * limit;
    const paged = products.slice(start, start + limit);

    return NextResponse.json({
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
    });
  } catch (e: any) {
    console.error("Products API error:", e);
    return NextResponse.json(
      { error: e.message || "Failed to load products" },
      { status: 500 }
    );
  }
}