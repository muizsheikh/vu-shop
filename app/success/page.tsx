import Stripe from "stripe";
import ClearCartOnSuccess from "@/components/ClearCartOnSuccess";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const sp = await searchParams; // ✅ fix
  const sid = sp?.session_id;
  let amount: number | null = null;
  let currency: string | null = null;

  if (sid && process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // ✅ no apiVersion
    try {
      const session = await stripe.checkout.sessions.retrieve(sid, {
        expand: ["payment_intent"],
      });
      amount = session.amount_total ?? null;
      currency = session.currency ?? null;
    } catch {
      // silent fail; still render page
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <ClearCartOnSuccess />
      <h1 className="text-3xl font-semibold">Shukriya! 🧾</h1>
      <p className="mt-3 text-muted-foreground">
        Aapki payment receive ho chuki hai. Order confirmation email aapko mil
        jayegi.
      </p>

      <div className="mt-8 rounded-xl border p-6">
        <div className="text-sm text-muted-foreground">Stripe Session</div>
        <div className="font-mono break-all">{sid ?? "—"}</div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50/50 p-4 dark:bg-white/5">
            <div className="text-sm text-muted-foreground">Total Paid</div>
            <div className="text-xl font-semibold">
              {amount !== null && currency
                ? new Intl.NumberFormat("en-PK", {
                    style: "currency",
                    currency: currency.toUpperCase(),
                  }).format(amount / 100)
                : "—"}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50/50 p-4 dark:bg-white/5">
            <div className="text-sm text-muted-foreground">Currency</div>
            <div className="text-xl font-semibold">
              {currency?.toUpperCase() ?? "—"}
            </div>
          </div>
        </div>

        <a
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-black px-5 py-2.5 text-white dark:bg-white dark:text-black"
        >
          Back to Home
        </a>
      </div>
    </main>
  );
}
