import "server-only";

import { Prisma } from "@prisma/client";
import {
  sendPaymentFailedEmailOnce,
  sendPremiumActivatedEmailOnce,
  sendPremiumCancelledEmailOnce,
} from "@/lib/billing/billing-emails";
import { getAgreement, isVippsRecurringConfigured } from "@/lib/billing/vipps-recurring";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { trackServerFunnelEvent } from "@/lib/server-analytics";

const stalePendingMinutes = 10;

const agreementInclude = {
  user: { select: { id: true, plan: true, email: true, name: true } },
} satisfies Prisma.BillingAgreementInclude;

type BillingAgreementWithUser = Prisma.BillingAgreementGetPayload<{
  include: typeof agreementInclude;
}>;

type LocalBillingStatus = "active" | "cancelled" | "expired" | "failed";

export type BillingReconciliationResult = {
  ok: boolean;
  agreementId?: string;
  reference?: string;
  previousStatus?: string;
  nextStatus?: string;
  vippsStatus?: string | null;
  changed: boolean;
  retryable?: boolean;
  skipped?: boolean;
  error?: string;
};

export async function reconcileBillingAgreementById(agreementId: string): Promise<BillingReconciliationResult> {
  const agreement = await prisma.billingAgreement.findUnique({
    where: { id: agreementId },
    include: agreementInclude,
  });

  if (!agreement) {
    return {
      ok: false,
      agreementId,
      changed: false,
      skipped: true,
      error: "AGREEMENT_NOT_FOUND",
    } satisfies BillingReconciliationResult;
  }

  return reconcileBillingAgreement(agreement);
}

export async function reconcileStalePendingBillingAgreements({
  olderThanMinutes = stalePendingMinutes,
  limit = 25,
}: {
  olderThanMinutes?: number;
  limit?: number;
} = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const agreements = await prisma.billingAgreement.findMany({
    where: {
      provider: "vipps",
      status: "pending",
      createdAt: { lt: cutoff },
      providerAgreementId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: agreementInclude,
  });

  const results: BillingReconciliationResult[] = [];

  for (const agreement of agreements) {
    results.push(await reconcileBillingAgreement(agreement));
  }

  return {
    checked: agreements.length,
    results,
  };
}

export async function reconcileBillingAgreement(
  agreement: BillingAgreementWithUser,
): Promise<BillingReconciliationResult> {
  const baseResult = {
    agreementId: agreement.id,
    reference: agreement.reference,
    previousStatus: agreement.status,
    changed: false,
  };

  if (!isVippsRecurringConfigured()) {
    return {
      ...baseResult,
      ok: false,
      skipped: true,
      error: "PAYMENTS_NOT_CONFIGURED",
    } satisfies BillingReconciliationResult;
  }

  if (!agreement.providerAgreementId) {
    return {
      ...baseResult,
      ok: false,
      skipped: true,
      error: "MISSING_PROVIDER_AGREEMENT_ID",
    } satisfies BillingReconciliationResult;
  }

  try {
    const vippsAgreement = await getAgreement(agreement.providerAgreementId);
    const vippsStatus = getVippsStatus(vippsAgreement);
    const confirmedStatus = mapVippsStatusToLocalStatus(vippsStatus);

    if (!confirmedStatus) {
      logger.info("[billing:reconcile]", {
        reference: agreement.reference,
        localStatus: agreement.status,
        vippsStatus,
        changed: false,
      });

      return {
        ...baseResult,
        ok: true,
        nextStatus: agreement.status,
        vippsStatus,
        changed: false,
      } satisfies BillingReconciliationResult;
    }

    const updatedAgreement = await applyVerifiedBillingStatus(agreement, confirmedStatus);
    const changed = updatedAgreement.status !== agreement.status;

    logger.info("[billing:reconcile]", {
      reference: agreement.reference,
      localStatus: agreement.status,
      nextStatus: updatedAgreement.status,
      vippsStatus,
      changed,
    });

    return {
      ...baseResult,
      ok: true,
      nextStatus: updatedAgreement.status,
      vippsStatus,
      changed,
    } satisfies BillingReconciliationResult;
  } catch (error) {
    const retryable = isRetryablePrismaError(error);

    logger.error("[billing:reconcile]", {
      reference: agreement.reference,
      localStatus: agreement.status,
      error,
      retryable,
    });

    return {
      ...baseResult,
      ok: false,
      retryable,
      error: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    } satisfies BillingReconciliationResult;
  }
}

export async function applyVerifiedBillingStatus(
  agreement: BillingAgreementWithUser,
  confirmedStatus: LocalBillingStatus,
) {
  const now = new Date();

  if (confirmedStatus === "active") {
    const updatedAgreement = await prisma.$transaction(async (tx) => {
      const nextAgreement = await tx.billingAgreement.update({
        where: { id: agreement.id },
        data: {
          status: "active",
          activatedAt: agreement.activatedAt ?? now,
          cancelledAt: null,
        },
        include: { user: { select: { email: true, name: true } } },
      });

      await tx.user.update({
        where: { id: agreement.userId },
        data: { plan: "premium" },
      });

      return nextAgreement;
    });

    await sendPremiumActivatedEmailOnce(updatedAgreement);
    trackServerFunnelEvent("premium_activated", {
      plan: updatedAgreement.plan,
      interval: updatedAgreement.interval,
      priceNok: updatedAgreement.priceNok,
    });
    return updatedAgreement;
  }

  const updatedAgreement = await prisma.billingAgreement.update({
    where: { id: agreement.id },
    data: {
      status: confirmedStatus,
      cancelledAt: confirmedStatus === "cancelled" ? now : agreement.cancelledAt,
    },
    include: { user: { select: { email: true, name: true } } },
  });

  await downgradeUserIfNoActivePremiumAgreement(agreement.userId);

  if (confirmedStatus === "cancelled" && (agreement.status === "active" || agreement.activatedAt)) {
    await sendPremiumCancelledEmailOnce(updatedAgreement);
  } else {
    await sendPaymentFailedEmailOnce(updatedAgreement);
  }

  return updatedAgreement;
}

export async function downgradeUserIfNoActivePremiumAgreement(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (!user || user.plan === "admin" || user.plan === "beta") {
    return false;
  }

  const activePremiumAgreement = await prisma.billingAgreement.findFirst({
    where: {
      userId,
      status: "active",
    },
    select: { id: true },
  });

  if (activePremiumAgreement) {
    return false;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { plan: "free" },
  });

  return true;
}

export function getVippsStatus(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "status" in payload) {
    const status = (payload as { status?: unknown }).status;

    return typeof status === "string" ? status : null;
  }

  return null;
}

export function mapVippsStatusToLocalStatus(status: string | null): LocalBillingStatus | null {
  if (status === "ACTIVE") {
    return "active";
  }

  if (status === "STOPPED" || status === "CANCELLED" || status === "TERMINATED") {
    return "cancelled";
  }

  if (status === "EXPIRED") {
    return "expired";
  }

  if (status === "FAILED" || status === "ABORTED") {
    return "failed";
  }

  return null;
}

export function isRetryablePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1002", "P1008", "P1017", "P2024", "P2034"].includes(error.code);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("timeout") ||
    message.includes("connection") ||
    message.includes("temporarily") ||
    message.includes("econnreset")
  );
}
