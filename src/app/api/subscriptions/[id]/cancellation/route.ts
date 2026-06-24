import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createCancellationDraft,
  isCancellationStatus,
  logCancellationAudit,
  logCancellationEvent,
} from "@/lib/cancellation";
import {
  cancellationAuthorizationVersion,
  getCancellationSendingCapability,
  isRecentAuthentication,
  normalizeCancellationMode,
} from "@/lib/cancellation-sending.mjs";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { canSendCancellationEmail } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getSubscriptionLifecycle } from "@/lib/subscription-lifecycle.mjs";
import { sendTransactionalEmail } from "@/lib/transactional-email";

type RouteContext = { params: Promise<{ id: string }> };

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
  requestedEndDate: true,
  createdAt: true,
  updatedAt: true,
  events: {
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, message: true, createdAt: true },
  },
  delivery: {
    select: {
      recipient: true,
      deliveryStatus: true,
      bounceStatus: true,
      sentAt: true,
    },
  },
} as const;

export async function GET(_request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return unauthorizedResponse();

  const { id } = await context.params;
  const subscription = await getOwnedSubscription(id, currentUser.id);
  if (!subscription) return notFoundResponse();

  const lifecycle = getSubscriptionLifecycle(subscription);
  if (["cancelled", "archived"].includes(lifecycle.productStatus)) {
    return NextResponse.json(
      { ok: false, error: "ALREADY_CANCELLED", message: "Abonnementet er allerede avsluttet." },
      { status: 409 },
    );
  }

  const cancellationRequest = await getLatestCancellationRequest(currentUser.id, id);
  return NextResponse.json({
    ok: true,
    canSend: canSendCancellationEmail(currentUser),
    request: cancellationRequest,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return unauthorizedResponse();

  const { id } = await context.params;
  const subscription = await getOwnedSubscription(id, currentUser.id);
  if (!subscription) return notFoundResponse();

  const lifecycle = getSubscriptionLifecycle(subscription);
  if (["cancelled", "archived"].includes(lifecycle.productStatus)) {
    return NextResponse.json(
      { ok: false, error: "ALREADY_CANCELLED", message: "Abonnementet er allerede avsluttet." },
      { status: 409 },
    );
  }

  const payload = await request.json().catch(() => ({}));
  const customerName = getString(payload.customerName) || currentUser.name || "";
  const customerEmail = getString(payload.customerEmail) || currentUser.email || "";
  const customerNumber = getString(payload.customerNumber);
  const extraNote = getString(payload.extraNote);
  const method = normalizeCancellationMode(getString(payload.method));
  const requestedEndDate = getDateString(payload.requestedEndDate);
  const sendingCapability = getCancellationSendingCapability(subscription.provider);
  const recipientEmail: string = method === "aboslutt_email" && sendingCapability.allowed
    ? sendingCapability.recipient ?? ""
    : "";
  const draft = createCancellationDraft({
    subscriptionName: subscription.name,
    customerName,
    customerEmail,
    customerNumber,
    extraNote,
  });
  const subject = getString(payload.subject) || draft.subject;
  const body = getString(payload.body) || draft.body;

  const validationError = validateDraft({
    customerName,
    customerEmail,
    customerNumber,
    recipientEmail,
    subject,
    body,
    method,
    requiresCustomerReference: subscription.provider?.requiresCustomerReference === true,
  });
  if (validationError) return validationError;

  const existingRequest = lifecycle.productStatus === "cancellation_in_progress"
    ? await prisma.cancellationRequest.findFirst({
        where: { userId: currentUser.id, subscriptionId: subscription.id },
        orderBy: { updatedAt: "desc" },
      })
    : null;
  if (existingRequest && !["draft", "ready"].includes(existingRequest.status)) {
    return NextResponse.json({ ok: true, request: await getCancellationRequestById(existingRequest.id) });
  }

  const cancellationData = {
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
      requestedEndDate,
  };
  const cancellationRequest = existingRequest
    ? await prisma.cancellationRequest.update({
        where: { id: existingRequest.id },
        data: cancellationData,
        select: requestSelect,
      })
    : await prisma.cancellationRequest.create({
        data: cancellationData,
        select: requestSelect,
      });

  if (existingRequest) {
    await logCancellationAudit({
      userId: currentUser.id,
      subscriptionId: subscription.id,
      cancellationRequestId: cancellationRequest.id,
      action: "cancellation_draft_updated",
      metadata: { method },
    });
    return NextResponse.json({ ok: true, request: cancellationRequest });
  }

  await Promise.all([
    logCancellationAudit({
      userId: currentUser.id,
      subscriptionId: subscription.id,
      cancellationRequestId: cancellationRequest.id,
      action: "cancellation_draft_created",
      metadata: { method },
    }),
    logCancellationEvent({
      cancellationRequestId: cancellationRequest.id,
      type: "draft_created",
      message: "Oppsigelsen ble klargjort.",
    }),
    logCancellationEvent({
      cancellationRequestId: cancellationRequest.id,
      type: "ready",
      message: "Oppsigelsen er klar for neste steg.",
    }),
  ]);

  return NextResponse.json(
    { ok: true, request: await getCancellationRequestById(cancellationRequest.id) },
    { status: 201 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return unauthorizedResponse();

  const { id } = await context.params;
  const subscription = await getOwnedSubscription(id, currentUser.id);
  if (!subscription) return notFoundResponse();

  const payload = await request.json().catch(() => ({}));
  const action = getString(payload.action);
  const requestId = getString(payload.requestId);
  if (!requestId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_REQUEST", message: "Mangler oppsigelsesutkast." },
      { status: 400 },
    );
  }

  const cancellationRequest = await prisma.cancellationRequest.findFirst({
    where: { id: requestId, userId: currentUser.id, subscriptionId: subscription.id },
  });
  if (!cancellationRequest) return notFoundResponse("Fant ikke oppsigelsesutkastet.");

  if (action === "send") {
    return sendCancellationEmail({
      currentUser,
      cancellationRequest,
      provider: subscription.provider,
      authorizationConfirmed: payload.authorizationConfirmed === true,
    });
  }

  if (action === "mark_sent") {
    if (cancellationRequest.status === "confirmed_cancelled") {
      return NextResponse.json(
        { ok: false, error: "ALREADY_COMPLETED", message: "Oppsigelsen er allerede bekreftet avsluttet." },
        { status: 409 },
      );
    }

    const now = new Date();
    await prisma.cancellationRequest.update({
      where: { id: cancellationRequest.id },
      data: {
        status: "awaiting_confirmation",
        sentAt: cancellationRequest.sentAt ?? now,
        providerResponse: "marked_sent_by_user",
      },
    });
    await Promise.all([
      logCancellationAudit({
        userId: currentUser.id,
        subscriptionId: subscription.id,
        cancellationRequestId: cancellationRequest.id,
        action: "cancellation_marked_sent",
        metadata: { method: cancellationRequest.method },
      }),
      logCancellationEvent({
        cancellationRequestId: cancellationRequest.id,
        type: "awaiting_confirmation",
        message: "Brukeren bekreftet at oppsigelsen er sendt til leverandøren.",
      }),
    ]);
    return NextResponse.json({ ok: true, request: await getCancellationRequestById(cancellationRequest.id) });
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
      });
      if (status === "confirmed_cancelled") {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: "cancelled" },
        });
      }
    });

    await Promise.all([
      logCancellationAudit({
        userId: currentUser.id,
        subscriptionId: subscription.id,
        cancellationRequestId: cancellationRequest.id,
        action: `cancellation_${status}`,
      }),
      logCancellationEvent({
        cancellationRequestId: cancellationRequest.id,
        type: status,
        message: getStatusEventMessage(status),
      }),
    ]);
    return NextResponse.json({ ok: true, request: await getCancellationRequestById(cancellationRequest.id) });
  }

  if (action === "note") {
    const note = getString(payload.note);
    if (!note) {
      return NextResponse.json(
        { ok: false, error: "INVALID_NOTE", message: "Notatet kan ikke være tomt." },
        { status: 400 },
      );
    }
    await Promise.all([
      logCancellationEvent({
        cancellationRequestId: cancellationRequest.id,
        type: "note_added",
        message: note,
      }),
      logCancellationAudit({
        userId: currentUser.id,
        subscriptionId: subscription.id,
        cancellationRequestId: cancellationRequest.id,
        action: "cancellation_note_added",
      }),
    ]);
    return NextResponse.json({ ok: true, request: await getCancellationRequestById(cancellationRequest.id) });
  }

  return NextResponse.json(
    { ok: false, error: "INVALID_ACTION", message: "Ugyldig handling." },
    { status: 400 },
  );
}

