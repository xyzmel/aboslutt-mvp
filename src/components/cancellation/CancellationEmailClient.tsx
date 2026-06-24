"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastProvider";
import { getCancellationEventLabel } from "@/lib/cancellation";
import { getCancellationGuideMethodLabel } from "@/lib/provider-cancellation-guide.mjs";
import { getProviderInitials } from "@/lib/subscription-provider-catalog.mjs";
import type { Subscription } from "@/types/subscription";

type CancellationMode = "aboslutt_email" | "provider_portal" | "manual_draft";

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
  requestedEndDate: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  events?: CancellationEventView[];
  delivery?: {
    recipient: string;
    deliveryStatus: string;
    bounceStatus: string;
    sentAt: Date | string | null;
  } | null;
};

type CancellationEventView = {
  id: string;
  type: string;
  message: string;
  createdAt: Date | string;
};

type ProviderCancellationGuide = {
  providerId: string;
  providerName: string;
  logoPath: string | null;
  method: "website" | "email" | "phone" | "app" | "manual" | "unknown";
  instructions: string[];
  requiredInformation: string[];
  confirmationExpected: string | null;
  officialUrl: string | null;
  lastVerifiedAt: Date | string | null;
  supportsAbosluttSending: boolean;
  sendingVerifiedAt: Date | string | null;
  requiresProviderLogin: boolean;
  requiresCustomerReference: boolean;
};

type DraftForm = {
  customerName: string;
  customerEmail: string;
  customerNumber: string;
  requestedEndDate: string;
  subject: string;
  body: string;
};

