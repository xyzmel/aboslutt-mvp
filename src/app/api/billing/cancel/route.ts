import { NextResponse } from "next/server";
import {
  cancelAgreement,
  isVippsRecurringConfigured,
  VippsRecurringError,
} from "@/lib/billing/vipps-recurring";
import { sendPremiumCancelledEmailOnce } from "@/lib/billing/billing-emails";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  if (!isVippsRecurringConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "PAYMENTS_NOT_CONFIGURED",
        message: "Vipps-betaling er ikke ferdig konfigurert.",
      },
      { status: 503 },
    );
  }

  const agreement = await prisma.billingAgreement.findFirst({
    where: {
      userId: currentUser.id,
      provider: "vipps",
      status: "active",
      providerAgreementId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      providerAgreementId: true,
      reference: true,
      plan: true,
      activatedAt: true,
      expiresAt: true,
      provider: true,
      providerChargeId: true,
      priceNok: true,
      interval: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      cancelledAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (!agreement?.providerAgreementId) {
    return NextResponse.json(
      {
        ok: false,
        error: "NO_ACTIVE_AGREEMENT",
        message: "Fant ingen aktiv Vipps-avtale å stoppe.",
      },
      { status: 404 },
    );
  }

  try {
    const vippsResponse = await cancelAgreement(agreement.providerAgreementId);
    const vippsStatus = getVippsStatus(vippsResponse);
    const nextStatus = isConfirmedStoppedStatus(vippsStatus) ? "cancelled" : "cancellation_pending";
    const now = new Date();

    const updatedAgreement = await prisma.billingAgreement.update({
      where: { id: agreement.id },
      data: {
        status: nextStatus,
        cancelledAt: nextStatus === "cancelled" ? now : null,
      },
      include: { user: { select: { email: true, name: true } } },
    });

    if (nextStatus === "cancelled") {
      await sendPremiumCancelledEmailOnce(updatedAgreement);
    }

    logger.info("[billing:cancel:result]", {
      reference: agreement.reference,
      plan: agreement.plan,
      vippsStatus,
      nextStatus,
    });

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      message:
        nextStatus === "cancelled"
          ? "Vipps-avtalen er stoppet."
          : "Avslutning av Vipps-avtalen er sendt.",
    });
  } catch (error) {
    logCancelError(error, agreement.reference, agreement.plan);

    if (error instanceof VippsRecurringError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: "Vipps kunne ikke stoppe betalingsavtalen akkurat nå.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Kunne ikke stoppe betalingsavtalen akkurat nå.",
      },
      { status: 500 },
    );
  }
}

function getVippsStatus(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "status" in payload) {
    const status = (payload as { status?: unknown }).status;
    return typeof status === "string" ? status : null;
  }

  return null;
}

function isConfirmedStoppedStatus(status: string | null) {
  return status === "STOPPED" || status === "CANCELLED" || status === "TERMINATED";
}

function logCancelError(error: unknown, reference: string, plan: string) {
  if (error instanceof VippsRecurringError) {
    logger.error("[billing:cancel]", {
      error: error.code,
      status: error.status,
      vippsCode: error.vippsCode,
      vippsMessage: error.vippsMessage,
      reference,
      plan,
    });
    return;
  }

  logger.error("[billing:cancel]", {
    error: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown cancellation error",
    reference,
    plan,
  });
}
