// /app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Debug: log incoming body
    console.log("🔎 Incoming body", body);

    // Debug: log env presence
    console.log("🔎 ENV", {
      stripeKey: process.env.STRIPE_SECRET_KEY ? "present" : "MISSING",
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY not set" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey);

    // ✅ validate payload
    if (!body.line_items || !Array.isArray(body.line_items)) {
      return NextResponse.json(
        { error: "Invalid payload: line_items missing" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_BASE_URL not set" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: body.line_items,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
    });

    // Debug: session created
    console.log("✅ Stripe session created", session.id);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("❌ Checkout error:", err);
    return NextResponse.json(
      { error: err.message || "Checkout failed" },
      { status: 500 }
    );
  }
}

