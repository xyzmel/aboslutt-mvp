import { isSmtpConfigured } from "@/lib/smtp";

export function isVippsConfigured() {
  return Boolean(
    process.env.VIPPS_CLIENT_ID?.trim() &&
      process.env.VIPPS_CLIENT_SECRET?.trim() &&
      process.env.VIPPS_WELL_KNOWN_URL?.trim(),
  );
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function isEmailConfigured() {
  return isSmtpConfigured();
}

export function getSafeAuthConfigStatus() {
  return {
    googleConfigured: isGoogleConfigured(),
    vippsConfigured: isVippsConfigured(),
    emailConfigured: isEmailConfigured(),
  };
}

export function logAuthConfigStatusInDevelopment() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[auth-config]", {
    vippsConfigured: isVippsConfigured(),
    hasClientId: Boolean(process.env.VIPPS_CLIENT_ID?.trim()),
    hasClientSecret: Boolean(process.env.VIPPS_CLIENT_SECRET?.trim()),
    hasWellKnown: Boolean(process.env.VIPPS_WELL_KNOWN_URL?.trim()),
  });
}
