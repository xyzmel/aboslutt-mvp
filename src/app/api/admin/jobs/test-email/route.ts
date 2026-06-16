import { NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/admin-audit";
import { AdminForbiddenError, isAdminUser } from "@/lib/admin";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";
import { sendTransactionalEmail } from "@/lib/transactional-email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "admin-job-test-email",
    limit: 10,
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

  if (!currentUser.email) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_EMAIL_MISSING", message: "Admin-brukeren mangler e-postadresse." },
      { status: 400 },
    );
  }

  try {
    const result = await sendTransactionalEmail({
      to: currentUser.email,
      subject: "Test e-post fra Aboslutt",
      text: [
        "Hei!",
        "",
        "Dette er en test fra admin-portalen i Aboslutt.",
        "Hvis du mottar denne, fungerer SMTP-konfigurasjonen for transaksjonelle e-poster.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0D1B2A;">
          <h1>Test e-post fra Aboslutt</h1>
          <p>Hvis du mottar denne, fungerer SMTP-konfigurasjonen for transaksjonelle e-poster.</p>
        </div>
      `,
    });

    if (!result.sent) {
      return NextResponse.json(
        { ok: false, error: "EMAIL_NOT_CONFIGURED", message: "E-post er ikke konfigurert." },
        { status: 503 },
      );
    }

    await logAdminAudit({
      adminUserId: currentUser.id,
      action: "job.test_email_triggered",
    });

    return NextResponse.json({ ok: true, message: `Test-e-post er sendt til ${currentUser.email}.` });
  } catch (error) {
    logAdminJobError("admin/jobs/test-email", error, currentUser.id);
    return NextResponse.json(
      { ok: false, error: "TEST_EMAIL_FAILED", message: "Kunne ikke sende test-e-post." },
      { status: 500 },
    );
  }
}

function logAdminJobError(route: string, error: unknown, userId?: string) {
  const safeError =
    error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  logger.error("[admin-job]", { route, userId, ...safeError });
}
