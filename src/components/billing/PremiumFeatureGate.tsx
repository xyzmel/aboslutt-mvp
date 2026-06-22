"use client";

import { useState } from "react";
import { PremiumUpgradeDialog } from "@/components/billing/PremiumUpgradeDialog";

type PremiumFeatureGateProps = {
  title: string;
  description: string;
  benefit: string;
  blockedAction?: string;
  currentUsage?: number | null;
  limit?: number | null;
  onClose?: () => void;
};

export function PremiumFeatureGate({
  title,
  description,
  benefit,
  blockedAction,
  currentUsage,
  limit,
  onClose,
}: PremiumFeatureGateProps) {
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const hasUsage = typeof currentUsage === "number" && typeof limit === "number";

  return (
    <section className="rounded-2xl border border-[#F3C3CC] bg-[#FFF8F9] p-5 text-sm text-[#0D1B2A]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">Premium-funksjon</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight">{title}</h2>
          <p className="mt-2 leading-6 text-[#5F6F82]">{description}</p>
        </div>
        {onClose ? (
          <button
            className="w-fit rounded-xl border border-[#F3C3CC] bg-white px-3 py-2 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
            onClick={onClose}
            type="button"
          >
            Lukk
          </button>
        ) : null}
      </div>

      {hasUsage ? (
        <p className="mt-4 rounded-xl bg-white px-4 py-3 font-bold text-[#0D1B2A] ring-1 ring-[#F3C3CC]">
          Du har brukt {currentUsage} av {limit} abonnementer i gratisplanen.
        </p>
      ) : null}

      {blockedAction ? (
        <p className="mt-3 font-semibold text-[#5F6F82]">{blockedAction}</p>
      ) : null}

      <p className="mt-3 font-semibold text-[#0D1B2A]">{benefit}</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
          onClick={() => setIsUpgradeOpen(true)}
          type="button"
        >
          Se Premium
        </button>
        {onClose ? (
          <button
            className="rounded-xl border border-[#DBE4EE] bg-white px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
            onClick={onClose}
            type="button"
          >
            Fortsett gratis
          </button>
        ) : null}
      </div>

      <PremiumUpgradeDialog
        onClose={() => setIsUpgradeOpen(false)}
        open={isUpgradeOpen}
        reason={benefit}
      />
    </section>
  );
}
