"use client";

import { Dispatch, FormEvent, MouseEvent, ReactNode, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { PremiumFeatureGate } from "@/components/billing/PremiumFeatureGate";
import { PremiumUpgradeDialog } from "@/components/billing/PremiumUpgradeDialog";
import { ProviderCombobox, type ProviderOption } from "@/components/subscriptions/ProviderCombobox";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { AuthPageHeader } from "@/components/ui/AuthPageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { trackFunnelEvent } from "@/lib/analytics";
import type { EmailSubscriptionCandidate } from "@/lib/email-subscription-parser";
import type { EnrichedImportCandidate } from "@/lib/import-candidates";
import {
  getOutlookDisplayState,
  shouldApplyConnectionResponse,
} from "@/lib/outlook-provider-state.mjs";
import { formatNextPaymentDate, normalizeDateInputValue } from "@/lib/subscription-date";
import type { BillingInterval, SubscriptionCategory } from "@/types/subscription";
import { getProviderInitials } from "@/lib/subscription-provider-catalog.mjs";

type MicrosoftImportState =
  | "loading"
  | "not_connected"
  | "connecting"
  | "connected"
  | "scanning"
  | "scan_failed"
  | "error"
  | "no_candidates"
  | "review_results"
  | "disconnected"
  | "expired"
  | "unavailable";

type OutlookDisplayState =
  | "loading"
  | "disconnected"
  | "connecting"
  | "connected"
  | "scanning"
  | "expired"
  | "unavailable"
  | "error";

type CandidateDraft = {
  providerId: string | null;
  merchantName: string;
  amount: string;
  category: SubscriptionCategory;
  billingInterval: BillingInterval;
  nextPayment: string;
};

type PremiumGateState = {
  title: string;
  description: string;
  benefit: string;
  blockedAction?: string;
  currentUsage?: number | null;
  limit?: number | null;
};

type ProviderStatus = OutlookDisplayState;
type ProviderSectionState = "loading" | "ready" | "error";

type OutlookCandidate = {
  id: string;
  providerName: string;
  senderDomain: string | null;
  subject: string;
  receivedDate: string | null;
  amount: number | null;
  currency: string | null;
  billingInterval: "monthly" | "yearly" | "unknown";
  confidence: "high" | "medium" | "low";
  reasons: string[];
  grouped: boolean;
  relatedMessageCount: number;
  providerId: string | null;
  canonicalProviderName: string | null;
  originalDetectedName: string | null;
  providerLogoPath: string | null;
  suggestedCategory: string | null;
  providerMatchConfidence: "high" | "medium" | null;
  likelyDuplicate: boolean;
  duplicateMessage: string | null;
};

type OutlookCandidateDraft = {
  providerId: string | null;
  name: string;
  price: string;
  currency: string;
  billingInterval: string;
  nextPayment: string;
  category: string;
};

const categoryLabels: Record<EmailSubscriptionCandidate["category"], string> = {
  streaming: "Streaming",
  software: "Programvare",
  news: "Nyheter",
  health: "Helse",
};

const intervalLabels: Record<EmailSubscriptionCandidate["billingInterval"], string> = {
  monthly: "Månedlig",
  yearly: "Årlig",
  trial: "Prøveperiode",
  unknown: "Ukjent intervall",
};

export default function EmailImportPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [emailText, setEmailText] = useState("");
  const [candidates, setCandidates] = useState<EmailSubscriptionCandidate[]>([]);
  const [hiddenCandidateKeys, setHiddenCandidateKeys] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isScanningGmail, setIsScanningGmail] = useState(false);
  const [scannedMessages, setScannedMessages] = useState<number | null>(null);
  const [savedCandidateName, setSavedCandidateName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailScopeConnected, setGmailScopeConnected] = useState(false);
  const [googleMailConnectEnabled, setGoogleMailConnectEnabled] = useState(false);
  const [gmailScanAvailable, setGmailScanAvailable] = useState(true);
  const [providerSectionState, setProviderSectionState] = useState<ProviderSectionState>("loading");
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [microsoftConfigured, setMicrosoftConfigured] = useState(false);
  const [microsoftEmail, setMicrosoftEmail] = useState<string | null>(null);
  const [microsoftImportState, setMicrosoftImportState] = useState<MicrosoftImportState>("loading");
  const [microsoftMessage, setMicrosoftMessage] = useState<string | null>(null);
  const [microsoftMessagesChecked, setMicrosoftMessagesChecked] = useState<number | null>(null);
  const [microsoftCandidates, setMicrosoftCandidates] = useState<OutlookCandidate[]>([]);
  const [microsoftScanId, setMicrosoftScanId] = useState<string | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<EmailSubscriptionCandidate | null>(null);
  const [candidateDraft, setCandidateDraft] = useState<CandidateDraft | null>(null);
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);
  const [reportingCandidate, setReportingCandidate] = useState<EmailSubscriptionCandidate | null>(null);
  const [premiumGate, setPremiumGate] = useState<PremiumGateState | null>(null);
  const [premiumDialogReason, setPremiumDialogReason] = useState<string | null>(null);
  const lastToastKeyRef = useRef<string | null>(null);
  const connectionRequestIdRef = useRef(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/import/email");
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    const requestId = connectionRequestIdRef.current + 1;
    connectionRequestIdRef.current = requestId;
    const abortController = new AbortController();
    async function loadConnectionStatus() {
      setProviderSectionState("loading");
      const response = await fetch("/api/connections", { cache: "no-store", signal: abortController.signal });
      if (!response.ok) {
        if (shouldApplyConnectionResponse(requestId, connectionRequestIdRef.current)) {
          setMicrosoftImportState("error");
          setProviderSectionState("error");
        }
        return;
      }
      const result = (await response.json()) as {
        googleConnected: boolean;
        gmailScopeConnected: boolean;
        googleMailConnectEnabled?: boolean;
        gmailScanAvailable?: boolean;
        microsoftConnected?: boolean;
        microsoftConfigured?: boolean;
        microsoftEmail?: string | null;
        microsoftExpired?: boolean;
        microsoftStatus?: ProviderStatus;
      };
      if (!shouldApplyConnectionResponse(requestId, connectionRequestIdRef.current)) {
        return;
      }

      setGmailConnected(result.googleConnected);
      setGmailScopeConnected(result.gmailScopeConnected);
      setGoogleMailConnectEnabled(Boolean(result.googleMailConnectEnabled));
      setGmailScanAvailable(result.gmailScanAvailable ?? true);
      if (result.gmailScopeConnected) {
        trackFunnelEvent("email_provider_connected", { provider: "gmail", result: "success" });
      }
      setMicrosoftConnected(Boolean(result.microsoftConnected));
      setMicrosoftConfigured(Boolean(result.microsoftConfigured));
      setMicrosoftEmail(sanitizeDisplayEmail(result.microsoftEmail));
      setMicrosoftMessage(null);
      const microsoftExpired = Boolean(result.microsoftExpired);
      if (microsoftExpired) {
        setMicrosoftConnected(false);
        setMicrosoftImportState("expired");
        setMicrosoftEmail(null);
        setMicrosoftMessage("Tilkoblingen til Outlook har utløpt.");
      }
      const microsoft = searchParams.get("microsoft");

      if (microsoft === "connected") {
        if (result.microsoftConnected && !microsoftExpired) {
          setMicrosoftConnected(true);
          setMicrosoftImportState("connected");
          setMicrosoftMessage("Outlook er koblet til og klar for skanning.");
          trackFunnelEvent("email_provider_connected", { provider: "outlook", result: "success" });
        }
        setProviderSectionState("ready");
        return;
      }

      if (microsoft) {
        setMicrosoftImportState(microsoft === "expired" ? "expired" : microsoft === "cancelled" ? "not_connected" : "scan_failed");
        setMicrosoftMessage(getMicrosoftConnectionMessage(microsoft));
        setProviderSectionState("ready");
        return;
      }

      if (!microsoftExpired) {
        setMicrosoftImportState(result.microsoftConnected ? "connected" : "not_connected");
      }
      setProviderSectionState("ready");
    }

    loadConnectionStatus().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (shouldApplyConnectionResponse(requestId, connectionRequestIdRef.current)) {
        setMicrosoftImportState("error");
        setProviderSectionState("error");
      }
    });

    return () => {
      abortController.abort();
    };
  }, [router, searchParams, showToast, status]);

  const visibleCandidates = useMemo(
    () => candidates.filter((candidate) => !hiddenCandidateKeys.includes(getCandidateKey(candidate))),
    [candidates, hiddenCandidateKeys],
  );
  const likelyCandidates = visibleCandidates.filter((candidate) => getConfidenceScore(candidate) >= 75);
  const possibleCandidates = visibleCandidates.filter(
    (candidate) => getConfidenceScore(candidate) >= 50 && getConfidenceScore(candidate) < 75,
  );

  async function parseEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsParsing(true);
    resetResults();
    trackFunnelEvent("email_scan_started", { route: "/import/email", source: "manual_paste" });

    try {
      const response = await fetch("/api/import/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailText }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? result.error ?? "Kunne ikke lese e-posten.");
      }

      setCandidates(result.candidates);
      trackFunnelEvent("email_scan_completed", {
        result: "success",
        route: "/import/email",
        source: "manual_paste",
        candidate_count: result.candidates.length,
      });

      if (result.candidates.length === 0) {
        const message = "Fant ingen sikre abonnementer. Prøv å lime inn en kvittering eller legg til manuelt.";
        setErrorMessage(message);
        showToast({ title: "Ingen funn", message, tone: "info" });
      } else {
        trackFunnelEvent("import_candidates_found", {
          route: "/import/email",
          source: "manual_paste",
          candidate_count: result.candidates.length,
        });
        showToast({
          title: "Forslag funnet",
          message: `${result.candidates.length} mulige abonnementer er klare for gjennomgang.`,
          tone: "success",
        });
      }
    } catch {
      setCandidates([]);
      trackFunnelEvent("email_scan_failed", {
        result: "failed",
        route: "/import/email",
        source: "manual_paste",
        error_category: "manual_import",
      });
      const message = "Kunne ikke lese e-posten akkurat nå.";
      setErrorMessage(message);
      showToast({ title: "Import feilet", message, tone: "error" });
    } finally {
      setIsParsing(false);
    }
  }

  async function scanGmail() {
    setIsScanningGmail(true);
    resetResults();
    trackFunnelEvent("email_scan_started", { provider: "gmail", route: "/import/email" });

    try {
      const response = await fetch("/api/import/gmail", { method: "POST" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? result.error ?? "Kunne ikke skanne Gmail.");
      }

      setCandidates(result.candidates);
      setScannedMessages(result.scannedMessages);
      trackFunnelEvent("email_scan_completed", {
        provider: "gmail",
        result: "success",
        candidate_count: result.candidates.length,
      });

      if (result.candidates.length === 0) {
        const message = "Fant ingen sikre abonnementer. Prøv å lime inn en kvittering eller legg til manuelt.";
        setErrorMessage(message);
        showToast({ title: "Ingen funn", message, tone: "info" });
      } else {
        trackFunnelEvent("import_candidates_found", {
          provider: "gmail",
          candidate_count: result.candidates.length,
        });
        showToast({
          title: "Gmail er skannet",
          message: `${result.candidates.length} forslag er klare for gjennomgang.`,
          tone: "success",
        });
      }
    } catch {
      setCandidates([]);
      trackFunnelEvent("email_scan_failed", { provider: "gmail", result: "failed", error_category: "gmail_scan" });
      const message = "Kunne ikke skanne Gmail akkurat nå.";
      setErrorMessage(message);
      showToast({ title: "Skanning feilet", message, tone: "error" });
    } finally {
      setIsScanningGmail(false);
    }
  }

  function connectMicrosoft(event: MouseEvent<HTMLAnchorElement>) {
    if (microsoftImportState === "connecting") {
      event.preventDefault();
      return;
    }

    setMicrosoftImportState("connecting");
    setMicrosoftMessage("Kobler til Microsoft ...");
    lastToastKeyRef.current = null;
  }

  async function scanMicrosoft() {
    setMicrosoftImportState("scanning");
    setMicrosoftMessage(null);
    setMicrosoftMessagesChecked(null);
    setMicrosoftScanId(null);
    setMicrosoftCandidates([]);
    trackFunnelEvent("email_scan_started", { provider: "outlook", route: "/import/email" });

    try {
      const response = await fetch("/api/import/microsoft/scan", { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as {
        status?: MicrosoftImportState;
        scanId?: string;
        messagesChecked?: number;
        candidates?: OutlookCandidate[];
        message?: string;
        error?: string;
        partial?: boolean;
      };

      if (!response.ok) {
        const message = result.message ?? getMicrosoftConnectionMessage(result.error ?? "SCAN_FAILED");
        const code = result.error ?? "SCAN_FAILED";

        if (code === "NOT_CONNECTED") {
          trackFunnelEvent("email_scan_failed", { provider: "outlook", result: "failed", error_category: "not_connected" });
          setMicrosoftConnected(false);
          setMicrosoftImportState("not_connected");
          setMicrosoftEmail(null);
          setMicrosoftMessage("Koble til Outlook for å skanne e-post.");
          return;
        }

        if (code === "CONNECTION_EXPIRED" || code === "RECONNECT_REQUIRED" || code === "GRAPH_UNAUTHORIZED") {
          trackFunnelEvent("email_scan_failed", { provider: "outlook", result: "failed", error_category: "expired" });
          setMicrosoftConnected(false);
          setMicrosoftImportState("expired");
          setMicrosoftEmail(null);
          setMicrosoftMessage("Tilkoblingen til Outlook har utløpt.");
          return;
        }

        throw new Error(message);
      }

      const candidates = Array.isArray(result.candidates) ? result.candidates : [];
      setMicrosoftImportState(candidates.length > 0 ? "review_results" : "no_candidates");
      setMicrosoftScanId(result.scanId ?? null);
      setMicrosoftMessagesChecked(result.messagesChecked ?? 0);
      setMicrosoftCandidates(candidates);
      trackFunnelEvent("email_scan_completed", {
        provider: "outlook",
        result: "success",
        candidate_count: candidates.length,
      });
      if (candidates.length > 0) {
        trackFunnelEvent("import_candidates_found", {
          provider: "outlook",
          candidate_count: candidates.length,
        });
      }
      setMicrosoftMessage(result.message ?? "Outlook-skanningen er fullført.");
      showImportToast("outlook-scan-success", candidates.length > 0 ? "Outlook-forslag funnet" : "Ingen sikre Outlook-funn",
        candidates.length > 0
          ? `${candidates.length} mulige abonnementer er klare for gjennomgang.`
          : "Vi fant ingen sikre abonnementer i denne skanningen.",
        candidates.length > 0 ? "success" : "info");
    } catch {
      trackFunnelEvent("email_scan_failed", { provider: "outlook", result: "failed", error_category: "outlook_scan" });
      setMicrosoftImportState("scan_failed");
      setMicrosoftScanId(null);
      setMicrosoftMessage("Vi klarte ikke å skanne e-posten. Koble til på nytt eller prøv igjen.");
      setMicrosoftCandidates([]);
    }
  }

  async function disconnectMicrosoft() {
    setMicrosoftImportState("connecting");

    try {
      const response = await fetch("/api/import/microsoft/disconnect", { method: "POST" });

      if (!response.ok) {
        throw new Error("DISCONNECT_FAILED");
      }

      setMicrosoftConnected(false);
      setMicrosoftImportState("disconnected");
      setMicrosoftEmail(null);
      setMicrosoftScanId(null);
      setMicrosoftMessage("Outlook er ikke koblet til.");
      setMicrosoftCandidates([]);
      trackFunnelEvent("email_provider_disconnected", { provider: "outlook", result: "success" });
      showToast({
        title: "Outlook er koblet fra.",
        message: "Du kan koble til Outlook igjen når du vil.",
        tone: "success",
      });
    } catch {
      setMicrosoftImportState(microsoftConnected ? "connected" : "not_connected");
      showToast({
        title: "Frakobling feilet",
        message: "Kunne ikke koble fra Microsoft akkurat nå.",
        tone: "error",
      });
    }
  }

  function startCandidateConfirmation(candidate: EmailSubscriptionCandidate) {
    setEditingCandidate(candidate);
    setCandidateDraft({
      providerId: candidate.providerId ?? null,
      merchantName: candidate.merchantName,
      amount: String(candidate.amount),
      category: candidate.suggestedCategory ?? candidate.category,
      billingInterval: candidate.billingInterval === "yearly" ? "yearly" : "monthly",
      nextPayment: normalizeDateInputValue(candidate.nextPayment),
    });
  }

  async function saveCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCandidate || !candidateDraft) {
      return;
    }

    setErrorMessage(null);
    setSavedCandidateName(null);
    setIsSavingCandidate(true);

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingCandidate,
          merchantName: candidateDraft.merchantName,
          name: candidateDraft.merchantName,
          amount: Number(candidateDraft.amount),
          monthlyCost: Number(candidateDraft.amount),
          category: candidateDraft.category,
          billingInterval: candidateDraft.billingInterval,
          nextPayment: candidateDraft.nextPayment,
          status:
            editingCandidate.billingInterval === "trial"
              ? "trial"
              : candidateDraft.billingInterval === "yearly"
                ? "yearly"
                : "active",
          source: getCandidateSource(editingCandidate),
          providerId: candidateDraft.providerId,
          confirmedDuplicateReview: true,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        currentUsage?: number;
        limit?: number | null;
      };

      if (!response.ok) {
        if (result.error === "PLAN_LIMIT_REACHED") {
          const currentUsage = result.currentUsage ?? 10;
          const limit = typeof result.limit === "number" ? result.limit : 10;
          const message = `Du har brukt ${currentUsage} av ${limit} abonnementer i gratisplanen.`;
          setErrorMessage(message);
          setPremiumGate({
            title: "Gratisgrensen er nådd",
            description: message,
            benefit: "Premium gir ubegrensede abonnementer og automatisk import fra e-post.",
            blockedAction: "Forslaget lagres ikke før du sletter et abonnement eller oppgraderer.",
            currentUsage,
            limit,
          });
          showToast({
            title: "Gratisgrensen er nådd",
            message,
            tone: "info",
            actionLabel: "Se Premium",
            onAction: () =>
              setPremiumGate({
                title: "Gratisgrensen er nådd",
                description: message,
                benefit: "Premium gir ubegrensede abonnementer og automatisk import fra e-post.",
                blockedAction: "Forslaget lagres ikke før du sletter et abonnement eller oppgraderer.",
                currentUsage,
                limit,
              }),
          });
          return;
        }

        throw new Error(result.message ?? result.error ?? "Kunne ikke lagre abonnementet.");
      }

      setSavedCandidateName(candidateDraft.merchantName);
      showToast({
        title: "Abonnement lagret",
        message: `${candidateDraft.merchantName} er lagt til i oversikten.`,
        tone: "success",
      });
      setEmailText("");
      ignoreCandidate(editingCandidate);
      setEditingCandidate(null);
      setCandidateDraft(null);
    } catch {
      const message = "Kunne ikke lagre abonnementet akkurat nå.";
      setErrorMessage(message);
      showToast({ title: "Lagring feilet", message, tone: "error" });
    } finally {
      setIsSavingCandidate(false);
    }
  }

  function resetResults() {
    setSavedCandidateName(null);
    setScannedMessages(null);
    setErrorMessage(null);
    setHiddenCandidateKeys([]);
  }

  function showImportToast(key: string, title: string, message: string, tone: "success" | "error" | "info") {
    const toastKey = `${key}:${message}`;
    if (lastToastKeyRef.current === toastKey) {
      return;
    }

    lastToastKeyRef.current = toastKey;
    showToast({ title, message, tone });
  }

  async function ignoreCandidate(candidate: EmailSubscriptionCandidate) {
    setHiddenCandidateKeys((currentKeys) => [...currentKeys, getCandidateKey(candidate)]);
    await fetch("/api/import/candidates/ignore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidate),
    }).catch(() => null);
  }

  const gmailStatus: ProviderStatus = providerSectionState === "error"
    ? "error"
    : !googleMailConnectEnabled
    ? "unavailable"
    : isScanningGmail
      ? "scanning"
      : gmailScopeConnected
        ? "connected"
        : "disconnected";
  const outlookStatus = getOutlookProviderStatus(microsoftImportState, microsoftConnected, microsoftConfigured);
  const outlookEmail = outlookStatus === "connected" ? sanitizeDisplayEmail(microsoftEmail) : null;
  const outlookFeedback =
    outlookStatus === "connected"
      ? "Outlook er koblet til og klar for skanning."
      : outlookStatus === "expired"
        ? "Tilkoblingen til Outlook har utløpt."
        : outlookStatus === "error"
          ? "Vi klarte ikke å skanne e-posten. Koble til på nytt eller prøv igjen."
          : outlookStatus === "unavailable"
            ? "Outlook er midlertidig utilgjengelig."
            : outlookStatus === "disconnected"
              ? "Outlook er ikke koblet til."
              : outlookStatus === "loading"
                ? null
                : microsoftMessage;

  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader />

      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 lg:py-7">
        {status === "unauthenticated" ? (
          <div className="mb-6 rounded-2xl border border-[#F3C3CC] bg-[#F5E6E9] p-5 text-sm text-[#C8102E]">
            <p className="font-bold">Du må logge inn for å importere abonnementer.</p>
            <button
              className="mt-4 rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
              onClick={() => signIn(undefined, { callbackUrl: "/import/email" })}
              type="button"
            >
              Logg inn
            </button>
          </div>
        ) : null}

        <AuthPageHeader
          description="Koble til e-post eller lim inn en kvittering. Du velger alltid selv hva som lagres."
          eyebrow="E-postimport"
          title="Finn abonnementer i e-posten din"
        />
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Koble til e-post</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F6F82]">
                Vi leser bare e-post for å finne mulige abonnementer. Vi sender, endrer eller sletter aldri e-post.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              <Link className="text-[#C8102E] hover:underline" href="/privacy">
                Personvern
              </Link>
              <Link className="text-[#C8102E] hover:underline" href="/contact">
                Support
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2" aria-busy={providerSectionState === "loading"}>
            {providerSectionState === "loading" ? (
              <>
                <ProviderCardSkeleton name="Gmail" imageAlt="Gmail-logo" imageSrc="/gmail.png" />
                <ProviderCardSkeleton name="Outlook" imageAlt="Outlook-logo" imageSrc="/outlook.png" />
              </>
            ) : (
              <>
            <ProviderCard
              action={
                !googleMailConnectEnabled ? (
                  <p className="rounded-xl bg-[#F8F1E8] px-4 py-3 text-sm font-bold text-[#8A4B13]">
                    Gmail-import blir tilgjengelig når godkjenningen er fullført.
                  </p>
                ) : gmailScanAvailable && gmailStatus === "connected" ? (
                  <LoadingButton isLoading={isScanningGmail} loadingLabel="Skanner..." onClick={scanGmail} type="button">
                    Skann e-post
                  </LoadingButton>
                ) : gmailScanAvailable ? (
                  <button
                    className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
                    onClick={() => signIn("google", { callbackUrl: "/import/email" })}
                    type="button"
                  >
                    Koble til Gmail
                  </button>
                ) : gmailScopeConnected ? (
                  <button
                    className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
                    onClick={() => setPremiumDialogReason("E-postskanning krever Premium.")}
                    type="button"
                  >
                    Se Premium
                  </button>
                ) : (
                  <button
                    className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
                    onClick={() => signIn("google", { callbackUrl: "/import/email" })}
                    type="button"
                  >
                    Koble til Gmail
                  </button>
                )
              }
              connectedEmail={gmailStatus === "connected" ? session?.user?.email ?? null : null}
              feedback={
                !googleMailConnectEnabled
                  ? "Gmail-import blir tilgjengelig når godkjenningen er fullført."
                  : gmailConnected && !gmailScopeConnected
                  ? "Koble til Gmail på nytt for å gi lesetilgang."
                  : scannedMessages !== null
                    ? `Skannet ${scannedMessages} meldinger.`
                    : null
              }
              imageAlt="Gmail-logo"
              imageSrc="/gmail.png"
              name="Gmail"
              secondaryAction={
                googleMailConnectEnabled && gmailScopeConnected ? (
                  <button
                    className="text-xs font-bold text-[#5F6F82] hover:text-[#C8102E]"
                    onClick={() => signIn("google", { callbackUrl: "/import/email" })}
                    type="button"
                  >
                    Koble til på nytt
                  </button>
                ) : null
              }
              status={!googleMailConnectEnabled ? "Midlertidig utilgjengelig" : getProviderStatusLabel(gmailStatus)}
              statusTone={getProviderStatusTone(gmailStatus)}
            />

            <ProviderCard
              action={
                outlookStatus === "connected" && gmailScanAvailable ? (
                  <LoadingButton isLoading={microsoftImportState === "scanning"} loadingLabel="Skanner..." onClick={scanMicrosoft} type="button">
                    Skann e-post
                  </LoadingButton>
                ) : outlookStatus === "connected" ? (
                  <button
                    className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
                    onClick={() => setPremiumDialogReason("E-postskanning krever Premium.")}
                    type="button"
                  >
                    Se Premium
                  </button>
                ) : outlookStatus === "loading" ? (
                  <div className="h-11 w-40 animate-pulse rounded-xl bg-[#E6EDF5]" aria-hidden="true" />
                ) : microsoftConfigured ? (
                  <a
                    aria-disabled={microsoftImportState === "connecting"}
                    className="inline-flex justify-center rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] aria-disabled:pointer-events-none aria-disabled:opacity-70"
                    href="/api/import/microsoft/connect"
                    onClick={connectMicrosoft}
                  >
                    {microsoftImportState === "connecting"
                      ? "Kobler til Microsoft ..."
                      : outlookStatus === "expired"
                        ? "Koble til på nytt"
                        : "Koble til Outlook"}
                  </a>
                ) : outlookStatus === "unavailable" ? (
                  <p className="rounded-xl bg-[#F8F1E8] px-4 py-3 text-sm font-bold text-[#8A4B13]">
                    Outlook er midlertidig utilgjengelig.
                  </p>
                ) : (
                  <a
                    className="inline-flex justify-center rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
                    href="/api/import/microsoft/connect"
                    onClick={connectMicrosoft}
                  >
                    Koble til Outlook
                  </a>
                )
              }
              connectedEmail={outlookEmail}
              feedback={outlookFeedback}
              imageAlt="Outlook-logo"
              imageSrc="/outlook.png"
              name="Outlook"
              secondaryAction={
                outlookStatus === "connected" ? (
                  <button
                    className="text-xs font-bold text-[#5F6F82] hover:text-[#C8102E]"
                    disabled={microsoftImportState === "scanning"}
                    onClick={disconnectMicrosoft}
                    type="button"
                  >
                    Koble fra
                  </button>
                ) : null
              }
              status={
                outlookStatus === "loading"
                  ? ""
                  : outlookStatus === "expired"
                    ? "Må kobles til på nytt"
                    : outlookStatus === "unavailable"
                      ? "Utilgjengelig"
                      : getProviderStatusLabel(outlookStatus)
              }
              statusTone={getProviderStatusTone(outlookStatus)}
            />
              </>
            )}
          </div>
        </section>

        {!gmailScanAvailable ? (
          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
            <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">Premium</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">E-postskanning krever Premium</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F6F82]">
              Med Premium kan du skanne e-posten din og velge hvilke abonnementer du vil importere.
            </p>
            <p className="mt-2 text-sm font-semibold text-[#5F6F82]">
              Du kan fortsatt legge inn abonnementer manuelt gratis.
            </p>
            <button
              className="mt-4 rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
              onClick={() => setPremiumDialogReason("E-postskanning krever Premium.")}
              type="button"
            >
              Se Premium
            </button>
          </section>
        ) : null}

        <MicrosoftImportPanel
          key={microsoftScanId ?? microsoftImportState}
          messagesChecked={microsoftMessagesChecked}
          candidates={microsoftCandidates}
          scanId={microsoftScanId}
        />

        <form
          className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]"
          onSubmit={parseEmail}
        >
          <h2 className="text-lg font-extrabold tracking-tight">Eller lim inn en kvittering</h2>
          <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
            Lim inn teksten fra en kvittering eller betalingsbekreftelse.
          </p>
          <label className="mt-4 block text-sm font-semibold text-[#4A5568]" htmlFor="emailText">
            E-posttekst
          </label>
          <textarea
            className="mt-2 min-h-32 w-full resize-y rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm text-[#0D1B2A] outline-none transition focus:border-[#0D1B2A] focus:ring-2 focus:ring-[#C8102E]/20"
            id="emailText"
            onChange={(event) => setEmailText(event.target.value)}
            placeholder="Eksempel: Kvittering fra Spotify. Beløp kr 129. Neste trekk 3. jul."
            required
            value={emailText}
          />
          <LoadingButton
            className="mt-4 bg-[#0D1B2A] hover:bg-[#15283c]"
            isLoading={isParsing}
            loadingLabel="Leser tekst..."
            type="submit"
          >
            Finn abonnement
          </LoadingButton>
        </form>

        {premiumGate ? (
          <div className="mt-5">
            <PremiumFeatureGate {...premiumGate} onClose={() => setPremiumGate(null)} />
          </div>
        ) : null}

        {errorMessage && !premiumGate ? (
          <div className="mt-5 rounded-2xl border border-[#F3C3CC] bg-[#F5E6E9] p-4 text-sm font-semibold text-[#C8102E]">
            {errorMessage}
          </div>
        ) : null}

        {savedCandidateName ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {savedCandidateName} ble lagt til i abonnementene dine.
          </div>
        ) : null}

        {likelyCandidates.length > 0 ? (
          <CandidateGroup
            candidates={likelyCandidates}
            onIgnore={ignoreCandidate}
            onReport={(candidate) => setReportingCandidate(candidate)}
            onSave={startCandidateConfirmation}
            title="Sannsynlige abonnementer"
          />
        ) : null}

        {possibleCandidates.length > 0 ? (
          <CandidateGroup
            candidates={possibleCandidates}
            onIgnore={ignoreCandidate}
            onReport={(candidate) => setReportingCandidate(candidate)}
            onSave={startCandidateConfirmation}
            title="Mulige funn"
          />
        ) : null}

        {editingCandidate && candidateDraft ? (
          <CandidateConfirmationModal
            candidate={editingCandidate}
            draft={candidateDraft}
            isSaving={isSavingCandidate}
            onClose={() => {
              setEditingCandidate(null);
              setCandidateDraft(null);
            }}
            onSubmit={saveCandidate}
            setDraft={setCandidateDraft}
          />
        ) : null}
        {reportingCandidate ? (
          <ReportWrongModal
            candidate={reportingCandidate}
            onClose={() => setReportingCandidate(null)}
            onReported={() => {
              ignoreCandidate(reportingCandidate);
              setReportingCandidate(null);
            }}
          />
        ) : null}
        <PremiumUpgradeDialog
          onClose={() => setPremiumDialogReason(null)}
          open={Boolean(premiumDialogReason)}
          reason={premiumDialogReason ?? undefined}
        />
      </section>

      <AppFooter compact />
    </main>
  );
}

