// /app/api/erp-health/route.ts
export const runtime = "nodejs";

// Prefer IPv4 for DNS (avoids AAAA stalls on some hosts)
try {
  // @ts-ignore
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
const ERP_KEY = process.env.ERP_API_KEY || "";
const ERP_SECRET = process.env.ERP_API_SECRET || "";
const PRICE_LIST = process.env.ERP_PRICE_LIST || "Standard Selling";
const WAREHOUSE = process.env.WEBSITE_WAREHOUSE || "";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `token ${ERP_KEY}:${ERP_SECRET}`,
  };
}

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const txt = await res.text();
  throw new Error(`HTTP ${res.status} ${res.statusText} (non-JSON): ${txt.slice(0, 160)}`);
}

async function fetchERP(pathQS: string, timeoutMs = 25000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${ERP_BASE}${pathQS}`;
    const res = await fetch(url, { headers: authHeaders(), cache: "no-store", signal: controller.signal });
    const body = await safeJson(res).catch((e) => ({ error: String(e.message || e) }));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  if (!ERP_BASE || !ERP_KEY || !ERP_SECRET) {
    return NextResponse.json({ ok: false, error: "Missing ERP env" }, { status: 500 });
  }

  const ping = await fetchERP(`/api/method/ping`);
  const itemOne = await fetchERP(`/api/resource/Item?fields=["item_code","item_name","image","disabled"]&limit_page_length=1`);
  const priceOne = await fetchERP(
    `/api/resource/Item%20Price?fields=["item_code","price_list","price_list_rate","currency"]&filters=${encodeURIComponent(
      JSON.stringify([["price_list","=",PRICE_LIST]])
    )}&limit_page_length=1`
  );

  return NextResponse.json({
    env: {
      base: ERP_BASE,
      price_list: PRICE_LIST,
      warehouse: WAREHOUSE || null,
      api_key_present: !!ERP_KEY,
      api_secret_present: !!ERP_SECRET,
    },
    ping,
    item_read: itemOne,
    price_read: priceOne,
  });
}
