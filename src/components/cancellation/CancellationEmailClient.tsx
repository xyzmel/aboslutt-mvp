"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { PremiumFeatureGate } from "@/components/billing/PremiumFeatureGate";
import {
  type CancellationProvider,
  type CancellationProviderMethod,
  getCancellationMethodLabel,
} from "@/data/cancellation-providers";
import { useToast } from "@/components/ui/ToastProvider";
import { getCancellationEventLabel, getCancellationStatusLabel } from "@/lib/cancellation";
import type { Subscription } from "@/types/subscription";

type CancellationRequestView = {
  id: string;
  status: string;
  method: string;
  recipientEmail: string;
  customerName: string;
  customerEmail: string;
  customerNumber: string | null;
  subject: string;
  body: string;
  consentConfirmed: boolean;
  sentAt: Date | string | null;
  confirmedAt: Date | string | null;
  rejectedAt: Date | string | null;
  providerResponse: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  events?: CancellationEventView[];
};

type CancellationEventView = {
  id: string;
  type: string;
  message: string;
  createdAt: Date | string;
};

type CancellationEmailClientProps = {
  subscription: Subscription;
  currentUserName: string | null;
  currentUserEmail: string | null;
  canSend: boolean;
  initialRequest: CancellationRequestView | null;
  provider: CancellationProvider | null;
};

type DraftForm = {
  customerName: string;
  customerEmail: string;
  customerNumber: string;
  extraNote: string;
  recipientEmail: string;
  method: CancellationProviderMethod;
  subject: string;
  body: string;
};

