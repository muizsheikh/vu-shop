import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { pushStripeOrderToERP } from "@/lib/erpnext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = (await headers()).get("stripe-signature") as string | null;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!); // ✅ no apiVersion

  let event: Stripe.Event;

  try {
    const payload = await req.text(); // raw body required for signature
    if (!webhookSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
    event = stripe.webhooks.constructEvent(payload, signature!, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook verification failed:", err?.message);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log("✅ checkout.session.completed", {
        id: session.id,
        amount_total: session.amount_total,
        currency: session.currency,
        email: session.customer_details?.email,
      });

      // Push to ERPNext
      try {
        const res = await pushStripeOrderToERP({
          email: session.customer_details?.email,
          name: session.customer_details?.name,
          amount_total: session.amount_total ?? null,
          currency: session.currency ?? null,
          session_id: session.id,
        });
        console.log("🧾 ERP push result:", res);
      } catch (e) {
        console.error("⚠️ ERP push failed:", e);
      }
    } else if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      console.log("💸 payment_intent.succeeded", { id: pi.id, amount: pi.amount });
    } else {
      console.log(`ℹ️ Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error("⚠️ Webhook handler error:", err);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
