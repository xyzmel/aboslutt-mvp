import { sendMonthlySummaryEmail, sendUpcomingPaymentReminder } from "@/lib/notification-email";
import { canUseEmailReminders, canUseMonthlySummary } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import {
  normalizeNextPaymentDate,
  parseSubscriptionDate,
  startOfDay,
  toIsoDate,
} from "@/lib/subscription-dates";
import type { BillingInterval } from "@/types/subscription";

const activeStatuses = ["active", "trial", "yearly"];
const reminderType = "upcoming_payment";

type JobOptions = {
  dryRun?: boolean;
  triggeredByEmail?: string | null;
};

type JobResult = {
  ok: true;
  dryRun: boolean;
  usersChecked: number;
  activeSubscriptionsChecked: number;
  dueReminders: number;
  emailsSent: number;
  remindersCreated: number;
  skippedReasons: Record<string, number>;
};

export async function runUpcomingPaymentReminders({
  dryRun = false,
  triggeredByEmail = null,
}: JobOptions = {}): Promise<JobResult> {
  return runLoggedJob("upcoming_payment_reminders", dryRun, triggeredByEmail, async () => {
    const users = await prisma.user.findMany({
      where: {
        email: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        plan: true,
        emailRemindersEnabled: true,
        reminderDaysBefore: true,
        subscriptions: {
          where: { status: { in: activeStatuses } },
          select: {
            id: true,
            name: true,
            monthlyCost: true,
            status: true,
            billingInterval: true,
            nextPayment: true,
          },
        },
      },
    });

    let emailsSent = 0;
    let remindersCreated = 0;
    let activeSubscriptionsChecked = 0;
    let dueReminders = 0;
    const skippedReasons = createSkippedReasons();
    const today = startOfDay(new Date());
    const todayIsoDate = toIsoDate(today);

    for (const user of users) {
      if (!user.email) {
        skippedReasons.missingEmail += 1;
        continue;
      }

      if (!user.emailVerified) {
        skippedReasons.unverifiedEmail += 1;
        continue;
      }

      if (!canUseEmailReminders(user)) {
        skippedReasons.planNotAllowed += 1;
        continue;
      }

      if (!user.emailRemindersEnabled) {
        skippedReasons.remindersDisabled += 1;
        continue;
      }

      const dueSubscriptions = [];

      if (user.subscriptions.length === 0) {
        skippedReasons.noActiveSubscriptions += 1;
      }

      for (const subscription of user.subscriptions) {
        activeSubscriptionsChecked += 1;
        const normalizedNextPayment = normalizeNextPaymentDate({
          nextPayment: subscription.nextPayment,
          billingInterval: subscription.billingInterval as BillingInterval,
          status: subscription.status,
        });

        if (!dryRun && normalizedNextPayment && normalizedNextPayment !== subscription.nextPayment) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { nextPayment: normalizedNextPayment },
          });
        }

        if (!normalizedNextPayment) {
          skippedReasons.missingOrInvalidNextPayment += 1;
          continue;
        }

        const reminderDate = calculateReminderDate(normalizedNextPayment, user.reminderDaysBefore);

        if (reminderDate !== todayIsoDate) {
          skippedReasons.notDueToday += 1;
          continue;
        }

        const existingReminder = await prisma.reminderLog.findFirst({
          where: {
            userId: user.id,
            subscriptionId: subscription.id,
            reminderDate: normalizedNextPayment,
            type: reminderType,
          },
          select: { id: true },
        });

        if (existingReminder) {
          skippedReasons.alreadySent += 1;
          continue;
        }

        dueReminders += 1;
        dueSubscriptions.push({
          id: subscription.id,
          name: subscription.name,
          monthlyCost: subscription.monthlyCost,
          nextPayment: normalizedNextPayment,
        });
      }

      if (dueSubscriptions.length === 0) {
        continue;
      }

      if (dryRun) {
        emailsSent += 1;
        remindersCreated += dueSubscriptions.length;
        continue;
      }

      const emailResult = await sendUpcomingPaymentReminder({
        to: user.email,
        name: user.name,
        subscriptions: dueSubscriptions,
      });

      if (!emailResult.sent) {
        continue;
      }

      emailsSent += 1;

      await prisma.reminderLog.createMany({
        data: dueSubscriptions.map((subscription) => ({
          userId: user.id,
          subscriptionId: subscription.id,
          reminderDate: subscription.nextPayment,
          type: reminderType,
        })),
        skipDuplicates: true,
      });
      remindersCreated += dueSubscriptions.length;
    }

    return {
      ok: true,
      dryRun,
      usersChecked: users.length,
      activeSubscriptionsChecked,
      dueReminders,
      emailsSent,
      remindersCreated,
      skippedReasons,
    };
  });
}

