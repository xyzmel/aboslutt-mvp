import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  applyVerifiedBillingStatus,
  downgradeUserIfNoActivePremiumAgreement,
  isRetryablePrismaError,
} from "@/lib/billing/reconcile";
import {
  getAgreement,
  parseVippsWebhookEvent,
  sanitizeVippsPayloadForStorage,
  verifyWebhookSignature,
} from "@/lib/billing/vipps-recurring";
import {
  sendPaymentFailedEmailOnce,
  sendPremiumCancelledEmailOnce,
} from "@/lib/billing/billing-emails";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const activeEvents = new Set(["epayments.payment.authorized.v1", "epayments.payment.captured.v1"]);
const inactiveEvents = new Set([
  "epayments.payment.aborted.v1",
  "epayments.payment.cancelled.v1",
  "epayments.payment.expired.v1",
  "epayments.payment.terminated.v1",
]);
const handledEvents = new Set([...activeEvents, ...inactiveEvents, "epayments.payment.created.v1"]);

type BillingAgreementForWebhook = NonNullable<Awaited<ReturnType<typeof findBillingAgreementForEvent>>>;

export async function POST(request: Request) {
  const rawBody = await request.text();

  let signatureVerified = false;

  try {
    signatureVerified = verifyWebhookSignature(request, rawBody);
  } catch (error) {
    logger.error("[billing:webhook:config]", { error });
    return NextResponse.json({ ok: false, error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  }

  if (!signatureVerified) {
    logger.warn("[billing:webhook:invalid-signature]");
    return NextResponse.json({ ok: false, error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let event: ReturnType<typeof parseVippsWebhookEvent>;

  try {
    event = parseVippsWebhookEvent(rawBody);
  } catch (error) {
    logger.warn("[billing:webhook:malformed]", { error });
    return NextResponse.json({ ok: false, error: "MALFORMED_PAYLOAD" }, { status: 400 });
  }

  logger.info("[billing:webhook:received]", {
    eventType: event.eventType,
    providerEventId: event.providerEventId,
    reference: event.reference,
    providerAgreementId: event.providerAgreementId,
    providerChargeId: event.providerChargeId,
  });

  try {
    let isDuplicate = false;

    if (event.providerEventId) {
      const existingEvent = await prisma.billingEvent.findFirst({
        where: {
          provider: "vipps",
          providerEventId: event.providerEventId,
        },
        select: { id: true },
      });

      if (existingEvent) {
        isDuplicate = true;

        logger.info("[billing:webhook:duplicate]", {
          eventType: event.eventType,
          providerEventId: event.providerEventId,
          reference: event.reference,
        });
      }
    }

    const agreement = await findBillingAgreementForEvent(event);

    if (!isDuplicate) {
      await prisma.billingEvent.create({
        data: {
          provider: "vipps",
          eventType: event.eventType,
          providerEventId: event.providerEventId,
          providerAgreementId: event.providerAgreementId ?? agreement?.providerAgreementId,
          providerChargeId: event.providerChargeId ?? agreement?.providerChargeId,
          reference: event.reference ?? agreement?.reference,
          rawJson: toPrismaJson(sanitizeVippsPayloadForStorage(event.payload)),
        },
      });
    }

    if (!agreement || !handledEvents.has(event.eventType)) {
      return NextResponse.json({ ok: true, duplicate: isDuplicate, handled: false });
    }

    if (activeEvents.has(event.eventType)) {
      await activateAgreementIfVerified(agreement);
      return NextResponse.json({ ok: true, duplicate: isDuplicate, handled: true });
    }

    if (event.eventType === "epayments.payment.created.v1") {
      await markAgreementPending(agreement);
      return NextResponse.json({ ok: true, duplicate: isDuplicate, handled: true });
    }

    await markAgreementInactive(agreement, statusForInactiveEvent(event.eventType));
    return NextResponse.json({ ok: true, duplicate: isDuplicate, handled: true });
  } catch (error) {
    const retryable = isRetryablePrismaError(error);

    logger.error("[billing:webhook:error]", {
      error,
      retryable,
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      reference: event.reference,
    });

    return NextResponse.json(
      { ok: false, error: retryable ? "RETRYABLE_WEBHOOK_ERROR" : "WEBHOOK_PROCESSING_ERROR" },
      { status: retryable ? 503 : 500 },
    );
  }
}

async function findBillingAgreementForEvent(event: {
  reference?: string;
  providerAgreementId?: string;
  providerChargeId?: string;
}) {
  if (event.reference) {
    const agreement = await prisma.billingAgreement.findUnique({
      where: { reference: event.reference },
      include: { user: { select: { id: true, plan: true, email: true, name: true } } },
    });

    if (agreement) {
      return agreement;
    }
  }

  if (event.providerAgreementId) {
    const agreement = await prisma.billingAgreement.findUnique({
      where: { providerAgreementId: event.providerAgreementId },
      include: { user: { select: { id: true, plan: true, email: true, name: true } } },
    });

    if (agreement) {
      return agreement;
    }
  }

  if (event.providerChargeId) {
    return prisma.billingAgreement.findFirst({
      where: { providerChargeId: event.providerChargeId },
      include: { user: { select: { id: true, plan: true, email: true, name: true } } },
    });
  }

  return null;
}

async function activateAgreementIfVerified(agreement: BillingAgreementForWebhook) {
  const providerAgreementId = agreement.providerAgreementId;

  if (!providerAgreementId) {
    return;
  }

  const vippsAgreement = await getAgreement(providerAgreementId);

  if (!isActiveVippsAgreement(vippsAgreement)) {
    return;
  }

  await applyVerifiedBillingStatus(agreement, "active");

  logger.info("[billing:status-changed]", {
    reference: agreement.reference,
    previousStatus: agreement.status,
    nextStatus: "active",
  });
}

async function markAgreementPending(agreement: BillingAgreementForWebhook) {
  if (agreement.status === "active") {
    return;
  }

  await prisma.billingAgreement.update({
    where: { id: agreement.id },
    data: { status: "pending" },
  });
}

async function markAgreementInactive(agreement: BillingAgreementForWebhook, status: string) {
  const now = new Date();

  const updatedAgreement = await prisma.billingAgreement.update({
    where: { id: agreement.id },
    data: {
      status,
      cancelledAt: now,
    },
    include: { user: { select: { email: true, name: true } } },
  });

  await downgradeUserIfNoActivePremiumAgreement(agreement.userId);

  if ((status === "cancelled" || status === "terminated") && (agreement.status === "active" || agreement.activatedAt)) {
    await sendPremiumCancelledEmailOnce(updatedAgreement);
  } else {
    await sendPaymentFailedEmailOnce(updatedAgreement);
  }

  logger.info("[billing:status-changed]", {
    reference: agreement.reference,
    previousStatus: agreement.status,
    nextStatus: status,
  });
}

function statusForInactiveEvent(eventType: string) {
  if (eventType === "epayments.payment.aborted.v1") {
    return "aborted";
  }

  if (eventType === "epayments.payment.expired.v1") {
    return "expired";
  }

  if (eventType === "epayments.payment.terminated.v1") {
    return "terminated";
  }

  return "cancelled";
}

function isActiveVippsAgreement(payload: unknown) {
  return isRecord(payload) && payload.status === "ACTIVE";
}

function toPrismaJson(payload: unknown): Prisma.InputJsonValue {
  if (payload === null) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }

  if (typeof payload === "string" || typeof payload === "number" || typeof payload === "boolean") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => toPrismaJson(item));
  }

  if (isRecord(payload)) {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, toPrismaJson(value)]));
  }

  return String(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
