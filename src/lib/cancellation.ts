import { prisma } from "@/lib/prisma";

export const cancellationStatuses = [
  "draft",
  "ready",
  "sent",
  "awaiting_confirmation",
  "confirmed_cancelled",
  "rejected",
  "manual_required",
] as const;

export type CancellationStatus = (typeof cancellationStatuses)[number];

export const cancellationEventTypes = [
  "draft_created",
  "ready",
  "email_sent",
  "awaiting_confirmation",
  "confirmed_cancelled",
  "rejected",
  "manual_required",
  "note_added",
] as const;

export type CancellationEventType = (typeof cancellationEventTypes)[number];

export function isCancellationStatus(value: string): value is CancellationStatus {
  return cancellationStatuses.includes(value as CancellationStatus);
}

export function getCancellationStatusLabel(status?: string | null) {
  const labels: Record<CancellationStatus, string> = {
    draft: "Utkast",
    ready: "Klar",
    sent: "Oppsigelse sendt",
    awaiting_confirmation: "Venter på bekreftelse",
    confirmed_cancelled: "Avsluttet",
    rejected: "Avvist",
    manual_required: "Krever manuell handling",
  };

  return status && isCancellationStatus(status) ? labels[status] : null;
}

export function createCancellationDraft({
  subscriptionName,
  customerName,
  customerEmail,
  customerNumber,
  extraNote,
}: {
  subscriptionName: string;
  customerName: string;
  customerEmail: string;
  customerNumber?: string | null;
  extraNote?: string | null;
}) {
  const subject = `Oppsigelse av ${subscriptionName}`;
  const customerNumberLine = customerNumber
    ? `Kundenummer/medlemsnummer: ${customerNumber}\n`
    : "";
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

export function getCancellationEventLabel(type: string) {
  const labels: Record<CancellationEventType, string> = {
    draft_created: "Utkast opprettet",
    ready: "Klar til sending",
    email_sent: "Sendt på vegne av bruker",
    awaiting_confirmation: "Venter på bekreftelse",
    confirmed_cancelled: "Bekreftet avsluttet",
    rejected: "Avvist",
    manual_required: "Krever manuell handling",
    note_added: "Notat lagt til",
  };

  return cancellationEventTypes.includes(type as CancellationEventType)
    ? labels[type as CancellationEventType]
    : type;
}

export async function logCancellationEvent({
  cancellationRequestId,
  type,
  message,
}: {
  cancellationRequestId: string;
  type: CancellationEventType;
  message: string;
}) {
  await prisma.cancellationEvent.create({
    data: {
      cancellationRequestId,
      type,
      message: message.slice(0, 1000),
    },
    select: { id: true },
  });
}

export async function logCancellationAudit({
  userId,
  subscriptionId,
  cancellationRequestId,
  action,
  metadata = {},
}: {
  userId: string;
  subscriptionId?: string | null;
  cancellationRequestId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.cancellationAuditLog.create({
    data: {
      userId,
      subscriptionId,
      cancellationRequestId,
      action,
      metadataJson: JSON.stringify(sanitizeMetadata(metadata)),
    },
    select: { id: true },
  });
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  const blocked = /token|secret|password|authorization|cookie|raw|access|refresh/i;

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !blocked.test(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 300) : value]),
  );
}
