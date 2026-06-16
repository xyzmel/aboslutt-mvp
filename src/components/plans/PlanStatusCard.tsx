import Link from "next/link";
import { getPlanDisplayName, getPlanFeatures, getUserPlan, type Plan } from "@/lib/plans";

type PlanStatusCardProps = {
  plan: string | null | undefined;
  compact?: boolean;
};

export function PlanStatusCard({ plan, compact = false }: PlanStatusCardProps) {
  const normalizedPlan = getUserPlan({ plan });
  const features = getPlanFeatures(normalizedPlan);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Plan</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
            {getPlanDisplayName(normalizedPlan)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5F6F82]">{getPlanCtaText(normalizedPlan)}</p>
        </div>
        <PlanCta plan={normalizedPlan} />
      </div>

      {!compact ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FeatureList title="Inkludert" items={features.included} />
          <FeatureList title="Låst" items={features.locked} muted />
        </div>
      ) : null}
    </section>
  );
}

function PlanCta({ plan }: { plan: Plan }) {
  if (plan === "free") {
    return (
      <Link
        className="rounded-xl bg-[#C8102E] px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-[#a90d27]"
        href="/pricing#beta"
      >
        Be om beta-tilgang
      </Link>
    );
  }

  const label: Record<Plan, string> = {
    free: "Be om beta-tilgang",
    beta: "Du har beta-tilgang",
    premium: "Premium aktiv",
    admin: "Admin",
  };

  return (
    <span className="rounded-xl bg-[#F0F4F8] px-4 py-2.5 text-sm font-bold text-[#0D1B2A]">
      {label[plan]}
    </span>
  );
}

function FeatureList({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div className="rounded-xl bg-[#F7F9FC] p-4">
      <h3 className="text-sm font-extrabold text-[#0D1B2A]">{title}</h3>
      {items.length > 0 ? (
        <ul className={`mt-3 grid gap-2 text-sm font-semibold ${muted ? "text-[#5F6F82]" : "text-[#0D1B2A]"}`}>
          {items.map((item) => (
            <li key={item}>{muted ? "–" : "✓"} {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm font-semibold text-[#5F6F82]">Ingen låste kjernefunksjoner.</p>
      )}
    </div>
  );
}

function getPlanCtaText(plan: Plan) {
  if (plan === "free") {
    return "Manuell oversikt er gratis. Automatiske funksjoner kan åpnes med beta-tilgang.";
  }

  if (plan === "admin") {
    return "Admin har tilgang til alle funksjoner for testing og drift.";
  }

  return "Du har tilgang til automatiske beta-/SaaS-funksjoner.";
}
