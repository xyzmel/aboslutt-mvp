import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createAgreement,
  isVippsRecurringConfigured,
  type VippsRecurringAgreementPlan,
} from "@/lib/billing/vipps-recurring";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

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

  if (!isVippsRecurringConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "PAYMENTS_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const reference = createBillingReference();
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
    await prisma.billingAgreement.update({
      where: { id: billingAgreement.id },
      data: { status: "failed" },
    });

    throw error;
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
