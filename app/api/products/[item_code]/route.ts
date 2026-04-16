import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 60;

try {
  // @ts-ignore
  const { setDefaultResultOrder } = await import("node:dns");
  setDefaultResultOrder?.("ipv4first");
} catch {}

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
const STRICT_PUBLISH = (process.env.VU_STRICT_PUBLISH || "1").trim() === "1";

/* ---------- helpers ---------- */
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
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0, 300)}`);
  }
  if (ct.includes("application/json")) return res.json();
  const txt = await res.text();
  throw new Error(
    `HTTP ${res.status} ${res.statusText} (non-JSON): ${txt.slice(0, 300)}`
  );
}

function slugify(value: string) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function absUrl(path?: string | null) {
  if (!path) return null;
  const raw = String(path).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${ERP_BASE}${raw}`;
  return `${ERP_BASE}/${raw}`;
}

function publicImageOrNull(path?: string | null) {
  const url = absUrl(path);
  if (!url) return null;
  if (url.includes("/private/files/")) return null;
  return url;
}

async function getPublicFileFallback(attachedToName: string) {
  const filters = encodeURIComponent(
    JSON.stringify([
      ["attached_to_doctype", "=", "Item"],
      ["attached_to_name", "=", attachedToName],
      ["is_private", "=", 0],
    ])
  );

  const fields = encodeURIComponent(JSON.stringify(["file_url"]));
  const orderBy = encodeURIComponent("creation desc");
  const limit = 1;

  const url =
    `${ERP_BASE}/api/resource/File` +
    `?filters=${filters}` +
    `&fields=${fields}` +
    `&order_by=${orderBy}` +
    `&limit_page_length=${limit}`;

  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const json = await safeJson(res);
  const fileUrl = json?.data?.[0]?.file_url;
  return publicImageOrNull(fileUrl);
}

async function getItemByCode(itemCode: string) {
  const filters = STRICT_PUBLISH
    ? [
        ["item_code", "=", itemCode],
        ["disabled", "=", 0],
        ["vu_show_in_website", "=", 1],
      ]
    : [
        ["item_code", "=", itemCode],
        ["disabled", "=", 0],
      ];

  const url =
    `${ERP_BASE}/api/resource/Item` +
    `?filters=${encodeURIComponent(JSON.stringify(filters))}` +
    `&fields=${encodeURIComponent(
      JSON.stringify([
        "name",
        "item_code",
        "item_name",
        "description",
        "image",
        "brand",
        "item_group",
        "disabled",
      ])
    )}` +
    `&limit_page_length=1`;

  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const json = await safeJson(res);
  return json?.data?.[0] || null;
}

async function getPrice(itemCode: string) {
  const filters = [
    ["item_code", "=", itemCode],
    ["price_list", "=", PRICE_LIST],
  ];

  const url =
    `${ERP_BASE}/api/resource/Item Price` +
    `?filters=${encodeURIComponent(JSON.stringify(filters))}` +
    `&fields=${encodeURIComponent(JSON.stringify(["price_list_rate", "currency"]))}` +
    `&limit_page_length=1`;

  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const json = await safeJson(res);

  return {
    price: json?.data?.[0]?.price_list_rate ?? null,
    currency: json?.data?.[0]?.currency || "PKR",
  };
}

async function getStock(itemCode: string) {
  const filters = [
    ["item_code", "=", itemCode],
    ["warehouse", "=", WEBSITE_WAREHOUSE],
  ];

  const url =
    `${ERP_BASE}/api/resource/Bin` +
    `?filters=${encodeURIComponent(JSON.stringify(filters))}` +
    `&fields=${encodeURIComponent(JSON.stringify(["actual_qty"]))}` +
    `&limit_page_length=1`;

  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });

  const json = await safeJson(res);
  return Number(json?.data?.[0]?.actual_qty ?? 0);
}

/* ---------- GET ---------- */
export async function GET(
  _req: Request,
  context: { params: Promise<{ item_code: string }> }
) {
  try {
    assertEnv();

    const { item_code } = await context.params;
    const cleanItemCode = (item_code || "").trim();

    if (!cleanItemCode) {
      return NextResponse.json({ error: "Missing item_code" }, { status: 400 });
    }

    const item = await getItemByCode(cleanItemCode);

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const [priceData, stock, fallbackImage] = await Promise.all([
      getPrice(item.item_code),
      getStock(item.item_code),
      publicImageOrNull(item.image) ? Promise.resolve(null) : getPublicFileFallback(item.name || item.item_code),
    ]);

    const image =
      publicImageOrNull(item.image) ||
      fallbackImage ||
      "/images/placeholder.png";

    return NextResponse.json(
      {
        item_code: item.item_code,
        item_name: item.item_name,
        description: item.description || "",
        image,
        price: priceData.price,
        currency: priceData.currency,
        stock,
        brand: item.brand || "",
        item_group: item.item_group || "",
        slug: slugify(item.item_name || item.item_code),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error: any) {
    console.error("GET /api/products/[item_code] failed:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch item",
        details:
          process.env.NODE_ENV !== "production"
            ? String(error?.message || error)
            : undefined,
      },
      { status: 500 }
    );
  }
}