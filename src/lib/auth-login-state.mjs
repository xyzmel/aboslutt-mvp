export const authAttemptCookieName = "aboslutt_auth_provider";
export const authAttemptMaxAgeSeconds = 5 * 60;

const supportedProviders = new Set(["google", "microsoft-login", "vipps"]);

export function normalizeAttemptedProvider(value) {
  return supportedProviders.has(value) ? value : null;
}

export function readAttemptedProvider(cookieString = "") {
  const prefix = `${authAttemptCookieName}=`;
  const entry = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!entry) {
    return null;
  }

  return normalizeAttemptedProvider(decodeURIComponent(entry.slice(prefix.length)));
}

export function createAttemptedProviderCookie(provider, { secure = false } = {}) {
  const normalized = normalizeAttemptedProvider(provider);
  if (!normalized) {
    return createClearedAttemptedProviderCookie({ secure });
  }

  return [
    `${authAttemptCookieName}=${encodeURIComponent(normalized)}`,
    "Path=/",
    `Max-Age=${authAttemptMaxAgeSeconds}`,
    "SameSite=Lax",
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export function createClearedAttemptedProviderCookie({ secure = false } = {}) {
  return [
    `${authAttemptCookieName}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export function getAuthErrorPresentation(errorCode, attemptedProvider) {
  const provider = normalizeAttemptedProvider(attemptedProvider);
  const providerName =
    provider === "microsoft-login" ? "Microsoft" : provider === "google" ? "Google" : provider === "vipps" ? "Vipps" : null;

  const genericMessages = {
    OAuthAccountNotLinked:
      "Denne e-postadressen er allerede knyttet til en annen innloggingsmetode. Logg inn på vanlig måte først.",
    AccessDenied: "Innloggingen ble avbrutt. Ingen tilgang ble gitt.",
    Configuration: "Innlogging er midlertidig utilgjengelig. Prøv igjen senere.",
    Verification: "Innloggingslenken er ugyldig eller utløpt. Be om en ny lenke.",
    CredentialsSignin: "E-post eller passord er ikke riktig.",
    EMAIL_NOT_VERIFIED: "E-posten din er ikke bekreftet ennå. Sjekk e-posten din før du logger inn.",
  };

  const providerFailureCodes = new Set(["OAuthCallback", "Callback", "OAuthCreateAccount"]);
  const message =
    genericMessages[errorCode] ??
    (providerName && providerFailureCodes.has(errorCode)
      ? `Vi klarte ikke å logge deg inn med ${providerName}. Prøv igjen.`
      : "Vi klarte ikke å logge deg inn. Prøv igjen.");

  return {
    provider,
    message,
    retryLabel: providerName ? `Prøv ${providerName} på nytt` : "Prøv igjen",
  };
}
