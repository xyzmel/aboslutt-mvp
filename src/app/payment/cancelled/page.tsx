import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function PaymentCancelledPage() {
  return (
    <PublicPageShell
      intro="Betalingen ble ikke fullført. Ingen Premium-tilgang er aktivert, og du kan prøve igjen når du vil."
      title="Betaling avbrutt"
    >
      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Ingen belastning registrert</h2>
        <p className="mt-2 text-[#5F6F82]">
          Hvis du lukket Vipps eller valgte å avbryte, er avtalen ikke fullført. Du beholder gratis oversikt og
          kan starte en ny betaling fra prissiden.
        </p>
      </section>

      <Link
        className="inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27]"
        href="/pricing"
      >
        Tilbake til priser
      </Link>
    </PublicPageShell>
  );
}
