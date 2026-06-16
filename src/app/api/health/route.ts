import { NextResponse } from "next/server";
import { isVippsConfigured } from "@/lib/auth-config-status";
import { areBetaSignupsEnabled } from "@/lib/beta";
import { sessionStrategy } from "@/lib/auth";
import { isCronConfigured } from "@/lib/cron";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured } from "@/lib/smtp";

export async function GET() {
  const authConfigured = Boolean(process.env.NEXTAUTH_URL && process.env.NEXTAUTH_SECRET);
  const vippsConfigured = isVippsConfigured();

  try {
    const [userCount, subscriptionCount] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count(),
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
        userCount: null,
        subscriptionCount: null,
      },
      { status: 503 },
    );
  }
}
