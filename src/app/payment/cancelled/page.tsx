import Link from "next/link";
import { getServerSession } from "next-auth";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { authOptions } from "@/lib/auth";

export default async function PaymentCancelledPage() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = Boolean(session?.user);

  return (
    <PublicPageShell
      intro="Betalingen ble avbrutt. Ingen betaling er fullført, og Premium aktiveres ikke."
      title="Betalingen ble avbrutt"
    >
      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Ingen betaling ble fullført</h2>
        <p className="mt-2 text-[#5F6F82]">
          Hvis du lukket Vipps, gikk tilbake eller valgte å avbryte, er betalingsavtalen ikke fullført. Du kan
          prøve igjen fra prissiden når du vil.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          className="inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27]"
          href="/pricing"
        >
          Tilbake til priser
        </Link>
        {isLoggedIn ? (
          <Link
            className="inline-flex rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50"
            href="/dashboard"
          >
            Gå til oversikt
          </Link>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
