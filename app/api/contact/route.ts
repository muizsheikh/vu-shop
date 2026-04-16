import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(0).optional(), // honeypot
});

type RateEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 min
const RATE_LIMIT_MAX = 5;
const rateStore = new Map<string, RateEntry>();

function sanitizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for") || "";
  const realIp = req.headers.get("x-real-ip") || "";
  const firstForwarded = xff.split(",")[0]?.trim();
  return firstForwarded || realIp || "unknown";
}

function cleanupRateStore(now: number) {
  for (const [key, value] of rateStore.entries()) {
    if (value.resetAt <= now) {
      rateStore.delete(key);
    }
  }
}

function checkRateLimit(key: string) {
  const now = Date.now();
  cleanupRateStore(now);

  const existing = rateStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetAt,
    };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  rateStore.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, RATE_LIMIT_MAX - existing.count),
    resetAt: existing.resetAt,
  };
}

function buildRateHeaders(rate: {
  remaining: number;
  resetAt: number;
}) {
  const retryAfterSec = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));

  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(rate.remaining),
    "Retry-After": String(retryAfterSec),
  };
}

function getResendConfig() {
  const key = sanitizeString(process.env.RESEND_API_KEY);
  const to = sanitizeString(process.env.CONTACT_TO_EMAIL);
  const from = sanitizeString(
    process.env.CONTACT_FROM_EMAIL,
    "onboarding@resend.dev"
  );

  return { key, to, from };
}

function buildSubject(name: string) {
  return `New contact from ${name}`;
}

function buildTextBody(args: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  ip: string;
}) {
  return [
    `Name: ${args.name}`,
    `Email: ${args.email}`,
    `Phone: ${args.phone || "-"}`,
    `IP: ${args.ip}`,
    "",
    args.message,
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`contact:${ip}`);

    if (!rate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: buildRateHeaders(rate),
        }
      );
    }

    const json = await req.json().catch(() => null);

    if (!json || typeof json !== "object") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request body",
        },
        {
          status: 400,
          headers: buildRateHeaders(rate),
        }
      );
    }

    const parsed = schema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          errors: parsed.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: buildRateHeaders(rate),
        }
      );
    }

    const { name, email, phone, message, website } = parsed.data;

    if (website) {
      return NextResponse.json(
        { ok: true },
        {
          headers: buildRateHeaders(rate),
        }
      );
    }

    const { key, to, from } = getResendConfig();

    if (!key) {
      throw new Error("RESEND_API_KEY not set");
    }

    if (!to) {
      throw new Error("CONTACT_TO_EMAIL not set");
    }

    const resend = new Resend(key);

    await resend.emails.send({
      to,
      from,
      subject: buildSubject(name),
      reply_to: email,
      text: buildTextBody({
        name,
        email,
        phone,
        message,
        ip,
      }),
    });

    console.log("CONTACT_MSG", {
      name,
      email,
      phone: phone || "",
      ip,
      messageLength: message.length,
    });

    return NextResponse.json(
      { ok: true },
      {
        headers: buildRateHeaders(rate),
      }
    );
  } catch (err: any) {
    console.error("CONTACT_ERR", err);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to send message",
      },
      { status: 500 }
    );
  }
}