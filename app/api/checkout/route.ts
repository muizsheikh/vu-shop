// /app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";         // use Node runtime (not Edge)
export const dynamic = "force-dynamic";  // don't cache

// ---- helpers ----
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

type IncomingItem = {
  slug?: string;
  name: string;
  price: number;   // numeric price (we charge test USD here)
  image?: string;  // /products/x.jpg or absolute URL
  qty?: number;
};

// ---- Stripe init ----
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-06-20" });

export async function GET() {
  // quick sanity endpoint
  return NextResponse.json({
    ok: true,
    hasKey: Boolean(process.env.STRIPE_SECRET_KEY),
    base: getBaseUrl(),
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "NO_STRIPE_KEY" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const items = (body?.items || []) as IncomingItem[];
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "EMPTY_CART" }, { status: 400 });
    }

    const base = getBaseUrl();

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
      (it) => ({
        quantity: Math.max(1, Number(it.qty || 1)),
        price_data: {
          currency: "usd",                           // TEST mode currency
          unit_amount: Math.round(Number(it.price) * 100),
          product_data: {
            name: it.name,
            images: it.image ? [new URL(it.image, base).toString()] : undefined,
            metadata: { slug: it.slug ?? "" },
          },
        },
      })
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${base}/?checkout=success`,
      cancel_url: `${base}/?checkout=cancel`,
      // shipping_address_collection: { allowed_countries: ["US", "AE", "GB", "PK"] },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("CHECKOUT_ERR", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
