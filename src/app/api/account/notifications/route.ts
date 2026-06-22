import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { canUseEmailReminders, canUseMonthlySummary } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

const allowedReminderDays = [1, 3, 7];

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST", message: "Ugyldig forespørsel." },
      { status: 400 },
    );
  }

  const data: {
    emailRemindersEnabled?: boolean;
    reminderDaysBefore?: number;
    monthlySummaryEnabled?: boolean;
  } = {};

  if ("emailRemindersEnabled" in payload) {
    if (typeof payload.emailRemindersEnabled !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "INVALID_NOTIFICATION_SETTING", message: "Ugyldig varselvalg." },
        { status: 400 },
      );
    }
    if (payload.emailRemindersEnabled && !canUseEmailReminders(currentUser)) {
      return NextResponse.json(
        {
          ok: false,
          error: "PLAN_REQUIRED",
          feature: "email_reminders",
          message: "E-postvarsler krever Premium.",
        },
        { status: 403 },
      );
    }
    data.emailRemindersEnabled = payload.emailRemindersEnabled;
  }

  if ("monthlySummaryEnabled" in payload) {
    if (typeof payload.monthlySummaryEnabled !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "INVALID_SUMMARY_SETTING", message: "Ugyldig oppsummeringsvalg." },
        { status: 400 },
      );
    }
    if (payload.monthlySummaryEnabled && !canUseMonthlySummary(currentUser)) {
      return NextResponse.json(
        {
          ok: false,
          error: "PLAN_REQUIRED",
          feature: "monthly_summary",
          message: "Månedlig oppsummering krever Premium.",
        },
        { status: 403 },
      );
    }
    data.monthlySummaryEnabled = payload.monthlySummaryEnabled;
  }

  if ("reminderDaysBefore" in payload) {
    const reminderDaysBefore = Number(payload.reminderDaysBefore);
    if (!allowedReminderDays.includes(reminderDaysBefore)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_REMINDER_DAYS", message: "Ugyldig påminnelsestid." },
        { status: 400 },
      );
    }
    data.reminderDaysBefore = reminderDaysBefore;
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data,
      select: {
        emailRemindersEnabled: true,
        reminderDaysBefore: true,
        monthlySummaryEnabled: true,
      },
    });

    return NextResponse.json({ ok: true, preferences: withNotificationDefaults(updatedUser) });
  } catch (error) {
    logServerError("api/account/notifications:patch", error, currentUser.id);
    return NextResponse.json(
      {
        ok: false,
        error: "NOTIFICATION_SETTINGS_UNAVAILABLE",
        message: "Varselinnstillinger kunne ikke lastes. Prøv igjen senere.",
      },
      { status: 503 },
    );
  }
}

function withNotificationDefaults(preferences: {
  emailRemindersEnabled: boolean | null;
  reminderDaysBefore: number | null;
  monthlySummaryEnabled: boolean | null;
}) {
  return {
    emailRemindersEnabled: preferences.emailRemindersEnabled ?? true,
    reminderDaysBefore: preferences.reminderDaysBefore ?? 3,
    monthlySummaryEnabled: preferences.monthlySummaryEnabled ?? false,
  };
}

function logServerError(route: string, error: unknown, userId?: string) {
  const safeError =
    error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  console.error("[api]", { route, userId, ...safeError });
}