export function CancellationEmailClient({
  subscription,
  currentUserName,
  currentUserEmail,
  canSend,
  initialRequest,
  provider,
}: CancellationEmailClientProps) {
  const { showToast } = useToast();
  const initialMethod = getInitialMethod(initialRequest?.method, provider);
  const generatedDraft = useMemo(
    () => createLocalDraft(subscription.name, currentUserName ?? "", currentUserEmail ?? "", "", ""),
    [currentUserEmail, currentUserName, subscription.name],
  );
  const [request, setRequest] = useState(initialRequest);
  const [form, setForm] = useState<DraftForm>({
    customerName: initialRequest?.customerName ?? currentUserName ?? "",
    customerEmail: initialRequest?.customerEmail ?? currentUserEmail ?? "",
    customerNumber: initialRequest?.customerNumber ?? "",
    extraNote: "",
    recipientEmail: initialRequest?.recipientEmail ?? provider?.cancellationEmail ?? "",
    method: initialMethod,
    subject: initialRequest?.subject ?? generatedDraft.subject,
    body: initialRequest?.body ?? generatedDraft.body,
  });
  const [consentConfirmed, setConsentConfirmed] = useState(Boolean(initialRequest?.consentConfirmed));
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const statusLabel = getCancellationStatusLabel(request?.status);
  const canSendEmailMethod = form.method === "email" && Boolean(form.recipientEmail);
  const showManualPrimary = form.method !== "email";

  function updateForm(field: keyof DraftForm, value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "method" && value !== "email") {
        next.recipientEmail = current.recipientEmail;
      }
      if (["customerName", "customerEmail", "customerNumber", "extraNote"].includes(field)) {
        const nextDraft = createLocalDraft(
          subscription.name,
          next.customerName,
          next.customerEmail,
          next.customerNumber,
          next.extraNote,
        );
        return { ...next, subject: next.subject || nextDraft.subject, body: nextDraft.body };
      }
      return next as DraftForm;
    });
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancellation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; request?: CancellationRequestView };

      if (!response.ok || !result.request) {
        throw new Error(result.message ?? "Kunne ikke lagre utkastet.");
      }

      setRequest(result.request);
      setMessage("Utkastet er lagret. Kontroller teksten før du sender eller bruker leverandørens anbefalte metode.");
      showToast({ title: "Utkast lagret", message: "Oppsigelsesutkastet er klart.", tone: "success" });
    } catch {
      const userMessage = "Kunne ikke lagre utkastet akkurat nå.";
      setMessage(userMessage);
      showToast({ title: "Lagring feilet", message: userMessage, tone: "error" });
    } finally {
      setIsWorking(false);
    }
  }

  async function sendEmail() {
    if (!request) {
      setMessage("Lagre utkastet før du sender.");
      return;
    }

    if (!canSendEmailMethod) {
      setMessage("Mottakeradresse mangler. Kopier utkastet eller bruk leverandørens anbefalte oppsigelsesmetode.");
      return;
    }

    if (!consentConfirmed) {
      setMessage("Du må bekrefte samtykke før Aboslutt kan sende oppsigelsen.");
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancellation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", requestId: request.id }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; request?: CancellationRequestView };

      if (!response.ok || !result.request) {
        throw new Error(result.message ?? "Kunne ikke sende oppsigelsen.");
      }

      setRequest(result.request);
      setMessage("Oppsigelsen er sendt. Abonnementet er ikke markert som avsluttet før du bekrefter svar fra leverandøren.");
      showToast({ title: "Oppsigelse sendt", message: "Følg opp når leverandøren svarer.", tone: "success" });
    } catch {
      const userMessage = "Kunne ikke sende oppsigelsen akkurat nå.";
      setMessage(userMessage);
      showToast({ title: "Sending feilet", message: userMessage, tone: "error" });
    } finally {
      setIsWorking(false);
    }
  }

  async function updateStatus(status: "confirmed_cancelled" | "rejected" | "manual_required") {
    if (!request) {
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancellation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", requestId: request.id, status }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; request?: CancellationRequestView };

      if (!response.ok || !result.request) {
        throw new Error(result.message ?? "Kunne ikke oppdatere status.");
      }

      setRequest(result.request);
      setMessage(
        status === "confirmed_cancelled"
          ? "Bekreftet som avsluttet. Abonnementet er markert som avsluttet."
          : "Status er oppdatert.",
      );
      showToast({ title: "Status oppdatert", message: "Oppsigelsen er lagret.", tone: "success" });
    } catch {
      const userMessage = "Kunne ikke oppdatere status akkurat nå.";
      setMessage(userMessage);
      showToast({ title: "Oppdatering feilet", message: userMessage, tone: "error" });
    } finally {
      setIsWorking(false);
    }
  }

  async function addNote() {
    if (!request || !note.trim()) {
      setMessage("Skriv et notat først.");
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancellation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "note", requestId: request.id, note }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; request?: CancellationRequestView };

      if (!response.ok || !result.request) {
        throw new Error(result.message ?? "Kunne ikke lagre notatet.");
      }

      setRequest(result.request);
      setNote("");
      setMessage("Notatet er lagt til.");
      showToast({ title: "Notat lagt til", message: "Notatet er lagret på oppsigelsen.", tone: "success" });
    } catch {
      const userMessage = "Kunne ikke lagre notatet akkurat nå.";
      setMessage(userMessage);
      showToast({ title: "Lagring feilet", message: userMessage, tone: "error" });
    } finally {
      setIsWorking(false);
    }
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(`${form.subject}\n\n${form.body}`).catch(() => null);
    setMessage("Utkastet er kopiert.");
    showToast({ title: "Kopiert", message: "Utkastet ligger på utklippstavlen.", tone: "success" });
  }

  return (
    <section className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <Link className="text-sm font-bold text-[#C8102E] hover:underline" href={`/subscriptions/${subscription.id}`}>
        Tilbake til abonnementet
      </Link>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
          <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Oppsigelse</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{subscription.name}</h1>
          <dl className="mt-5 grid gap-3 text-sm">
            <InfoRow label="Potensiell sparing" value={`${subscription.monthlyCost} kr/mnd`} />
            <InfoRow label="Status" value={statusLabel ?? "Ikke sendt"} />
            <InfoRow label="Anbefalt metode" value={provider ? getCancellationMethodLabel(provider.method) : "Ukjent"} />
          </dl>

          <ProviderGuidance provider={provider} />

          <div className="mt-5 rounded-xl bg-[#FFF6E8] p-4 text-sm font-semibold leading-6 text-[#8A4B13]">
            Ikke alle leverandører godtar oppsigelse på e-post. Bruk anbefalt metode når Aboslutt kjenner den.
          </div>

          <div className="mt-5 rounded-xl bg-[#FFF6E8] p-4 text-sm leading-6 text-[#8A4B13]">
            Aboslutt sender bare e-post på dine vegne når du godkjenner det. Abonnementet regnes ikke som avsluttet før leverandøren bekrefter det.
          </div>
          {!canSend ? (
            <div className="mt-4">
              <PremiumFeatureGate
                benefit="Premium lar deg sende oppsigelser via Aboslutt når leverandøren støtter e-postmetoden."
                blockedAction="Sending via Aboslutt er ikke tilgjengelig i gratisplanen."
                description="Du kan fortsatt lage og kopiere oppsigelsesutkastet gratis."
                title="Sending krever Premium"
              />
            </div>
          ) : null}
        </aside>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
          <form className="grid gap-4" onSubmit={saveDraft}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Ditt navn" onChange={(value) => updateForm("customerName", value)} required value={form.customerName} />
              <TextInput label="Din e-post" onChange={(value) => updateForm("customerEmail", value)} required type="email" value={form.customerEmail} />
            </div>

            <label className="text-sm font-semibold text-[#4A5568]">
              Oppsigelsesmetode
              <select
                className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-4 py-3 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
                onChange={(event) => updateForm("method", event.target.value)}
                value={form.method}
              >
                <option value="email">E-post</option>
                <option value="account_page">Kontoside</option>
                <option value="contact_form">Kontaktskjema</option>
                <option value="chat">Chat</option>
                <option value="app_store">App Store / Google Play</option>
                <option value="partner_billing">Partnerfakturering</option>
                <option value="manual_unknown">Må bekreftes manuelt</option>
              </select>
            </label>

            {form.method === "email" ? (
              <TextInput
                helperText="Kun bruk e-post hvis leverandøren faktisk aksepterer oppsigelse på e-post."
                label="Mottaker e-post"
                onChange={(value) => updateForm("recipientEmail", value)}
                required
                type="email"
                value={form.recipientEmail}
              />
            ) : (
              <ManualMethodBox provider={provider} method={form.method} />
            )}

            <details className="rounded-xl bg-[#F7F9FC] p-4">
              <summary className="cursor-pointer text-sm font-extrabold text-[#0D1B2A]">Flere detaljer</summary>
              <div className="mt-4 grid gap-4">
                <TextInput
                  helperText="Valgfritt. Noen leverandører ber om kundenummer, medlemsnummer eller referanse."
                  label="Kundenummer / medlemsnummer (valgfritt)"
                  onChange={(value) => updateForm("customerNumber", value)}
                  value={form.customerNumber}
                />
                <label className="text-sm font-semibold text-[#4A5568]">
                  Ekstra beskjed (valgfritt)
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-xl border border-[#DBE4EE] bg-white px-4 py-3 text-sm leading-6 text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
                    onChange={(event) => updateForm("extraNote", event.target.value)}
                    value={form.extraNote}
                  />
                </label>
              </div>
            </details>

            <TextInput label="Emne" onChange={(value) => updateForm("subject", value)} required value={form.subject} />
            <label className="text-sm font-semibold text-[#4A5568]">
              E-postutkast
              <textarea
                className="mt-2 min-h-72 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm leading-6 text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
                onChange={(event) => updateForm("body", event.target.value)}
                required
                value={form.body}
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold hover:border-[#C8102E]/50" disabled={isWorking} type="submit">
                Lagre utkast
              </button>
              <button className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold hover:border-[#C8102E]/50" onClick={copyDraft} type="button">
                Kopier utkast
              </button>
              {provider?.cancellationUrl ? (
                <Link
                  className="rounded-xl bg-[#0D1B2A] px-5 py-3 text-center text-sm font-bold text-white hover:bg-[#13263a]"
                  href={provider.cancellationUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Åpne oppsigelsesside
                </Link>
              ) : null}
            </div>
          </form>

          {showManualPrimary ? (
            <div className="mt-6 rounded-2xl bg-[#F7F9FC] p-4 text-sm leading-6 text-[#4A5568]">
              Denne leverandøren ser ut til å kreve at du bruker kontoside, app, chat eller kundeservice. Lagre gjerne utkastet som hjelp, men bruk leverandørens anbefalte metode først.
            </div>
          ) : null}

          <div className="mt-6 border-t border-[#DBE4EE] pt-5">
            <label className="flex items-start gap-3 rounded-xl bg-[#F7F9FC] p-4 text-sm font-semibold text-[#0D1B2A]">
              <input
                checked={consentConfirmed}
                className="mt-1 h-5 w-5 accent-[#C8102E]"
                onChange={(event) => setConsentConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>Jeg bekrefter at jeg ønsker at Aboslutt sender denne oppsigelsen på mine vegne.</span>
            </label>
            <button
              className="mt-4 w-full rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] disabled:opacity-50"
              disabled={!canSend || !request || !consentConfirmed || !canSendEmailMethod || isWorking}
              onClick={sendEmail}
              type="button"
            >
              Send oppsigelse via Aboslutt
            </button>
            {!canSendEmailMethod ? (
              <p className="mt-2 text-xs font-semibold text-[#5F6F82]">
                Sending via Aboslutt krever en gyldig mottakeradresse. For denne leverandøren kan oppsigelse via kontoside eller app være riktigere.
              </p>
            ) : null}
          </div>

          {request ? (
            <div className="mt-6 rounded-2xl bg-[#F7F9FC] p-4">
              <h2 className="text-sm font-extrabold">Oppfølging</h2>
              <p className="mt-2 text-sm text-[#5F6F82]">
                Når leverandøren svarer, oppdaterer du status her. Først da markeres abonnementet som avsluttet.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <StatusButton disabled={isWorking} label="Bekreftet avsluttet" onClick={() => updateStatus("confirmed_cancelled")} />
                <StatusButton disabled={isWorking} label="Avvist" onClick={() => updateStatus("rejected")} />
                <StatusButton disabled={isWorking} label="Krever manuell handling" onClick={() => updateStatus("manual_required")} />
              </div>
            </div>
          ) : null}

          {request ? (
            <section className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-[#DBE4EE]">
              <h2 className="text-sm font-extrabold">Tidslinje</h2>
              <CancellationTimeline events={request.events ?? []} status={request.status} />
              <div className="mt-5 border-t border-[#DBE4EE] pt-4">
                <label className="text-sm font-semibold text-[#4A5568]">
                  Legg til notat
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm leading-6 text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="F.eks. Leverandør svarte at jeg må logge inn og avslutte selv."
                    value={note}
                  />
                </label>
                <button
                  className="mt-3 rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold hover:border-[#C8102E]/50 disabled:opacity-50"
                  disabled={isWorking || !note.trim()}
                  onClick={addNote}
                  type="button"
                >
                  Legg til notat
                </button>
              </div>
            </section>
          ) : null}

          {message ? (
            <p className="mt-4 rounded-xl bg-[#F0F4F8] px-4 py-3 text-sm font-semibold text-[#0D1B2A]">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CancellationTimeline({
  events,
  status,
}: {
  events: CancellationEventView[];
  status: string;
}) {
  const fallbackSteps = getFallbackTimeline(status);
  const visibleEvents = events.length > 0 ? events : fallbackSteps;

  return (
    <ol className="mt-4 grid gap-3">
      {visibleEvents.map((event, index) => (
        <li className="flex gap-3" key={event.id}>
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C8102E] text-xs font-black text-white">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-bold text-[#0D1B2A]">{getCancellationEventLabel(event.type)}</p>
            <p className="mt-1 text-sm leading-6 text-[#5F6F82]">{event.message}</p>
            <p className="mt-1 text-xs font-semibold text-[#5F6F82]">{formatTimelineDate(event.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ProviderGuidance({ provider }: { provider: CancellationProvider | null }) {
  if (!provider) {
    return (
      <div className="mt-5 rounded-xl bg-[#F7F9FC] p-4 text-sm leading-6 text-[#4A5568]">
        Vi fant ikke en trygg oppsigelsesmetode for denne leverandøren ennå. Kontroller mottaker eller bruk leverandørens egne sider.
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl bg-[#F7F9FC] p-4 text-sm leading-6 text-[#4A5568]">
      <p className="font-bold text-[#0D1B2A]">{provider.displayName}</p>
      <p className="mt-1">{provider.notes}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-white px-3 py-1 text-[#5F6F82]">
          {getCancellationMethodLabel(provider.method)}
        </span>
        {provider.requiresLogin ? <span className="rounded-full bg-white px-3 py-1 text-[#5F6F82]">Krever innlogging</span> : null}
        {provider.requiresCustomerNumber ? <span className="rounded-full bg-white px-3 py-1 text-[#5F6F82]">Kundenummer kan være nyttig</span> : null}
        {provider.confidence === "needs_review" ? <span className="rounded-full bg-[#FFF6E8] px-3 py-1 text-[#8A4B13]">Må kvalitetssikres</span> : null}
      </div>
    </div>
  );
}

function ManualMethodBox({
  provider,
  method,
}: {
  provider: CancellationProvider | null;
  method: CancellationProviderMethod;
}) {
  return (
    <div className="rounded-xl border border-[#DBE4EE] bg-[#F7F9FC] p-4 text-sm leading-6 text-[#4A5568]">
      <p className="font-bold text-[#0D1B2A]">{getCancellationMethodLabel(method)}</p>
      <p className="mt-1">
        E-post er ikke valgt som primær metode. Bruk leverandørens kontoside, app, kontaktskjema eller kundeservice, og kopier utkastet hvis du trenger tekst.
      </p>
      {provider?.supportUrl ? (
        <Link className="mt-3 inline-flex font-bold text-[#C8102E] hover:underline" href={provider.supportUrl} rel="noreferrer" target="_blank">
          Åpne kundeservice
        </Link>
      ) : null}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  helperText?: string;
}) {
  return (
    <label className="text-sm font-semibold text-[#4A5568]">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
      {helperText ? <span className="mt-1 block text-xs font-medium text-[#5F6F82]">{helperText}</span> : null}
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="font-semibold text-[#5F6F82]">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}

function StatusButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      className="rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50 disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function createLocalDraft(
  subscriptionName: string,
  customerName: string,
  customerEmail: string,
  customerNumber: string,
  extraNote: string,
) {
  const subject = `Oppsigelse av ${subscriptionName}`;
  const customerNumberLine = customerNumber ? `Kundenummer/medlemsnummer: ${customerNumber}\n` : "";
  const extraNoteLine = extraNote ? `\nTilleggsinformasjon:\n${extraNote}\n` : "";
  const body = `Hei,

Jeg ønsker å si opp abonnementet mitt på ${subscriptionName}.

Navn: ${customerName}
E-post: ${customerEmail}
${customerNumberLine}
${extraNoteLine}
Vennligst bekreft skriftlig at abonnementet er avsluttet, og oppgi siste dato for eventuell tilgang eller siste fakturaperiode.

Hilsen
${customerName}

--
Denne oppsigelsen er sendt via Aboslutt på vegne av kunden.`;

  return { subject, body };
}

function getInitialMethod(value: string | null | undefined, provider: CancellationProvider | null): CancellationProviderMethod {
  const allowedMethods: CancellationProviderMethod[] = [
    "email",
    "account_page",
    "contact_form",
    "chat",
    "app_store",
    "partner_billing",
    "manual_unknown",
  ];

  if (value && allowedMethods.includes(value as CancellationProviderMethod)) {
    return value as CancellationProviderMethod;
  }

  return provider?.method ?? "email";
}

function getFallbackTimeline(status: string): CancellationEventView[] {
  const now = new Date().toISOString();
  const baseSteps: CancellationEventView[] = [
    {
      id: "fallback-draft",
      type: "draft_created",
      message: "Utkastet er opprettet.",
      createdAt: now,
    },
    {
      id: "fallback-ready",
      type: "ready",
      message: "Oppsigelsen er klar til sending eller manuell bruk.",
      createdAt: now,
    },
  ];

  if (["awaiting_confirmation", "confirmed_cancelled", "rejected", "manual_required"].includes(status)) {
    baseSteps.push(
      {
        id: "fallback-email-sent",
        type: "email_sent",
        message: "Oppsigelsen er sendt på vegne av bruker.",
        createdAt: now,
      },
      {
        id: "fallback-awaiting",
        type: "awaiting_confirmation",
        message: "Venter på bekreftelse fra leverandøren.",
        createdAt: now,
      },
    );
  }

  if (["confirmed_cancelled", "rejected", "manual_required"].includes(status)) {
    baseSteps.push({
      id: `fallback-${status}`,
      type: status,
      message: getCancellationStatusLabel(status) ?? "Status er oppdatert.",
      createdAt: now,
    });
  }

  return baseSteps;
}

function formatTimelineDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
