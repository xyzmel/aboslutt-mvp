"use client";

import { useState } from "react";
import type { CheckoutPlanId } from "@/lib/billing/plans";

export function CheckoutButton({ plan, label }: { plan: CheckoutPlanId; label: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function startCheckout() {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        redirectUrl?: string;
      };

      if (response.ok && result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }

      setMessage(getCheckoutErrorMessage(result.error));
    } catch {
      setMessage("Kunne ikke starte betaling akkurat nå. Prøv igjen.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        className="mt-6 w-full rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        onClick={startCheckout}
        type="button"
      >
        {isLoading ? "Sender deg til Vipps..." : label}
      </button>
      {message ? <p className="mt-2 text-xs font-semibold text-white/70">{message}</p> : null}
    </div>
  );
}

function getCheckoutErrorMessage(error?: string) {
  if (error === "UNAUTHORIZED") {
    return "Du må være logget inn for å starte Premium.";
  }

  if (error === "PAYMENTS_NOT_CONFIGURED") {
    return "Vipps-betaling er ikke ferdig konfigurert.";
  }

  if (error === "VIPPS_AGREEMENT_ERROR") {
    return "Vipps kunne ikke opprette betalingsavtalen. Prøv igjen.";
  }

  if (error === "VIPPS_TOKEN_ERROR") {
    return "Vipps kunne ikke kontaktes akkurat nå. Prøv igjen.";
  }

  return "Kunne ikke starte betaling akkurat nå. Prøv igjen.";
}
