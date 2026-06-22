"use client";

import { useState } from "react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useToast } from "@/components/ui/ToastProvider";
import { trackFunnelEvent } from "@/lib/analytics";
import type { CheckoutPlanId } from "@/lib/billing/plans";
import { siteConfig } from "@/lib/site-config";

export function CheckoutButton({
  plan,
  label,
  surface = "dark",
}: {
  plan: CheckoutPlanId;
  label: string;
  surface?: "dark" | "light";
}) {
  const { showToast } = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function startCheckout() {
    setIsLoading(true);
    setMessage(null);
    trackFunnelEvent("checkout_started", { plan });

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirectUrl?: string;
      };

      if (response.ok && result.redirectUrl) {
        trackFunnelEvent("vipps_redirect_started", { plan });
        window.location.href = result.redirectUrl;
        return;
      }

      trackFunnelEvent("checkout_failed", { plan, reason: result.error ?? "unknown" });
      const errorMessage = getCheckoutErrorMessage(result.error);
      setMessage(errorMessage);
      showToast({
        title: "Betaling kunne ikke startes",
        message: errorMessage,
        tone: "error",
        actionLabel: "Prøv igjen",
        onAction: startCheckout,
      });
    } catch {
      trackFunnelEvent("checkout_failed", { plan, reason: "network" });
      const errorMessage = `Kunne ikke starte betaling akkurat nå. Prøv igjen eller kontakt ${siteConfig.contactEmail}.`;
      setMessage(errorMessage);
      showToast({
        title: "Nettverksfeil",
        message: errorMessage,
        tone: "error",
        actionLabel: "Prøv igjen",
        onAction: startCheckout,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <LoadingButton
        className="mt-6 w-full"
        isLoading={isLoading}
        loadingLabel="Sender deg til Vipps..."
        onClick={startCheckout}
        type="button"
      >
        {label}
      </LoadingButton>
      {message ? (
        <p className={`mt-2 text-xs font-semibold ${surface === "dark" ? "text-white/70" : "text-[#C8102E]"}`}>
          {message}
        </p>
      ) : null}
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

  return `Kunne ikke starte betaling akkurat nå. Prøv igjen eller kontakt ${siteConfig.contactEmail}.`;
}
