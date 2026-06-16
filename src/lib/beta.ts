import { prisma } from "@/lib/prisma";
import { isSmtpConfigured } from "@/lib/smtp";

export type EmailAuthMode = "login" | "register";

export function areBetaSignupsEnabled() {
  return process.env.BETA_SIGNUPS_ENABLED !== "false";
}

export function getAllowedBetaEmails() {
  return (process.env.BETA_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function validateEmailMagicLinkRequest(email: string, mode: EmailAuthMode) {
  const normalizedEmail = email.trim().toLowerCase();
  const allowedEmails = getAllowedBetaEmails();
  const smtpConfigured = isSmtpConfigured();
  const betaSignupsEnabled = areBetaSignupsEnabled();

  if (!smtpConfigured) {
    return {
      allowed: false,
      message: "E-postinnlogging er ikke konfigurert enda.",
      smtpConfigured,
      betaSignupsEnabled,
    };
  }

  if (allowedEmails.length > 0 && !allowedEmails.includes(normalizedEmail)) {
    return {
      allowed: false,
      message: "Denne e-postadressen er ikke invitert til betaen enda.",
      smtpConfigured,
      betaSignupsEnabled,
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (!betaSignupsEnabled && !existingUser) {
    return {
      allowed: false,
      message: "Beta-registrering er midlertidig stengt.",
      smtpConfigured,
      betaSignupsEnabled,
    };
  }

  if (mode === "register" && !betaSignupsEnabled) {
    return {
      allowed: false,
      message: "Beta-registrering er midlertidig stengt.",
      smtpConfigured,
      betaSignupsEnabled,
    };
  }

  return {
    allowed: true,
    message: null,
    smtpConfigured,
    betaSignupsEnabled,
  };
}
