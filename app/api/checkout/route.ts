// /app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function getBaseUrl(req: Request) {
  // Trim env, fallback to request origin
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const hdrOrigin = req.headers.get("origin")?.trim();

  let base = envBase || hdrOrigin || "";
  // If user accidentally saved without scheme, add https
  if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;
  // Remove trailing slashes
  base = base.replace(/\/+$/, "");
  return base;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Debug logs
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const baseUrl = getBaseUrl(req);
    console.log("🔎 Checkout ENV", {
      stripeKey: stripeKey ? "present" : "MISSING",
      envBase: process.env.NEXT_PUBLIC_BASE_URL,
      resolvedBaseUrl: `[${baseUrl}]`,
    });
    console.log("🔎 Incoming body", body);

    if (!stripeKey) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY not set" },
        { status: 500 }
      );
    }
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Base URL not resolvable (env/origin missing)" },
        { status: 500 }
      );
    }

    // Final validation for Stripe
    try {
      // Will throw if not a proper absolute URL
      new URL(`${baseUrl}/success`);
      new URL(`${baseUrl}/cancel`);
    } catch {
      return NextResponse.json(
        { error: `Invalid base URL: ${baseUrl}` },
        { status: 500 }
      );
    }

    if (!body.line_items || !Array.isArray(body.line_items)) {
      return NextResponse.json(
        { error: "Invalid payload: line_items missing" },
        { status: 400 }
      );
    }

    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: body.line_items,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
    });

    console.log("✅ Stripe session created", session.id);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("❌ Checkout error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
