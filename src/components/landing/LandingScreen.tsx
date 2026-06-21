"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

const featureSections = [
  {
    title: "Manuell oversikt",
    eyebrow: "Gratis å starte",
    description:
      "Legg inn abonnementene du allerede kjenner selv. Aboslutt gir deg en ryddig oversikt uten at du må koble til Gmail eller andre integrasjoner.",
    points: ["Opptil 10 abonnementer gratis", "Følg pris, dato og kategori", "Månedlig og årlig oversikt"],
  },
  {
    title: "Automatisk skanning",
    eyebrow: "Beta/premium",
    description:
      "Skann Gmail eller lim inn kvitteringer for å få forslag til abonnementer. Du redigerer og bekrefter alltid kandidaten før noe lagres.",
    points: ["Gmail- og e-postkvitteringer", "Bekreft før lagring", "Valgfri SaaS-funksjon"],
  },
  {
    title: "Varsler",
    eyebrow: "Beta/premium",
    description:
      "Få e-post før kommende trekk og en enkel månedlig oppsummering basert på abonnementene du selv har lagret.",
    points: ["Påminnelser før trekk", "Månedlig oppsummering", "Basert på lagrede abonnementer"],
  },
  {
    title: "Trygghet og personvern",
    eyebrow: "Du bestemmer",
    description:
      "Aboslutt bruker Gmail read-only for skanning og lagrer ikke rå e-postinnhold. Du kontrollerer hva som blir lagret.",
    points: ["Gmail read-only", "Rå e-post lagres ikke", "Slett data i innstillinger"],
  },
  {
    title: "Vipps Login",
    eyebrow: "Norsk innlogging",
    description: "Logg inn raskt med Vipps når du ønsker det. E-post/passord og Google fungerer fortsatt.",
    points: ["Fortsett med Vipps", "Samme Aboslutt-konto", "Rask inngang til oversikten"],
    vipps: true,
  },
  {
    title: "Oppsigelsesassistent",
    eyebrow: "Premium",
    description:
      "Få leverandørspesifikk veiledning, e-postutkast og oppfølging av oppsigelser. Du bekrefter selv når en oppsigelse faktisk er gjennomført.",
    points: ["Provider Directory", "Utkast med samtykke", "Tidslinje og oppfølging"],
  },
];

const plans = [
  {
    name: "Gratis",
    price: "0 kr",
    description: "For deg som vil starte med manuell abonnementskontroll.",
    features: ["Opptil 10 abonnementer", "Manuell oversikt", "Månedlig/årlig oversikt", "Grunnleggende dashboard"],
  },
  {
    name: "Premium månedlig",
    price: "79 kr/mnd",
    description: "For deg som vil automatisere oversikten.",
    features: ["Gmail-skanning", "E-postpåminnelser", "Månedlig oppsummering", "Oppsigelsesassistent"],
    highlighted: true,
  },
  {
    name: "Premium årlig",
    price: "499 kr/år",
    description: "For deg som vil ha Premium hele året.",
    features: ["Alt i Premium", "Årspris for lavere månedspris", "Vipps-betaling", "Automatisk aktivering"],
  },
];

type LandingScreenProps = {
  authConfig: {
    vippsConfigured: boolean;
  };
  user: {
    name: string | null;
    email: string | null;
    isAdmin: boolean;
  } | null;
};

