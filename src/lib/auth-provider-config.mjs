export const microsoftLoginProviderId = "microsoft-login";
export const microsoftCommonWellKnownUrl =
  "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration";
export const microsoftLoginScope = "openid profile email";
export const gmailReadonlyScope = "https://www.googleapis.com/auth/gmail.readonly";

export function isGoogleMailConnectEnabled(env = process.env) {
  return env.GOOGLE_MAIL_CONNECT_ENABLED === "true";
}

export function getGoogleAuthScope({ mailConnectEnabled = isGoogleMailConnectEnabled() } = {}) {
  return mailConnectEnabled ? `openid email profile ${gmailReadonlyScope}` : "openid email profile";
}

export function isMicrosoftLoginConfigured(env = process.env) {
  return Boolean(env.MICROSOFT_CLIENT_ID?.trim() && env.MICROSOFT_CLIENT_SECRET?.trim());
}

export function getMicrosoftLoginRedirectUri(baseUrl) {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
  return `${normalizedBaseUrl}/api/auth/callback/${microsoftLoginProviderId}`;
}

export function getSafeAuthErrorMessage(errorCode) {
  const messages = {
    OAuthAccountNotLinked:
      "Denne e-postadressen er allerede knyttet til en annen innloggingsmetode. Logg inn på vanlig måte først.",
    AccessDenied: "Innloggingen ble avbrutt.",
    OAuthCallback: "Vi klarte ikke å logge deg inn med Microsoft. Prøv igjen.",
    Callback: "Vi klarte ikke å logge deg inn. Prøv igjen.",
    Configuration: "Innlogging er midlertidig utilgjengelig. Prøv igjen senere.",
    EMAIL_NOT_VERIFIED: "E-posten din er ikke bekreftet ennå. Sjekk e-posten din før du logger inn.",
  };

  return messages[errorCode] ?? "Kunne ikke logge inn. Sjekk e-post, passord og at kontoen er verifisert.";
}

export function getProviderTokenPurpose(provider) {
  if (provider === microsoftLoginProviderId) {
    return "login";
  }

  if (provider === "microsoft") {
    return "mailbox_import";
  }

  if (provider === "google") {
    return isGoogleMailConnectEnabled() ? "login_and_mailbox_import" : "login";
  }

  return "login";
}

export function canUseProviderForOutlookImport(provider, scope = "") {
  return provider === "microsoft" && scope.split(/\s+/).includes("Mail.Read");
}
