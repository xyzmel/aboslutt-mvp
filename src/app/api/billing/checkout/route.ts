import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createAgreement,
  isVippsRecurringConfigured,
  VippsRecurringError,
  type VippsRecurringAgreementPlan,
} from "@/lib/billing/vipps-recurring";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { trackServerFunnelEvent } from "@/lib/server-analytics";

const checkoutPlans = {
  premium_monthly: {
    id: "premium_monthly",
    name: "Aboslutt Premium månedlig",
    amountNok: 79,
    interval: "month",
  },
  premium_yearly: {
    id: "premium_yearly",
    name: "Aboslutt Premium årlig",
    amountNok: 499,
    interval: "year",
  },
} as const satisfies Record<string, VippsRecurringAgreementPlan>;

type CheckoutPlanId = keyof typeof checkoutPlans;

const pendingCheckoutWindowMs = 10 * 60 * 1000;

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const payload = (await request.json().catch(() => ({}))) as { plan?: unknown };
  const plan = typeof payload.plan === "string" ? getCheckoutPlan(payload.plan) : null;

  if (!plan) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PLAN", message: "Ugyldig betalingsplan." },
      { status: 400 },
    );
  }

  const reference = createBillingReference();

  logger.info("[billing:checkout:started]", {
    reference,
    plan: plan.id,
    userId: currentUser.id,
  });

  if (!isVippsRecurringConfigured()) {
    logger.error("[billing:checkout]", {
      error: "PAYMENTS_NOT_CONFIGURED",
      reference,
      plan: plan.id,
      config: getSafeVippsRecurringConfigStatus(),
    });

    return NextResponse.json(
      {
        ok: false,
        error: "PAYMENTS_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const existingActiveAgreement = await prisma.billingAgreement.findFirst({
    where: {
      userId: currentUser.id,
      status: "active",
    },
    select: { id: true },
  });

  if (existingActiveAgreement || currentUser.plan === "premium") {
    return NextResponse.json(
      {
        ok: false,
        error: "ALREADY_PREMIUM",
        message: "Premium er allerede aktivert på kontoen din.",
        statusUrl: "/payment/thanks",
      },
      { status: 409 },
    );
  }

  const recentPendingAgreement = await prisma.billingAgreement.findFirst({
    where: {
      userId: currentUser.id,
      status: "pending",
      createdAt: { gt: new Date(Date.now() - pendingCheckoutWindowMs) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      reference: true,
      plan: true,
      createdAt: true,
    },
  });

  if (recentPendingAgreement) {
    logger.info("[billing:checkout:duplicate_pending]", {
      reference: recentPendingAgreement.reference,
      plan: recentPendingAgreement.plan,
      userId: currentUser.id,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "CHECKOUT_ALREADY_PENDING",
        message: "En Vipps-godkjenning er allerede startet. Sjekk status før du starter på nytt.",
        statusUrl: "/payment/thanks",
      },
      { status: 409 },
    );
  }

  const billingAgreement = await prisma.billingAgreement.create({
    data: {
      userId: currentUser.id,
      reference,
      plan: plan.id,
      status: "pending",
      priceNok: plan.amountNok,
      interval: plan.interval,
    },
  });

  logger.info("[billing:agreement:created]", {
    reference,
    agreementId: billingAgreement.id,
    status: billingAgreement.status,
    plan: plan.id,
  });

  try {
    const vippsAgreement = await createAgreement({
      user: currentUser,
      plan,
      reference,
    });

    await prisma.billingAgreement.update({
      where: { id: billingAgreement.id },
      data: {
        providerAgreementId: vippsAgreement.agreementId,
        providerChargeId: vippsAgreement.chargeId,
      },
    });

    return NextResponse.json({
      ok: true,
      redirectUrl: vippsAgreement.vippsConfirmationUrl,
    });
  } catch (error) {
    trackServerFunnelEvent("checkout_failed", {
      plan: plan.id,
      reason: error instanceof VippsRecurringError ? error.code : "INTERNAL_ERROR",
    });

    await prisma.billingAgreement.update({
      where: { id: billingAgreement.id },
      data: { status: "failed" },
    });

    logCheckoutError(error, reference, plan.id);

    if (error instanceof VippsRecurringError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message:
            error.code === "VIPPS_TOKEN_ERROR"
              ? "Kunne ikke koble til Vipps akkurat nå."
              : "Vipps kunne ikke opprette betalingsavtalen.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Kunne ikke starte betaling akkurat nå.",
      },
      { status: 500 },
    );
  }
}

function getCheckoutPlan(plan: string) {
  return isCheckoutPlanId(plan) ? checkoutPlans[plan] : null;
}

function isCheckoutPlanId(plan: string): plan is CheckoutPlanId {
  return plan === "premium_monthly" || plan === "premium_yearly";
}

function createBillingReference() {
  return `vipps-${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function getSafeVippsRecurringConfigStatus() {
  return {
    hasClientId: Boolean(process.env.VIPPS_RECURRING_CLIENT_ID?.trim()),
    hasClientSecret: Boolean(process.env.VIPPS_RECURRING_CLIENT_SECRET?.trim()),
    hasSubscriptionKey: Boolean(process.env.VIPPS_RECURRING_SUBSCRIPTION_KEY?.trim()),
    hasMerchantSerialNumber: Boolean(process.env.VIPPS_RECURRING_MERCHANT_SERIAL_NUMBER?.trim()),
    hasBaseUrl: Boolean(process.env.VIPPS_RECURRING_BASE_URL?.trim()),
    hasWebhookSecret: Boolean(process.env.VIPPS_WEBHOOK_SECRET?.trim()),
    hasSiteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
  };
}

function logCheckoutError(error: unknown, reference: string, plan: CheckoutPlanId) {
  if (error instanceof VippsRecurringError) {
    logger.error("[billing:checkout]", {
      error: error.code,
      status: error.status,
      vippsCode: error.vippsCode,
      vippsMessage: error.vippsMessage,
      reference,
      plan,
    });
    return;
  }

  logger.error("[billing:checkout]", {
    error: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown checkout error",
    reference,
    plan,
  });
}
