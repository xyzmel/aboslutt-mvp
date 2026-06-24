import { createHash } from "node:crypto";

const knownProviders = [
  ["netflix", "Netflix"],
  ["spotify", "Spotify"],
  ["adobe", "Adobe"],
  ["microsoft 365", "Microsoft 365"],
  ["youtube premium", "YouTube Premium"],
  ["google one", "Google One"],
  ["disney", "Disney+"],
  ["viaplay", "Viaplay"],
  ["tv 2 play", "TV 2 Play"],
  ["storytel", "Storytel"],
  ["duolingo", "Duolingo Plus"],
  ["icloud", "iCloud+"],
  ["apple music", "Apple Music"],
  ["sats", "SATS"],
  ["strava", "Strava"],
  ["notion", "Notion"],
  ["dropbox", "Dropbox"],
  ["github", "GitHub"],
];

const broadRetailDomains = [
  "amazon.com",
  "amazon.co.uk",
  "elkjop.no",
  "komplett.no",
  "power.no",
  "klarna.com",
  "paypal.com",
  "stripe.com",
];

const positiveSignals = [
  [/\b(subscription|abonnement)\b/i, 3, "Abonnement nevnt"],
  [/\b(membership|medlemskap)\b/i, 3, "Medlemskap nevnt"],
  [/\b(renewal|renews|renewed|fornyelse|fornyes)\b/i, 3, "Fornyelse nevnt"],
  [/\b(recurring|auto-?renewal|automatic renewal|fast trekk|gjentakende)\b/i, 3, "Gjentakende betaling nevnt"],
  [/\b(monthly|per month|\/month|månedlig|maanedlig|per mnd|\/mnd)\b/i, 2, "Månedlig periode nevnt"],
  [/\b(annual|annually|yearly|per year|årlig|aarlig|per år)\b/i, 2, "Årlig periode nevnt"],
  [/\b(invoice|receipt|kvittering|faktura)\b/i, 1, "Kvittering eller faktura nevnt"],
  [/\b(next payment|next billing|neste trekk|neste betaling)\b/i, 3, "Neste betaling nevnt"],
  [/\b(trial ending|trial ends|prøveperiode|proveperiode)\b/i, 2, "Prøveperiode nevnt"],
];

const negativeSignals = [
  [/\b(order shipped|delivered|delivery|shipping|frakt|levering)\b/i, 4, "Levering eller frakt nevnt"],
  [/\b(one-time purchase|engangskjøp|engangskjop|single purchase)\b/i, 5, "Engangskjøp nevnt"],
  [/\b(refund|refunded|refusjon|tilbakebetalt)\b/i, 4, "Refusjon nevnt"],
  [/\b(password|verification code|security alert|bekreftelseskode|sikkerhetsvarsel)\b/i, 5, "Sikkerhetsvarsel nevnt"],
  [/\b(cancelled|canceled|kansellert|avsluttet|oppsagt)\b/i, 2, "Avslutning nevnt"],
];

/**
 * @typedef {Object} OutlookMessage
 * @property {string} id
 * @property {string | null | undefined} subject
 * @property {{ emailAddress?: { address?: string | null, name?: string | null } } | null | undefined} [from]
 * @property {string | null | undefined} receivedDateTime
 * @property {string | null | undefined} bodyPreview
 * @property {boolean | null | undefined} hasAttachments
 */

/**
 * @typedef {"monthly" | "yearly" | "unknown"} OutlookBillingInterval
 * @typedef {"high" | "medium" | "low"} OutlookConfidence
 *
 * @typedef {Object} OutlookSubscriptionCandidate
 * @property {string} id
 * @property {string} providerName
 * @property {string | null} senderDomain
 * @property {string} subject
 * @property {string | null} receivedDate
 * @property {number | null} amount
 * @property {string | null} currency
 * @property {OutlookBillingInterval} billingInterval
 * @property {OutlookConfidence} confidence
 * @property {string[]} reasons
 * @property {boolean} grouped
 * @property {number} relatedMessageCount
 * @property {boolean} hasAttachments
 */

/**
 * @param {OutlookMessage[]} messages
 * @param {Record<string, { canonicalName: string }>} [providerHints]
 * @returns {OutlookSubscriptionCandidate[]}
 */
export function detectOutlookSubscriptionCandidates(messages, providerHints = {}) {
  const detected = messages
    .map((message) => detectMessage(message, providerHints[message.id]))
    .filter((candidate) => candidate !== null);

  return groupCandidates(detected);
}

/**
 * @param {OutlookMessage} message
 * @param {{ canonicalName: string } | undefined} [providerHint]
 * @returns {OutlookSubscriptionCandidate | null}
 */
