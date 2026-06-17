import { NextResponse } from "next/server";
import { getAgreement, isVippsRecurringConfigured } from "@/lib/billing/vipps-recurring";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const agreement = await prisma.billingAgreement.findFirst({
    where: {
      userId: currentUser.id,
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      providerAgreementId: true,
      reference: true,
      plan: true,
      status: true,
      priceNok: true,
      interval: true,
      activatedAt: true,
      createdAt: true,
    },
  });

  if (!agreement) {
    return NextResponse.json({
      ok: true,
      status: "none",
      plan: currentUser.plan,
    });
  }

  if (!agreement.providerAgreementId) {
    return NextResponse.json({
      ok: true,
      status: agreement.status,
      plan: currentUser.plan,
      billingAgreement: safeAgreement(agreement),
    });
  }

  if (!isVippsRecurringConfigured()) {
    return NextResponse.json({
      ok: true,
      status: agreement.status,
      plan: currentUser.plan,
      billingAgreement: safeAgreement(agreement),
      paymentsConfigured: false,
    });
  }

  const vippsAgreement = await getAgreement(agreement.providerAgreementId);
  const vippsStatus = getVippsStatus(vippsAgreement);

  if (vippsStatus === "ACTIVE") {
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
        where: { id: currentUser.id },
        data: { plan: "premium" },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      status: "active",
      plan: "premium",
      billingAgreement: { ...safeAgreement(agreement), status: "active" },
    });
  }

  if (vippsStatus === "STOPPED" || vippsStatus === "EXPIRED") {
    const status = vippsStatus === "EXPIRED" ? "expired" : "cancelled";

    await prisma.billingAgreement.update({
      where: { id: agreement.id },
      data: {
        status,
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      status,
      plan: currentUser.plan,
      billingAgreement: { ...safeAgreement(agreement), status },
    });
  }

  return NextResponse.json({
    ok: true,
    status: agreement.status,
    plan: currentUser.plan,
    vippsStatus,
    billingAgreement: safeAgreement(agreement),
  });
}

function getVippsStatus(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "status" in payload) {
    const status = (payload as { status?: unknown }).status;

    return typeof status === "string" ? status : null;
  }

  return null;
}

function safeAgreement(agreement: {
  reference: string;
  plan: string;
  status: string;
  priceNok: number;
  interval: string;
  createdAt: Date;
}) {
  return {
    reference: agreement.reference,
    plan: agreement.plan,
    status: agreement.status,
    priceNok: agreement.priceNok,
    interval: agreement.interval,
    createdAt: agreement.createdAt.toISOString(),
  };
}
