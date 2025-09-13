import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "EMPTY_CART" }, { status: 400 });
    }

    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
      (it: any) => ({
        quantity: Math.max(1, Number(it.qty || 1)),
        price_data: {
          currency: "usd",
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
      success_url: `${base}/success`,
      cancel_url: `${base}/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("CHECKOUT_ERR", err);
    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
