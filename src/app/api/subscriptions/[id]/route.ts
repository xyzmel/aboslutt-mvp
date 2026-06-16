import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { normalizeMerchantKey, normalizeMerchantName } from "@/lib/email-subscription-parser";
import { prisma } from "@/lib/prisma";
import {
  isValidSubscriptionDateInput,
  normalizeNextPaymentDate,
} from "@/lib/subscription-dates";
import type { BillingInterval, SubscriptionCategory, SubscriptionStatus } from "@/types/subscription";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const allowedCategories: SubscriptionCategory[] = ["streaming", "software", "news", "health"];
const allowedStatuses: SubscriptionStatus[] = ["active", "trial", "yearly", "cancelled"];
const allowedBillingIntervals: BillingInterval[] = ["monthly", "yearly", "unknown"];

const subscriptionSelect = {
  id: true,
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
} as const;

export async function GET(_request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId: currentUser.id },
    select: subscriptionSelect,
  });

  if (!subscription) {
    return NextResponse.json({ error: "Fant ikke abonnementet." }, { status: 404 });
  }

  return NextResponse.json(withCancellationStatus(await rolloverSubscription(subscription)));
}

export async function PATCH(request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const payload = await request.json();
  const data: {
    name?: string;
    normalizedName?: string | null;
    category?: SubscriptionCategory;
    monthlyCost?: number;
    status?: SubscriptionStatus;
    billingInterval?: BillingInterval;
    nextPayment?: string;
    note?: string | null;
  } = {};

  if (typeof payload.name === "string") {
    const name = payload.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Navn kan ikke være tomt." }, { status: 400 });
    }

    const normalizedName = normalizeMerchantName(name);
    data.name = normalizedName;
    data.normalizedName = normalizeMerchantKey(normalizedName);
  }

  if (payload.category !== undefined) {
    const category = payload.category as SubscriptionCategory;
    if (!allowedCategories.includes(category)) {
      return NextResponse.json({ error: "Ugyldig kategori." }, { status: 400 });
    }
    data.category = category;
  }

  if (payload.status !== undefined) {
    const status = payload.status as SubscriptionStatus;
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Ugyldig status." }, { status: 400 });
    }
    data.status = status;
  }

  if (payload.monthlyCost !== undefined) {
    const monthlyCost = Number(payload.monthlyCost);
    if (!Number.isInteger(monthlyCost) || monthlyCost < 0) {
      return NextResponse.json({ error: "Ugyldig månedspris." }, { status: 400 });
    }
    data.monthlyCost = monthlyCost;
  }

  if (payload.billingInterval !== undefined) {
    const billingInterval = payload.billingInterval as BillingInterval;
    if (!allowedBillingIntervals.includes(billingInterval)) {
      return NextResponse.json({ error: "Ugyldig faktureringsintervall." }, { status: 400 });
    }
    data.billingInterval = billingInterval;
  }

  if (typeof payload.nextPayment === "string") {
    const nextPayment = payload.nextPayment.trim();
    if (!isValidSubscriptionDateInput(nextPayment)) {
      return NextResponse.json(
        { error: "Ugyldig dato.", message: "Neste trekk må være tom eller en gyldig dato." },
        { status: 400 },
      );
    }
    data.nextPayment = nextPayment;
  }

  if (payload.note !== undefined) {
    data.note = typeof payload.note === "string" && payload.note.trim() ? payload.note.trim() : null;
  }

  const result = await prisma.subscription.updateMany({
    where: { id, userId: currentUser.id },
    data,
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Fant ikke abonnementet." }, { status: 404 });
  }

  const subscription = await prisma.subscription.findFirstOrThrow({
    where: { id, userId: currentUser.id },
    select: subscriptionSelect,
  });

  return NextResponse.json(withCancellationStatus(await rolloverSubscription(subscription)));
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

export async function DELETE(_request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const result = await prisma.subscription.deleteMany({
    where: { id, userId: currentUser.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Fant ikke abonnementet." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

async function rolloverSubscription<T extends { id: string; nextPayment: string; billingInterval: string; status: string }>(
  subscription: T,
) {
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
}
