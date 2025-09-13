import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";         // ensure Node runtime (not Edge)
export const dynamic = "force-dynamic";  // no caching

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.warn("Missing STRIPE_SECRET_KEY env var.");
}

const stripe = new Stripe(STRIPE_KEY || "", {
  apiVersion: "2024-06-20",
});

// Shape we expect from the cart
type IncomingItem = {
  slug?: string;
  name: string;
  price: number;       // number in your PKR, but we'll charge in USD test mode
  image?: string;      // "/products/xxx.jpg" or absolute
  qty?: number;        // quantity
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const items = (body?.items || []) as IncomingItem[];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "EMPTY_CART" }, { status: 400 });
    }

    // Base URL for success/cancel + absolute image URLs
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((it) => ({
      quantity: Math.max(1, Number(it.qty || 1)),
      price_data: {
        currency: "usd",                    // TEST MODE; later we’ll change per region
        unit_amount: Math.round(Number(it.price) * 100),
        product_data: {
          name: it.name,
          images: it.image ? [new URL(it.image, base).toString()] : undefined,
          metadata: { slug: it.slug ?? "" },
        },
      },
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${base}/success`,   // ✅ fixed
      cancel_url: `${base}/cancel`,     // ✅ fixed
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("CHECKOUT_ERR", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
