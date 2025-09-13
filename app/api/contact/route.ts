import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(10),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, phone, message, website } = parsed.data;
  if (website) return NextResponse.json({ ok: true }); // bot trap

  try {
    const key = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_TO_EMAIL;
    const from = process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev";

    if (key && to) {
      const resend = new Resend(key);
      await resend.emails.send({
        to,
        from,
        subject: `New contact from ${name}`,
        reply_to: email,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "-"}\n\n${message}`,
      });
    }

    console.log("CONTACT_MSG", { name, email, phone, message });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("CONTACT_ERR", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
