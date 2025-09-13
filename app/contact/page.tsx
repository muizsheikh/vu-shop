export const metadata = { title: "Contact — Vape Ustad" };

export default function ContactPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-extrabold">Contact</h1>
      <p className="opacity-80">This is a placeholder. In v2 we’ll add a form and send to ERPNext/Email.</p>
      <ul className="list-disc pl-6 space-y-1 opacity-80">
        <li>WhatsApp: +92-XXX-XXXXXXX</li>
        <li>Email: info@vapeustad.com</li>
        <li>Hours: 11am – 11pm PKT</li>
      </ul>
    </div>
  );
}
