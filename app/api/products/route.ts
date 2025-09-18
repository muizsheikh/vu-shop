// /app/api/products/route.ts
export const runtime = "nodejs";
export const revalidate = 60;

// Prefer IPv4 for DNS (avoids AAAA stalls)
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
  item_code: string;
  item_name?: string | null;
  image?: string | null;
  item_group?: string | null;
  brand?: string | null;
  disabled?: 0 | 1;
  vu_show_in_website?: 0 | 1;
};
type ERPItemPrice = { item_code: string; price_list: string; price_list_rate: number; currency: string };
type ERPBin = { item_code: string; warehouse: string; actual_qty: number };
type ERPFile = { file_url: string; is_private: 0 | 1; attached_to_name?: string | null };

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
  throw new Error(`HTTP ${res.status} ${res.statusText} (non-JSON): ${txt.slice(0, 200)}`);
}

async function erpGetList<T>(doctype: string, body: Record<string, any>, timeoutMs = 25000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${ERP_BASE}/api/method/frappe.client.get_list`;
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ doctype, ...body }),
    });
    const json = await safeJson(res).catch((e) => {
      throw new Error(String(e.message || e));
    });
    return (json?.message ?? json?.data ?? []) as T[];
  } finally {
    clearTimeout(t);
  }
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

async function loadPublicFilesForItems(itemCodes: string[]) {
  const map = new Map<string, string>();
  for (const part of chunk(itemCodes, 100)) {
    const files = await erpGetList<ERPFile>("File", {
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
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "12", 10) || 12, 1), 60);

    // Item filters
    const filters: any[] = [["disabled", "=", 0]];
    if (VU_STRICT_PUBLISH !== "0") filters.push(["vu_show_in_website", "=", 1]);
    if (brand) filters.push(["brand", "like", brand]); // case-insensitive
    if (group) filters.push(["item_group", "like", group]); // case-insensitive

    const or_filters = q
      ? [
          ["item_name", "like", `%${q}%`],
          ["item_code", "like", `%${q}%`],
        ]
      : undefined;

    const items = await erpGetList<ERPItem>("Item", {
      fields: ["item_code", "item_name", "image", "item_group", "brand", "disabled", "vu_show_in_website"],
      filters,
      ...(or_filters ? { or_filters } : {}),
      order_by: "item_name asc",
      limit_page_length: 2000,
    });

    if (!items.length) {
      return NextResponse.json({
        products: [],
        meta: { page, limit, total: 0, pages: 0, filters: { brand, group, q } },
      });
    }

    const codes = items.map((it) => it.item_code).filter(Boolean);

    // Prices
    const priceChunks = await Promise.all(
      chunk(codes).map((part) =>
        erpGetList<ERPItemPrice>("Item Price", {
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

    // Stock
    const binChunks = await Promise.all(
      chunk(codes).map((part) =>
        erpGetList<ERPBin>("Bin", {
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

    let products = items
      .map((it) => {
        const stockQty = stockMap.get(it.item_code) ?? 0;
        if (stockQty <= 0) return null;

        const rawImg = it.image || null;
        const useItemImg = rawImg && !isPrivatePath(rawImg) ? resolveAbsolute(rawImg) : null;
        const fileImg = publicFileMap.get(it.item_code) || null;

        const price = priceMap.get(it.item_code);
        const priceNum = price ? Number(price.price_list_rate) : null;

        return {
          id: it.item_code,
          name: it.item_name ?? it.item_code,
          image: useItemImg || fileImg || null,
          price: priceNum,
          currency: price?.currency || "PKR",
          item_group: it.item_group ?? null,
          brand: it.brand ?? null,
          stock_qty: stockQty,
          in_stock: stockQty > 0,
          disabled: !!(it.disabled ?? 0),
        };
      })
      .filter(Boolean) as any[];

    // Min/max price filter
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

    // Defensive client-side q filter
    if (q) {
      const qq = q.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(qq) ||
          p.id.toLowerCase().includes(qq) ||
          (p.brand ?? "").toLowerCase().includes(qq)
      );
    }

    products.sort((a, b) => a.name.localeCompare(b.name));

    const total = products.length;
    const pages = Math.max(Math.ceil(total / limit), 0);
    const start = (page - 1) * limit;
    const paged = products.slice(start, start + limit);

    return NextResponse.json({
      products: paged,
      meta: { page, limit, total, pages, filters: { brand, group, q, min_price: minPrice, max_price: maxPrice } },
    });
  } catch (e: any) {
    console.error("Products API error:", e);
    return NextResponse.json({ error: e.message || "Failed to load products" }, { status: 500 });
  }
}
