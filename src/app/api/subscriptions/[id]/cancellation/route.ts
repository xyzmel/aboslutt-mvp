import { NextResponse } from "next/server";
import {
  createCancellationDraft,
  isCancellationStatus,
  logCancellationAudit,
  logCancellationEvent,
} from "@/lib/cancellation";
import { cancellationProviders } from "@/data/cancellation-providers";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { canSendCancellationEmail } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const requestSelect = {
  id: true,
  status: true,
  method: true,
  recipientEmail: true,
  customerName: true,
  customerEmail: true,
  customerNumber: true,
  subject: true,
  body: true,
  consentConfirmed: true,
  sentAt: true,
  confirmedAt: true,
  rejectedAt: true,
  providerResponse: true,
  createdAt: true,
  updatedAt: true,
  events: {
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, message: true, createdAt: true },
  },
} as const;

export async function GET(_request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const subscription = await getOwnedSubscription(id, currentUser.id);
  if (!subscription) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND", message: "Fant ikke abonnementet." }, { status: 404 });
  }

  const cancellationRequest = await prisma.cancellationRequest.findFirst({
    where: { userId: currentUser.id, subscriptionId: id },
    orderBy: { updatedAt: "desc" },
    select: requestSelect,
  });

  return NextResponse.json({
    ok: true,
    canSend: canSendCancellationEmail(currentUser),
    request: cancellationRequest,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const subscription = await getOwnedSubscription(id, currentUser.id);
  if (!subscription) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND", message: "Fant ikke abonnementet." }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const customerName = getString(payload.customerName) || currentUser.name || "";
  const customerEmail = getString(payload.customerEmail) || currentUser.email || "";
  const customerNumber = getString(payload.customerNumber);
  const extraNote = getString(payload.extraNote);
  const recipientEmail = getString(payload.recipientEmail);
  const method = getCancellationMethod(getString(payload.method));
  const draft = createCancellationDraft({
    subscriptionName: subscription.name,
    customerName,
    customerEmail,
    customerNumber,
    extraNote,
  });
  const subject = getString(payload.subject) || draft.subject;
  const body = getString(payload.body) || draft.body;

  const validationError = validateDraft({ customerName, customerEmail, recipientEmail, subject, body, method });
  if (validationError) {
    return validationError;
  }

  const cancellationRequest = await prisma.cancellationRequest.create({
    data: {
      userId: currentUser.id,
      subscriptionId: subscription.id,
      status: "ready",
      method,
      recipientEmail,
      customerName,
      customerEmail,
      customerNumber: customerNumber || null,
      subject,
      body,
      consentConfirmed: false,
    },
    select: requestSelect,
  });

  await logCancellationAudit({
    userId: currentUser.id,
    subscriptionId: subscription.id,
    cancellationRequestId: cancellationRequest.id,
    action: "cancellation_draft_created",
  });
  await logCancellationEvent({
    cancellationRequestId: cancellationRequest.id,
    type: "draft_created",
    message: "Utkastet ble opprettet.",
  });
  await logCancellationEvent({
    cancellationRequestId: cancellationRequest.id,
    type: "ready",
    message: "Oppsigelsen er klar til sending eller manuell bruk.",
  });

  return NextResponse.json(
    { ok: true, request: await getCancellationRequestById(cancellationRequest.id) },
    { status: 201 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const subscription = await getOwnedSubscription(id, currentUser.id);
  if (!subscription) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND", message: "Fant ikke abonnementet." }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const action = getString(payload.action);
  const requestId = getString(payload.requestId);

  if (!requestId) {
    return NextResponse.json({ ok: false, error: "MISSING_REQUEST", message: "Mangler oppsigelsesutkast." }, { status: 400 });
  }

  const cancellationRequest = await prisma.cancellationRequest.findFirst({
    where: { id: requestId, userId: currentUser.id, subscriptionId: subscription.id },
  });

  if (!cancellationRequest) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND", message: "Fant ikke oppsigelsesutkastet." }, { status: 404 });
  }

  if (action === "send") {
    return sendCancellationEmail({ currentUser, cancellationRequest });
  }

  if (action === "status") {
    const status = getString(payload.status);
    if (!isCancellationStatus(status) || !isFollowUpStatus(status)) {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS", message: "Ugyldig status." }, { status: 400 });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.cancellationRequest.update({
        where: { id: cancellationRequest.id },
        data: {
          status,
          confirmedAt: status === "confirmed_cancelled" ? now : null,
          rejectedAt: status === "rejected" ? now : null,
        },
        select: requestSelect,
      });

      if (status === "confirmed_cancelled") {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: "cancelled" },
        });
      }

    });

    await logCancellationAudit({
      userId: currentUser.id,
      subscriptionId: subscription.id,
      cancellationRequestId: cancellationRequest.id,
      action: `cancellation_${status}`,
    });
    await logCancellationEvent({
      cancellationRequestId: cancellationRequest.id,
      type: status,
      message: getStatusEventMessage(status),
    });

    return NextResponse.json({ ok: true, request: await getCancellationRequestById(cancellationRequest.id) });
  }

  if (action === "note") {
    const note = getString(payload.note);
    if (!note) {
      return NextResponse.json({ ok: false, error: "INVALID_NOTE", message: "Notatet kan ikke være tomt." }, { status: 400 });
    }

    await logCancellationEvent({
      cancellationRequestId: cancellationRequest.id,
      type: "note_added",
      message: note,
    });
    await logCancellationAudit({
      userId: currentUser.id,
      subscriptionId: subscription.id,
      cancellationRequestId: cancellationRequest.id,
      action: "cancellation_note_added",
    });

    return NextResponse.json({ ok: true, request: await getCancellationRequestById(cancellationRequest.id) });
  }

  return NextResponse.json({ ok: false, error: "INVALID_ACTION", message: "Ugyldig handling." }, { status: 400 });
}

