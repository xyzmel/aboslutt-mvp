import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { normalizeMerchantKey, normalizeMerchantName } from "@/lib/email-subscription-parser";
import { logger } from "@/lib/logger";
import { canAddManualSubscription, getManualSubscriptionLimit } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { canDeleteSubscription, validateSubscriptionDeletion } from "@/lib/subscription-lifecycle.mjs";
import {
  isValidSubscriptionDateInput,
  normalizeNextPaymentDate,
} from "@/lib/subscription-dates";
import type { BillingInterval, SubscriptionCategory, SubscriptionStatus } from "@/types/subscription";

const allowedCategories: SubscriptionCategory[] = ["streaming", "software", "news", "health"];
const allowedStatuses: SubscriptionStatus[] = ["active", "trial", "yearly", "cancelled"];
const allowedBillingIntervals: BillingInterval[] = ["monthly", "yearly", "unknown"];

const subscriptionSelect = {
  id: true,
  providerId: true,
  name: true,
  normalizedName: true,
  category: true,
  monthlyCost: true,
  status: true,
  billingInterval: true,
  nextPayment: true,
  note: true,
  source: true,
  confidence: true,
  createdAt: true,
  cancellationRequests: {
    orderBy: { updatedAt: "desc" },
    take: 1,
    select: { id: true, status: true, sentAt: true, updatedAt: true },
  },
  provider: {
    select: { id: true, name: true, slug: true, category: true, logoPath: true },
  },
} as const;

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "asc" },
    select: subscriptionSelect,
  });

  const normalizedSubscriptions = await rolloverSubscriptions(subscriptions);

  return NextResponse.json(normalizedSubscriptions.map(withCancellationStatus));
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const payload = await request.json();
  const requestedProviderId = typeof payload.providerId === "string" ? payload.providerId.trim() : "";
  const selectedProvider = requestedProviderId
    ? await prisma.subscriptionProvider.findFirst({
        where: { id: requestedProviderId, isActive: true },
        select: { id: true, name: true },
      })
    : null;
  if (requestedProviderId && !selectedProvider) {
    return NextResponse.json({ error: "Ugyldig leverandør." }, { status: 400 });
  }
  const requestedName =
    selectedProvider?.name ??
    (typeof payload.merchantName === "string"
      ? payload.merchantName.trim()
      : typeof payload.name === "string"
        ? payload.name.trim()
        : "");
  const normalizedName = normalizeMerchantName(requestedName);
  const nextPayment = typeof payload.nextPayment === "string" ? payload.nextPayment.trim() : "";
  const note =
    typeof payload.note === "string"
      ? payload.note.trim()
      : typeof payload.source === "string"
        ? `Importert fra ${payload.source}`
        : "";
  const source = typeof payload.source === "string" ? payload.source.trim() : "manual";
  const confidence = typeof payload.confidence === "number" ? payload.confidence : null;
  const monthlyCost = Number(payload.amount ?? payload.monthlyCost);
  const category = payload.category as SubscriptionCategory;
  const status = getStatusFromPayload(payload);
  const billingInterval = getBillingIntervalFromPayload(payload, status);

  if (!requestedName || !Number.isInteger(monthlyCost) || monthlyCost < 0) {
    return NextResponse.json({ error: "Ugyldig abonnement." }, { status: 400 });
  }

  if (
    !allowedCategories.includes(category) ||
    !allowedStatuses.includes(status) ||
    !allowedBillingIntervals.includes(billingInterval)
  ) {
    return NextResponse.json({ error: "Ugyldig kategori eller status." }, { status: 400 });
  }

  if (!isValidSubscriptionDateInput(nextPayment)) {
    return NextResponse.json(
      { error: "Ugyldig dato.", message: "Neste trekk må være tom eller en gyldig dato." },
      { status: 400 },
    );
  }

  const existingSubscriptionCount = await prisma.subscription.count({
    where: { userId: currentUser.id },
  });
  if (!canAddManualSubscription(currentUser, existingSubscriptionCount)) {
    const limit = getManualSubscriptionLimit(currentUser);
    return NextResponse.json(
      {
        ok: false,
        error: "PLAN_LIMIT_REACHED",
        currentUsage: existingSubscriptionCount,
        limit,
        message: `Du har brukt ${existingSubscriptionCount} av ${limit} abonnementer i gratisplanen. Slett et abonnement eller oppgrader til Premium for å legge til flere.`,
      },
      { status: 403 },
    );
  }

  const duplicateSubscription = await prisma.subscription.findFirst({
    where: {
      userId: currentUser.id,
      status: { in: ["active", "trial", "yearly"] },
      OR: [
        { normalizedName: normalizeMerchantKey(normalizedName) },
        { name: { equals: normalizedName } },
      ],
    },
    select: { id: true },
  });

  if (duplicateSubscription) {
    return NextResponse.json(
      { error: "Dette abonnementet finnes allerede som aktivt abonnement." },
      { status: 409 },
    );
  }

  const subscription = await prisma.subscription.create({
    data: {
      name: normalizedName,
      providerId: selectedProvider?.id ?? null,
      normalizedName: normalizeMerchantKey(normalizedName),
      category,
      monthlyCost,
      status,
      billingInterval,
      nextPayment: normalizeNextPaymentDate({ nextPayment, billingInterval, status }),
      note: note || null,
      source,
      confidence,
      userId: currentUser.id,
    },
    select: subscriptionSelect,
  });

  if (source === "gmail_import" || source === "pasted_email") {
    logger.info("import_candidate_confirmed", {
      userId: currentUser.id,
      subscriptionId: subscription.id,
      source,
      normalizedName: subscription.normalizedName,
      confidence,
    });
  }

  return NextResponse.json(withCancellationStatus(subscription), { status: 201 });
}

