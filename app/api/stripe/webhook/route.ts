import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { pushStripeOrderToERP } from "@/lib/erpnext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(key);
}

function getWebhookSecret() {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }
  return secret;
}

function sanitizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

async function constructStripeEvent(req: Request) {
  const hdrs = await headers();
  const signature = hdrs.get("stripe-signature");

  if (!signature) {
    throw new Error("Missing stripe-signature header");
  }

  const payload = await req.text();
  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

async function fetchCheckoutSessionWithLineItems(sessionId: string) {
  const stripe = getStripe();

  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product"],
  });
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  if (!session.id) {
    throw new Error("checkout.session.completed missing session id");
  }

  const fullSession = await fetchCheckoutSessionWithLineItems(session.id);

  const email =
    sanitizeString(fullSession.customer_details?.email) ||
    sanitizeString(fullSession.customer_email) ||
    "";

  const name =
    sanitizeString(fullSession.customer_details?.name) || "Guest Checkout";

  const phone =
    sanitizeString(fullSession.customer_details?.phone) ||
    sanitizeString(fullSession.phone_number_collection as any) ||
    "";

  if (!email) {
    throw new Error(`Session ${session.id} missing customer email`);
  }

  const shippingAddress = {
    line1: sanitizeString(fullSession.customer_details?.address?.line1) || null,
    city: sanitizeString(fullSession.customer_details?.address?.city) || null,
    country:
      sanitizeString(fullSession.customer_details?.address?.country) || null,
  };

  const lineItems = fullSession.line_items?.data || [];

  const erpResult = await pushStripeOrderToERP({
    email,
    name,
    phone: phone || null,
    amount_total: fullSession.amount_total ?? null,
    currency: fullSession.currency ?? null,
    session_id: fullSession.id,
    line_items: lineItems,
    shipping_address: shippingAddress,
  });

  console.log("✅ Stripe checkout pushed to ERP", {
    event_id: event.id,
    session_id: fullSession.id,
    email,
    item_count: lineItems.length,
    erp_result: erpResult,
  });
}

export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    event = await constructStripeEvent(req);
  } catch (err: any) {
    console.error("❌ Stripe webhook verification failed:", err?.message || err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event);
        break;
      }

      default: {
        console.log("ℹ️ Stripe webhook ignored event", {
          event_id: event.id,
          type: event.type,
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("❌ Stripe webhook handler failed:", {
      event_id: event?.id,
      type: event?.type,
      message: err?.message || String(err),
    });

    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}