async function sendCancellationEmail({
  currentUser,
  cancellationRequest,
}: {
  currentUser: { id: string; plan: string | null };
  cancellationRequest: {
    id: string;
    userId: string;
    subscriptionId: string;
    method: string;
    recipientEmail: string;
    customerEmail: string;
    subject: string;
    body: string;
  };
}) {
  if (!canSendCancellationEmail(currentUser)) {
    return NextResponse.json(
      {
        ok: false,
        error: "PLAN_REQUIRED",
        feature: "cancellation_email_send",
        message: "Gratis-brukere kan kopiere utkastet, men sending via Aboslutt krever Premium.",
      },
      { status: 403 },
    );
  }

  if (cancellationRequest.method !== "email" || !cancellationRequest.recipientEmail || !isEmail(cancellationRequest.recipientEmail)) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_RECIPIENT",
        message: "Mottakeradresse mangler. Kopier utkastet eller bruk leverandørens anbefalte oppsigelsesmetode.",
      },
      { status: 400 },
    );
  }

  const emailResult = await sendTransactionalEmail({
    to: cancellationRequest.recipientEmail,
    replyTo: cancellationRequest.customerEmail,
    subject: cancellationRequest.subject,
    text: cancellationRequest.body,
    html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${escapeHtml(cancellationRequest.body)}</pre>`,
  });

  if (!emailResult.sent) {
    return NextResponse.json(
      { ok: false, error: "EMAIL_NOT_CONFIGURED", message: "E-postsending er ikke konfigurert." },
      { status: 503 },
    );
  }

  const updated = await prisma.cancellationRequest.update({
    where: { id: cancellationRequest.id },
    data: {
      status: "awaiting_confirmation",
      sentAt: new Date(),
      consentConfirmed: true,
      providerResponse: "sent",
    },
    select: requestSelect,
  });

  await logCancellationAudit({
    userId: cancellationRequest.userId,
    subscriptionId: cancellationRequest.subscriptionId,
    cancellationRequestId: cancellationRequest.id,
    action: "cancellation_email_sent",
  });
  await logCancellationEvent({
    cancellationRequestId: cancellationRequest.id,
    type: "email_sent",
    message: "Oppsigelsen ble sendt via Aboslutt på vegne av brukeren.",
  });
  await logCancellationEvent({
    cancellationRequestId: cancellationRequest.id,
    type: "awaiting_confirmation",
    message: "Venter på bekreftelse fra leverandøren.",
  });

  return NextResponse.json({ ok: true, request: await getCancellationRequestById(updated.id) });
}

function getOwnedSubscription(id: string, userId: string) {
  return prisma.subscription.findFirst({
    where: { id, userId },
    select: { id: true, name: true },
  });
}

function getCancellationRequestById(id: string) {
  return prisma.cancellationRequest.findUniqueOrThrow({
    where: { id },
    select: requestSelect,
  });
}

function validateDraft(input: {
  customerName: string;
  customerEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  method: string;
}) {
  if (!input.customerName || !input.customerEmail || !input.method || !input.subject || !input.body) {
    return NextResponse.json(
      { ok: false, error: "INVALID_DRAFT", message: "Fyll inn navn, e-post, metode, emne og melding." },
      { status: 400 },
    );
  }

  if (!isEmail(input.customerEmail) || (input.method === "email" && !isEmail(input.recipientEmail))) {
    return NextResponse.json(
      { ok: false, error: "INVALID_EMAIL", message: "Kontroller e-postadressene." },
      { status: 400 },
    );
  }

  return null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getCancellationMethod(value: string) {
  return cancellationProviders.some((provider) => provider.method === value) ? value : "email";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function isFollowUpStatus(
  status: string,
): status is "confirmed_cancelled" | "rejected" | "manual_required" {
  return ["confirmed_cancelled", "rejected", "manual_required"].includes(status);
}

function getStatusEventMessage(status: "confirmed_cancelled" | "rejected" | "manual_required") {
  const messages = {
    confirmed_cancelled: "Brukeren markerte oppsigelsen som bekreftet avsluttet.",
    rejected: "Brukeren markerte oppsigelsen som avvist.",
    manual_required: "Brukeren markerte at oppsigelsen krever manuell handling.",
  };

  return messages[status];
}
