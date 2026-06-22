"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { billingPlans, type CheckoutPlanId } from "@/lib/billing/plans";
import { siteConfig } from "@/lib/site-config";

type PremiumUpgradeDialogProps = {
  open: boolean;
  onClose: () => void;
  reason?: string;
  defaultPlan?: CheckoutPlanId;
};

type PremiumUpgradePanelProps = {
  onClose?: () => void;
  reason?: string;
  defaultPlan?: CheckoutPlanId;
};

const premiumBenefits = [
  "Ubegrensede abonnementer i oversikten",
  "Automatisk Gmail- og e-postskanning",
  "E-postvarsler før kommende trekk",
  "Månedlig oppsummering",
  "Oppsigelsesassistent og leverandørveiledning",
];

export function PremiumUpgradeDialog({
  open,
  onClose,
  reason,
  defaultPlan = "premium_monthly",
}: PremiumUpgradeDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-[#0D1B2A]/60 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
      <div
        aria-labelledby="premium-upgrade-title"
        aria-modal="true"
        className="max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl sm:max-w-2xl"
        role="dialog"
      >
        <PremiumUpgradePanel defaultPlan={defaultPlan} onClose={onClose} reason={reason} />
      </div>
    </div>
  );
}

export function PremiumUpgradePanel({
  onClose,
  reason,
  defaultPlan = "premium_monthly",
}: PremiumUpgradePanelProps) {
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlanId>(defaultPlan);
  const plan = selectedPlan === "premium_monthly" ? billingPlans.premiumMonthly : billingPlans.premiumYearly;

  return (
    <section className="p-5 text-[#0D1B2A] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Premium</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight" id="premium-upgrade-title">
            {plan.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
            {reason ??
              "Premium passer når du vil automatisere mer av oversikten, få varsler og gjøre oppsigelser enklere."}
          </p>
        </div>
        {onClose ? (
          <button
            aria-label="Lukk Premium-informasjon"
            className="rounded-xl border border-[#DBE4EE] px-3 py-2 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
            onClick={onClose}
            type="button"
          >
            Lukk
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PlanChoice
          checked={selectedPlan === "premium_monthly"}
          description="Fleksibel månedlig betaling."
          label={billingPlans.premiumMonthly.name}
          onClick={() => setSelectedPlan("premium_monthly")}
          price={billingPlans.premiumMonthly.priceLabel}
        />
        <PlanChoice
          checked={selectedPlan === "premium_yearly"}
          description="Lavere månedspris gjennom året."
          label={billingPlans.premiumYearly.name}
          onClick={() => setSelectedPlan("premium_yearly")}
          price={billingPlans.premiumYearly.priceLabel}
        />
      </div>

      <div className="mt-5 rounded-2xl bg-[#F7F9FC] p-4 ring-1 ring-[#E6EDF5]">
        <h3 className="text-sm font-extrabold">Dette får du med Premium</h3>
        <ul className="mt-3 grid gap-2 text-sm font-semibold text-[#0D1B2A]">
          {premiumBenefits.map((benefit) => (
            <li className="flex gap-2" key={benefit}>
              <span className="text-[#C8102E]" aria-hidden="true">
                ✓
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <InfoItem label="Pris" value={plan.priceLabel} />
        <InfoItem label="Fornyelse" value="Fornyes automatisk med fast Vipps-trekk etter godkjenning." />
        <InfoItem label="Bindingstid" value="Ingen bindingstid." />
        <InfoItem
          label="Avslutning"
          value={`Du kan stoppe fast trekk fra innstillinger når betaling er aktivert, eller kontakte ${siteConfig.contactEmail}.`}
        />
      </dl>

      <div className="mt-5 rounded-2xl border border-[#DBE4EE] bg-white p-4 text-sm leading-6 text-[#5F6F82]">
        Premium aktiveres først når betalingen er bekreftet av Vipps. Oppsigelsen gjelder fra neste
        betalingsperiode, og du beholder tilgang ut perioden du allerede har betalt for.
      </div>

      <CheckoutButton
        label={`Fortsett med Vipps (${plan.priceLabel})`}
        plan={selectedPlan}
        surface="light"
      />

      <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold">
        <Link className="text-[#C8102E] hover:underline" href="/terms/sales">
          Salgsbetingelser
        </Link>
        <Link className="text-[#C8102E] hover:underline" href="/privacy">
          Personvern
        </Link>
      </div>
    </section>
  );
}

function PlanChoice({
  checked,
  description,
  label,
  onClick,
  price,
}: {
  checked: boolean;
  description: string;
  label: string;
  onClick: () => void;
  price: string;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 ${
        checked ? "border-[#C8102E] bg-[#FFF8F9]" : "border-[#DBE4EE] bg-white hover:border-[#C8102E]/40"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="block text-sm font-extrabold text-[#0D1B2A]">{label}</span>
      <span className="mt-2 block text-2xl font-black text-[#0D1B2A]">{price}</span>
      <span className="mt-1 block text-sm font-semibold text-[#5F6F82]">{description}</span>
    </button>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F7F9FC] p-4 ring-1 ring-[#E6EDF5]">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">{label}</dt>
      <dd className="mt-2 text-sm font-bold leading-6 text-[#0D1B2A]">{value}</dd>
    </div>
  );
}