export async function runMonthlySummary({
  dryRun = false,
  triggeredByEmail = null,
}: JobOptions = {}): Promise<JobResult> {
  return runLoggedJob("monthly_summary", dryRun, triggeredByEmail, async () => {
    const users = await prisma.user.findMany({
      where: {
        monthlySummaryEnabled: true,
        email: { not: null },
        emailVerified: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        subscriptions: {
          where: { status: { in: activeStatuses } },
          select: {
            id: true,
            name: true,
            monthlyCost: true,
            status: true,
            billingInterval: true,
            nextPayment: true,
          },
        },
      },
    });

    let emailsSent = 0;
    let activeSubscriptionsChecked = 0;
    const skippedReasons = createSkippedReasons();
    const today = startOfDay(new Date());
    const thirtyDaysFromNow = addDays(today, 30);

    for (const user of users) {
      if (!user.email) {
        skippedReasons.missingEmail += 1;
        continue;
      }

      if (!canUseMonthlySummary(user)) {
        skippedReasons.planNotAllowed += 1;
        continue;
      }

      const normalizedSubscriptions = [];

      for (const subscription of user.subscriptions) {
        activeSubscriptionsChecked += 1;
        const normalizedNextPayment = normalizeNextPaymentDate({
          nextPayment: subscription.nextPayment,
          billingInterval: subscription.billingInterval as BillingInterval,
          status: subscription.status,
        });

        if (!dryRun && normalizedNextPayment && normalizedNextPayment !== subscription.nextPayment) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { nextPayment: normalizedNextPayment },
          });
        }

        normalizedSubscriptions.push({
          ...subscription,
          nextPayment: normalizedNextPayment,
        });
      }

      const monthlyTotal = normalizedSubscriptions.reduce(
        (sum, subscription) => sum + getMonthlyEquivalent(subscription),
        0,
      );
      const upcomingSubscriptions = normalizedSubscriptions
        .filter((subscription) => {
          const paymentDate = parseSubscriptionDate(subscription.nextPayment);
          return Boolean(paymentDate && paymentDate >= today && paymentDate <= thirtyDaysFromNow);
        })
        .sort((a, b) => {
          const dateA = parseSubscriptionDate(a.nextPayment);
          const dateB = parseSubscriptionDate(b.nextPayment);
          return (dateA?.getTime() ?? 0) - (dateB?.getTime() ?? 0);
        });

      if (dryRun) {
        emailsSent += 1;
        continue;
      }

      const emailResult = await sendMonthlySummaryEmail({
        to: user.email,
        name: user.name,
        activeCount: normalizedSubscriptions.length,
        monthlyTotal,
        yearlyEstimate: monthlyTotal * 12,
        upcomingSubscriptions,
      });

      if (emailResult.sent) {
        emailsSent += 1;
      }
    }

    return {
      ok: true,
      dryRun,
      usersChecked: users.length,
      activeSubscriptionsChecked,
      dueReminders: users.length,
      emailsSent,
      remindersCreated: 0,
      skippedReasons,
    };
  });
}

async function runLoggedJob(
  type: string,
  dryRun: boolean,
  triggeredByEmail: string | null,
  callback: () => Promise<JobResult>,
) {
  const jobRun = await prisma.jobRun.create({
    data: {
      type,
      status: "running",
      dryRun,
      triggeredByEmail,
    },
    select: { id: true },
  });

  try {
    const result = await callback();
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "success",
        usersChecked: result.usersChecked,
        emailsSent: result.emailsSent,
        remindersCreated: result.remindersCreated,
        completedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Ukjent feil",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

function calculateReminderDate(nextPayment: string, reminderDaysBefore: number) {
  const paymentDate = parseSubscriptionDate(nextPayment);

  if (!paymentDate) {
    return null;
  }

  const reminderDate = new Date(paymentDate);
  reminderDate.setDate(paymentDate.getDate() - reminderDaysBefore);
  return toIsoDate(startOfDay(reminderDate));
}

function createSkippedReasons() {
  return {
    missingEmail: 0,
    unverifiedEmail: 0,
    remindersDisabled: 0,
    planNotAllowed: 0,
    noActiveSubscriptions: 0,
    missingOrInvalidNextPayment: 0,
    notDueToday: 0,
    alreadySent: 0,
  };
}

function getMonthlyEquivalent(subscription: { monthlyCost: number; billingInterval: string }) {
  if (subscription.billingInterval === "yearly") {
    return Math.round(subscription.monthlyCost / 12);
  }

  return subscription.monthlyCost;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return startOfDay(nextDate);
}