export function detectMessage(message, providerHint) {
  const subject = sanitizeText(message.subject ?? "");
  const preview = sanitizeText(message.bodyPreview ?? "");
  const fromAddress = sanitizeText(message.from?.emailAddress?.address ?? "");
  const fromName = sanitizeText(message.from?.emailAddress?.name ?? "");
  const senderDomain = extractDomain(fromAddress);
  const combinedText = `${subject} ${fromName} ${fromAddress} ${preview}`;
  const normalized = normalizeText(combinedText);

  if (!normalized) {
    return null;
  }

  const provider = providerHint
    ? { name: providerHint.canonicalName, known: true }
    : detectProvider(normalized, fromName, senderDomain);
  const amount = extractAmountAndCurrency(combinedText);
  const billingInterval = detectBillingInterval(combinedText);
  const signalResult = scoreSignals(normalized);
  const repeatedHints = countPositiveSignalFamilies(normalized);
  let score = signalResult.score;
  const reasons = [...signalResult.reasons];

  if (provider) {
    score += provider.known ? 3 : 1;
    reasons.push(provider.known ? `Kjent leverandør: ${provider.name}` : "Leverandør utledet fra avsender");
  }

  if (amount.amount !== null) {
    score += 2;
    reasons.push("Beløp funnet");
  }

  if (billingInterval !== "unknown") {
    score += 2;
    reasons.push(billingInterval === "monthly" ? "Månedlig intervall funnet" : "Årlig intervall funnet");
  }

  if (message.hasAttachments && /\b(invoice|receipt|kvittering|faktura)\b/i.test(normalized)) {
    score += 1;
    reasons.push("Kvittering/faktura med vedlegg");
  }

  // Avoid weak single-keyword classifications.
  if (score < 6 || repeatedHints < 2 || !provider || amount.amount === null) {
    return null;
  }

  const confidence = score >= 11 ? "high" : score >= 8 ? "medium" : "low";
  const providerName = provider.name;

  return {
    id: createCandidateId([providerName, senderDomain ?? "unknown", String(amount.amount ?? ""), billingInterval]),
    providerName,
    senderDomain,
    subject,
    receivedDate: sanitizeDate(message.receivedDateTime),
    amount: amount.amount,
    currency: amount.currency,
    billingInterval,
    confidence,
    reasons: unique(reasons).slice(0, 4),
    grouped: false,
    relatedMessageCount: 1,
    hasAttachments: Boolean(message.hasAttachments),
  };
}

/**
 * @param {string} text
 */
export function extractAmountAndCurrency(text) {
  const normalized = normalizeText(text);
  const patterns = [
    /\b(NOK|USD|EUR|GBP|SEK|DKK|kr)\s*(\d{1,5})(?:[,.](\d{2}))?\b/gi,
    /\b(\d{1,5})(?:[,.](\d{2}))?\s*(NOK|USD|EUR|GBP|SEK|DKK|kr)\b/gi,
    /\b(?:kr)\s*(\d{1,5})(?:[,.](\d{2}))?\b/gi,
  ];
  /** @type {{ amount: number, currency: string, score: number }[]} */
  const matches = [];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const raw = match[0];
      const startsWithCurrency = /^(NOK|USD|EUR|GBP|SEK|DKK|kr)/i.test(raw.trim());
      const amountText = startsWithCurrency ? match[2] : match[1];
      const decimals = startsWithCurrency ? match[3] : match[2];
      const currencyText = startsWithCurrency ? match[1] : match[3] ?? "NOK";
      const whole = Number(amountText);

      if (!Number.isFinite(whole) || whole <= 0) {
        continue;
      }

      const amount = Number(`${whole}.${decimals ?? "00"}`);
      const window = getWindow(normalized, match.index ?? 0, (match.index ?? 0) + raw.length, 80);
      let score = 1;

      if (/\b(total|amount|paid|payment|invoice|receipt|beløp|betalt|faktura|kvittering)\b/i.test(window)) {
        score += 3;
      }

      if (/\b(monthly|annual|yearly|subscription|abonnement|fornyes|renewal)\b/i.test(window)) {
        score += 3;
      }

      if (/\b(order|ordre|customer|kunde|invoice no|fakturanr|id)\b/i.test(window)) {
        score -= 3;
      }

      matches.push({ amount, currency: normalizeCurrency(currencyText), score });
    }
  }

  const best = matches.sort((a, b) => b.score - a.score)[0];

  return {
    amount: best?.amount ?? null,
    currency: best?.currency ?? null,
  };
}

/**
 * @param {string} text
 * @returns {OutlookBillingInterval}
 */