export function LandingScreen({ authConfig, user }: LandingScreenProps) {
  const userLabel = user?.name ?? user?.email ?? "";

  return (
    <main className="flex min-h-screen flex-col bg-[#0D1B2A] text-white">
      <section className="relative overflow-hidden px-5 py-8 sm:py-10">
        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <PublicHeader />

          <div className="grid gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">
                Abonnementsoversikt i beta
              </p>
              <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
                Få kontroll på abonnementene dine
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/68">
                Aboslutt hjelper deg å holde oversikt manuelt først: legg inn abonnementer selv, følg kostnad,
                kategori og neste trekk. Automatisk Gmail- og e-postskanning er en valgfri beta-/SaaS-funksjon
                for deg som vil finne abonnementer raskere.
              </p>
              {user ? (
                <p className="mt-4 text-sm font-semibold text-white/70">
                  Du er logget inn som {userLabel}.
                </p>
              ) : null}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {user ? (
                  <>
                    <PrimaryLink href="/dashboard">Gå til oversikt</PrimaryLink>
                    <SecondaryLink href="/import/email">Importer e-post</SecondaryLink>
                  </>
                ) : (
                  <>
                    <PrimaryLink href="/register">Start gratis</PrimaryLink>
                    <SecondaryLink href="/login">Logg inn</SecondaryLink>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20">
              <div className="grid gap-3">
                <HeroSignal title="Manuell oversikt" text="Gratis å starte, opptil 10 abonnementer." />
                <HeroSignal title="Valgfri skanning" text="Gmail- og e-postforslag må bekreftes før lagring." />
                <HeroSignal title="Varsler" text="Beta/premium: e-post før trekk og månedlig oppsummering." />
                <HeroSignal
                  title="Vipps Login"
                  text={
                    authConfig.vippsConfigured
                      ? "Logg inn raskt med Vipps når du ønsker det."
                      : "Vipps aktiveres når innlogging er konfigurert."
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F0F4F8] px-5 py-14 text-[#0D1B2A]" id="produkt">
        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Produkt</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Start manuelt. Automatiser når du vil.</h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featureSections.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14" id="priser">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Priser</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Planer for beta</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                Manuell oversikt er gratis. Premium gir automatisk skanning, varsler, månedlige oppsummeringer
                og oppsigelsesassistent. Premium aktiveres automatisk når betalingen er bekreftet av Vipps.
              </p>
            </div>
            <Link className="text-sm font-bold text-white/70 hover:text-white" href="/pricing">
              Se alle planer
            </Link>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.name} {...plan} />
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="rounded-xl bg-[#C8102E] px-5 py-3.5 text-center text-sm font-bold text-white transition hover:bg-[#a90d27]" href={href}>
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="rounded-xl border border-white/15 px-5 py-3.5 text-center text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/[0.06]" href={href}>
      {children}
    </Link>
  );
}

function HeroSignal({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl bg-white p-4 text-[#0D1B2A]">
      <p className="text-sm font-extrabold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#5F6F82]">{text}</p>
    </div>
  );
}

function FeatureCard({
  title,
  eyebrow,
  description,
  points,
  vipps,
}: {
  title: string;
  eyebrow: string;
  description: string;
  points: string[];
  vipps?: boolean;
}) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">{eyebrow}</p>
        {vipps ? (
          <span className="rounded-full bg-[#FF5B24]/10 px-3 py-1 text-xs font-black text-[#FF5B24]">
            Vipps
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 text-xl font-extrabold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#5F6F82]">{description}</p>
      <ul className="mt-4 grid gap-2 text-sm font-semibold text-[#0D1B2A]">
        {points.map((point) => (
          <li key={point}>✓ {point}</li>
        ))}
      </ul>
    </article>
  );
}

function PlanCard({
  name,
  price,
  description,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <article className={`rounded-2xl p-5 ring-1 ${highlighted ? "bg-[#C8102E] text-white ring-[#C8102E]" : "bg-white/[0.06] text-white ring-white/10"}`}>
      <p className="text-sm font-semibold text-white/70">{name}</p>
      <p className="mt-3 text-3xl font-black">{price}</p>
      <p className="mt-2 min-h-12 text-sm leading-6 text-white/70">{description}</p>
      <ul className="mt-5 grid gap-2 text-sm font-semibold">
        {features.map((feature) => (
          <li key={feature}>✓ {feature}</li>
        ))}
      </ul>
    </article>
  );
}
