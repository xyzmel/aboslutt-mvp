import { normalizeProviderSearchValue, suggestSubscriptionCategory } from "./subscription-provider-catalog.mjs";

const recurringPattern =
  /\b(subscription|abonnement|membership|medlemskap|renewal|fornyelse|recurring|fast trekk|monthly|månedlig|yearly|årlig|next payment|neste trekk|trial|prøveperiode)\b/i;
const amountPattern = /\b(?:NOK|USD|EUR|GBP|SEK|DKK|kr)\s*\d|\b\d+(?:[,.]\d{2})?\s*(?:NOK|USD|EUR|GBP|SEK|DKK|kr)\b/i;
const intervalPattern = /\b(monthly|månedlig|per mnd|yearly|annual|årlig|per år)\b/i;
const intermediaries = new Set(["paypal.com", "stripe.com", "klarna.com", "google.com", "apple.com"]);
const retailers = new Set(["amazon.com", "amazon.co.uk", "elkjop.no", "komplett.no", "power.no"]);

export function matchSubscriptionProvider(input, providers) {
  const providerName = normalizeProviderSearchValue(input?.providerName);
  const senderName = normalizeProviderSearchValue(input?.senderName);
  const senderDomain = normalizeDomain(input?.senderDomain);
  const receiptText = String(input?.receiptText ?? "").slice(0, 20_000);
  const normalizedReceipt = normalizeProviderSearchValue(receiptText);
  const hasRecurringEvidence = Boolean(input?.hasRecurringEvidence ?? recurringPattern.test(receiptText));
  const hasAmount = Boolean(input?.hasAmount ?? amountPattern.test(receiptText));
  const hasInterval = Boolean(input?.hasInterval ?? intervalPattern.test(receiptText));

  const matches = [];
  for (const provider of providers.filter((item) => item.isActive !== false)) {
    const canonical = normalizeProviderSearchValue(provider.name);
    const aliases = (provider.aliases ?? []).map(normalizeProviderSearchValue).filter(Boolean);
    const senderNames = (provider.senderNames ?? []).map(normalizeProviderSearchValue).filter(Boolean);
    const domains = (provider.emailDomains ?? []).map(normalizeDomain).filter(Boolean);

    if (senderDomain && domains.includes(senderDomain) && !isGenericDomain(senderDomain)) {
      matches.push(result(provider, "sender_domain", "high", senderDomain, "Eksakt kjent avsenderdomene"));
      continue;
    }
    if (providerName && providerName === canonical && hasRecurringEvidence) {
      matches.push(result(provider, "canonical_name", "high", input.providerName, "Eksakt leverandørnavn med abonnementssignal"));
      continue;
    }
    const exactAlias = aliases.find((alias) => alias === providerName || alias === senderName);
    if (exactAlias && hasRecurringEvidence) {
      matches.push(result(provider, "alias", "high", exactAlias, "Kjent alias med gjentakende betaling"));
      continue;
    }
    const exactSenderName = senderNames.find((name) => name === senderName);
    if (exactSenderName && hasAmount && hasInterval) {
      matches.push(result(provider, "sender_name", "medium", input.senderName, "Kjent avsendernavn med beløp og intervall"));
      continue;
    }
    const receiptValue = [canonical, ...aliases].find(
      (value) => value.length >= 3 && containsWholeNormalizedValue(normalizedReceipt, value),
    );
    if (receiptValue && hasRecurringEvidence) {
      matches.push(result(provider, "receipt_text", "medium", receiptValue, "Leverandør nevnt sammen med abonnementssignal"));
    }
  }

  const unique = dedupeMatches(matches);
  if (unique.length !== 1) {
    return null;
  }
  return unique[0];
}

export function buildProviderCandidate(candidate, match) {
  if (!match) {
    return {
      ...candidate,
      providerId: null,
      canonicalProviderName: null,
      originalDetectedName: candidate.merchantName ?? candidate.providerName ?? null,
      providerMatchType: null,
      providerMatchConfidence: null,
      providerMatchedValue: null,
      providerLogoPath: null,
      suggestedCategory: candidate.category ?? null,
    };
  }
  return {
    ...candidate,
    providerId: match.providerId,
    canonicalProviderName: match.canonicalName,
    originalDetectedName: candidate.merchantName ?? candidate.providerName ?? null,
    merchantName: "merchantName" in candidate ? match.canonicalName : candidate.merchantName,
    providerName: "providerName" in candidate ? match.canonicalName : candidate.providerName,
    providerMatchType: match.matchType,
    providerMatchConfidence: match.confidence,
    providerMatchedValue: match.matchedValue,
    providerLogoPath: match.logoPath,
    suggestedCategory: match.suggestedCategory,
  };
}

export function getLikelyDuplicateWarning(candidate, subscriptions) {
  const active = subscriptions.filter((subscription) => ["active", "trial", "yearly"].includes(subscription.status));
  const providerMatches = candidate.providerId
    ? active.filter((subscription) => subscription.providerId === candidate.providerId)
    : [];
  const name = normalizeProviderSearchValue(candidate.canonicalProviderName ?? candidate.merchantName ?? candidate.providerName);
  const nameMatches = active.filter((subscription) => normalizeProviderSearchValue(subscription.name) === name);
  const candidates = providerMatches.length > 0 ? providerMatches : nameMatches;
  const sameInterval = candidates.filter(
    (subscription) => subscription.billingInterval === candidate.billingInterval,
  );

  if (sameInterval.length > 0) {
    return {
      likelyDuplicate: true,
      duplicateCount: sameInterval.length,
      duplicateMessage: `Du har allerede ${sameInterval.length} aktivt abonnement med samme leverandør og intervall. Kontroller før du importerer.`,
    };
  }
  if (candidates.length > 0) {
    return {
      likelyDuplicate: false,
      duplicateCount: candidates.length,
      duplicateMessage: "Du har et annet aktivt abonnement fra samme leverandør med et annet intervall.",
    };
  }
  return { likelyDuplicate: false, duplicateCount: 0, duplicateMessage: null };
}

export function sanitizeUnmatchedProviderName(value) {
  const rawValue = String(value ?? "");
  if (/@|https?:|www\./i.test(rawValue)) return null;
  const displayName = rawValue
    .replace(/[^a-zA-Z0-9æøåÆØÅ+&.' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const normalizedName = normalizeProviderSearchValue(displayName);
  if (displayName.length < 2 || normalizedName.length < 2) return null;
  return { displayName, normalizedName };
}

function result(provider, matchType, confidence, matchedValue, explanation) {
  return {
    providerId: provider.id,
    canonicalName: provider.name,
    matchType,
    confidence,
    matchedValue: String(matchedValue ?? "").slice(0, 120),
    explanation,
    suggestedCategory: suggestSubscriptionCategory(provider.category),
    logoPath: provider.logoPath ?? null,
  };
}

function normalizeDomain(value) {
  return String(value ?? "").trim().toLowerCase().replace(/^@/, "");
}

function isGenericDomain(domain) {
  return intermediaries.has(domain) || retailers.has(domain);
}

function containsWholeNormalizedValue(text, value) {
  return (` ${text} `).includes(` ${value} `);
}

function dedupeMatches(matches) {
  return [...new Map(matches.map((match) => [match.providerId, match])).values()];
}
