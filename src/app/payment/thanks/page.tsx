import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function PaymentThanksPage() {
  return (
    <PublicPageShell
      intro="Vi sjekker betalingsstatusen hos Vipps. Premium aktiveres ikke fra denne siden, men først når Aboslutt har fått bekreftet betalingen server-side."
      title="Betalingen behandles"
    >
      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Status sjekkes automatisk</h2>
        <p className="mt-2 text-[#5F6F82]">
          Vipps sender endelig bekreftelse til Aboslutt via en sikker server-til-server flyt. Hvis du godkjente
          betalingen, blir Premium aktivert når bekreftelsen er verifisert. Hvis du avbrøt hos Vipps, blir ingen
          betaling eller Premium-tilgang fullført.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          className="inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27]"
          href="/dashboard"
        >
          Gå til oversikt
        </Link>
        <Link
          className="inline-flex rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50"
          href="/pricing"
        >
          Se priser
        </Link>
      </div>
    </PublicPageShell>
  );
}
