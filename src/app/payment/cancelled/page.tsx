import Link from "next/link";
import type { Metadata } from "next";
import { FunnelEvent } from "@/components/analytics/FunnelEvent";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Betaling avbrutt | Aboslutt",
  robots: { index: false, follow: false },
};

export default function PaymentCancelledPage() {
  return (
    <PublicPageShell
      intro="Betalingen ble avbrutt. Ingen betaling er fullført, og Premium aktiveres ikke."
      title="Betalingen ble avbrutt"
    >
      <FunnelEvent event="checkout_cancelled" />
      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Ingen betaling ble fullført</h2>
        <p className="mt-2 text-[#5F6F82]">
          Hvis du lukket Vipps, gikk tilbake eller valgte å avbryte, er betalingsavtalen ikke fullført.
          Du kan prøve igjen fra prissiden når du vil.
        </p>
        <p className="mt-2 text-[#5F6F82]">
          Trenger du hjelp? Kontakt{" "}
          <a className="font-bold text-[#C8102E] hover:underline" href={`mailto:${siteConfig.contactEmail}`}>
            {siteConfig.contactEmail}
          </a>
          .
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          className="inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27]"
          href="/pricing"
        >
          Tilbake til priser
        </Link>
        <Link
          className="inline-flex rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50"
          href="/dashboard"
        >
          Gå til oversikt
        </Link>
      </div>
    </PublicPageShell>
  );
}