export function detectBillingInterval(text) {
  if (/\b(annual|annually|yearly|per year|\/year|årlig|aarlig|per år|\/år)\b/i.test(text)) {
    return "yearly";
  }

  if (/\b(monthly|per month|\/month|månedlig|maanedlig|per mnd|\/mnd)\b/i.test(text)) {
    return "monthly";
  }

  return "unknown";
}

/**
 * @param {OutlookSubscriptionCandidate[]} candidates
 * @returns {OutlookSubscriptionCandidate[]}
 */
export function groupCandidates(candidates) {
  /** @type {Map<string, OutlookSubscriptionCandidate[]>} */
  const groups = new Map();

  for (const candidate of candidates) {
    const key = getGroupingKey(candidate);
    const current = groups.get(key) ?? [];
    current.push(candidate);
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((group) => mergeCandidateGroup(group))
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence));
}

/**
 * @param {string} text
 */
export function sanitizeText(text) {
  return String(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function scoreSignals(text) {
  let score = 0;
  const reasons = [];

  for (const [pattern, points, reason] of positiveSignals) {
    if (pattern.test(text)) {
      score += Number(points);
      reasons.push(String(reason));
    }
  }

  for (const [pattern, points] of negativeSignals) {
    if (pattern.test(text)) {
      score -= Number(points);
    }
  }

  return { score, reasons };
}

function countPositiveSignalFamilies(text) {
  return positiveSignals.filter(([pattern]) => pattern.test(text)).length;
}

function detectProvider(text, fromName, senderDomain) {
  for (const [needle, name] of knownProviders) {
    if (text.includes(needle)) {
      return { name, known: true };
    }
  }

  if (senderDomain && !isBroadRetailDomain(senderDomain)) {
    const base = senderDomain.split(".").slice(-2, -1)[0] ?? senderDomain.split(".")[0] ?? "";
    const readable = titleCase(base.replace(/[-_]+/g, " "));

    if (readable && !/mail|email|send|notification|newsletter/i.test(readable)) {
      return { name: normalizeProviderName(fromName || readable), known: false };
    }
  }

  return null;
}

function mergeCandidateGroup(group) {
  const sorted = [...group].sort((a, b) => {
    const dateDiff = new Date(b.receivedDate ?? 0).getTime() - new Date(a.receivedDate ?? 0).getTime();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return confidenceRank(b.confidence) - confidenceRank(a.confidence);
  });
  const newest = sorted[0];
  const bestPrice = sorted.find((candidate) => candidate.amount !== null && candidate.billingInterval !== "unknown") ?? newest;
  const bestConfidence = sorted.sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))[0] ?? newest;

  return {
    ...newest,
    id: createCandidateId([newest.providerName, newest.senderDomain ?? "unknown", "grouped"]),
    amount: bestPrice.amount,
    currency: bestPrice.currency,
    billingInterval: bestPrice.billingInterval,
    confidence: bestConfidence.confidence,
    reasons: unique([...bestConfidence.reasons, group.length > 1 ? "Flere relaterte meldinger funnet" : ""]).filter(Boolean),
    grouped: group.length > 1,
    relatedMessageCount: group.length,
  };
}

function getGroupingKey(candidate) {
  if (candidate.senderDomain && isBroadRetailDomain(candidate.senderDomain)) {
    return `${candidate.senderDomain}:${normalizeKey(candidate.providerName)}:${candidate.amount ?? "missing"}`;
  }

  return `${normalizeKey(candidate.providerName)}:${candidate.senderDomain ?? "unknown"}`;
}

function extractDomain(address) {
  const match = address.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function normalizeText(text) {
  return sanitizeText(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 2000);
}

function normalizeCurrency(value) {
  const normalized = String(value).toUpperCase();
  return normalized === "KR" ? "NOK" : normalized;
}

function normalizeProviderName(value) {
  const withoutEmail = String(value).replace(/<[^>]+>/g, " ").replace(/\b(no-?reply|support|billing|receipt|invoice)\b/gi, " ");
  return titleCase(withoutEmail.replace(/[^a-zA-Z0-9æøåÆØÅ+ ]/g, " ").trim()).slice(0, 80) || "Ukjent leverandør";
}

function titleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9æøå]+/gi, "");
}

function createCandidateId(parts) {
  return `outlook_${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24)}`;
}

function confidenceRank(confidence) {
  if (confidence === "high") {
    return 3;
  }

  if (confidence === "medium") {
    return 2;
  }

  return 1;
}

function isBroadRetailDomain(domain) {
  return broadRetailDomains.some((retailer) => domain === retailer || domain.endsWith(`.${retailer}`));
}

function getWindow(text, start, end, padding) {
  return text.slice(Math.max(0, start - padding), Math.min(text.length, end + padding));
}

function sanitizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
