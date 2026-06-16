import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/cron";
import { runMonthlySummary } from "@/lib/notification-jobs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cronError = validateCronRequest(request);

  if (cronError) {
    return cronError;
  }

  try {
    const result = await runMonthlySummary();
    return NextResponse.json(result);
  } catch (error) {
    logJobError("send-monthly-summary", error);
    return NextResponse.json(
      { ok: false, error: "MONTHLY_SUMMARY_JOB_FAILED", message: "Kunne ikke sende månedsoppsummering." },
      { status: 500 },
    );
  }
}

function logJobError(route: string, error: unknown) {
  const safeError =
    error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  console.error("[job]", { route, ...safeError });
}
