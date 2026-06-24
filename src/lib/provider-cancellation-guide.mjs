export const cancellationGuideMethods = [
  "website",
  "email",
  "phone",
  "app",
  "manual",
  "unknown",
];

export function validateCancellationGuideInput(input) {
  const method = cleanString(input?.cancellationMethod, 20) || null;
  const instructions = cleanList(input?.cancellationInstructions, 12, 400);
  const requiredInformation = cleanList(input?.requiredInformation, 12, 160);
  const confirmationExpected = cleanString(input?.confirmationExpected, 300) || null;
  const countryCode = cleanString(input?.countryCode, 2).toUpperCase() || null;
  const verificationSource = cleanString(input?.verificationSource, 500) || null;
  const isActive = input?.isCancellationGuideActive === true;
  const supportsAbosluttSending = input?.supportsAbosluttSending === true;
  const verifiedCancellationEmail = cleanString(input?.verifiedCancellationEmail, 254).toLowerCase() || null;
  const sendingVerifiedAt = parseDate(input?.sendingVerifiedAt);
  const requiresProviderLogin = input?.requiresProviderLogin === true;
  const requiresCustomerReference = input?.requiresCustomerReference === true;
  const errors = [];

  if (method && !cancellationGuideMethods.includes(method)) {
    errors.push("Ugyldig oppsigelsesmetode.");
  }
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    errors.push("Landkode må bestå av to bokstaver.");
  }
  if (isActive && (!method || method === "unknown" || instructions.length === 0)) {
    errors.push("En aktiv veiledning må ha metode og minst ett konkret trinn.");
  }
  if (verifiedCancellationEmail && !isEmail(verifiedCancellationEmail)) {
    errors.push("Verifisert oppsigelsesadresse må være en gyldig e-postadresse.");
  }
  if (supportsAbosluttSending && (!verifiedCancellationEmail || !sendingVerifiedAt)) {
    errors.push("Sending via Aboslutt krever verifisert mottakeradresse og verifikasjonsdato.");
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      cancellationMethod: method,
      cancellationInstructions: instructions,
      requiredInformation,
      confirmationExpected,
      countryCode,
      verificationSource,
      isCancellationGuideActive: isActive,
      supportsAbosluttSending,
      verifiedCancellationEmail,
      sendingVerifiedAt,
      requiresProviderLogin,
      requiresCustomerReference,
    },
  };
}

export function toPublicCancellationGuide(provider) {
  if (!hasActiveCancellationGuide(provider)) {
    return null;
  }

  const sendingCapability = getCancellationSendingCapability(provider);
  return {
    providerId: provider.id,
    providerName: provider.name,
    logoPath: provider.logoPath ?? null,
    method: provider.cancellationMethod,
    instructions: [...(provider.cancellationInstructions ?? [])],
    requiredInformation: [...(provider.requiredInformation ?? [])],
    confirmationExpected: provider.confirmationExpected ?? null,
    officialUrl: getSafeProviderGuideUrl(provider),
    lastVerifiedAt: provider.lastVerifiedAt ?? null,
    supportsAbosluttSending: sendingCapability.allowed,
    sendingVerifiedAt: provider.sendingVerifiedAt ?? null,
    requiresProviderLogin: provider.requiresProviderLogin === true,
    requiresCustomerReference: provider.requiresCustomerReference === true,
  };
}

export function hasActiveCancellationGuide(provider) {
  return Boolean(
    provider?.isActive !== false &&
      provider?.isCancellationGuideActive === true &&
      cancellationGuideMethods.includes(provider?.cancellationMethod) &&
      provider?.cancellationMethod !== "unknown" &&
      Array.isArray(provider?.cancellationInstructions) &&
      provider.cancellationInstructions.length > 0,
  );
}

export function getSafeProviderGuideUrl(provider) {
  return validateSafeExternalUrl(provider?.cancellationUrl) ??
    validateSafeExternalUrl(provider?.accountManagementUrl);
}

export function validateSafeExternalUrl(value) {
  const raw = cleanString(value, 500);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function getCancellationGuideMethodLabel(method) {
  return {
    website: "Nettside",
    email: "E-post",
    phone: "Telefon",
    app: "App",
    manual: "Manuell kontakt",
    unknown: "Ukjent",
  }[method] ?? "Manuell kontakt";
}

export function getCancellationGuideCoverage(providers, now = new Date()) {
  const staleBefore = new Date(now);
  staleBefore.setMonth(staleBefore.getMonth() - 6);

  const withCompleteGuides = [];
  const missingGuides = [];
  const missingLogos = [];
  const staleGuides = [];

  for (const provider of providers) {
    if (provider.isActive === false) continue;
    if (hasActiveCancellationGuide(provider)) withCompleteGuides.push(provider);
    else missingGuides.push(provider);
    if (!provider.logoPath) missingLogos.push(provider);
    if (
      hasActiveCancellationGuide(provider) &&
      (!provider.lastVerifiedAt || new Date(provider.lastVerifiedAt) < staleBefore)
    ) {
      staleGuides.push(provider);
    }
  }

  return { withCompleteGuides, missingGuides, missingLogos, staleGuides };
}

function cleanString(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function cleanList(value, limit, maxLength) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  return [...new Set(list.map((item) => cleanString(item, maxLength)).filter(Boolean))].slice(0, limit);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
import { getCancellationSendingCapability } from "./cancellation-sending.mjs";
