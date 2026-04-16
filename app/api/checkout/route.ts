import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingLineItem = {
  quantity?: number;
  price_data?: {
    currency?: string;
    unit_amount?: number;
    product_data?: {
      name?: string;
      images?: string[];
      metadata?: Record<string, string>;
    };
  };
};

function normBase(u: string) {
  let x = (u || "").trim();
  if (x && !/^https?:\/\//i.test(x)) x = `https://${x}`;
  return x.replace(/\/+$/, "");
}

function getBaseUrl(req: Request) {
  const envBase = normBase(process.env.NEXT_PUBLIC_BASE_URL || "");
  const hdrOrigin = normBase(req.headers.get("origin") || "");
  return envBase || hdrOrigin || "";
}

function getStripe() {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  return new Stripe(key);
}

function assertAbsoluteUrl(url: string) {
  const parsed = new URL(url);
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error(`Invalid URL protocol: ${url}`);
  }
}

function sanitizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function sanitizeCurrency(value: unknown) {
  const cur = sanitizeString(value, "pkr").toLowerCase();
  return /^[a-z]{3}$/.test(cur) ? cur : "pkr";
}

function sanitizeQuantity(value: unknown) {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty <= 0) return 1;
  return Math.floor(qty);
}

function sanitizeUnitAmount(value: unknown) {
  const amt = Number(value);
  if (!Number.isFinite(amt) || amt <= 0) return null;
  return Math.round(amt);
}

function sanitizeImageUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => /^https?:\/\//i.test(v))
    .slice(0, 8);
}

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = sanitizeString(k);
    const val = typeof v === "string" ? v.trim() : String(v ?? "").trim();
    if (!key || !val) continue;
    out[key.slice(0, 40)] = val.slice(0, 500);
  }
  return out;
}

function sanitizeLineItems(input: unknown): Stripe.Checkout.SessionCreateParams.LineItem[] {
  if (!Array.isArray(input)) {
    throw new Error("Invalid payload: line_items missing");
  }

  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const raw of input as IncomingLineItem[]) {
    const name = sanitizeString(raw?.price_data?.product_data?.name);
    const unitAmount = sanitizeUnitAmount(raw?.price_data?.unit_amount);
    const quantity = sanitizeQuantity(raw?.quantity);
    const currency = sanitizeCurrency(raw?.price_data?.currency);
    const images = sanitizeImageUrls(raw?.price_data?.product_data?.images);
    const metadata = sanitizeMetadata(raw?.price_data?.product_data?.metadata);

    if (!name || unitAmount === null) {
      continue;
    }

    items.push({
      quantity,
      price_data: {
        currency,
        unit_amount: unitAmount,
        product_data: {
          name: name.slice(0, 200),
          images,
          metadata,
        },
      },
    });
  }

  if (!items.length) {
    throw new Error("Invalid payload: no valid line_items");
  }

  return items;
}

function buildSessionMetadata(req: Request, itemCount: number) {
  return {
    source: "vapeustad-web",
    checkout_type: "stripe",
    item_count: String(itemCount),
    origin: sanitizeString(req.headers.get("origin"), ""),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const baseUrl = getBaseUrl(req);

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Base URL not resolvable (env/origin missing)" },
        { status: 500 }
      );
    }

    const successUrl = `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/cancel`;

    assertAbsoluteUrl(successUrl);
    assertAbsoluteUrl(cancelUrl);

    const lineItems = sanitizeLineItems(body?.line_items);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: buildSessionMetadata(req, lineItems.length),
      payment_method_collection: "always",
      billing_address_collection: "auto",
    });

    if (!session.url) {
      throw new Error("Stripe session created without url");
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("POST /api/checkout failed:", err);

    return NextResponse.json(
      {
        error: err?.message || "Checkout failed",
      },
      { status: 500 }
    );
  }
}