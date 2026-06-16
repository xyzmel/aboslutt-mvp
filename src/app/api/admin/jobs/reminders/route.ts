import { NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/admin-audit";
import { AdminForbiddenError, isAdminUser } from "@/lib/admin";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { runUpcomingPaymentReminders } from "@/lib/notification-jobs";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "admin-job-reminders",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  if (!isAdminUser(currentUser)) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN", message: new AdminForbiddenError().message },
      { status: 403 },
    );
  }

  const payload = await request.json().catch(() => ({}));
  const dryRun = Boolean(payload?.dryRun);

  try {
    const result = await runUpcomingPaymentReminders({
      dryRun,
      triggeredByEmail: currentUser.email,
    });
    await logAdminAudit({
      adminUserId: currentUser.id,
      action: "job.reminders_triggered",
      metadata: { dryRun, emailsSent: result.emailsSent, remindersCreated: result.remindersCreated },
    });
    return NextResponse.json(result);
  } catch (error) {
    logAdminJobError("admin/jobs/reminders", error, currentUser.id);
    return NextResponse.json(
      { ok: false, error: "REMINDER_JOB_FAILED", message: "Kunne ikke teste kommende trekk-varsler." },
      { status: 500 },
    );
  }
}

function logAdminJobError(route: string, error: unknown, userId?: string) {
  const safeError =
    error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  logger.error("[admin-job]", { route, userId, ...safeError });
}
