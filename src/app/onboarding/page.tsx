import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { getCurrentAppUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Kom i gang",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader maxWidthClassName="max-w-5xl" />

      <section className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Kom i gang</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-extrabold tracking-tight">
          Få oversikt på få minutter
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5F6F82]">
          Start med ett abonnement du kjenner. Aboslutt hjelper deg å holde orden,
          velge hvordan abonnementet kan sies opp og følge opp til jobben er gjort.
          E-postimport er valgfritt og kan brukes senere.
        </p>

        <div className="mt-6 max-w-2xl rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DBE4EE]">
          <div className="flex items-center justify-between gap-4 text-sm font-bold">
            <span>3 tydelige steg</span>
            <Link className="text-[#C8102E] hover:underline" href="/dashboard?start=manual">
              Hopp over
            </Link>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#E6EDF5]">
            <div className="h-2 w-1/3 rounded-full bg-[#C8102E]" />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <OnboardingCard
            action="Legg til ditt første abonnement"
            description="Registrer navn, pris og neste trekk for en fast kostnad du allerede kjenner."
            href="/dashboard?start=manual"
            recommended
            title="1. Legg til abonnement"
          />
          <OnboardingCard
            action="Åpne oversikten"
            description="Når abonnementet ligger i oversikten, kan du markere det og velge hvordan det skal avsluttes."
            href="/dashboard#subscriptions"
            title="2. Velg hvordan du vil si opp"
          />
          <OnboardingCard
            action="Se oppfølging"
            description="Følg aktive oppsigelser, se hva som venter på svar og marker jobben som fullført."
            href="/dashboard#cancellations"
            title="3. Følg opp oppsigelsen"
          />
        </div>

        <div className="mt-6 rounded-2xl bg-white p-5 text-sm leading-6 text-[#5F6F82] shadow-sm ring-1 ring-[#DBE4EE]">
          <p className="font-extrabold text-[#0D1B2A]">Vil du finne flere automatisk?</p>
          <p className="mt-1">
            Du kan importere fra e-post når du ønsker det. Aboslutt foreslår mulige abonnementer,
            og du bekrefter selv hva som skal lagres.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
            href="/import/email"
          >
            Importer fra e-post
          </Link>
        </div>
      </section>
      <AppFooter compact />
    </main>
  );
}

function OnboardingCard({
  title,
  description,
  action,
  href,
  recommended = false,
}: {
  title: string;
  description: string;
  action: string;
  href: string;
  recommended?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${
        recommended ? "ring-[#C8102E]/40" : "ring-[#DBE4EE]"
      }`}
    >
      {recommended ? (
        <span className="rounded-full bg-[#F5E6E9] px-3 py-1 text-xs font-bold text-[#C8102E]">
          Anbefalt start
        </span>
      ) : null}
      <h2 className="mt-3 text-lg font-extrabold tracking-tight">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#5F6F82]">{description}</p>
      <Link
        className={`mt-5 inline-flex rounded-xl px-4 py-3 text-sm font-bold ${
          recommended
            ? "bg-[#C8102E] text-white hover:bg-[#a90d27]"
            : "border border-[#DBE4EE] text-[#0D1B2A] hover:border-[#C8102E]/50"
        }`}
        href={href}
      >
        {action}
      </Link>
    </article>
  );
}
