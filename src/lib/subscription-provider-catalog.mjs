import { validateCancellationGuideInput, validateSafeExternalUrl } from "./provider-cancellation-guide.mjs";

const categorySuggestions = {
  streaming: "streaming",
  music_audio: "streaming",
  gaming: "software",
  software_cloud: "software",
  security: "software",
  news: "news",
  fitness: "health",
  telecom: "software",
  other: "software",
};

export function normalizeProviderSearchValue(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

export function searchSubscriptionProviders(providers, query, limit = 8) {
  const normalizedQuery = normalizeProviderSearchValue(query);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 20));
  if (!normalizedQuery) {
    return providers.filter((provider) => provider.isActive !== false).slice(0, safeLimit);
  }

  return providers
    .filter((provider) => provider.isActive !== false)
    .map((provider) => ({ provider, score: getSearchScore(provider, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.provider.name.localeCompare(b.provider.name, "nb"))
    .slice(0, safeLimit)
    .map((entry) => entry.provider);
}

export function suggestSubscriptionCategory(providerCategory) {
  return categorySuggestions[providerCategory] ?? "software";
}

export function getProviderInitials(name) {
  return String(name ?? "")
    .replace(/[+]/g, " plus ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

export function applyProviderSelectionToDraft(draft, provider, dirtyFields = {}) {
  if (!provider) {
    return { ...draft, providerId: null };
  }

  return {
    ...draft,
    providerId: provider.id,
    name: provider.name,
    category: dirtyFields.category
      ? draft.category
      : provider.suggestedCategory ?? suggestSubscriptionCategory(provider.category),
    billingInterval: dirtyFields.billingInterval
      ? draft.billingInterval
      : provider.defaultBillingInterval ?? draft.billingInterval,
  };
}

export function matchExistingSubscriptionProvider(subscriptionName, providers) {
  const normalizedName = normalizeProviderSearchValue(subscriptionName);
  if (!normalizedName) {
    return { status: "unmatched", provider: null, candidates: [] };
  }

  const matches = providers.filter((provider) =>
    [provider.name, ...(provider.aliases ?? [])]
      .map(normalizeProviderSearchValue)
      .includes(normalizedName),
  );

  if (matches.length === 1) {
    return { status: "linked", provider: matches[0], candidates: matches };
  }

  if (matches.length > 1) {
    return { status: "ambiguous", provider: null, candidates: matches };
  }

  return { status: "unmatched", provider: null, candidates: [] };
}

export function validateProviderAdminInput(input) {
  const name = cleanString(input?.name, 100);
  const slug = cleanString(input?.slug, 100).toLowerCase();
  const category = cleanString(input?.category, 40);
  const defaultBillingInterval = cleanString(input?.defaultBillingInterval, 20) || null;
  const errors = [];

  if (name.length < 2) errors.push("Navn må ha minst to tegn.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push("Slug må bruke små bokstaver, tall og bindestrek.");
  if (!category) errors.push("Kategori må fylles ut.");
  if (defaultBillingInterval && !["monthly", "yearly", "unknown"].includes(defaultBillingInterval)) {
    errors.push("Ugyldig standardintervall.");
  }
  const guideValidation = validateCancellationGuideInput(input);
  errors.push(...guideValidation.errors);
  for (const [label, value] of [
    ["Nettside", input?.websiteUrl],
    ["Kontoside", input?.accountManagementUrl],
    ["Oppsigelseslenke", input?.cancellationUrl],
  ]) {
    if (cleanString(value, 500) && !validateSafeExternalUrl(value)) {
      errors.push(`${label} må være en gyldig http- eller https-lenke.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      name,
      slug,
      category,
      aliases: cleanList(input?.aliases),
      senderNames: cleanList(input?.senderNames),
      emailDomains: cleanList(input?.emailDomains).map((value) => value.toLowerCase()),
      logoPath: validateLocalLogoPath(input?.logoPath),
      websiteUrl: validateSafeExternalUrl(input?.websiteUrl),
      accountManagementUrl: validateSafeExternalUrl(input?.accountManagementUrl),
      cancellationUrl: validateSafeExternalUrl(input?.cancellationUrl),
      defaultBillingInterval,
      supportedCountries: cleanList(input?.supportedCountries).map((value) => value.toUpperCase()).filter((value) => /^[A-Z]{2}$/.test(value)),
      isActive: input?.isActive !== false,
      lastVerifiedAt: parseDate(input?.lastVerifiedAt),
      ...guideValidation.value,
    },
  };
}

function getSearchScore(provider, query) {
  const fields = [
    { values: [provider.name], weight: 100 },
    { values: provider.aliases ?? [], weight: 80 },
    { values: provider.emailDomains ?? [], weight: 65 },
    { values: provider.senderNames ?? [], weight: 55 },
  ];

  let score = 0;
  for (const field of fields) {
    for (const value of field.values) {
      const normalizedValue = normalizeProviderSearchValue(value);
      if (normalizedValue === query) score = Math.max(score, field.weight + 30);
      else if (normalizedValue.startsWith(query)) score = Math.max(score, field.weight + 15);
      else if (normalizedValue.includes(query)) score = Math.max(score, field.weight);
    }
  }
  return score;
}

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanList(value) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(list.map((item) => cleanString(item, 120)).filter(Boolean))].slice(0, 50);
}

function validateLocalLogoPath(value) {
  const path = cleanString(value, 200);
  return /^\/providers\/[a-zA-Z0-9._/-]+$/.test(path) ? path : null;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
