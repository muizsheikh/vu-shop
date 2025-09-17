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
  image?: string | null;         // may be /files/... or /private/...
  item_group?: string | null;
  brand?: string | null;
  disabled?: 0 | 1;
  vu_show_in_website?: 0 | 1;    // custom checkbox (our switch)
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

// POST to frappe.client.get_list (prevents long URLs)
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

/**
 * Load a PUBLIC image per item from File doctype (fallback).
 * Picks latest public file attached to Item.<item_code>.
 */
async function loadPublicFilesForItems(itemCodes: string[]) {
  const map = new Map<string, string>(); // item_code -> absolute url
  const parts = chunk(itemCodes, 100);

  // We need to query per chunk; ERP doesn't support IN for attached_to_name reliably in all versions,
  // so we'll just loop chunks and fetch many with IN if supported; otherwise you can loop per item if needed.
  for (const part of parts) {
    // Try IN first; if your ERP doesn't support, fall back per-item (optional).
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
export async function GET() {
  try {
    assertEnv();

    // (1) Items explicitly allowed for website
    const items = await erpGetList<ERPItem>("Item", {
      fields: ["item_code", "item_name", "image", "item_group", "brand", "disabled", "vu_show_in_website"],
      filters: [
        ["disabled", "=", 0],
        ["vu_show_in_website", "=", 1],
      ],
      order_by: "item_name asc",
      limit_page_length: 1000,
    });

    if (!items.length) {
      return NextResponse.json({
        products: [],
        meta: {
          source: "Item.vu_show_in_website=1",
          price_list: PRICE_LIST,
          warehouse: WEBSITE_WAREHOUSE,
          count: 0,
        },
      });
    }

    const codes = items.map((it) => it.item_code).filter(Boolean);

    // (2) Prices
    const priceChunks = await Promise.all(
      chunk(codes).map((part) =>
        erpGetList<ERPItemPrice>("Item Price", {
          fields: ["item_code", "price_list", "price_list_rate", "currency"],
          filters: [
            ["item_code", "in", part],
            ["price_list", "=", PRICE_LIST],
          ],
          limit_page_length: 1000,
        })
      )
    );
    const prices = priceChunks.flat();
    const priceMap = new Map(prices.map((p) => [p.item_code, p]));

    // (3) Stock strictly from selected warehouse
    const binChunks = await Promise.all(
      chunk(codes).map((part) =>
        erpGetList<ERPBin>("Bin", {
          fields: ["item_code", "warehouse", "actual_qty"],
          filters: [
            ["item_code", "in", part],
            ["warehouse", "=", WEBSITE_WAREHOUSE],
          ],
          limit_page_length: 1000,
        })
      )
    );
    const bins = binChunks.flat();
    const stockMap = new Map(bins.map((b) => [b.item_code, Number(b.actual_qty || 0)]));

    // (4) PUBLIC file fallback map for images
    const publicFileMap = await loadPublicFilesForItems(codes);

    // (5) Build products (hide qty <= 0)
    const products = items
      .map((it) => {
        const stockQty = stockMap.get(it.item_code) ?? 0;
        if (stockQty <= 0) return null;

        const rawImg = it.image || null;
        const useItemImg = rawImg && !isPrivatePath(rawImg) ? resolveAbsolute(rawImg) : null;
        const fileImg = publicFileMap.get(it.item_code) || null;

        const chosenImg = useItemImg || fileImg || null;

        const price = priceMap.get(it.item_code);
        return {
          id: it.item_code,
          name: it.item_name ?? it.item_code,
          image: chosenImg, // may be null → frontend should fallback to /images/placeholder.png
          price: price ? Number(price.price_list_rate) : null,
          currency: price?.currency || "PKR",
          item_group: it.item_group ?? null,
          brand: it.brand ?? null,
          stock_qty: stockQty,
          in_stock: stockQty > 0,
          disabled: !!(it.disabled ?? 0),
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      products,
      meta: {
        source: "Item.vu_show_in_website=1 + Bin(warehouse) + File(public fallback)",
        price_list: PRICE_LIST,
        warehouse: WEBSITE_WAREHOUSE,
        count: products.length,
      },
    });
  } catch (e: any) {
    console.error("Products API error:", e);
    return NextResponse.json({ error: e.message || "Failed to load products" }, { status: 500 });
  }
}
