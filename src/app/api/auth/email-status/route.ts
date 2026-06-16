import { NextResponse } from "next/server";
import { areBetaSignupsEnabled, validateEmailMagicLinkRequest } from "@/lib/beta";
import { isSmtpConfigured } from "@/lib/smtp";

export async function GET() {
  return NextResponse.json({
    smtpConfigured: isSmtpConfigured(),
    betaSignupsEnabled: areBetaSignupsEnabled(),
  });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as {
    email?: string;
    mode?: "login" | "register";
  };
  const email = payload.email?.trim().toLowerCase() ?? "";
  const mode = payload.mode === "register" ? "register" : "login";

  if (!email) {
    return NextResponse.json(
      {
        allowed: false,
        message: "Skriv inn e-postadressen din.",
        smtpConfigured: isSmtpConfigured(),
        betaSignupsEnabled: areBetaSignupsEnabled(),
      },
      { status: 400 },
    );
  }

  const result = await validateEmailMagicLinkRequest(email, mode);
  return NextResponse.json(result, { status: result.allowed ? 200 : 403 });
}