async function sendCancellationEmail({
  currentUser,
  cancellationRequest,
  provider,
  authorizationConfirmed,
}: {
  currentUser: { id: string; plan: string | null; email: string | null };
  cancellationRequest: {
    id: string;
    userId: string;
    subscriptionId: string;
    status: string;
    method: string;
    recipientEmail: string;
    customerEmail: string;
    customerNumber: string | null;
    subject: string;
    body: string;
  };
  provider: ProviderSendingView | null;
  authorizationConfirmed: boolean;
}) {
  if (!canSendCancellationEmail(currentUser)) {
    return NextResponse.json(
      {
        ok: false,
        error: "PLAN_REQUIRED",
        feature: "cancellation_email_send",
        message: "Sending via Aboslutt krever Premium.",
      },
      { status: 403 },
    );
  }

  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        error: "SENDING_NOT_AVAILABLE",
        message: "Sending via Aboslutt er ikke tilgjengelig for denne leverandøren. Bruk den anbefalte metoden.",
      },
      { status: 409 },
    );
  }

  const capability = getCancellationSendingCapability(provider);
  if (!capability.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "SENDING_NOT_AVAILABLE",
        message: "Sending via Aboslutt er ikke tilgjengelig for denne leverandøren. Bruk den anbefalte metoden.",
      },
      { status: 409 },
    );
  }

  if (
    cancellationRequest.method !== "aboslutt_email" ||
    cancellationRequest.recipientEmail.trim().toLowerCase() !== capability.recipient
  ) {
    return NextResponse.json(
      { ok: false, error: "RECIPIENT_MISMATCH", message: "Mottakeren er ikke lenger verifisert. Last siden på nytt." },
      { status: 409 },
    );
  }

  if (provider?.requiresCustomerReference && !cancellationRequest.customerNumber) {
    return NextResponse.json(
      {
        ok: false,
        error: "CUSTOMER_REFERENCE_REQUIRED",
        message: "Legg inn kundenummer eller medlemsreferanse før sending.",
      },
      { status: 400 },
    );
  }

  if (!authorizationConfirmed) {
    return NextResponse.json(
      {
        ok: false,
        error: "AUTHORIZATION_REQUIRED",
        message: "Du må godkjenne den begrensede fullmakten før sending.",
      },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!isRecentAuthentication(session?.authenticatedAt)) {
    return NextResponse.json(
      {
        ok: false,
        error: "RECENT_AUTH_REQUIRED",
        message: "Logg inn på nytt før Aboslutt sender oppsigelsen.",
      },
      { status: 401 },
    );
  }

  const rateLimit = consumeRateLimit({
    key: `cancellation-send:${currentUser.id}`,
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", message: "Du har sendt flere oppsigelser nylig. Prøv igjen senere." },
      { status: 429 },
    );
  }

  if (["sent", "awaiting_confirmation", "confirmed_cancelled"].includes(cancellationRequest.status)) {
    return NextResponse.json(
      { ok: false, error: "ALREADY_SENT", message: "Oppsigelsen er allerede sendt." },
      { status: 409 },
    );
  }

  const authorizationTimestamp = new Date();
  try {
    await prisma.cancellationDelivery.create({
      data: {
        userId: currentUser.id,
        providerId: provider.id,
        cancellationRequestId: cancellationRequest.id,
        authorizationTextVersion: cancellationAuthorizationVersion,
        authorizationTimestamp,
        recipient: capability.recipient,
        subject: cancellationRequest.subject,
        messageHash: createHash("sha256").update(cancellationRequest.body, "utf8").digest("hex"),
      },
      select: { id: true },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "ALREADY_SENT", message: "Oppsigelsen er allerede sendt eller under behandling." },
      { status: 409 },
    );
  }

  let emailResult: Awaited<ReturnType<typeof sendTransactionalEmail>>;
  try {
    emailResult = await sendTransactionalEmail({
      to: capability.recipient,
      from: "Aboslutt Oppsigelse <oppsigelse@aboslutt.no>",
      replyTo: cancellationRequest.customerEmail,
      cc: currentUser.email ?? undefined,
      subject: cancellationRequest.subject,
      text: cancellationRequest.body,
      html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${escapeHtml(cancellationRequest.body)}</pre>`,
    });
  } catch (error) {
    await markDeliveryFailed(cancellationRequest.id);
    logger.error("[cancellation:send_failed]", {
      route: "/api/subscriptions/[id]/cancellation",
      operation: "cancellation_send",
      provider: provider.id,
      cancellationRequestId: cancellationRequest.id,
      error,
    });
    return deliveryFailedResponse();
  }

  if (!emailResult.sent) {
    await markDeliveryFailed(cancellationRequest.id);
    return deliveryFailedResponse();
  }

  const sentAt = new Date();
  await prisma.$transaction([
    prisma.cancellationDelivery.update({
      where: { cancellationRequestId: cancellationRequest.id },
      data: {
        providerMessageId: emailResult.messageId ?? null,
        deliveryStatus: "accepted",
        sentAt,
      },
    }),
    prisma.cancellationRequest.update({
      where: { id: cancellationRequest.id },
      data: {
        status: "awaiting_confirmation",
        sentAt,
        consentConfirmed: true,
        providerResponse: "sent_via_aboslutt",
      },
    }),
  ]);

  await Promise.all([
    logCancellationAudit({
      userId: cancellationRequest.userId,
      subscriptionId: cancellationRequest.subscriptionId,
      cancellationRequestId: cancellationRequest.id,
      action: "cancellation_email_sent",
      metadata: { providerId: provider.id, deliveryStatus: "accepted" },
    }),
    logCancellationEvent({
      cancellationRequestId: cancellationRequest.id,
      type: "email_sent",
      message: "Oppsigelsen ble sendt via Aboslutt på vegne av brukeren.",
    }),
    logCancellationEvent({
      cancellationRequestId: cancellationRequest.id,
      type: "awaiting_confirmation",
      message: "Venter på bekreftelse fra leverandøren.",
    }),
  ]);

  logger.info("[cancellation:sent]", {
    operation: "cancellation_send",
    provider: provider.id,
    cancellationRequestId: cancellationRequest.id,
    deliveryStatus: "accepted",
  });
  return NextResponse.json({ ok: true, request: await getCancellationRequestById(cancellationRequest.id) });
}

type ProviderSendingView = {
  id: string;
  isActive: boolean;
  isCancellationGuideActive: boolean;
  supportsAbosluttSending: boolean;
  verifiedCancellationEmail: string | null;
  sendingVerifiedAt: Date | null;
  requiresCustomerReference: boolean;
  cancellationMethod: string | null;
  cancellationUrl: string | null;
  accountManagementUrl: string | null;
};

function getOwnedSubscription(id: string, userId: string) {
  return prisma.subscription.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      status: true,
      cancellationRequests: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { status: true },
      },
      provider: {
        select: {
          id: true,
          isActive: true,
          isCancellationGuideActive: true,
          supportsAbosluttSending: true,
          verifiedCancellationEmail: true,
          sendingVerifiedAt: true,
          requiresCustomerReference: true,
          cancellationMethod: true,
          cancellationUrl: true,
          accountManagementUrl: true,
        },
      },
    },
  });
}

function getLatestCancellationRequest(userId: string, subscriptionId: string) {
  return prisma.cancellationRequest.findFirst({
    where: { userId, subscriptionId },
    orderBy: { updatedAt: "desc" },
    select: requestSelect,
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
  customerNumber: string;
  recipientEmail: string;
  subject: string;
  body: string;
  method: string;
  requiresCustomerReference: boolean;
}) {
  if (!input.customerName || !input.customerEmail || !input.method || !input.subject || !input.body) {
    return NextResponse.json(
      { ok: false, error: "INVALID_DRAFT", message: "Fyll inn navn, e-post, metode, emne og melding." },
      { status: 400 },
    );
  }
  if (!isEmail(input.customerEmail) || (input.method === "aboslutt_email" && !isEmail(input.recipientEmail))) {
    return NextResponse.json(
      { ok: false, error: "INVALID_EMAIL", message: "Kontroller e-postadressene." },
      { status: 400 },
    );
  }
  if (input.method === "aboslutt_email" && input.requiresCustomerReference && !input.customerNumber) {
    return NextResponse.json(
      {
        ok: false,
        error: "CUSTOMER_REFERENCE_REQUIRED",
        message: "Denne leverandøren krever kundenummer eller medlemsreferanse.",
      },
      { status: 400 },
    );
  }
  return null;
}

async function markDeliveryFailed(cancellationRequestId: string) {
  await prisma.cancellationDelivery.update({
    where: { cancellationRequestId },
    data: { deliveryStatus: "failed", failedAt: new Date() },
  });
}

function deliveryFailedResponse() {
  return NextResponse.json(
      {
        ok: false,
        error: "DELIVERY_FAILED",
        message: "Vi klarte ikke å sende oppsigelsen. Bruk den manuelle metoden og kontakt leverandøren direkte.",
      },
    { status: 502 },
  );
}

function notFoundResponse(message = "Fant ikke abonnementet.") {
  return NextResponse.json({ ok: false, error: "NOT_FOUND", message }, { status: 404 });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getDateString(value: unknown) {
  const date = getString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
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
  return {
    confirmed_cancelled: "Brukeren markerte oppsigelsen som bekreftet avsluttet.",
    rejected: "Brukeren markerte oppsigelsen som avvist.",
    manual_required: "Brukeren markerte at oppsigelsen krever manuell handling.",
  }[status];
}
