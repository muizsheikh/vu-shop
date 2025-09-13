import ContactForm from "./ContactForm";

export const metadata = { title: "Contact — Vape Ustad" };

export default function ContactPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-extrabold">Contact</h1>
      <p className="opacity-80">Have a question? Send us a message.</p>
      <ContactForm />
      <p className="text-xs opacity-60">We’ll reply within 24 hours.</p>
    </div>
  );
}
