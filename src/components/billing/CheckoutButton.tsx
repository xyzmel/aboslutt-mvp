"use client";

import { useState } from "react";
import type { CheckoutPlanId } from "@/lib/billing/plans";

export function CheckoutButton({
  plan,
  paymentsConfigured,
}: {
  plan: CheckoutPlanId;
  paymentsConfigured: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function startCheckout() {
    if (!paymentsConfigured) {
      setMessage("Betaling er ikke aktivert ennå.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        redirectUrl?: string;
      };

      if (response.ok && result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }

      setMessage(result.message ?? "Betaling er ikke aktivert ennå.");
    } catch {
      setMessage("Kunne ikke starte betaling akkurat nå.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        className="mt-6 w-full rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading || !paymentsConfigured}
        onClick={startCheckout}
        type="button"
      >
        {paymentsConfigured ? (isLoading ? "Starter betaling..." : "Start checkout") : "Betaling kommer snart"}
      </button>
      {message ? <p className="mt-2 text-xs font-semibold text-white/70">{message}</p> : null}
    </div>
  );
}
