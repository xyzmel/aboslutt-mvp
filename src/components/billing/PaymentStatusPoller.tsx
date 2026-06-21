"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { trackFunnelEvent } from "@/lib/analytics";
import { siteConfig } from "@/lib/site-config";

type BillingStatus = "idle" | "pending" | "active" | "cancelled" | "expired" | "failed" | "none" | "timeout";

const maxAttempts = 20;
const pollIntervalMs = 3000;

export function PaymentStatusPoller() {
  const [status, setStatus] = useState<BillingStatus>("idle");
  const trackedFinalStatus = useRef<BillingStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attemptCount = 0;

    async function poll() {
      if (cancelled) {
        return;
      }

      attemptCount += 1;

      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" });
        const result = (await response.json().catch(() => ({}))) as { status?: BillingStatus };
        const nextStatus = normalizeStatus(result.status);

        if (cancelled) {
          return;
        }

        setStatus(nextStatus);

        if (isFinalStatus(nextStatus)) {
          return;
        }
      } catch {
        if (!cancelled) {
          setStatus("pending");
        }
      }

      if (!cancelled && attemptCount < maxAttempts) {
        timeoutId = setTimeout(poll, pollIntervalMs);
        return;
      }

      if (!cancelled) {
        setStatus("timeout");
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const content = useMemo(() => getStatusContent(status), [status]);

  useEffect(() => {
    if (trackedFinalStatus.current === status) {
      return;
    }

    if (status === "active") {
      trackedFinalStatus.current = status;
      trackFunnelEvent("premium_activated", { source: "payment_status_poll" });
    }

    if (status === "cancelled" || status === "expired" || status === "failed" || status === "none" || status === "timeout") {
      trackedFinalStatus.current = status;
      trackFunnelEvent("checkout_failed", { status });
    }
  }, [status]);

  return (
    <section className="rounded-2xl bg-[#F7F9FC] p-5 ring-1 ring-[#DBE4EE]" aria-live="polite">
      <p className={`text-sm font-bold uppercase tracking-wide ${content.tone}`}>{content.eyebrow}</p>
      <h2 className="mt-2 text-xl font-extrabold tracking-tight text-[#0D1B2A]">{content.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5F6F82]">{content.text}</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {status === "active" ? (
          <Link
            className="inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27]"
            href="/dashboard"
          >
            Gå til oversikt
          </Link>
        ) : null}
        {status === "cancelled" || status === "expired" || status === "failed" || status === "none" ? (
          <Link
            className="inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27]"
            href="/pricing"
          >
            Tilbake til priser
          </Link>
        ) : null}
        <Link
          className="inline-flex rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50"
          href="/settings"
        >
          Se betaling i innstillinger
        </Link>
      </div>
    </section>
  );
}

function normalizeStatus(status?: string): BillingStatus {
  if (
    status === "pending" ||
    status === "active" ||
    status === "cancelled" ||
    status === "expired" ||
    status === "failed" ||
    status === "none"
  ) {
    return status;
  }

  return "pending";
}

function isFinalStatus(status: BillingStatus) {
  return status === "active" || status === "cancelled" || status === "expired" || status === "failed" || status === "none";
}

function getStatusContent(status: BillingStatus) {
  if (status === "active") {
    return {
      eyebrow: "Bekreftet",
      title: "Premium er aktivert",
      text: "Vipps-betalingen er bekreftet, og Premium er aktivert på kontoen din.",
      tone: "text-emerald-700",
    };
  }

  if (status === "cancelled") {
    return {
      eyebrow: "Avbrutt",
      title: "Betalingen ble ikke fullført",
      text: `Vipps-avtalen er avbrutt eller kansellert. Ingen ny Premium-tilgang ble aktivert fra denne betalingen. Kontakt ${siteConfig.contactEmail} hvis du trenger hjelp.`,
      tone: "text-[#C8102E]",
    };
  }

  if (status === "expired") {
    return {
      eyebrow: "Utløpt",
      title: "Betalingen utløp",
      text: `Vipps-betalingen ble ikke godkjent innen fristen. Du kan prøve igjen fra prissiden eller kontakte ${siteConfig.contactEmail}.`,
      tone: "text-[#8A4B13]",
    };
  }

  if (status === "failed" || status === "none") {
    return {
      eyebrow: "Ikke fullført",
      title: "Betalingen kunne ikke bekreftes",
      text: `Vi fant ingen bekreftet betaling for denne økten. Premium aktiveres ikke fra denne siden. Kontakt ${siteConfig.contactEmail} hvis betalingen likevel er trukket.`,
      tone: "text-[#C8102E]",
    };
  }

  if (status === "timeout") {
    return {
      eyebrow: "Tar litt tid",
      title: "Vi venter fortsatt på Vipps",
      text: `Bekreftelsen kan bruke litt tid. Du kan gå til innstillinger eller oversikten og sjekke status senere. Kontakt ${siteConfig.contactEmail} hvis det ikke oppdateres.`,
      tone: "text-[#8A4B13]",
    };
  }

  return {
    eyebrow: "Behandler",
    title: "Bekrefter betalingen …",
    text: "Vi sjekker betalingsstatusen hos Vipps. Premium aktiveres først når Aboslutt har verifisert betalingen server-side.",
    tone: "text-[#C8102E]",
  };
}
