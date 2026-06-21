"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

const proofPoints = [
  { label: "Manuell start", value: "0 kr" },
  { label: "Premium fra", value: "79 kr/mnd" },
  { label: "Bindingstid", value: "Ingen" },
];

const reasons = [
  {
    title: "Se hvor pengene går",
    text: "Samle abonnementene dine på ett sted og få et roligere bilde av faste kostnader.",
  },
  {
    title: "Unngå overraskelser",
    text: "Hold oversikt over kommende trekk, pris og status før neste faktura dukker opp.",
  },
  {
    title: "Kutt det du ikke trenger",
    text: "Finn tjenester du har glemt, og bruk oppsigelseshjelp når du vil rydde opp.",
  },
];

const steps = [
  {
    title: "Legg inn abonnementene dine",
    text: "Start manuelt med tjenestene du allerede kjenner. Du trenger ikke koble til Gmail for å få oversikt.",
  },
  {
    title: "Få oversikt over kostnader og trekk",
    text: "Se månedlig total, kategori, status og neste betalingsdato i et ryddig dashboard.",
  },
  {
    title: "Oppgrader når du vil automatisere",
    text: "Premium gir automatisk skanning, varsler, månedlig oppsummering og oppsigelseshjelp.",
  },
];

const premiumFeatures = [
  "Automatisk skanning av Gmail- og e-postkvitteringer",
  "Varsler før kommende trekk",
  "Månedlig oppsummering",
  "Oppsigelsesassistent med utkast og veiledning",
];

const audiences = [
  "Deg som har mistet oversikten over små faste trekk",
  "Familier som deler strømmetjenester, apper og medlemskap",
  "Studenter og unge voksne som vil ha kontroll på månedsbudsjettet",
  "Alle som vil rydde før neste betalingsperiode",
];

type LandingScreenProps = {
  user: {
    name: string | null;
    email: string | null;
    isAdmin: boolean;
  } | null;
};

