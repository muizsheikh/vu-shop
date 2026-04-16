// /app/api/products/[item_code]/route.ts
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

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const txt = await res.text();
  throw new Error(`HTTP ${res.status} ${res.statusText} (non-JSON): ${txt.slice(0, 200)}`);
}

/* ---------- GET ---------- */
export async function GET(
  req: Request,
  { params }: { params: { item_code: string } }
) {
  try {
    assertEnv();
    const { item_code } = params;

    // Item detail
    const itemRes = await fetch(
      `${ERP_BASE}/api/resource/Item/${encodeURIComponent(item_code)}?fields=["item_code","item_name","brand","item_group","description","image"]`,
      { headers: authHeaders(), cache: "no-store" }
    );
    const itemJson = await safeJson(itemRes);
    const item = itemJson?.data;

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Price
    const priceRes = await fetch(
      `${ERP_BASE}/api/resource/Item Price?filters=[["item_code","=","${item_code}"],["price_list","=","${PRICE_LIST}"]]&fields=["price_list_rate","currency"]`,
      { headers: authHeaders(), cache: "no-store" }
    );
    const priceJson = await safeJson(priceRes);
    const price = priceJson?.data?.[0]?.price_list_rate || null;
    const currency = priceJson?.data?.[0]?.currency || "PKR";

    // Stock
    const stockRes = await fetch(
      `${ERP_BASE}/api/resource/Bin?filters=[["item_code","=","${item_code}"],["warehouse","=","${WEBSITE_WAREHOUSE}"]]&fields=["actual_qty"]`,
      { headers: authHeaders(), cache: "no-store" }
    );
    const stockJson = await safeJson(stockRes);
    const stock = stockJson?.data?.[0]?.actual_qty || 0;

    return NextResponse.json({
      item_code: item.item_code,
      item_name: item.item_name,
      brand: item.brand,
      item_group: item.item_group,
      description: item.description,
      image: item.image,
      price,
      currency,
      stock,
    });
  } catch (error: any) {
    console.error("Error fetching item:", error);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }
}
