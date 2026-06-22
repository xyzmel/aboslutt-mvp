"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { PremiumFeatureGate } from "@/components/billing/PremiumFeatureGate";
import { PremiumUpgradeDialog } from "@/components/billing/PremiumUpgradeDialog";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useToast } from "@/components/ui/ToastProvider";
import type { EmailSubscriptionCandidate } from "@/lib/email-subscription-parser";
import type { EnrichedImportCandidate } from "@/lib/import-candidates";
import { formatNextPaymentDate, normalizeDateInputValue } from "@/lib/subscription-date";
import type { BillingInterval, SubscriptionCategory } from "@/types/subscription";

type CandidateDraft = {
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

type MicrosoftImportState =
  | "not_connected"
  | "connecting"
  | "connected"
  | "scanning"
  | "scan_failed"
  | "no_candidates"
  | "review_results"
  | "disconnected";

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
};

type OutlookCandidateDraft = {
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
  const [gmailScanAvailable, setGmailScanAvailable] = useState(true);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [microsoftConfigured, setMicrosoftConfigured] = useState(false);
  const [microsoftImportState, setMicrosoftImportState] = useState<MicrosoftImportState>("not_connected");
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/import/email");
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    async function loadConnectionStatus() {
      const response = await fetch("/api/connections", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const result = (await response.json()) as {
        googleConnected: boolean;
        gmailScopeConnected: boolean;
        gmailScanAvailable?: boolean;
        microsoftConnected?: boolean;
        microsoftConfigured?: boolean;
      };
      setGmailConnected(result.googleConnected);
      setGmailScopeConnected(result.gmailScopeConnected);
      setGmailScanAvailable(result.gmailScanAvailable ?? true);
      setMicrosoftConnected(Boolean(result.microsoftConnected));
      setMicrosoftConfigured(Boolean(result.microsoftConfigured));
      const microsoft = searchParams.get("microsoft");

      if (microsoft === "connected") {
        setMicrosoftConnected(true);
        setMicrosoftImportState("connected");
        setMicrosoftMessage("Microsoft er koblet til. Du kan starte en manuell skann når du er klar.");
        showToast({
          title: "Microsoft er koblet til",
          message: "Outlook-tilgangen er klar.",
          tone: "success",
        });
        return;
      }

      if (microsoft === "cancelled") {
        setMicrosoftImportState("not_connected");
        setMicrosoftMessage("Microsoft-koblingen ble avbrutt. Ingen e-post ble lest.");
        return;
      }

      if (microsoft) {
        setMicrosoftImportState("scan_failed");
        setMicrosoftMessage("Microsoft-koblingen kunne ikke fullføres. Prøv igjen.");
        return;
      }

      setMicrosoftImportState(result.microsoftConnected ? "connected" : "not_connected");
    }

    loadConnectionStatus();
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

      if (result.candidates.length === 0) {
        const message = "Fant ingen sikre abonnementer. Prøv å lime inn en kvittering eller legg til manuelt.";
        setErrorMessage(message);
        showToast({ title: "Ingen funn", message, tone: "info" });
      } else {
        showToast({
          title: "Forslag funnet",
          message: `${result.candidates.length} mulige abonnementer er klare for gjennomgang.`,
          tone: "success",
        });
      }
    } catch {
      setCandidates([]);
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

    try {
      const response = await fetch("/api/import/gmail", { method: "POST" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? result.error ?? "Kunne ikke skanne Gmail.");
      }

      setCandidates(result.candidates);
      setScannedMessages(result.scannedMessages);

      if (result.candidates.length === 0) {
        const message = "Fant ingen sikre abonnementer. Prøv å lime inn en kvittering eller legg til manuelt.";
        setErrorMessage(message);
        showToast({ title: "Ingen funn", message, tone: "info" });
      } else {
        showToast({
          title: "Gmail er skannet",
          message: `${result.candidates.length} forslag er klare for gjennomgang.`,
          tone: "success",
        });
      }
    } catch {
      setCandidates([]);
      const message = "Kunne ikke skanne Gmail akkurat nå.";
      setErrorMessage(message);
      showToast({ title: "Skanning feilet", message, tone: "error" });
    } finally {
      setIsScanningGmail(false);
    }
  }

  function connectMicrosoft() {
    setMicrosoftImportState("connecting");
    setMicrosoftMessage("Sender deg til Microsoft for sikker godkjenning.");
    window.location.href = "/api/import/microsoft/connect";
  }

  async function scanMicrosoft() {
    setMicrosoftImportState("scanning");
    setMicrosoftMessage(null);
    setMicrosoftMessagesChecked(null);

    try {
      const response = await fetch("/api/import/microsoft/scan", { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as {
        status?: MicrosoftImportState;
        scanId?: string;
        messagesChecked?: number;
        candidates?: OutlookCandidate[];
        message?: string;
        partial?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.message ?? "Kunne ikke skanne Outlook akkurat nå.");
      }

      const candidates = Array.isArray(result.candidates) ? result.candidates : [];
      setMicrosoftImportState(candidates.length > 0 ? "review_results" : "no_candidates");
      setMicrosoftScanId(result.scanId ?? null);
      setMicrosoftMessagesChecked(result.messagesChecked ?? 0);
      setMicrosoftCandidates(candidates);
      setMicrosoftMessage(result.message ?? "Outlook-skanningen er fullført.");
      showToast({
        title: candidates.length > 0 ? "Outlook-forslag funnet" : "Ingen sikre Outlook-funn",
        message:
          candidates.length > 0
            ? `${candidates.length} mulige abonnementer er klare for gjennomgang.`
            : "Vi fant ingen sikre abonnementer denne gangen.",
        tone: candidates.length > 0 ? "success" : "info",
      });
    } catch {
      const message = "Kunne ikke skanne Outlook akkurat nå.";
      setMicrosoftImportState("scan_failed");
      setMicrosoftScanId(null);
      setMicrosoftMessage(message);
      setMicrosoftCandidates([]);
      showToast({ title: "Skanning feilet", message, tone: "error" });
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
      setMicrosoftScanId(null);
      setMicrosoftMessage("Microsoft er koblet fra. Lagrede Microsoft-token er fjernet.");
      setMicrosoftCandidates([]);
      showToast({
        title: "Microsoft er koblet fra",
        message: "Du kan koble til igjen når du vil.",
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
      merchantName: candidate.merchantName,
      amount: String(candidate.amount),
      category: candidate.category,
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

  async function ignoreCandidate(candidate: EmailSubscriptionCandidate) {
    setHiddenCandidateKeys((currentKeys) => [...currentKeys, getCandidateKey(candidate)]);
    await fetch("/api/import/candidates/ignore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidate),
    }).catch(() => null);
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader maxWidthClassName="max-w-4xl" />

      <section className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
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

        <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">E-postimport</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Finn abonnementer fra kvitteringer
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6F82]">
          Skann Gmail med read-only tilgang, koble til Outlook med Microsoft, eller lim inn tekst fra en kvittering.
          Aboslutt lagrer ikke rå e-postinnhold, og ingenting importeres før du bekrefter det.
        </p>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Velg e-postkobling</h2>
              <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
                Aboslutt leser bare e-post for å finne mulige abonnementer. Vi sender, endrer eller sletter aldri
                e-post, og du kan koble fra Microsoft når som helst.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                <Link className="text-[#C8102E] hover:underline" href="/privacy">
                  Personvern
                </Link>
                <Link className="text-[#C8102E] hover:underline" href="/contact">
                  Support
                </Link>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[26rem]">
              <button
                className="rounded-xl border border-[#DBE4EE] bg-white px-5 py-3 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50"
                onClick={() => signIn("google", { callbackUrl: "/import/email" })}
                type="button"
              >
                Fortsett med Google
              </button>
              <button
                className="rounded-xl bg-[#0D1B2A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#15283c] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!microsoftConfigured || microsoftImportState === "connecting"}
                onClick={connectMicrosoft}
                type="button"
              >
                {microsoftImportState === "connecting" ? "Kobler til..." : "Fortsett med Microsoft"}
              </button>
            </div>
          </div>
          {!microsoftConfigured ? (
            <p className="mt-3 text-xs font-semibold text-[#8A4B13]">
              Microsoft-import er ikke ferdig konfigurert ennå.
            </p>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Gmail-skanning</h2>
              <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
                Skann inntil 100 sannsynlige kvitteringer fra de siste 24 månedene.
                Kun Gmail read-only brukes.
              </p>
              <p className="mt-1 text-xs font-semibold text-[#5F6F82]">
                {session?.user?.email
                  ? `Innlogget som ${session.user.email}. Gmail: ${
                      gmailScopeConnected ? "koblet til" : "ikke koblet til"
                    }`
                  : "Logg inn med Google for å bruke Gmail-skanning."}
              </p>
              {gmailConnected && !gmailScopeConnected ? (
                <p className="mt-2 text-xs font-semibold text-[#C8102E]">
                  Gmail read-only mangler. Koble til Google på nytt.
                </p>
              ) : null}
              {!gmailScanAvailable ? (
                <div className="mt-4">
                  <PremiumFeatureGate
                    benefit="Premium skanner Gmail med read-only tilgang og foreslår abonnementer du kan bekrefte før lagring."
                    blockedAction="Gmail-skanning starter ikke i gratisplanen."
                    description="Du kan fortsatt lime inn kvitteringstekst eller legge inn abonnementer manuelt gratis."
                    title="Gmail-skanning krever Premium"
                  />
                </div>
              ) : null}
              <p className="mt-3 text-xs font-semibold text-[#C8102E]">
                Forslag kan inneholde feil. Bekreft alltid kandidaten før den lagres.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:w-44">
              {!gmailScanAvailable ? (
                <button
                  className="rounded-xl bg-[#C8102E] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#a90d27]"
                  onClick={() =>
                    setPremiumDialogReason(
                      "Automatisk Gmail-skanning er en Premium-funksjon. Du kan fortsatt lime inn kvitteringer eller legge inn manuelt gratis.",
                    )
                  }
                  type="button"
                >
                  Se Premium
                </button>
              ) : !gmailScopeConnected ? (
                <button
                  className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
                  onClick={() => signIn("google", { callbackUrl: "/import/email" })}
                  type="button"
                >
                  Koble til Gmail
                </button>
              ) : (
                <LoadingButton
                  isLoading={isScanningGmail}
                  loadingLabel="Skanner..."
                  onClick={scanGmail}
                  type="button"
                >
                  Skann Gmail
                </LoadingButton>
              )}
            </div>
          </div>
          {isScanningGmail ? (
            <div className="mt-4 rounded-xl bg-[#F0F4F8] p-4 text-sm font-semibold text-[#4A5568]">
              <p>Henter sannsynlige kvitteringer...</p>
              <p className="mt-1">Analyserer kandidater...</p>
            </div>
          ) : null}
          {scannedMessages !== null ? (
            <p className="mt-4 text-sm font-semibold text-[#5F6F82]">
              Skannet {scannedMessages} meldinger.
            </p>
          ) : null}
        </div>

        <MicrosoftImportPanel
          configured={microsoftConfigured}
          connected={microsoftConnected}
          key={microsoftScanId ?? microsoftImportState}
          messagesChecked={microsoftMessagesChecked}
          message={microsoftMessage}
          candidates={microsoftCandidates}
          scanId={microsoftScanId}
          onConnect={connectMicrosoft}
          onDisconnect={disconnectMicrosoft}
          onScan={scanMicrosoft}
          state={microsoftImportState}
        />

        <form
          className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]"
          onSubmit={parseEmail}
        >
          <label className="text-sm font-semibold text-[#4A5568]" htmlFor="emailText">
            E-posttekst
          </label>
          <textarea
            className="mt-2 min-h-56 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm text-[#0D1B2A] outline-none transition focus:border-[#0D1B2A]"
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

function MicrosoftImportPanel({
  configured,
  connected,
  state,
  message,
  messagesChecked,
  candidates,
  scanId,
  onConnect,
  onScan,
  onDisconnect,
}: {
  configured: boolean;
  connected: boolean;
  state: MicrosoftImportState;
  message: string | null;
  messagesChecked: number | null;
  candidates: OutlookCandidate[];
  scanId: string | null;
  onConnect: () => void;
  onScan: () => void;
  onDisconnect: () => void;
}) {
  const { showToast } = useToast();
  const content = getMicrosoftStateContent({ configured, connected, state, messagesChecked });
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

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wide ${content.tone}`}>{content.eyebrow}</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight">Outlook-import</h2>
          <p className="mt-2 text-sm leading-6 text-[#5F6F82]">{content.description}</p>
          <ul className="mt-3 space-y-1 text-xs font-semibold text-[#5F6F82]">
            <li>- Aboslutt bruker delegert Microsoft Graph-tilgang til innlogget brukers e-post.</li>
            <li>- Vi ber bare om lesetilgang til e-post, ikke sending, endring eller sletting.</li>
            <li>- Ingenting lagres som abonnement før du bekrefter det selv.</li>
          </ul>
          {message ? <p className="mt-3 text-sm font-semibold text-[#0D1B2A]">{message}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-48">
          {!connected ? (
            <button
              className="rounded-xl bg-[#0D1B2A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#15283c] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!configured || state === "connecting"}
              onClick={onConnect}
              type="button"
            >
              {state === "connecting" ? "Kobler til..." : "Fortsett med Microsoft"}
            </button>
          ) : (
            <>
              <LoadingButton
                isLoading={state === "scanning"}
                loadingLabel="Skanner..."
                onClick={onScan}
                type="button"
              >
                Skann Outlook
              </LoadingButton>
              <button
                className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50"
                disabled={state === "connecting" || state === "scanning"}
                onClick={onDisconnect}
                type="button"
              >
                Koble fra
              </button>
            </>
          )}
        </div>
      </div>
      {visibleCandidates.length > 0 ? (
        <div className="mt-5 grid gap-3">
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
                  <p className="mt-2 text-sm text-[#5F6F82]">{candidate.subject}</p>
                  <p className="mt-1 text-xs font-semibold text-[#5F6F82]">
                    {candidate.senderDomain ?? "Ukjent avsender"}
                    {candidate.receivedDate ? ` · ${new Date(candidate.receivedDate).toLocaleDateString("nb-NO")}` : ""}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs font-semibold text-[#5F6F82]">
                    {candidate.reasons.map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
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
                  <OutlookDraftInput label="Navn" value={draft.name} onChange={(name) => updateDraft(candidate.id, { name })} />
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
      ) : null}
    </section>
  );
}

function getMicrosoftStateContent({
  configured,
  connected,
  state,
  messagesChecked,
}: {
  configured: boolean;
  connected: boolean;
  state: MicrosoftImportState;
  messagesChecked: number | null;
}) {
  if (!configured) {
    return {
      eyebrow: "Ikke konfigurert",
      description: "Microsoft-import er klar i grensesnittet, men mangler serverkonfigurasjon.",
      tone: "text-[#8A4B13]",
    };
  }

  if (state === "connecting") {
    return {
      eyebrow: "Kobler til",
      description: "Du sendes til Microsoft for å godkjenne lesetilgang til Outlook.",
      tone: "text-[#C8102E]",
    };
  }

  if (state === "scanning") {
    return {
      eyebrow: "Skanner",
      description: "Vi leser nylige Outlook-meldinger og finner mulige abonnementer du kan vurdere.",
      tone: "text-[#C8102E]",
    };
  }

  if (state === "scan_failed") {
    return {
      eyebrow: "Feilet",
      description: "Outlook kunne ikke skannes akkurat nå. Prøv igjen eller koble til på nytt.",
      tone: "text-[#C8102E]",
    };
  }

  if (state === "no_candidates") {
    return {
      eyebrow: "Ingen sikre funn",
      description: "Skanningen ble fullført, men reglene fant ingen tydelige abonnementer.",
      tone: "text-[#5F6F82]",
    };
  }

  if (state === "review_results") {
    return {
      eyebrow: "Klar til gjennomgang",
      description: `${messagesChecked ?? 0} meldinger ble skannet. Velg og rediger forslagene du vil importere.`,
      tone: "text-emerald-700",
    };
  }

  if (state === "disconnected") {
    return {
      eyebrow: "Frakoblet",
      description: "Microsoft er koblet fra. Du kan koble til igjen når du vil.",
      tone: "text-[#5F6F82]",
    };
  }

  if (connected || state === "connected") {
    return {
      eyebrow: "Tilkoblet",
      description: "Microsoft er koblet til. Du kan starte en manuell testskann når du er klar.",
      tone: "text-emerald-700",
    };
  }

  return {
    eyebrow: "Ikke tilkoblet",
    description: "Koble til Microsoft for å forberede Outlook-import. Dette starter ikke automatisk skanning.",
    tone: "text-[#5F6F82]",
  };
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
    name: candidate.providerName,
    price: candidate.amount ? String(Math.round(candidate.amount)) : "",
    currency: candidate.currency ?? "NOK",
    billingInterval: candidate.billingInterval,
    nextPayment: "",
    category: inferOutlookCategory(candidate.providerName),
  };
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
                  <h3 className="text-xl font-extrabold tracking-tight">
                    {candidate.merchantName}
                  </h3>
                  <span className="rounded-full bg-[#EAF7EF] px-3 py-1 text-xs font-bold text-emerald-700">
                    {getConfidenceLabel(candidate)} · {getConfidenceScore(candidate)}%
                  </span>
                </div>
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
          <label className="text-sm font-semibold text-[#4A5568]">
            Navn
            <input
              className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
              onChange={(event) => updateDraft({ merchantName: event.target.value })}
              required
              value={draft.merchantName}
            />
          </label>
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