export function LandingScreen({ user }: LandingScreenProps) {
  const userLabel = user?.name ?? user?.email ?? "";

  return (
    <main className="flex min-h-screen flex-col bg-[#0D1B2A] text-white">
      <section className="px-5 pb-16 pt-6">
        <div className="mx-auto w-full max-w-6xl">
          <PublicHeader />

          <div className="grid gap-10 py-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">
                Abonnementskontroll for hverdagen
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
                Få kontroll på abonnementene dine.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72">
                Oppdag hva du betaler for. Kutt det du ikke trenger. Hold oversikten på ett sted med manuell
                sporing, varsler og smartere Premium-funksjoner når du vil automatisere.
              </p>
              {user ? (
                <p className="mt-4 text-sm font-semibold text-white/68">
                  Du er logget inn som {userLabel}.
                </p>
              ) : null}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {user ? (
                  <>
                    <PrimaryLink href="/dashboard">Gå til oversikt</PrimaryLink>
                    <SecondaryLink href="/pricing">Se priser</SecondaryLink>
                  </>
                ) : (
                  <>
                    <PrimaryLink href="/register">Start gratis</PrimaryLink>
                    <SecondaryLink href="/pricing">Se priser</SecondaryLink>
                  </>
                )}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {proofPoints.map((point) => (
                  <div className="border-l border-white/14 pl-4" key={point.label}>
                    <p className="text-2xl font-black">{point.value}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/48">{point.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <HeroDashboard />
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 text-[#0D1B2A]" id="produkt">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <SectionIntro
            eyebrow="Hvorfor Aboslutt?"
            title="Mindre pengesløsing. Færre overraskelser."
            text="Aboslutt er laget for én enkel jobb: gi deg kontroll over faste trekk før de blir en vane du ikke ser."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {reasons.map((reason) => (
              <article className="rounded-2xl bg-[#F0F4F8] p-5 ring-1 ring-[#DBE4EE]" key={reason.title}>
                <h3 className="text-lg font-extrabold tracking-tight">{reason.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5F6F82]">{reason.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F0F4F8] px-5 py-16 text-[#0D1B2A]">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Slik fungerer det"
            title="Start enkelt. Bygg bedre oversikt underveis."
            text="Du kan bruke Aboslutt manuelt fra første minutt, og legge til automatisering når du vil spare mer tid."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#DBE4EE]" key={step.title}>
                <p className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C8102E] text-sm font-black text-white">
                  {index + 1}
                </p>
                <h3 className="mt-5 text-xl font-extrabold tracking-tight">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5F6F82]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionIntro
            eyebrow="Hva får du med Premium?"
            title="Automatisering for deg som vil rydde raskere."
            text="Premium er for deg som vil bruke Aboslutt mer aktivt: finne abonnementer raskere, få varsler og gjøre oppsigelser enklere."
            dark
          />
          <div className="rounded-2xl bg-white p-6 text-[#0D1B2A] shadow-2xl shadow-black/20">
            <div className="grid gap-3">
              {premiumFeatures.map((feature) => (
                <div className="flex items-start gap-3 rounded-xl bg-[#F7F9FC] p-4" key={feature}>
                  <span className="mt-0.5 text-sm font-black text-[#C8102E]">✓</span>
                  <p className="text-sm font-semibold leading-6">{feature}</p>
                </div>
              ))}
            </div>
            <Link
              className="mt-6 inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27]"
              href="/pricing"
            >
              Se Premium-planer
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 text-[#0D1B2A]">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <SectionIntro
            eyebrow="Hvem passer det for?"
            title="For alle som vil ha bedre kontroll på faste trekk."
            text="Aboslutt fungerer like godt om du vil legge inn alt manuelt, eller bruke Premium for å finne mer automatisk."
          />
          <div className="grid gap-3 md:grid-cols-2">
            {audiences.map((audience) => (
              <div className="rounded-xl border border-[#DBE4EE] bg-white p-4 text-sm font-semibold" key={audience}>
                {audience}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16" id="priser">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 text-[#0D1B2A] shadow-2xl shadow-black/20 lg:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionIntro
              eyebrow="Priser"
              title="Start gratis. Oppgrader når du vil."
              text="Manuell oversikt er gratis. Premium gir skanning, varsler, oppsummering og oppsigelseshjelp."
            />
            <Link className="text-sm font-bold text-[#C8102E] hover:underline" href="/pricing">
              Se full prisside
            </Link>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <PlanCard
              description="For deg som vil komme i gang med manuell oversikt."
              features={["Opptil 10 abonnementer", "Kostnader og neste trekk", "Grunnleggende dashboard"]}
              name="Gratis"
              price="0 kr"
            />
            <PlanCard
              description="For deg som vil automatisere oversikten måned for måned."
              features={["Automatisk skanning", "Varsler", "Månedlig oppsummering", "Oppsigelseshjelp"]}
              highlighted
              name="Premium månedlig"
              price="79 kr/mnd"
            />
            <PlanCard
              description="Best verdi for deg som vil bruke Premium gjennom året."
              features={["Alt i Premium", "Lavere månedspris", "Ingen bindingstid", "Betaling med Vipps"]}
              name="Premium årlig"
              price="499 kr/år"
            />
          </div>
          <p className="mt-6 text-sm font-semibold text-[#5F6F82]">
            Ingen bindingstid. Premium aktiveres når betalingen er bekreftet av Vipps.
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function HeroDashboard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/25">
      <div className="rounded-xl bg-white p-5 text-[#0D1B2A]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">Din måned</p>
            <p className="mt-2 text-3xl font-black">1 247 kr</p>
          </div>
          <span className="rounded-full bg-[#F0F4F8] px-3 py-1 text-xs font-bold text-[#5F6F82]">12 aktive</span>
        </div>
        <div className="mt-6 grid gap-3">
          <HeroSubscription name="Strømming" price="349 kr" width="w-10/12" />
          <HeroSubscription name="Apper og verktøy" price="288 kr" width="w-8/12" />
          <HeroSubscription name="Trening og helse" price="229 kr" width="w-6/12" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#C8102E] p-4">
          <p className="text-sm font-extrabold">Neste trekk</p>
          <p className="mt-1 text-sm text-white/75">3 tjenester denne uken</p>
        </div>
        <div className="rounded-xl bg-white/[0.08] p-4">
          <p className="text-sm font-extrabold">Mulig kutt</p>
          <p className="mt-1 text-sm text-white/70">Finn det du ikke bruker</p>
        </div>
      </div>
    </div>
  );
}

function HeroSubscription({ name, price, width }: { name: string; price: string; width: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-bold">{name}</p>
        <p className="font-black">{price}</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[#DBE4EE]">
        <div className={`h-2 rounded-full bg-[#C8102E] ${width}`} />
      </div>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  text,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  text: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-extrabold tracking-tight ${dark ? "text-white" : "text-[#0D1B2A]"}`}>
        {title}
      </h2>
      <p className={`mt-3 text-sm leading-6 ${dark ? "text-white/68" : "text-[#5F6F82]"}`}>{text}</p>
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="rounded-xl bg-[#C8102E] px-5 py-3.5 text-center text-sm font-bold text-white transition hover:bg-[#a90d27]"
      href={href}
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="rounded-xl border border-white/15 px-5 py-3.5 text-center text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/[0.06]"
      href={href}
    >
      {children}
    </Link>
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
    <article
      className={`rounded-2xl p-5 ring-1 ${
        highlighted ? "bg-[#C8102E] text-white ring-[#C8102E]" : "bg-[#F7F9FC] text-[#0D1B2A] ring-[#DBE4EE]"
      }`}
    >
      <p className={`text-sm font-semibold ${highlighted ? "text-white/75" : "text-[#5F6F82]"}`}>{name}</p>
      <p className="mt-3 text-3xl font-black">{price}</p>
      <p className={`mt-3 min-h-16 text-sm leading-6 ${highlighted ? "text-white/75" : "text-[#5F6F82]"}`}>
        {description}
      </p>
      <ul className="mt-5 grid gap-2 text-sm font-semibold">
        {features.map((feature) => (
          <li key={feature}>✓ {feature}</li>
        ))}
      </ul>
    </article>
  );
}
