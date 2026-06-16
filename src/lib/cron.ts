import { NextResponse } from "next/server";

export function validateCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_NOT_CONFIGURED", message: "Cron er ikke konfigurert." },
      { status: process.env.NODE_ENV === "production" ? 500 : 503 },
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Ugyldig cron-token." },
      { status: 401 },
    );
  }

  return null;
}

export function isCronConfigured() {
  return Boolean(process.env.CRON_SECRET?.trim());
}
