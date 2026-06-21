"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
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
  const router = useRouter();
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
  const [editingCandidate, setEditingCandidate] = useState<EmailSubscriptionCandidate | null>(null);
  const [candidateDraft, setCandidateDraft] = useState<CandidateDraft | null>(null);
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);
  const [reportingCandidate, setReportingCandidate] = useState<EmailSubscriptionCandidate | null>(null);

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
      };
      setGmailConnected(result.googleConnected);
      setGmailScopeConnected(result.gmailScopeConnected);
      setGmailScanAvailable(result.gmailScanAvailable ?? true);
    }

    loadConnectionStatus();
  }, [router, status]);

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
        setErrorMessage(
          "Fant ingen sikre abonnementer. Prøv å lime inn en kvittering eller legg til manuelt.",
        );
      }
    } catch (error) {
      setCandidates([]);
      setErrorMessage(error instanceof Error ? error.message : "Kunne ikke lese e-posten.");
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
        setErrorMessage(
          "Fant ingen sikre abonnementer. Prøv å lime inn en kvittering eller legg til manuelt.",
        );
      }
    } catch (error) {
      setCandidates([]);
      setErrorMessage(error instanceof Error ? error.message : "Kunne ikke skanne Gmail.");
    } finally {
      setIsScanningGmail(false);
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
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? result.error ?? "Kunne ikke lagre abonnementet.");
      }

      setSavedCandidateName(candidateDraft.merchantName);
      setEmailText("");
      ignoreCandidate(editingCandidate);
      setEditingCandidate(null);
      setCandidateDraft(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Kunne ikke lagre abonnementet.");
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
          Skann Gmail med read-only tilgang, eller lim inn tekst fra en kvittering.
          Aboslutt lagrer ikke rå e-postinnhold, bare abonnementet du bekrefter.
        </p>

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
                <p className="mt-2 rounded-xl bg-[#FFF6E8] px-3 py-2 text-xs font-semibold text-[#8A4B13]">
                  Automatisk skanning er en Premium-funksjon. Du kan fortsatt legge inn abonnementer manuelt gratis.
                </p>
              ) : null}
              <p className="mt-3 text-xs font-semibold text-[#C8102E]">
                Forslag kan inneholde feil. Bekreft alltid kandidaten før den lagres.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:w-44">
              {!gmailScanAvailable ? (
                <Link
                  className="rounded-xl bg-[#C8102E] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#a90d27]"
                  href="/pricing"
                >
                  Se Premium
                </Link>
              ) : !gmailScopeConnected ? (
                <button
                  className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
                  onClick={() => signIn("google", { callbackUrl: "/import/email" })}
                  type="button"
                >
                  Koble til Gmail
                </button>
              ) : (
                <button
                  className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] disabled:opacity-55"
                  disabled={isScanningGmail}
                  onClick={scanGmail}
                  type="button"
                >
                  {isScanningGmail ? "Skanner..." : "Skann Gmail"}
                </button>
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
          <button
            className="mt-4 rounded-xl bg-[#0D1B2A] px-5 py-3 text-sm font-bold text-white hover:bg-[#15283c] disabled:opacity-55"
            disabled={isParsing}
            type="submit"
          >
            {isParsing ? "Leser tekst..." : "Finn abonnement"}
          </button>
        </form>

        {errorMessage ? (
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
      </section>

      <AppFooter compact />
    </main>
  );
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
