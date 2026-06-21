import { NextResponse } from "next/server";
import { reconcileBillingAgreementById } from "@/lib/billing/reconcile";
import { isVippsRecurringConfigured } from "@/lib/billing/vipps-recurring";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type PublicBillingStatus = "pending" | "active" | "cancelled" | "expired" | "failed" | "none";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const agreement = await prisma.billingAgreement.findFirst({
    where: {
      userId: currentUser.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  if (!agreement) {
    return NextResponse.json({
      ok: true,
      status: "none" satisfies PublicBillingStatus,
      plan: currentUser.plan,
      billingAgreement: null,
    });
  }

  if (agreement.status !== "pending" || !agreement.providerAgreementId || !isVippsRecurringConfigured()) {
    return NextResponse.json({
      ok: true,
      status: normalizePublicStatus(agreement.status),
      plan: currentUser.plan,
      paymentsConfigured: isVippsRecurringConfigured(),
      billingAgreement: safeAgreement(agreement),
    });
  }

  try {
    const reconciliation = await reconcileBillingAgreementById(agreement.id);
    const updatedAgreement =
      (await prisma.billingAgreement.findUnique({ where: { id: agreement.id } })) ?? agreement;

    return NextResponse.json({
      ok: true,
      status: normalizePublicStatus(updatedAgreement.status),
      plan: updatedAgreement.status === "active" ? "premium" : currentUser.plan,
      vippsStatus: reconciliation.vippsStatus,
      verification: reconciliation.ok ? "checked" : "unavailable",
      billingAgreement: safeAgreement(updatedAgreement),
    });
  } catch (error) {
    logger.error("[billing:status]", {
      error,
      reference: agreement.reference,
      agreementStatus: agreement.status,
    });

    return NextResponse.json({
      ok: true,
      status: "pending" satisfies PublicBillingStatus,
      plan: currentUser.plan,
      billingAgreement: safeAgreement(agreement),
      verification: "unavailable",
    });
  }
}

function normalizePublicStatus(status: string): PublicBillingStatus {
  if (status === "active") {
    return "active";
  }

  if (status === "pending" || status === "cancellation_pending") {
    return "pending";
  }

  if (status === "cancelled" || status === "terminated") {
    return "cancelled";
  }

  if (status === "expired") {
    return "expired";
  }

  if (status === "failed" || status === "aborted") {
    return "failed";
  }

  return "failed";
}

function safeAgreement(agreement: {
  reference: string;
  plan: string;
  status: string;
  priceNok: number;
  interval: string;
  currency: string;
  activatedAt: Date | null;
  cancelledAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    reference: agreement.reference,
    plan: agreement.plan,
    status: normalizePublicStatus(agreement.status),
    localStatus: agreement.status,
    priceNok: agreement.priceNok,
    currency: agreement.currency,
    interval: agreement.interval,
    activatedAt: agreement.activatedAt?.toISOString() ?? null,
    cancelledAt: agreement.cancelledAt?.toISOString() ?? null,
    expiresAt: agreement.expiresAt?.toISOString() ?? null,
    createdAt: agreement.createdAt.toISOString(),
    updatedAt: agreement.updatedAt.toISOString(),
  };
}
