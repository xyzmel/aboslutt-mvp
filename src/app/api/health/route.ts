import { NextResponse } from "next/server";
import { isVippsConfigured } from "@/lib/auth-config-status";
import { areBetaSignupsEnabled } from "@/lib/beta";
import { sessionStrategy } from "@/lib/auth";
import { isVippsRecurringConfigured } from "@/lib/billing/vipps-recurring";
import { isCronConfigured } from "@/lib/cron";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured } from "@/lib/smtp";

export async function GET() {
  const authConfigured = Boolean(process.env.NEXTAUTH_URL && process.env.NEXTAUTH_SECRET);
  const vippsConfigured = isVippsConfigured();

  try {
    const [userCount, subscriptionCount, latestSuccessfulBillingEvent, latestFailedBillingEvent] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count(),
      prisma.billingEvent.findFirst({
        where: { provider: "vipps" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.billingEvent.findFirst({
        where: {
          OR: [
            { eventType: { contains: "failed" } },
            { eventType: { contains: "aborted" } },
            { eventType: { contains: "expired" } },
            { eventType: { contains: "cancelled" } },
            { eventType: { contains: "terminated" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      environment: process.env.NODE_ENV,
      databaseConnected: true,
      authConfigured,
      cronConfigured: isCronConfigured(),
      emailConfigured: isSmtpConfigured(),
      sessionStrategy,
      smtpConfigured: isSmtpConfigured(),
      betaSignupsEnabled: areBetaSignupsEnabled(),
      vippsConfigured,
      billing: {
        vippsRecurringConfigured: isVippsRecurringConfigured(),
        webhookSecretPresent: Boolean(process.env.VIPPS_WEBHOOK_SECRET?.trim()),
        databaseReachable: true,
        latestSuccessfulWebhookAt: latestSuccessfulBillingEvent?.createdAt.toISOString() ?? null,
        latestFailedBillingEventAt: latestFailedBillingEvent?.createdAt.toISOString() ?? null,
      },
      userCount,
      subscriptionCount,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        environment: process.env.NODE_ENV,
        databaseConnected: false,
        authConfigured,
        cronConfigured: isCronConfigured(),
        emailConfigured: isSmtpConfigured(),
        sessionStrategy,
        smtpConfigured: isSmtpConfigured(),
        betaSignupsEnabled: areBetaSignupsEnabled(),
        vippsConfigured,
        billing: {
          vippsRecurringConfigured: isVippsRecurringConfigured(),
          webhookSecretPresent: Boolean(process.env.VIPPS_WEBHOOK_SECRET?.trim()),
          databaseReachable: false,
          latestSuccessfulWebhookAt: null,
          latestFailedBillingEventAt: null,
        },
        userCount: null,
        subscriptionCount: null,
      },
      { status: 503 },
    );
  }
}
