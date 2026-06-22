import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { isAdminUser } from "@/lib/admin";
import { isVippsConfigured } from "@/lib/auth-config-status";
import { isVippsRecurringConfigured } from "@/lib/billing/vipps-recurring";
import { getCurrentAppUser } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { canUseEmailReminders, canUseMonthlySummary } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

const gmailReadonlyScope = "https://www.googleapis.com/auth/gmail.readonly";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Innstillinger | Aboslutt",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  let currentUser;

  try {
    currentUser = await getCurrentAppUser();
  } catch (error) {
    logServerError("settings:getCurrentUser", error);
    return <SettingsLoadError />;
  }

  if (!currentUser) {
    redirect("/login");
  }

  let googleAccount: { scope: string | null; refresh_token: string | null } | null = null;
  let vippsAccount: { provider: string } | null = null;
  let notificationPreferences = {
    emailRemindersEnabled: true,
    reminderDaysBefore: 3,
    monthlySummaryEnabled: false,
  };
  let billingAgreement: SettingsBillingAgreement | null = null;

  try {
    [googleAccount, vippsAccount] = await Promise.all([
      prisma.account.findFirst({
        where: { userId: currentUser.id, provider: "google" },
        select: { scope: true, refresh_token: true },
      }),
      prisma.account.findFirst({
        where: { userId: currentUser.id, provider: "vipps" },
        select: { provider: true },
      }),
    ]);
  } catch (error) {
    logServerError("settings:providerAccounts", error, currentUser.id);
  }

  try {
    const userPreferences = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        emailRemindersEnabled: true,
        reminderDaysBefore: true,
        monthlySummaryEnabled: true,
      },
    });

    if (userPreferences) {
      notificationPreferences = {
        emailRemindersEnabled: userPreferences.emailRemindersEnabled ?? true,
        reminderDaysBefore: userPreferences.reminderDaysBefore ?? 3,
        monthlySummaryEnabled: userPreferences.monthlySummaryEnabled ?? false,
      };
    }
  } catch (error) {
    logServerError("settings:notificationPreferences", error, currentUser.id);
  }

  try {
    billingAgreement = await getSettingsBillingAgreement(currentUser.id);
  } catch (error) {
    logServerError("settings:billingAgreement", error, currentUser.id);
  }

  const gmailScopeConnected = Boolean(
    googleAccount?.scope?.split(" ").includes(gmailReadonlyScope),
  );
  const googleReconnectRequired = Boolean(
    googleAccount && gmailScopeConnected && !googleAccount.refresh_token,
  );
  const emailRemindersAvailable = canUseEmailReminders(currentUser);
  const monthlySummaryAvailable = canUseMonthlySummary(currentUser);
  notificationPreferences = {
    ...notificationPreferences,
    emailRemindersEnabled: emailRemindersAvailable && notificationPreferences.emailRemindersEnabled,
    monthlySummaryEnabled: monthlySummaryAvailable && notificationPreferences.monthlySummaryEnabled,
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader />

      <SettingsClient
        email={currentUser.email}
        billingAgreement={billingAgreement}
        emailRemindersEnabled={notificationPreferences.emailRemindersEnabled}
        emailRemindersAvailable={emailRemindersAvailable}
        gmailScopeConnected={gmailScopeConnected}
        googleConnected={gmailScopeConnected && !googleReconnectRequired}
        googleReconnectRequired={googleReconnectRequired}
        isAdmin={isAdminUser(currentUser)}
        monthlySummaryAvailable={monthlySummaryAvailable}
        monthlySummaryEnabled={notificationPreferences.monthlySummaryEnabled}
        name={currentUser.name}
        plan={currentUser.plan}
        reminderDaysBefore={notificationPreferences.reminderDaysBefore}
        paymentsConfigured={isVippsRecurringConfigured()}
        vippsConnected={Boolean(vippsAccount)}
        vippsConfigured={isVippsConfigured()}
      />
      <AppFooter compact />
    </main>
  );
}

type SettingsBillingAgreement = {
  plan: string;
  status: string;
  priceNok: number;
  interval: string;
  currency: string;
  activatedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
};

async function getSettingsBillingAgreement(userId: string): Promise<SettingsBillingAgreement | null> {
  const agreement =
    (await prisma.billingAgreement.findFirst({
      where: {
        userId,
        provider: "vipps",
        status: { in: ["active", "cancellation_pending"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        plan: true,
        status: true,
        priceNok: true,
        interval: true,
        currency: true,
        activatedAt: true,
        cancelledAt: true,
        expiresAt: true,
      },
    })) ??
    (await prisma.billingAgreement.findFirst({
      where: {
        userId,
        provider: "vipps",
      },
      orderBy: { updatedAt: "desc" },
      select: {
        plan: true,
        status: true,
        priceNok: true,
        interval: true,
        currency: true,
        activatedAt: true,
        cancelledAt: true,
        expiresAt: true,
      },
    }));

  if (!agreement) {
    return null;
  }

  return {
    plan: agreement.plan,
    status: agreement.status,
    priceNok: agreement.priceNok,
    interval: agreement.interval,
    currency: agreement.currency,
    activatedAt: agreement.activatedAt?.toISOString() ?? null,
    cancelledAt: agreement.cancelledAt?.toISOString() ?? null,
    expiresAt: agreement.expiresAt?.toISOString() ?? null,
  };
}

function SettingsLoadError() {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <h1 className="text-2xl font-extrabold tracking-tight">Kunne ikke laste innstillingene akkurat nå.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6F82]">Prøv igjen.</p>
      </section>
    </main>
  );
}

function logServerError(route: string, error: unknown, userId?: string) {
  const safeError = error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  logger.error("[server-render]", { route, userId, ...safeError });
}
