import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function PaymentThanksPage() {
  return (
    <PublicPageShell
      intro="Vipps-godkjenningen er mottatt og behandles server-side. Premium aktiveres først når betalingen er bekreftet av Vipps."
      title="Takk, betalingen behandles"
    >
      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Hva skjer nå?</h2>
        <p className="mt-2 text-[#5F6F82]">
          Det kan ta litt tid før Vipps sender endelig bekreftelse. Aboslutt sjekker statusen fra serveren og
          aktiverer Premium når avtalen er bekreftet.
        </p>
      </section>

      <Link
        className="inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27]"
        href="/dashboard"
      >
        Gå til oversikt
      </Link>
    </PublicPageShell>
  );
}