export function CancellationEmailClient({
  subscription,
  currentUserName,
  currentUserEmail,
  canSend,
  initialRequest,
  guide,
}: {
  subscription: Subscription;
  currentUserName: string | null;
  currentUserEmail: string | null;
  canSend: boolean;
  initialRequest: CancellationRequestView | null;
  guide: ProviderCancellationGuide | null;
}) {
  const { showToast } = useToast();
  const recommendedMode = getRecommendedMode(guide, canSend);
  const initialMode = normalizeMode(initialRequest?.method) ?? recommendedMode;
  const draft = useMemo(
    () => createLocalDraft(subscription.name, currentUserName ?? "", currentUserEmail ?? "", ""),
    [currentUserEmail, currentUserName, subscription.name],
  );
  const [request, setRequest] = useState(initialRequest);
  const [mode, setMode] = useState<CancellationMode>(initialMode);
  const [step, setStep] = useState(initialRequest ? (isSent(initialRequest.status) ? 3 : 2) : 1);
  const [form, setForm] = useState<DraftForm>({
    customerName: initialRequest?.customerName ?? currentUserName ?? "",
    customerEmail: initialRequest?.customerEmail ?? currentUserEmail ?? "",
    customerNumber: initialRequest?.customerNumber ?? "",
    requestedEndDate: initialRequest?.requestedEndDate ?? "",
    subject: initialRequest?.subject ?? draft.subject,
    body: initialRequest?.body ?? draft.body,
  });
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const modes = getAvailableModes(guide, canSend);

  function updateForm(field: keyof DraftForm, value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (["customerName", "customerEmail", "customerNumber"].includes(field)) {
        const nextDraft = createLocalDraft(
          subscription.name,
          next.customerName,
          next.customerEmail,
          next.customerNumber,
        );
        return { ...next, body: nextDraft.body };
      }
      return next;
    });
  }

  async function saveDraft(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (isWorking) return null;
    setIsWorking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancellation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, method: mode }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        request?: CancellationRequestView;
      };
      if (!response.ok || !result.request) {
        throw new Error(result.message ?? "Kunne ikke klargjøre oppsigelsen.");
      }
      setRequest(result.request);
      setStep(2);
      setMessage("Oppsigelsen er klargjort. Kontroller innholdet før du fortsetter.");
      return result.request;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke klargjøre oppsigelsen.");
      return null;
    } finally {
      setIsWorking(false);
    }
  }

  async function sendViaAboslutt() {
    if (!request || isWorking) return;
    if (!authorizationConfirmed) {
      setMessage("Du må godkjenne den begrensede fullmakten før sending.");
      return;
    }
    const savedRequest = await saveDraft();
    if (!savedRequest) return;
    setIsWorking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancellation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          requestId: savedRequest.id,
          authorizationConfirmed: true,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        request?: CancellationRequestView;
      };
      if (!response.ok || !result.request) {
        throw new Error(result.message ?? "Kunne ikke sende oppsigelsen.");
      }
      setRequest(result.request);
      setStep(3);
      setMessage(null);
      showToast({
        title: "Oppsigelse sendt",
        message: "Venter på bekreftelse fra leverandøren.",
        tone: "success",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke sende oppsigelsen.");
    } finally {
      setIsWorking(false);
    }
  }

  async function markSent() {
    if (!request || isWorking) return;
    const savedRequest = await saveDraft();
    if (!savedRequest) return;
    setIsWorking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancellation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_sent", requestId: savedRequest.id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        request?: CancellationRequestView;
      };
      if (!response.ok || !result.request) throw new Error(result.message);
      setRequest(result.request);
      setStep(3);
      showToast({
        title: "Oppsigelse registrert",
        message: "Venter på bekreftelse fra leverandøren.",
        tone: "success",
      });
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "Kunne ikke oppdatere oppsigelsen.");
    } finally {
      setIsWorking(false);
    }
  }

  async function updateStatus(status: "confirmed_cancelled" | "manual_required") {
    if (!request || isWorking) return;
    if (
      status === "confirmed_cancelled" &&
      !window.confirm("Bekreft at leverandøren faktisk har avsluttet abonnementet.")
    ) {
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
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        request?: CancellationRequestView;
      };
      if (!response.ok || !result.request) throw new Error(result.message);
      setRequest(result.request);
      setMessage(
        status === "confirmed_cancelled"
          ? "Abonnementet er registrert som bekreftet avsluttet."
          : "Oppsigelsen er markert for manuell oppfølging.",
      );
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "Kunne ikke oppdatere status.");
    } finally {
      setIsWorking(false);
    }
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(`${form.subject}\n\n${form.body}`).catch(() => null);
    setMessage("Oppsigelsesutkastet er kopiert.");
  }

  function downloadDocumentation() {
    if (!request) return;
    const content = [
      `Oppsigelse: ${subscription.name}`,
      `Status: ${getPublicCancellationState(request.status)}`,
      request.delivery?.recipient ? `Mottaker: ${request.delivery.recipient}` : "",
      request.sentAt ? `Sendt: ${formatDateTime(request.sentAt)}` : "",
      "",
      request.subject,
      "",
      request.body,
    ].filter(Boolean).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `oppsigelse-${subscription.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
      <Link className="text-sm font-bold text-[#C8102E] hover:underline" href={`/subscriptions/${subscription.id}`}>
        Tilbake til abonnementet
      </Link>

      <ProviderSummary guide={guide} request={request} subscription={subscription} />

      <nav aria-label="Fremdrift" className="mt-5 grid grid-cols-3 gap-2">
        {["Velg metode", "Kontroller", "Følg opp"].map((label, index) => {
          const number = index + 1;
          return (
            <div className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${step >= number ? "bg-[#0D1B2A] text-white" : "bg-white text-[#5F6F82] ring-1 ring-[#DBE4EE]"}`} key={label}>
              {number}. {label}
            </div>
          );
        })}
      </nav>

      <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE] sm:p-6">
        {step === 1 ? (
          <section>
            <p className="text-xs font-bold uppercase text-[#C8102E]">Steg 1</p>
            <h1 className="mt-2 text-2xl font-extrabold">Velg hvordan du vil avslutte</h1>
            <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
              Vi anbefaler den tryggeste verifiserte metoden for denne leverandøren.
            </p>
            <div className="mt-5 grid gap-3">
              {modes.map((item) => (
                <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${mode === item.mode ? "border-[#C8102E] bg-[#FFF7F8]" : "border-[#DBE4EE]"}`} key={item.mode}>
                  <input checked={mode === item.mode} name="cancellation-mode" onChange={() => setMode(item.mode)} type="radio" />
                  <span>
                    <span className="flex flex-wrap items-center gap-2 font-bold">
                      {item.label}
                      {item.mode === recommendedMode ? <span className="rounded-full bg-[#EAF7EF] px-2 py-0.5 text-xs text-[#166534]">Anbefalt</span> : null}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[#5F6F82]">{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <button className="mt-5 rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#A90D27]" onClick={() => setStep(2)} type="button">
              Fortsett
            </button>
          </section>
        ) : null}

        {step === 2 ? (
          <form onSubmit={saveDraft}>
            <p className="text-xs font-bold uppercase text-[#C8102E]">Steg 2</p>
            <h1 className="mt-2 text-2xl font-extrabold">Kontroller oppsigelsen</h1>
            <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
              Kontroller opplysningene. Sending eller åpning av en leverandørside garanterer ikke at oppsigelsen blir godkjent.
            </p>

            {guide && mode !== "aboslutt_email" ? (
              <details className="mt-5 rounded-xl border border-[#DBE4EE] p-4">
                <summary className="cursor-pointer text-sm font-bold">Vis leverandørens veiledning</summary>
                <ol className="mt-4 grid gap-3">
                  {guide.instructions.map((instruction, index) => (
                    <li className="flex gap-3 text-sm leading-6 text-[#4A5568]" key={`${index}-${instruction}`}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0D1B2A] text-xs font-bold text-white">{index + 1}</span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextInput label="Ditt navn" onChange={(value) => updateForm("customerName", value)} required value={form.customerName} />
              <TextInput label="Din e-post" onChange={(value) => updateForm("customerEmail", value)} required type="email" value={form.customerEmail} />
              <TextInput
                label={guide?.requiresCustomerReference ? "Kundenummer / medlemsreferanse" : "Kundenummer / medlemsreferanse (valgfritt)"}
                onChange={(value) => updateForm("customerNumber", value)}
                required={guide?.requiresCustomerReference}
                value={form.customerNumber}
              />
              <TextInput label="Ønsket sluttdato (valgfritt)" onChange={(value) => updateForm("requestedEndDate", value)} type="date" value={form.requestedEndDate} />
            </div>
            <TextInput className="mt-4" label="Emne" onChange={(value) => updateForm("subject", value)} required value={form.subject} />
            <label className="mt-4 block text-sm font-semibold text-[#4A5568]">
              Melding
              <textarea className="mt-2 min-h-56 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm leading-6 outline-none focus:border-[#0D1B2A] focus:ring-2 focus:ring-[#0D1B2A]/15" onChange={(event) => updateForm("body", event.target.value)} required value={form.body} />
            </label>

            {mode === "aboslutt_email" && request ? (
              <label className="mt-5 flex items-start gap-3 rounded-xl bg-[#F7F9FC] p-4 text-sm font-semibold leading-6">
                <input checked={authorizationConfirmed} className="mt-1 h-5 w-5 accent-[#C8102E]" onChange={(event) => setAuthorizationConfirmed(event.target.checked)} type="checkbox" />
                <span>Jeg gir Aboslutt begrenset fullmakt til å sende denne oppsigelsen én gang på mine vegne. Jeg forstår at leverandøren må bekrefte avslutningen.</span>
              </label>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {!request ? (
                <button className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={isWorking} type="submit">
                  {isWorking ? "Klargjør …" : "Klargjør oppsigelsen"}
                </button>
              ) : mode === "aboslutt_email" ? (
                <button className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={isWorking || !authorizationConfirmed} onClick={sendViaAboslutt} type="button">
                  {isWorking ? "Sender …" : "Send via Aboslutt"}
                </button>
              ) : mode === "provider_portal" ? (
                <>
                  {guide?.officialUrl ? (
                    <Link className="rounded-xl bg-[#C8102E] px-5 py-3 text-center text-sm font-bold text-white" href={guide.officialUrl} rel="noopener noreferrer" target="_blank">
                      Åpne leverandørens side
                    </Link>
                  ) : null}
                  <button className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold" disabled={isWorking} onClick={markSent} type="button">
                    Jeg har sendt oppsigelsen
                  </button>
                </>
              ) : (
                <>
                  <button className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white" onClick={copyDraft} type="button">
                    Kopier utkast
                  </button>
                  <button className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold" disabled={isWorking} onClick={markSent} type="button">
                    Jeg har sendt oppsigelsen
                  </button>
                </>
              )}
              <button className="rounded-xl px-3 py-3 text-sm font-bold text-[#5F6F82]" onClick={() => { setRequest(null); setStep(1); }} type="button">
                Endre metode
              </button>
            </div>
          </form>
        ) : null}

        {step === 3 && request ? (
          <section>
            <p className="text-xs font-bold uppercase text-[#C8102E]">Steg 3</p>
            <h1 className="mt-2 text-2xl font-extrabold">Følg opp</h1>
            <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
              Oppsigelsen er sendt eller registrert som sendt. Abonnementet avsluttes først når leverandøren bekrefter det.
            </p>
            <dl className="mt-5 grid gap-3 rounded-xl bg-[#F7F9FC] p-4 text-sm sm:grid-cols-2">
              <InfoRow label="Status" value={getPublicCancellationState(request.status)} />
              <InfoRow label="Sendt" value={request.sentAt ? formatDateTime(request.sentAt) : "Registrert"} />
              {request.delivery?.recipient ? <InfoRow label="Mottaker" value={request.delivery.recipient} /> : null}
              {request.delivery ? <InfoRow label="Levering" value={getDeliveryLabel(request.delivery.deliveryStatus)} /> : null}
            </dl>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={isWorking || request.status === "confirmed_cancelled"} onClick={() => updateStatus("confirmed_cancelled")} type="button">
                Bekreft avsluttet
              </button>
              <button className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold" onClick={downloadDocumentation} type="button">
                Last ned dokumentasjon
              </button>
              <button className="rounded-xl px-3 py-3 text-sm font-bold text-[#5F6F82]" disabled={isWorking} onClick={() => updateStatus("manual_required")} type="button">
                Krever manuell handling
              </button>
            </div>
            <details className="mt-5 rounded-xl border border-[#DBE4EE] p-4">
              <summary className="cursor-pointer text-sm font-bold">Vis hendelser</summary>
              <CancellationTimeline events={request.events ?? []} />
            </details>
          </section>
        ) : null}

        {message ? <p className="mt-5 rounded-xl bg-[#F0F4F8] px-4 py-3 text-sm font-semibold">{message}</p> : null}
      </div>
    </section>
  );
}

function ProviderSummary({
  guide,
  request,
  subscription,
}: {
  guide: ProviderCancellationGuide | null;
  request: CancellationRequestView | null;
  subscription: Subscription;
}) {
  return (
    <section className="mt-5 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {guide?.logoPath ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white ring-1 ring-[#DBE4EE]">
            <Image alt="" height={30} src={guide.logoPath} width={30} />
          </span>
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0D1B2A] text-sm font-black text-white">
            {getProviderInitials(guide?.providerName ?? subscription.name)}
          </span>
        )}
        <div>
          <p className="text-xs font-bold uppercase text-[#C8102E]">Oppsigelse</p>
          <h1 className="mt-1 text-xl font-extrabold">{guide?.providerName ?? subscription.name}</h1>
          <p className="mt-1 text-sm text-[#5F6F82]">{subscription.monthlyCost} kr per måned</p>
        </div>
      </div>
      <span className="w-fit rounded-full bg-[#FFF6E8] px-3 py-1.5 text-xs font-bold text-[#8A4B13]">
        {getPublicCancellationState(request?.status)}
      </span>
    </section>
  );
}

function CancellationTimeline({ events }: { events: CancellationEventView[] }) {
  return (
    <ol className="mt-4 grid gap-3">
      {events.map((event, index) => (
        <li className="flex gap-3" key={event.id}>
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0D1B2A] text-xs font-bold text-white">{index + 1}</span>
          <div>
            <p className="text-sm font-bold">{getCancellationEventLabel(event.type)}</p>
            <p className="mt-1 text-sm text-[#5F6F82]">{event.message}</p>
            <p className="mt-1 text-xs text-[#5F6F82]">{formatDateTime(event.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-semibold text-[#4A5568] ${className}`}>
      {label}
      <input className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm outline-none focus:border-[#0D1B2A] focus:ring-2 focus:ring-[#0D1B2A]/15" onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} />
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-[#5F6F82]">{label}</dt>
      <dd className="mt-1 break-words font-bold">{value}</dd>
    </div>
  );
}

function getAvailableModes(guide: ProviderCancellationGuide | null, canSend: boolean) {
  const modes: { mode: CancellationMode; label: string; description: string }[] = [];
  if (guide?.supportsAbosluttSending && canSend) {
    modes.push({
      mode: "aboslutt_email",
      label: "Send via Aboslutt",
      description: "Aboslutt sender én e-post fra oppsigelse@aboslutt.no til en verifisert adresse.",
    });
  }
  if (guide?.officialUrl) {
    modes.push({
      mode: "provider_portal",
      label: getCancellationGuideMethodLabel(guide.method),
      description: guide.requiresProviderLogin
        ? "Åpne leverandørens side og logg inn for å fullføre oppsigelsen."
        : "Åpne leverandørens offisielle side og følg veiledningen.",
    });
  }
  modes.push({
    mode: "manual_draft",
    label: "Bruk et oppsigelsesutkast",
    description: "Kopier teksten og send den selv via en kanal leverandøren godtar.",
  });
  return modes;
}

function getRecommendedMode(guide: ProviderCancellationGuide | null, canSend: boolean): CancellationMode {
  if (guide?.supportsAbosluttSending && canSend) return "aboslutt_email";
  if (guide?.officialUrl) return "provider_portal";
  return "manual_draft";
}

function normalizeMode(value?: string | null): CancellationMode | null {
  return ["aboslutt_email", "provider_portal", "manual_draft"].includes(value ?? "")
    ? value as CancellationMode
    : null;
}

function createLocalDraft(
  subscriptionName: string,
  customerName: string,
  customerEmail: string,
  customerNumber: string,
) {
  const subject = `Oppsigelse av ${subscriptionName}`;
  const customerNumberLine = customerNumber ? `Kundenummer/medlemsnummer: ${customerNumber}\n` : "";
  return {
    subject,
    body: `Hei,

Jeg ønsker å si opp abonnementet mitt på ${subscriptionName}.

Navn: ${customerName}
E-post: ${customerEmail}
${customerNumberLine}
Vennligst bekreft skriftlig at abonnementet er avsluttet, og oppgi siste dato for tilgang eller siste fakturaperiode.

Hilsen
${customerName}

--
Sendt via Aboslutt på vegne av kunden.`,
  };
}

function isSent(status: string) {
  return ["sent", "awaiting_confirmation", "confirmed_cancelled", "manual_required", "rejected"].includes(status);
}

function getPublicCancellationState(status?: string | null) {
  if (!status) return "Oppsigelse ikke startet";
  if (status === "ready" || status === "draft") return "Oppsigelse klargjort";
  if (status === "sent") return "Oppsigelse sendt";
  if (status === "awaiting_confirmation") return "Venter på bekreftelse";
  if (status === "confirmed_cancelled") return "Bekreftet avsluttet";
  if (status === "manual_required" || status === "rejected") return "Krever manuell handling";
  return "Oppsigelse klargjort";
}

function getDeliveryLabel(status: string) {
  return {
    sending: "Sender",
    accepted: "Mottatt for levering",
    delivered: "Levert",
    failed: "Levering feilet",
    bounced: "Returnert",
  }[status] ?? "Ukjent";
}

function formatDateTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukjent";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