function withCancellationStatus<T extends {
  cancellationRequests?: { id: string; status: string; sentAt: Date | null; updatedAt: Date }[];
}>(subscription: T) {
  const { cancellationRequests, ...rest } = subscription;
  const cancellationRequest = cancellationRequests?.[0] ?? null;
  return {
    ...rest,
    cancellationStatus: cancellationRequest?.status ?? null,
    cancellationRequest: cancellationRequest
      ? {
          id: cancellationRequest.id,
          status: cancellationRequest.status,
          sentAt: cancellationRequest.sentAt?.toISOString() ?? null,
          updatedAt: cancellationRequest.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function DELETE(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: currentUser.id },
    select: subscriptionSelect,
  });

  const blockedCount = subscriptions.filter((subscription) => !canDeleteSubscription(subscription)).length;
  if (blockedCount > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "CANCELLATION_REQUIRED",
        message: "Abonnementet må avsluttes før det kan fjernes.",
        blockedCount,
      },
      { status: 409 },
    );
  }

  const confirmation = await getDeletionConfirmation(request);
  const missingConfirmationCount = subscriptions.filter(
    (subscription) => !validateSubscriptionDeletion(subscription, confirmation).ok,
  ).length;
  if (missingConfirmationCount > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "CONFIRMATION_REQUIRED",
        message: "Skriv SLETT for å bekrefte permanent sletting.",
        blockedCount: missingConfirmationCount,
      },
      { status: 400 },
    );
  }

  const result = await prisma.subscription.deleteMany({
    where: { userId: currentUser.id },
  });

  return NextResponse.json({ ok: true, deletedCount: result.count });
}

async function getDeletionConfirmation(request: Request) {
  const url = new URL(request.url);
  const queryConfirmation = url.searchParams.get("confirm");
  if (queryConfirmation) {
    return queryConfirmation;
  }

  const payload = (await request.json().catch(() => ({}))) as { confirmation?: unknown };
  return typeof payload.confirmation === "string" ? payload.confirmation.trim() : null;
}

function getStatusFromPayload(payload: Record<string, unknown>): SubscriptionStatus {
  if (typeof payload.status === "string") {
    return payload.status as SubscriptionStatus;
  }

  if (payload.billingInterval === "trial") {
    return "trial";
  }

  if (payload.billingInterval === "yearly") {
    return "yearly";
  }

  return "active";
}

function getBillingIntervalFromPayload(
  payload: Record<string, unknown>,
  status: SubscriptionStatus,
): BillingInterval {
  if (typeof payload.billingInterval === "string") {
    const billingInterval =
      payload.billingInterval === "trial" ? "monthly" : (payload.billingInterval as BillingInterval);

    if (allowedBillingIntervals.includes(billingInterval)) {
      return billingInterval;
    }
  }

  if (status === "yearly") {
    return "yearly";
  }

  return "monthly";
}

async function rolloverSubscriptions<T extends { id: string; nextPayment: string; billingInterval: string; status: string }>(
  subscriptions: T[],
) {
  return Promise.all(
    subscriptions.map(async (subscription) => {
      if (
        subscription.status === "cancelled" ||
        !["monthly", "yearly"].includes(subscription.billingInterval)
      ) {
        return subscription;
      }

      const normalizedNextPayment = normalizeNextPaymentDate({
        nextPayment: subscription.nextPayment,
        billingInterval: subscription.billingInterval as BillingInterval,
        status: subscription.status,
      });

      if (!normalizedNextPayment || normalizedNextPayment === subscription.nextPayment) {
        return subscription;
      }

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { nextPayment: normalizedNextPayment },
      });

      return {
        ...subscription,
        nextPayment: normalizedNextPayment,
      };
    }),
  );
}
