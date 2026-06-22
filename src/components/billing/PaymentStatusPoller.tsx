"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useToast } from "@/components/ui/ToastProvider";
import { trackFunnelEvent } from "@/lib/analytics";
import { siteConfig } from "@/lib/site-config";

type BillingStatus = "idle" | "pending" | "active" | "cancelled" | "expired" | "failed" | "none" | "timeout";

type BillingStatusResponse = {
  ok?: boolean;
  status?: BillingStatus;
  plan?: string;
  verification?: "checked" | "unavailable";
};

const maxAttempts = 20;
const pollIntervalMs = 3000;

export function PaymentStatusPoller({ returnContext = "thanks" }: { returnContext?: "thanks" | "cancelled" }) {
  const router = useRouter();
  const { update } = useSession();
  const { showToast } = useToast();
  const [status, setStatus] = useState<BillingStatus>("idle");
  const [verification, setVerification] = useState<"checked" | "unavailable" | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const trackedFinalStatus = useRef<BillingStatus | null>(null);
  const refreshedEntitlements = useRef(false);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/billing/status", { cache: "no-store" });
    const result = (await response.json().catch(() => ({}))) as BillingStatusResponse;

    if (!response.ok || result.ok === false) {
      throw new Error("STATUS_UNAVAILABLE");
    }

    const nextStatus = normalizeStatus(result.status);
    setStatus(nextStatus);
    setVerification(result.verification ?? "checked");

    return nextStatus;
  }, []);

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
        const nextStatus = await refreshStatus();

        if (cancelled || isFinalStatus(nextStatus)) {
          return;
        }
      } catch {
        if (!cancelled) {
          setStatus("pending");
          setVerification("unavailable");
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
  }, [refreshStatus]);

  const content = useMemo(() => getStatusContent(status, returnContext, verification), [returnContext, status, verification]);

  useEffect(() => {
    if (status === "active" && !refreshedEntitlements.current) {
      refreshedEntitlements.current = true;
      update().catch(() => undefined);
      router.refresh();
    }
  }, [router, status, update]);

  useEffect(() => {
    if (trackedFinalStatus.current === status) {
      return;
    }

    if (status === "active") {
      trackedFinalStatus.current = status;
      trackFunnelEvent("premium_activated", { source: "payment_status_poll" });
      showToast({
        title: "Premium er aktivert",
        message: "Betalingen er bekreftet, og tilgangen er oppdatert.",
        tone: "success",
      });
    }

    if (status === "cancelled" || status === "expired" || status === "failed" || status === "none" || status === "timeout") {
      trackedFinalStatus.current = status;
      trackFunnelEvent(status === "cancelled" ? "checkout_cancelled" : "checkout_failed", { status });
      showToast({
        title: "Betaling ikke fullført",
        message: getStatusContent(status, returnContext, verification).title,
        tone: "error",
      });
    }
  }, [returnContext, showToast, status, verification]);

  async function handleRefresh() {
    setIsRefreshing(true);

    try {
      await refreshStatus();
    } catch {
      setStatus("pending");
      setVerification("unavailable");
      showToast({
        title: "Kunne ikke oppdatere status",
        message: "Prøv igjen om litt, eller sjekk betalingsstatus i innstillinger.",
        tone: "error",
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  const showRetry = status === "cancelled" || status === "expired" || status === "failed" || status === "none";
  const showRefresh = status === "pending" || status === "idle" || status === "timeout";

  return (
    <section className="rounded-2xl bg-[#F7F9FC] p-5 ring-1 ring-[#DBE4EE]" aria-live="polite">
      <p className={`text-sm font-bold uppercase tracking-wide ${content.tone}`}>{content.eyebrow}</p>
      <h2 className="mt-2 text-xl font-extrabold tracking-tight text-[#0D1B2A]">{content.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5F6F82]">{content.text}</p>

      {verification === "unavailable" && (status === "pending" || status === "timeout") ? (
        <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#8A4B13] ring-1 ring-[#F0D8B8]">
          Vi fikk ikke kontakt med betalingsstatus akkurat nå. Premium aktiveres ikke før betalingen er bekreftet.
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {status === "active" ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
            href="/dashboard"
          >
            Gå til oversikt
          </Link>
        ) : null}

        {showRetry ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
            href="/pricing"
          >
            Prøv igjen
          </Link>
        ) : null}

        {showRefresh ? (
          <LoadingButton isLoading={isRefreshing} loadingLabel="Oppdaterer..." onClick={handleRefresh} type="button">
            Oppdater status
          </LoadingButton>
        ) : null}

        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
          href="/dashboard"
        >
          Til oversikt
        </Link>

        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
          href="/settings"
        >
          Se betaling
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

function getStatusContent(
  status: BillingStatus,
  returnContext: "thanks" | "cancelled",
  verification: "checked" | "unavailable" | null,
) {
  if (status === "active") {
    return {
      eyebrow: "Bekreftet",
      title: "Premium er aktivert",
      text: "Vipps-betalingen er bekreftet, og Premium er aktivert på kontoen din. Tilgangen oppdateres automatisk.",
      tone: "text-emerald-700",
    };
  }

  if (status === "cancelled") {
    return {
      eyebrow: "Avbrutt",
      title: "Betalingen ble avbrutt",
      text: "Vipps-godkjenningen ble avbrutt eller kansellert. Ingen betaling ble fullført, og Premium ble ikke aktivert fra dette forsøket.",
      tone: "text-[#C8102E]",
    };
  }

  if (status === "expired") {
    return {
      eyebrow: "Utløpt",
      title: "Betalingen utløp",
      text: `Vipps-godkjenningen ble ikke fullført innen fristen. Du kan prøve igjen fra prissiden eller kontakte ${siteConfig.contactEmail}.`,
      tone: "text-[#8A4B13]",
    };
  }

  if (status === "failed" || status === "none") {
    return {
      eyebrow: "Ikke fullført",
      title: "Betalingen kunne ikke bekreftes",
      text: `Vi finner ingen bekreftet betaling for dette forsøket. Premium aktiveres ikke før betalingen er bekreftet. Kontakt ${siteConfig.contactEmail} hvis du mener betalingen er trukket.`,
      tone: "text-[#C8102E]",
    };
  }

  if (status === "timeout") {
    return {
      eyebrow: "Tar litt tid",
      title: "Vi venter fortsatt på Vipps",
      text: `Bekreftelsen kan bruke litt tid. Oppdater status her, eller sjekk betaling i innstillinger senere. Kontakt ${siteConfig.contactEmail} hvis status ikke endrer seg.`,
      tone: "text-[#8A4B13]",
    };
  }

  const pendingTitle = returnContext === "cancelled" ? "Sjekker om betalingen ble avbrutt" : "Bekrefter betalingen ...";
  const pendingText =
    verification === "unavailable"
      ? "Vi prøver å hente bekreftet status. Premium aktiveres ikke før betalingen er bekreftet."
      : "Vi sjekker betalingsstatusen. Premium aktiveres først når betalingen er bekreftet hos Vipps.";

  return {
    eyebrow: "Behandler",
    title: pendingTitle,
    text: pendingText,
    tone: "text-[#C8102E]",
  };
}
