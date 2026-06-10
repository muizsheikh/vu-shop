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
const STRICT_PUBLISH = (process.env.VU_STRICT_PUBLISH || "1").trim() === "1";
const PLACEHOLDER_IMAGE = "/images/placeholder.png";

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
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 400)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();

  const txt = await res.text();
  throw new Error(`Non JSON response: ${txt.slice(0, 400)}`);
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

async function loadGalleryMap(itemCodes: string[]) {
  const map = new Map<string, GalleryImage[]>();

  for (const part of chunk(itemCodes, 100)) {
    const rows = await erpResourceList<ERPGalleryRow>("VU Item Gallery Image", {
      fields: ["parent", "image", "alt_text", "sort_order", "is_primary"],
      filters: [["parent", "in", part]],
      order_by: "sort_order asc, idx asc",
      limit_page_length: 1000,
    });

    for (const row of rows) {
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

    const filters: any[] = [["disabled", "=", 0]];

    if (STRICT_PUBLISH) filters.push(["vu_show_in_website", "=", 1]);
    if (brand) filters.push(["brand", "=", brand]);
    if (group) filters.push(["item_group", "=", group]);
    if (category) filters.push(["custom_website_category", "=", category]);
    if (homepageSection) filters.push(["custom_homepage_section", "=", homepageSection]);

    const items = await erpResourceList<ERPItem>("Item", {
      fields: [
        "item_code",
        "item_name",
        "image",
        "item_group",
        "brand",
        "description",
        "custom_website_category",
        "custom_homepage_section",
        "custom_homepage_sort_order",
        "disabled",
        "vu_show_in_website",
      ],
      filters,
      order_by: "item_name asc",
      limit_page_length: 2000,
    });

    if (!items.length) {
      return NextResponse.json({
        products: [],
        meta: { page, limit, total: 0, pages: 0 },
      });
    }

    const codes = items.map((it) => it.item_code).filter(Boolean);

    const [priceChunks, binChunks, galleryMap] = await Promise.all([
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
    ]);

    const prices = priceChunks.flat();
    const bins = binChunks.flat();

    const priceMap = new Map(prices.map((p) => [p.item_code, p]));
    const stockMap = new Map(bins.map((b) => [b.item_code, Number(b.actual_qty || 0)]));

    let products: Product[] = items.map((it) => {
      const itemName = sanitizeString(it.item_name, it.item_code);
      const slug = toSlug(itemName || it.item_code);
      const stock = stockMap.get(it.item_code) ?? 0;
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
      const homepageSort =
        Number.isFinite(homepageSortRaw) ? homepageSortRaw : null;

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
        stock,
        stock_qty: stock,
        brand: sanitizeString(it.brand),
        item_group: sanitizeString(it.item_group),
        category: sanitizeString(it.custom_website_category),
        homepage_section: sanitizeString(it.custom_homepage_section),
        homepage_sort_order: homepageSort,
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