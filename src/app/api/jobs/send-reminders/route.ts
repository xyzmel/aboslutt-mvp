import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron";
import { runUpcomingPaymentReminders } from "@/lib/notification-jobs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cronError = validateCronRequest(request);

  if (cronError) {
    return cronError;
  }

  try {
    const result = await runUpcomingPaymentReminders();
    return NextResponse.json(result);
  } catch (error) {
    logJobError("send-reminders", error);
    return NextResponse.json(
      { ok: false, error: "REMINDER_JOB_FAILED", message: "Kunne ikke sende påminnelser." },
      { status: 500 },
    );
  }
}

function logJobError(route: string, error: unknown) {
  const safeError =
    error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  console.error("[job]", { route, ...safeError });
}