function ProviderCard({
  name,
  imageSrc,
  imageAlt,
  status,
  statusTone,
  connectedEmail,
  feedback,
  action,
  secondaryAction,
}: {
  name: string;
  imageSrc: string;
  imageAlt: string;
  status: string;
  statusTone: "success" | "warning" | "neutral" | "error";
  connectedEmail?: string | null;
  feedback?: string | null;
  action: ReactNode;
  secondaryAction?: ReactNode;
}) {
  const statusClass = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-[#F8F1E8] text-[#8A4B13] ring-amber-200",
    neutral: "bg-[#F0F4F8] text-[#5F6F82] ring-[#DBE4EE]",
    error: "bg-[#F5E6E9] text-[#C8102E] ring-[#F3C3CC]",
  }[statusTone];

  return (
    <article className="flex min-h-[252px] flex-col rounded-2xl border border-[#DBE4EE] bg-[#F7F9FC] p-4 shadow-sm transition hover:border-[#C8D4E2] sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-2 ring-1 ring-[#DBE4EE]">
          <Image
            alt={imageAlt}
            className="h-8 w-8 object-contain"
            height={32}
            src={imageSrc}
            width={32}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold tracking-tight">{name}</h3>
            {status ? (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass}`}>
                {status}
              </span>
            ) : (
              <span className="h-6 w-24 animate-pulse rounded-full bg-[#E6EDF5]" aria-hidden="true" />
            )}
          </div>
          {connectedEmail ? (
            <p className="mt-1 truncate text-sm font-semibold text-[#5F6F82]" title={connectedEmail}>
              {connectedEmail}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 min-h-[72px] text-sm leading-6 text-[#5F6F82]">
        {feedback ? <p>{feedback}</p> : null}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex min-h-11 flex-col justify-end gap-2">{action}</div>
        {secondaryAction ? <div className="mt-2">{secondaryAction}</div> : null}
      </div>
    </article>
  );
}

function ProviderCardSkeleton({
  imageAlt,
  imageSrc,
  name,
}: {
  imageAlt: string;
  imageSrc: string;
  name: string;
}) {
  return (
    <article
      aria-label={`Henter status for ${name}`}
      className="flex min-h-[252px] flex-col rounded-2xl border border-[#DBE4EE] bg-[#F7F9FC] p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-2 ring-1 ring-[#DBE4EE]">
          <Image alt={imageAlt} className="h-8 w-8 object-contain opacity-60" height={32} src={imageSrc} width={32} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold tracking-tight">{name}</h3>
            <span className="h-6 w-28 animate-pulse rounded-full bg-[#E6EDF5]" aria-hidden="true" />
          </div>
          <div className="mt-2 h-4 w-36 animate-pulse rounded bg-[#E6EDF5]" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-3 min-h-[72px] space-y-2" aria-hidden="true">
        <div className="h-4 w-11/12 animate-pulse rounded bg-[#E6EDF5]" />
        <div className="h-4 w-8/12 animate-pulse rounded bg-[#E6EDF5]" />
      </div>
      <div className="mt-auto pt-4">
        <div className="h-11 w-full animate-pulse rounded-xl bg-[#E6EDF5]" aria-hidden="true" />
      </div>
      <span className="sr-only">Henter tilkoblingsstatus.</span>
    </article>
  );
}

function MicrosoftImportPanel({
  messagesChecked,
  candidates,
  scanId,
}: {
  messagesChecked: number | null;
  candidates: OutlookCandidate[];
  scanId: string | null;
}) {
  const { showToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ignoredIds, setIgnoredIds] = useState<string[]>([]);
  const [editingIds, setEditingIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OutlookCandidateDraft>>(() =>
    Object.fromEntries(candidates.map((candidate) => [candidate.id, toOutlookDraft(candidate)])),
  );
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [itemResults, setItemResults] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const visibleCandidates = candidates.filter((candidate) => !ignoredIds.includes(candidate.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectHighConfidence() {
    setSelectedIds(visibleCandidates.filter((candidate) => candidate.confidence === "high").map((candidate) => candidate.id));
  }

  function updateDraft(id: string, update: Partial<OutlookCandidateDraft>) {
    setDrafts((current) => {
      const existing = current[id];
      const source = candidates.find((candidate) => candidate.id === id);

      if (!existing && !source) {
        return current;
      }

      const base = existing ?? (source ? toOutlookDraft(source) : null);

      if (!base) {
        return current;
      }

      return {
        ...current,
        [id]: { ...base, ...update },
      };
    });
  }

  async function importSelected() {
    setImportMessage(null);
    setItemResults({});

    if (!scanId) {
      setImportMessage("Skanningen mangler importreferanse. Skann Outlook på nytt.");
      return;
    }

    if (selectedIds.length === 0) {
      setImportMessage("Velg minst ett forslag før du importerer.");
      return;
    }

    const validationError = selectedIds
      .map((id) => validateOutlookDraft(drafts[id]))
      .find((error) => error !== null);

    if (validationError) {
      setImportMessage(validationError);
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch("/api/import/microsoft/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId,
          candidates: visibleCandidates.map((candidate) => ({
            id: candidate.id,
            selected: selectedIds.includes(candidate.id),
            ...(drafts[candidate.id] ?? toOutlookDraft(candidate)),
          })),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        results?: { id: string; ok: boolean; message?: string; error?: string }[];
      };

      setImportMessage(result.message ?? "Importen er behandlet.");
      setItemResults(
        Object.fromEntries(
          (result.results ?? []).map((item) => [
            item.id,
            item.ok ? "Importert" : item.message ?? getOutlookImportErrorLabel(item.error),
          ]),
        ),
      );
      trackFunnelEvent("subscriptions_imported", {
        provider: "outlook",
        result: response.ok ? "success" : "failed",
        imported_count: (result.results ?? []).filter((item) => item.ok).length,
      });

      showToast({
        title: response.ok ? "Outlook-import behandlet" : "Import feilet",
        message: result.message ?? "Se resultatene i listen.",
        tone: response.ok ? "success" : "error",
      });
    } catch {
      const message = "Kunne ikke importere Outlook-forslag akkurat nå.";
      setImportMessage(message);
      showToast({ title: "Import feilet", message, tone: "error" });
    } finally {
      setIsImporting(false);
    }
  }

  if (visibleCandidates.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="grid gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">Outlook-forslag</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">Se gjennom funn før import</h2>
            <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
              Velg forslagene du vil importere, og rediger navn, pris eller intervall før de lagres.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-[#0D1B2A]">
              {messagesChecked ?? 0} meldinger skannet · {visibleCandidates.length} mulige funn
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className="rounded-xl border border-[#DBE4EE] px-4 py-2.5 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
                onClick={selectHighConfidence}
                type="button"
              >
                Velg alle sikre funn
              </button>
              <LoadingButton isLoading={isImporting} loadingLabel="Importerer..." onClick={importSelected} type="button">
                Importer valgte
              </LoadingButton>
              <button
                className="rounded-xl border border-[#DBE4EE] px-4 py-2.5 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
                onClick={() => {
                  setSelectedIds([]);
                  setImportMessage("Import avbrutt. Ingen forslag ble lagret.");
                }}
                type="button"
              >
                Avbryt
              </button>
            </div>
          </div>
          {importMessage ? (
            <p className="rounded-xl bg-[#F7F9FC] px-4 py-3 text-sm font-semibold text-[#0D1B2A] ring-1 ring-[#DBE4EE]">
              {importMessage}
            </p>
          ) : null}
          {visibleCandidates.map((candidate) => {
            const draft = drafts[candidate.id] ?? toOutlookDraft(candidate);
            const isEditing = editingIds.includes(candidate.id);

            return (
              <article className="rounded-xl bg-[#F7F9FC] p-4 ring-1 ring-[#DBE4EE]" key={candidate.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-[#0D1B2A]">
                      <input
                        checked={selectedIds.includes(candidate.id)}
                        className="h-4 w-4 accent-[#C8102E]"
                        onChange={() => toggleSelected(candidate.id)}
                        type="checkbox"
                      />
                      Velg
                    </label>
                    <CandidateProviderLogo logoPath={candidate.providerLogoPath} name={candidate.providerName} />
                    <h3 className="font-extrabold text-[#0D1B2A]">{candidate.providerName}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4A5568] ring-1 ring-[#DBE4EE]">
                      {getOutlookConfidenceLabel(candidate.confidence)}
                    </span>
                    {candidate.grouped ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {candidate.relatedMessageCount} relaterte
                      </span>
                    ) : null}
                  </div>
                  {candidate.originalDetectedName && candidate.originalDetectedName !== candidate.providerName ? (
                    <p className="mt-2 text-sm text-[#5F6F82]">Opprinnelig funn: {candidate.originalDetectedName}</p>
                  ) : null}
                  <p className="mt-1 text-xs font-semibold text-[#5F6F82]">
                    {candidate.senderDomain ?? "Ukjent avsender"}
                    {candidate.receivedDate ? ` · ${new Date(candidate.receivedDate).toLocaleDateString("nb-NO")}` : ""}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs font-semibold text-[#5F6F82]">
                    {candidate.reasons.map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
                  {candidate.duplicateMessage ? (
                    <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${candidate.likelyDuplicate ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>
                      {candidate.duplicateMessage}
                    </p>
                  ) : null}
                  {itemResults[candidate.id] ? (
                    <p className="mt-3 text-sm font-bold text-[#0D1B2A]">{itemResults[candidate.id]}</p>
                  ) : null}
                </div>
                <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-[#DBE4EE] sm:text-right">
                  <p className="text-lg font-black text-[#0D1B2A]">
                    {candidate.amount ? `${candidate.amount} ${candidate.currency ?? ""}` : "Ukjent pris"}
                  </p>
                  <p className="mt-1 font-semibold text-[#5F6F82]">
                    {getOutlookIntervalLabel(candidate.billingInterval)}
                  </p>
                </div>
              </div>
              {isEditing ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ProviderCombobox
                    onChange={(name) => updateDraft(candidate.id, { name, providerId: null })}
                    onSelect={(provider) => updateOutlookProviderDraft(candidate.id, provider, updateDraft)}
                    selectedProviderId={draft.providerId}
                    value={draft.name}
                  />
                  <OutlookDraftInput
                    inputMode="numeric"
                    label="Pris"
                    value={draft.price}
                    onChange={(price) => updateDraft(candidate.id, { price })}
                  />
                  <OutlookDraftSelect
                    label="Valuta"
                    onChange={(currency) => updateDraft(candidate.id, { currency })}
                    options={["NOK", "USD", "EUR", "GBP", "SEK", "DKK"]}
                    value={draft.currency}
                  />
                  <OutlookDraftSelect
                    label="Intervall"
                    onChange={(billingInterval) => updateDraft(candidate.id, { billingInterval })}
                    options={["monthly", "yearly", "unknown"]}
                    value={draft.billingInterval}
                  />
                  <OutlookDraftInput
                    label="Neste trekk"
                    onChange={(nextPayment) => updateDraft(candidate.id, { nextPayment })}
                    type="date"
                    value={draft.nextPayment}
                  />
                  <OutlookDraftSelect
                    label="Kategori"
                    onChange={(category) => updateDraft(candidate.id, { category })}
                    options={["streaming", "software", "news", "health"]}
                    value={draft.category}
                  />
                </div>
              ) : null}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  className="rounded-xl border border-[#DBE4EE] px-4 py-2.5 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
                  onClick={() =>
                    setEditingIds((current) =>
                      current.includes(candidate.id)
                        ? current.filter((id) => id !== candidate.id)
                        : [...current, candidate.id],
                    )
                  }
                  type="button"
                >
                  {isEditing ? "Lukk redigering" : "Rediger"}
                </button>
                <button
                  className="rounded-xl border border-[#F3C3CC] px-4 py-2.5 text-sm font-bold text-[#C8102E] hover:bg-[#F5E6E9]"
                  onClick={() => {
                    setIgnoredIds((current) => [...current, candidate.id]);
                    setSelectedIds((current) => current.filter((id) => id !== candidate.id));
                  }}
                  type="button"
                >
                  Ignorer
                </button>
              </div>
              </article>
            );
          })}
          <p className="text-xs font-semibold text-[#5F6F82]">
            Ingenting importeres før du velger forslag og trykker Importer valgte.
          </p>
      </div>
    </section>
  );
}

function getMicrosoftConnectionMessage(code: string) {
  if (code === "cancelled") {
    return "Tilkoblingen ble avbrutt. Ingen tilgang ble gitt.";
  }

  if (code === "expired" || code === "MICROSOFT_RECONNECT_REQUIRED") {
    return "Tilkoblingen til Outlook har utløpt.";
  }

  if (code === "unavailable" || code === "MICROSOFT_NOT_CONFIGURED") {
    return "Outlook er midlertidig utilgjengelig.";
  }

  return "Vi klarte ikke å koble til Outlook. Prøv igjen.";
}

function getOutlookProviderStatus(state: MicrosoftImportState, connected: boolean, configured: boolean): ProviderStatus {
  return getOutlookDisplayState({ state, connected, configured });
}

function getProviderStatusLabel(status: ProviderStatus) {
  const labels: Record<ProviderStatus, string> = {
    loading: "",
    disconnected: "Ikke tilkoblet",
    connecting: "Kobler til",
    connected: "Tilkoblet",
    scanning: "Skanner",
    expired: "Må kobles til på nytt",
    unavailable: "Utilgjengelig",
    error: "Feil",
  };

  return labels[status];
}

function getProviderStatusTone(status: ProviderStatus): "success" | "warning" | "neutral" | "error" {
  if (status === "connected") {
    return "success";
  }

  if (status === "expired" || status === "unavailable") {
    return "warning";
  }

  if (status === "error") {
    return "error";
  }

  return "neutral";
}

function sanitizeDisplayEmail(value: string | null | undefined) {
  const decoded = decodeURIComponent(String(value ?? "").trim());

  if (!decoded || decoded.includes("#EXT#")) {
    return null;
  }

  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(decoded)) {
    return null;
  }

  return decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function getOutlookConfidenceLabel(confidence: OutlookCandidate["confidence"]) {
  if (confidence === "high") {
    return "Høy tillit";
  }

  if (confidence === "medium") {
    return "Middels tillit";
  }

  return "Lav tillit";
}

function getOutlookIntervalLabel(interval: OutlookCandidate["billingInterval"]) {
  if (interval === "monthly") {
    return "Månedlig";
  }

  if (interval === "yearly") {
    return "Årlig";
  }

  return "Ukjent intervall";
}

function toOutlookDraft(candidate: OutlookCandidate): OutlookCandidateDraft {
  return {
    providerId: candidate.providerId,
    name: candidate.providerName,
    price: candidate.amount ? String(Math.round(candidate.amount)) : "",
    currency: candidate.currency ?? "NOK",
    billingInterval: candidate.billingInterval,
    nextPayment: "",
    category: candidate.suggestedCategory ?? inferOutlookCategory(candidate.providerName),
  };
}

function updateOutlookProviderDraft(
  id: string,
  provider: ProviderOption | null,
  updateDraft: (id: string, update: Partial<OutlookCandidateDraft>) => void,
) {
  if (!provider) {
    updateDraft(id, { providerId: null });
    return;
  }
  updateDraft(id, {
    providerId: provider.id,
    name: provider.name,
    category: provider.suggestedCategory,
    ...(provider.defaultBillingInterval ? { billingInterval: provider.defaultBillingInterval } : {}),
  });
}

function validateOutlookDraft(draft: OutlookCandidateDraft | undefined) {
  if (!draft) {
    return "Forslaget mangler redigeringsdata.";
  }

  if (!draft.name.trim()) {
    return "Navn må fylles ut.";
  }

  const price = Number(draft.price);
  if (!Number.isInteger(price) || price < 0) {
    return "Pris må være et heltall.";
  }

  if (draft.nextPayment && !/^\d{4}-\d{2}-\d{2}$/.test(draft.nextPayment)) {
    return "Neste trekk må være tom eller en gyldig dato.";
  }

  return null;
}

function inferOutlookCategory(name: string) {
  if (/\b(netflix|spotify|youtube|disney|viaplay|storytel|tv 2|hbo|max)\b/i.test(name)) {
    return "streaming";
  }

  if (/\b(sats|fitness|gym|strava)\b/i.test(name)) {
    return "health";
  }

  return "software";
}

function getOutlookImportErrorLabel(error?: string) {
  if (error === "DUPLICATE_SUBSCRIPTION") {
    return "Finnes allerede.";
  }

  if (error === "VALIDATION_ERROR") {
    return "Må rettes før import.";
  }

  if (error === "PLAN_LIMIT_REACHED") {
    return "Gratisgrensen er nådd.";
  }

  return "Kunne ikke importeres.";
}

function OutlookDraftInput({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "numeric";
}) {
  return (
    <label className="text-sm font-semibold text-[#4A5568]">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function OutlookDraftSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-[#4A5568]">
      {label}
      <select
        className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getOutlookOptionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function getOutlookOptionLabel(option: string) {
  const labels: Record<string, string> = {
    monthly: "Månedlig",
    yearly: "Årlig",
    unknown: "Ukjent",
    streaming: "Streaming",
    software: "Programvare",
    news: "Nyheter",
    health: "Helse",
  };

  return labels[option] ?? option;
}

function CandidateGroup({
  title,
  candidates,
  onSave,
  onIgnore,
  onReport,
}: {
  title: string;
  candidates: EmailSubscriptionCandidate[];
  onSave: (candidate: EmailSubscriptionCandidate) => void;
  onIgnore: (candidate: EmailSubscriptionCandidate) => void | Promise<void>;
  onReport: (candidate: EmailSubscriptionCandidate) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      <div className="mt-3 grid gap-4">
        {candidates.map((candidate) => (
          <article
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]"
            key={getCandidateKey(candidate)}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CandidateProviderLogo logoPath={candidate.providerLogoPath ?? null} name={candidate.merchantName} />
                  <h3 className="text-xl font-extrabold tracking-tight">
                    {candidate.merchantName}
                  </h3>
                  <span className="rounded-full bg-[#EAF7EF] px-3 py-1 text-xs font-bold text-emerald-700">
                    {getConfidenceLabel(candidate)} · {getConfidenceScore(candidate)}%
                  </span>
                </div>
                {candidate.originalDetectedName && candidate.originalDetectedName !== candidate.merchantName ? (
                  <p className="mt-2 text-sm text-[#5F6F82]">Opprinnelig funn: {candidate.originalDetectedName}</p>
                ) : null}
                <p className="mt-2 text-sm text-[#5F6F82]">
                  {candidate.amount} {candidate.currency} · {categoryLabels[candidate.category]} ·{" "}
                  {intervalLabels[candidate.billingInterval]}
                </p>
                <p className="mt-1 text-sm text-[#5F6F82]">
                  Neste trekk: {formatNextPaymentDate(candidate.nextPayment)}
                </p>
                <ReasonList items={candidate.reasons} title="Hvorfor fant vi dette?" />
                {candidate.warnings.length > 0 ? (
                  <ReasonList items={candidate.warnings} title="Varsler" warning />
                ) : null}
                {candidate.duplicateMessage ? (
                  <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${candidate.likelyDuplicate ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>
                    {candidate.duplicateMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:w-44">
                <button
                  className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
                  onClick={() => onSave(candidate)}
                  type="button"
                >
                  Se og lagre
                </button>
                <button
                  className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
                  onClick={() => onIgnore(candidate)}
                  type="button"
                >
                  Ignorer
                </button>
                <button
                  className="rounded-xl border border-[#F3C3CC] px-5 py-3 text-sm font-bold text-[#C8102E] hover:bg-[#F5E6E9]"
                  onClick={() => onReport(candidate)}
                  type="button"
                >
                  Rapporter feil funn
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CandidateConfirmationModal({
  candidate,
  draft,
  setDraft,
  onClose,
  onSubmit,
  isSaving,
}: {
  candidate: EmailSubscriptionCandidate;
  draft: CandidateDraft;
  setDraft: Dispatch<SetStateAction<CandidateDraft | null>>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
}) {
  const amount = Number(draft.amount);
  const showSuspiciousAmountWarning =
    amount > 500 && ["monthly", "unknown"].includes(draft.billingInterval);

  function updateDraft(update: Partial<CandidateDraft>) {
    setDraft((currentDraft) => (currentDraft ? { ...currentDraft, ...update } : currentDraft));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#0D1B2A]/50 p-4 sm:items-center sm:justify-center">
      <form
        className="w-full rounded-2xl bg-white p-5 shadow-2xl sm:max-w-2xl"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Sjekk før du lagrer</h2>
            <p className="mt-1 text-sm text-[#5F6F82]">
              Gmail-funn kan være feil. Rett opp navn, pris og intervall før abonnementet lagres.
            </p>
          </div>
          <button
            className="rounded-full border border-[#DBE4EE] px-3 py-1.5 text-sm font-bold text-[#0D1B2A]"
            onClick={onClose}
            type="button"
          >
            Lukk
          </button>
        </div>

        {showSuspiciousAmountWarning ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            Beløpet virker høyt. Sjekk før du lagrer.
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ProviderCombobox
            onChange={(merchantName) => updateDraft({ merchantName, providerId: null })}
            onSelect={(provider) =>
              updateDraft(
                provider
                  ? {
                      providerId: provider.id,
                      merchantName: provider.name,
                      category: provider.suggestedCategory,
                      billingInterval: provider.defaultBillingInterval ?? draft.billingInterval,
                    }
                  : { providerId: null },
              )
            }
            selectedProviderId={draft.providerId}
            value={draft.merchantName}
          />
          <label className="text-sm font-semibold text-[#4A5568]">
            Kr/mnd
            <input
              className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
              inputMode="numeric"
              onChange={(event) => updateDraft({ amount: event.target.value })}
              required
              value={draft.amount}
            />
          </label>
          <label className="text-sm font-semibold text-[#4A5568]">
            Kategori
            <select
              className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
              onChange={(event) =>
                updateDraft({ category: event.target.value as SubscriptionCategory })
              }
              value={draft.category}
            >
              <option value="streaming">Streaming</option>
              <option value="software">Programvare</option>
              <option value="news">Nyheter</option>
              <option value="health">Helse</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-[#4A5568]">
            Intervall
            <select
              className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
              onChange={(event) =>
                updateDraft({ billingInterval: event.target.value as BillingInterval })
              }
              value={draft.billingInterval}
            >
              <option value="monthly">Månedlig</option>
              <option value="yearly">Årlig</option>
              <option value="unknown">Ukjent</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-[#4A5568] sm:col-span-2">
            Neste trekk
            <input
              className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
              onChange={(event) => updateDraft({ nextPayment: event.target.value })}
              type="date"
              value={draft.nextPayment}
            />
            <span className="mt-1 block text-xs font-medium text-[#5F6F82]">Valgfritt</span>
          </label>
        </div>

        <div className="mt-5 rounded-xl bg-[#F7F9FC] p-4 text-sm text-[#5F6F82]">
          <p className="font-bold text-[#0D1B2A]">Opprinnelig forslag</p>
          <p className="mt-1">
            {candidate.merchantName} · {candidate.amount} {candidate.currency} ·{" "}
            {candidate.confidenceLabel} ({Math.round(candidate.confidence * 100)}%)
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
            onClick={onClose}
            type="button"
          >
            Avbryt
          </button>
          <button
            className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Lagrer..." : "Bekreft og lagre"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CandidateProviderLogo({ name, logoPath }: { name: string; logoPath: string | null }) {
  const [failed, setFailed] = useState(false);
  if (logoPath && !failed) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-[#DBE4EE]">
        <Image alt="" data-testid="candidate-provider-logo" height={24} onError={() => setFailed(true)} src={logoPath} width={24} />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0D1B2A] text-xs font-black text-white" data-testid="candidate-provider-fallback">
      {getProviderInitials(name)}
    </span>
  );
}

function ReasonList({
  title,
  items,
  warning = false,
}: {
  title: string;
  items: string[];
  warning?: boolean;
}) {
  return (
    <div className="mt-4">
      <p className={`text-xs font-bold uppercase ${warning ? "text-[#C8102E]" : "text-[#4A5568]"}`}>
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-[#5F6F82]">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function ReportWrongModal({
  candidate,
  onClose,
  onReported,
}: {
  candidate: EmailSubscriptionCandidate;
  onClose: () => void;
  onReported: () => void;
}) {
  const [issueType, setIssueType] = useState("not_subscription");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/import/candidates/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...candidate, issueType, comment }),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "Kunne ikke rapportere funnet.");
      }

      onReported();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke rapportere funnet.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#0D1B2A]/50 p-4 sm:items-center sm:justify-center">
      <form className="w-full rounded-2xl bg-white p-5 shadow-2xl sm:max-w-md" onSubmit={submitReport}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Rapporter feil funn</h2>
            <p className="mt-1 text-sm text-[#5F6F82]">{candidate.merchantName}</p>
          </div>
          <button className="text-sm font-bold text-[#5F6F82]" onClick={onClose} type="button">
            Lukk
          </button>
        </div>
        <label className="mt-5 block text-sm font-semibold text-[#4A5568]">
          Hva var feil?
          <select
            className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
            onChange={(event) => setIssueType(event.target.value)}
            value={issueType}
          >
            <option value="wrong_amount">Feil beløp</option>
            <option value="wrong_merchant">Feil leverandør</option>
            <option value="not_subscription">Ikke et abonnement</option>
            <option value="duplicate">Duplikat</option>
            <option value="other">Annet</option>
          </select>
        </label>
        <label className="mt-4 block text-sm font-semibold text-[#4A5568]">
          Kommentar
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
            onChange={(event) => setComment(event.target.value)}
            placeholder="Valgfritt"
            value={comment}
          />
        </label>
        <button
          className="mt-5 w-full rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Sender..." : "Rapporter og ignorer"}
        </button>
        {message ? <p className="mt-3 text-sm font-semibold text-[#C8102E]">{message}</p> : null}
      </form>
    </div>
  );
}

function getCandidateKey(candidate: EmailSubscriptionCandidate) {
  return (
    (candidate as unknown as Partial<EnrichedImportCandidate>).sourceFingerprint ||
    `${candidate.merchantName}-${candidate.amount}-${candidate.confidence}`
  );
}

function getConfidenceScore(candidate: EmailSubscriptionCandidate) {
  return (
    (candidate as unknown as Partial<EnrichedImportCandidate>).confidenceScore ??
    Math.round(candidate.confidence * 100)
  );
}

function getConfidenceLabel(candidate: EmailSubscriptionCandidate) {
  const label = (candidate as unknown as Partial<EnrichedImportCandidate>).confidenceLabel;

  if (label === "high") {
    return "Høy tillit";
  }

  if (label === "medium") {
    return "Middels tillit";
  }

  if (label === "low") {
    return "Lav tillit";
  }

  return "Middels tillit";
}

function getCandidateSource(candidate: EmailSubscriptionCandidate) {
  const sourceProvider = (candidate as unknown as Partial<EnrichedImportCandidate>).sourceProvider;

  return sourceProvider === "pasted_email" ? "pasted_email" : "gmail_import";
}
