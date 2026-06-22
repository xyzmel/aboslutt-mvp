import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { FunnelEvent } from "@/components/analytics/FunnelEvent";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { authOptions } from "@/lib/auth";
import { billingPlans } from "@/lib/billing/plans";
import { siteConfig } from "@/lib/site-config";

const valuePoints = [
  "Start gratis med manuell oversikt",
  "Ingen bindingstid",
  "Avslutt når du vil",
  "Premium aktiveres når Vipps bekrefter betalingen",
];

export const metadata: Metadata = {
  title: "Premium",
  description:
    "Start gratis med manuell abonnementskontroll, eller oppgrader til Aboslutt Premium med Vipps.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Priser",
    description: "Gratis oversikt og Premium-planer for automatisk skanning, varsler og oppsigelseshjelp.",
    url: "https://www.aboslutt.no/pricing",
  },
};

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user ? { email: session.user.email ?? null } : null;

  return (
    <main className="flex min-h-screen flex-col bg-[#0D1B2A] text-white">
      <FunnelEvent event="pricing_viewed" />
      <PublicHeader />

      <section className="px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Priser</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Velg oversikten som passer deg.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
                Kom i gang gratis med manuell abonnementskontroll. Oppgrader til Premium når du vil ha automatisk
                skanning, varsler, månedlig oppsummering og enklere oppsigelser.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {user ? (
                  <PrimaryLink href="/dashboard">Gå til oversikt</PrimaryLink>
                ) : (
                  <PrimaryLink href="/register">Start gratis</PrimaryLink>
                )}
                <SecondaryLink href="/terms/sales">Se salgsbetingelser</SecondaryLink>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <p className="text-sm font-extrabold text-white">Trygt å komme i gang</p>
              <div className="mt-4 grid gap-3">
                {valuePoints.map((point) => (
                  <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3" key={point}>
                    <span className="text-sm font-black text-[#C8102E]">✓</span>
                    <p className="text-sm font-semibold text-white/78">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <PlanCard
              description="For deg som vil samle abonnementene manuelt og få kontroll uten å koble til Gmail."
              features={[...billingPlans.free.features, "Ingen Gmail kreves"]}
              name={billingPlans.free.name}
              price={billingPlans.free.priceLabel}
            >
              <Link
                className="mt-6 block rounded-xl bg-white px-5 py-3 text-center text-sm font-bold text-[#0D1B2A] transition hover:bg-white/90"
                href={user ? "/dashboard" : "/register"}
              >
                Start gratis
              </Link>
            </PlanCard>

            <PlanCard
              description="For deg som vil automatisere oversikten og få hjelp før kostnadene løper videre."
              features={[...billingPlans.premiumMonthly.features]}
              highlighted
              name={billingPlans.premiumMonthly.name}
              price={billingPlans.premiumMonthly.priceLabel}
            >
              <CheckoutButton label="Start Premium månedlig med Vipps" plan="premium_monthly" />
            </PlanCard>

            <PlanCard
              badge="Best verdi"
              description="For deg som vil bruke Premium gjennom året og betale mindre per måned."
              features={[...billingPlans.premiumYearly.features, "Spar 449 kr mot månedlig pris"]}
              name={billingPlans.premiumYearly.name}
              price={billingPlans.premiumYearly.priceLabel}
            >
              <CheckoutButton label="Start Premium årlig med Vipps" plan="premium_yearly" />
            </PlanCard>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm font-semibold leading-6 text-white/78">
            <p>Premium aktiveres automatisk når betalingen er bekreftet av Vipps.</p>
            <p className="mt-1">
              Ingen bindingstid. Fast trekk kan stoppes ved å kontakte{" "}
              <a
                className="text-white underline decoration-white/35 underline-offset-4 hover:decoration-white"
                href={`mailto:${siteConfig.contactEmail}`}
              >
                {siteConfig.contactEmail}
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 text-[#0D1B2A]">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          <InfoPanel
            title="Gratis er en sterk start"
            text="Legg inn abonnementene du kjenner, se kostnadene og få kontroll uten å betale først."
          />
          <InfoPanel
            title="Premium sparer tid"
            text="Automatisk skanning og varsler hjelper deg å oppdage faste trekk før de blir glemt."
          />
          <InfoPanel
            title="Vipps håndterer betaling"
            text="Betalingen skjer trygt med Vipps. Aboslutt aktiverer Premium først etter bekreftet betaling."
          />
        </div>
      </section>

      <PublicFooter />
    </main>
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
  badge,
  children,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <article
      className={`rounded-2xl p-6 ring-1 ${
        highlighted ? "bg-[#C8102E] text-white ring-[#C8102E]" : "bg-white/[0.06] text-white ring-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white/70">{name}</p>
        {badge ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{badge}</span> : null}
      </div>
      <p className="mt-3 text-3xl font-black">{price}</p>
      <p className="mt-3 min-h-20 text-sm leading-6 text-white/70">{description}</p>
      <ul className="mt-6 grid gap-2 text-sm font-semibold">
        {features.map((feature) => (
          <li key={feature}>✓ {feature}</li>
        ))}
      </ul>
      {children}
    </article>
  );
}

function InfoPanel({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-2xl bg-[#F0F4F8] p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#5F6F82]">{text}</p>
    </article>
  );
}
