import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  getAgreement,
  parseVippsWebhookEvent,
  sanitizeVippsPayloadForStorage,
  verifyWebhookSignature,
} from "@/lib/billing/vipps-recurring";
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

  if (!verifyWebhookSignature(request, rawBody)) {
    return NextResponse.json({ ok: false, error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const event = parseVippsWebhookEvent(rawBody);

  if (event.providerEventId) {
    const existingEvent = await prisma.billingEvent.findFirst({
      where: {
        provider: "vipps",
        providerEventId: event.providerEventId,
      },
      select: { id: true },
    });

    if (existingEvent) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const agreement = await findBillingAgreementForEvent(event);
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

  if (!agreement || !handledEvents.has(event.eventType)) {
    return NextResponse.json({ ok: true, handled: false });
  }

  if (activeEvents.has(event.eventType)) {
    await activateAgreementIfVerified(agreement);
    return NextResponse.json({ ok: true, handled: true });
  }

  if (event.eventType === "epayments.payment.created.v1") {
    await markAgreementPending(agreement);
    return NextResponse.json({ ok: true, handled: true });
  }

  await markAgreementInactive(agreement, statusForInactiveEvent(event.eventType));
  return NextResponse.json({ ok: true, handled: true });
}

async function findBillingAgreementForEvent(event: {
  reference?: string;
  providerAgreementId?: string;
  providerChargeId?: string;
}) {
  if (event.reference) {
    const agreement = await prisma.billingAgreement.findUnique({
      where: { reference: event.reference },
      include: { user: { select: { id: true, plan: true } } },
    });

    if (agreement) {
      return agreement;
    }
  }

  if (event.providerAgreementId) {
    const agreement = await prisma.billingAgreement.findUnique({
      where: { providerAgreementId: event.providerAgreementId },
      include: { user: { select: { id: true, plan: true } } },
    });

    if (agreement) {
      return agreement;
    }
  }

  if (event.providerChargeId) {
    return prisma.billingAgreement.findFirst({
      where: { providerChargeId: event.providerChargeId },
      include: { user: { select: { id: true, plan: true } } },
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

  const now = new Date();

  await prisma.$transaction([
    prisma.billingAgreement.update({
      where: { id: agreement.id },
      data: {
        status: "active",
        activatedAt: agreement.activatedAt ?? now,
        cancelledAt: null,
      },
    }),
    prisma.user.update({
      where: { id: agreement.userId },
      data: { plan: "premium" },
    }),
  ]);
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

  await prisma.billingAgreement.update({
    where: { id: agreement.id },
    data: {
      status,
      cancelledAt: now,
    },
  });

  await downgradeUserIfNoActivePremiumAgreement(agreement.userId);
}

async function downgradeUserIfNoActivePremiumAgreement(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (!user || user.plan === "admin" || user.plan === "beta") {
    return;
  }

  const activePremiumAgreement = await prisma.billingAgreement.findFirst({
    where: {
      userId,
      status: "active",
    },
    select: { id: true },
  });

  if (activePremiumAgreement) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { plan: "free" },
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
