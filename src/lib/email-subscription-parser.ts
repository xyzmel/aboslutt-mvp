import type { SubscriptionCategory } from "@/types/subscription";

export type BillingInterval = "monthly" | "yearly" | "trial" | "unknown";

export type EmailSubscriptionCandidate = {
  providerId?: string | null;
  canonicalProviderName?: string | null;
  originalDetectedName?: string | null;
  providerMatchType?: string | null;
  providerMatchConfidence?: "high" | "medium" | null;
  providerMatchedValue?: string | null;
  providerLogoPath?: string | null;
  suggestedCategory?: SubscriptionCategory | null;
  likelyDuplicate?: boolean;
  duplicateCount?: number;
  duplicateMessage?: string | null;
  merchantName: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  category: SubscriptionCategory;
  confidence: number;
  confidenceLabel: "høy" | "middels" | "lav";
  reasons: string[];
  warnings: string[];
  source: "gmail_import";
  nextPayment: string;
};

type MerchantMatch = {
  merchantName: string;
  category: SubscriptionCategory;
  reasons: string[];
  warnings: string[];
};

type AmountMatch = {
  amount: number;
  currency: string;
  score: number;
  reasons: string[];
  warnings: string[];
};

const merchantPatterns: {
  pattern: RegExp;
  merchantName: string;
  category: SubscriptionCategory;
}[] = [
  { pattern: /\b(?:hbo\s*max|max)\b/i, merchantName: "HBO Max", category: "streaming" },
  { pattern: /\bnetflix\b/i, merchantName: "Netflix", category: "streaming" },
  { pattern: /\bspotify\b/i, merchantName: "Spotify", category: "streaming" },
  { pattern: /\badobe\b/i, merchantName: "Adobe", category: "software" },
  { pattern: /\b(?:icloud|apple)\b/i, merchantName: "iCloud+", category: "software" },
  { pattern: /\byoutube\b/i, merchantName: "YouTube Premium", category: "streaming" },
  { pattern: /\bmicrosoft\s*365\b/i, merchantName: "Microsoft 365", category: "software" },
  { pattern: /\bmicrosoft\b/i, merchantName: "Microsoft", category: "software" },
  { pattern: /\bdisney\+?\b/i, merchantName: "Disney+", category: "streaming" },
  { pattern: /\bviaplay\b/i, merchantName: "Viaplay", category: "streaming" },
  { pattern: /\btv\s*2\s*play\b/i, merchantName: "TV 2 Play", category: "streaming" },
  { pattern: /\bsats\b/i, merchantName: "SATS", category: "health" },
  { pattern: /\bstorytel\b/i, merchantName: "Storytel", category: "streaming" },
  { pattern: /\bduolingo\b/i, merchantName: "Duolingo Plus", category: "software" },
];

const googleProductPatterns: {
  pattern: RegExp;
  merchantName: string;
  category: SubscriptionCategory;
}[] = [
  { pattern: /\byoutube\s+premium\b/i, merchantName: "YouTube Premium", category: "streaming" },
  { pattern: /\bgoogle\s+one\b/i, merchantName: "Google One", category: "software" },
  { pattern: /\bduolingo\b/i, merchantName: "Duolingo Plus", category: "software" },
  { pattern: /\bhbo\s*max\b/i, merchantName: "HBO Max", category: "streaming" },
  { pattern: /\bdisney\+?\b/i, merchantName: "Disney+", category: "streaming" },
];

const positiveSignals = [
  { pattern: /\b(subscription|abonnement|medlemskap|membership)\b/i, points: 0.18, reason: "Abonnement nevnt" },
  {
    pattern: /\b(recurring|renewal|renews|fornyes|renewed|gjentas|fast betaling)\b/i,
    points: 0.18,
    reason: "Fornyelse eller gjentakende betaling nevnt",
  },
  {
    pattern: /\b(monthly|månedlig|maanedlig|per måned|per mnd|\/mnd|\/month)\b/i,
    points: 0.16,
    reason: "Månedlig betaling nevnt",
  },
  { pattern: /\b(trial|prøveperiode|proveperiode|free trial)\b/i, points: 0.12, reason: "Prøveperiode nevnt" },
  {
    pattern: /\b(receipt|kvittering|invoice|faktura|payment|betaling|paid|beløp|belop)\b/i,
    points: 0.1,
    reason: "Kvittering eller betaling nevnt",
  },
  {
    pattern: /\b(next billing|next payment|neste trekk|neste betaling|fornyes)\b/i,
    points: 0.14,
    reason: "Neste betaling funnet",
  },
];

const negativeSignals = [
  { pattern: /\b(refund|refusjon|refunded|tilbakebetalt)\b/i, points: 0.45, warning: "Refusjon nevnt" },
  { pattern: /\b(cancelled|canceled|kansellert|avsluttet|oppsagt)\b/i, points: 0.35, warning: "Kansellering eller avslutning nevnt" },
  { pattern: /\b(free|gratis|0 kr|nok 0)\b/i, points: 0.25, warning: "Gratis eller nullbeløp nevnt" },
  { pattern: /\b(order|ordre|bestilling)\b/i, points: 0.18, warning: "Ordretekst uten tydelig abonnement kan være kjøp" },
  { pattern: /\b(shipping|delivery|frakt|levering|delivered)\b/i, points: 0.3, warning: "Frakt eller levering nevnt" },
  { pattern: /\b(password reset|tilbakestill passord|nullstill passord)\b/i, points: 0.55, warning: "Passordvarsel" },
  { pattern: /\b(security alert|sikkerhetsvarsel|login alert|new sign-in|ny pålogging)\b/i, points: 0.55, warning: "Sikkerhets- eller innloggingsvarsel" },
  { pattern: /\b(verification code|bekreftelseskode|verifiseringskode)\b/i, points: 0.55, warning: "Verifiseringskode" },
  { pattern: /\b(one-time purchase|engangskjøp|engangskjop|in-app purchase)\b/i, points: 0.4, warning: "Engangskjøp nevnt" },
];

export function parseEmailSubscriptionCandidates(
  text: unknown,
  providerHint?: { name: string; category: SubscriptionCategory } | null,
): EmailSubscriptionCandidate[] {
  try {
    if (typeof text !== "string") {
      return [];
    }

    const normalizedText = normalizeEmailText(text);

    if (!normalizedText) {
      return [];
    }

    const merchant = findMerchant(normalizedText, providerHint);
    const billingInterval = findBillingInterval(normalizedText);
    const amount = findBestAmount(normalizedText, billingInterval);

    if (!merchant || !amount) {
      return [];
    }

    const reasons = [...merchant.reasons, ...amount.reasons];
    const warnings = [...merchant.warnings, ...amount.warnings];
    let score = 0.22;
    reasons.push("Kjent eller utledet abonnementsleverandør");

    for (const signal of positiveSignals) {
      if (signal.pattern.test(normalizedText)) {
        score += signal.points;
        reasons.push(signal.reason);
      }
    }

    score += 0.12;
    const nextPayment = findNextPayment(normalizedText);

    if (nextPayment !== "Ukjent") {
      score += 0.08;
      reasons.push("Dato for betaling eller fornyelse funnet");
    }

    if (countMerchantMentions(normalizedText, merchant.merchantName) > 1) {
      score += 0.06;
      reasons.push("Leverandøren nevnes flere ganger");
    }

    for (const signal of negativeSignals) {
      if (signal.pattern.test(normalizedText)) {
        score -= signal.points;
        warnings.push(signal.warning);
      }
    }

    if (hasReceiptOnlyWithoutRecurringSignal(normalizedText)) {
      score -= 0.28;
      warnings.push("Kvittering uten tydelig gjentakende abonnementsignal");
    }

    const confidence = clamp(Number(score.toFixed(2)), 0, 1);

    return [
      {
        merchantName: merchant.merchantName,
        amount: amount.amount,
        currency: amount.currency,
        billingInterval,
        category: merchant.category,
        confidence,
        confidenceLabel: getConfidenceLabel(confidence),
        reasons: unique(reasons),
        warnings: unique(warnings),
        source: "gmail_import",
        nextPayment,
      },
    ];
  } catch {
    return [];
  }
}

export function dedupeSubscriptionCandidates(
  candidates: EmailSubscriptionCandidate[],
): EmailSubscriptionCandidate[] {
  const byMerchantName = new Map<string, EmailSubscriptionCandidate>();

  for (const candidate of candidates) {
    const key = normalizeMerchantKey(candidate.merchantName);
    const current = byMerchantName.get(key);

    if (!current || candidate.confidence > current.confidence) {
      byMerchantName.set(key, candidate);
    }
  }

  return Array.from(byMerchantName.values()).sort((a, b) => b.confidence - a.confidence);
}

export function normalizeMerchantKey(name: string) {
  return normalizeMerchantName(name)
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, "");
}

export function normalizeMerchantName(name: string) {
  const lowerName = name.toLowerCase();

  if (/\b(?:hbo\s*max|max)\b/i.test(lowerName)) {
    return "HBO Max";
  }

  const merchant = merchantPatterns.find(({ pattern }) => pattern.test(name));

  return merchant?.merchantName ?? titleCase(name.trim());
}

function findMerchant(
  text: string,
  providerHint?: { name: string; category: SubscriptionCategory } | null,
): MerchantMatch | null {
  if (providerHint) {
    return {
      merchantName: providerHint.name,
      category: providerHint.category,
      reasons: [`Leverandør matchet mot katalogen: ${providerHint.name}`],
      warnings: [],
    };
  }
  const googleProduct = findGoogleProduct(text);

  if (googleProduct) {
    return googleProduct;
  }

  const directMatch = merchantPatterns.find(({ pattern }) => pattern.test(text));

  if (directMatch) {
    return {
      merchantName: directMatch.merchantName,
      category: directMatch.category,
      reasons: [`Normalisert leverandør: ${directMatch.merchantName}`],
      warnings: [],
    };
  }

  const merchantMatch = text.match(/(?:fra|from|merchant|selger|butikk):?\s*([A-ZÆØÅ][\wÆØÅæøå+&.\- ]{1,40})/i);
  const rawName = merchantMatch?.[1]?.trim();

  if (!rawName || isGenericGoogleMerchant(rawName)) {
    return null;
  }

  return {
    merchantName: normalizeMerchantName(rawName),
    category: inferCategory(text),
    reasons: ["Leverandørnavn funnet i e-posttekst"],
    warnings: [],
  };
}

function findGoogleProduct(text: string): MerchantMatch | null {
  if (!/(google commerce limited|google play)/i.test(text)) {
    return null;
  }

  const product = googleProductPatterns.find(({ pattern }) => pattern.test(text));

  if (product) {
    return {
      merchantName: product.merchantName,
      category: product.category,
      reasons: [`Google-kvittering knyttet til ${product.merchantName}`],
      warnings: [],
    };
  }

  const productMatch = text.match(/(?:item|produkt|subscription|abonnement|app):?\s*([A-ZÆØÅ][\wÆØÅæøå+&.\- ]{2,50})/i);

  if (productMatch?.[1]) {
    const productName = normalizeMerchantName(productMatch[1]);
    return {
      merchantName: productName,
      category: inferCategory(text),
      reasons: ["Produktnavn hentet fra Google Play-kvittering"],
      warnings: ["Google Play-avsender ble erstattet med produktnavn"],
    };
  }

  return {
    merchantName: "Google Play",
    category: "software",
    reasons: ["Google Play-kvittering funnet"],
    warnings: ["Fant ikke tydelig produktnavn i Google-kvitteringen"],
  };
}

function findBestAmount(text: string, billingInterval: BillingInterval): AmountMatch | null {
  const matches = findAmountMatches(text);

  if (matches.length === 0) {
    return null;
  }

  const hasMonthlyContext = billingInterval === "monthly" || hasMonthlySignal(text);
  const hasYearlyContext = billingInterval === "yearly";
  const scoredMatches = matches
    .filter((match) => !looksLikeNonPriceNumber(text, match.start, match.end, match.amount))
    .map((match) => scoreAmountMatch(text, match, hasMonthlyContext, hasYearlyContext))
    .sort((a, b) => b.score - a.score);

  return scoredMatches[0] ?? null;
}

function findAmountMatches(text: string) {
  const matches: {
    amount: number;
    currency: string;
    start: number;
    end: number;
  }[] = [];
  const patterns = [
    /\b(kr|nok|usd|eur)\s*(\d{1,5})(?:[,.](\d{2}))?\b/gi,
    /\b(\d{1,5})(?:[,.](\d{2}))?\s*(kr|nok|usd|eur)\b/gi,
    /\b(\d{1,5})(?:[,.](\d{2}))?\s*,-/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const matchedText = match[0];
      const index = match.index ?? 0;
      const startsWithCurrency = /^(kr|nok|usd|eur)/i.test(matchedText.trim());
      const currency = startsWithCurrency ? match[1] : match[3] ?? "NOK";
      const wholeAmount = startsWithCurrency ? match[2] : match[1];
      const amount = Number(wholeAmount);

      if (Number.isInteger(amount) && amount > 0) {
        matches.push({
          amount,
          currency: normalizeCurrency(currency),
          start: index,
          end: index + matchedText.length,
        });
      }
    }
  }

  return matches;
}

function scoreAmountMatch(
  text: string,
  match: { amount: number; currency: string; start: number; end: number },
  hasMonthlyContext: boolean,
  hasYearlyContext: boolean,
): AmountMatch {
  const window = getWindow(text, match.start, match.end, 90);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 1;

  if (/\b(kr\/mnd|\/mnd|per mnd|per måned|monthly|month|månedlig|maanedlig)\b/i.test(window)) {
    score += 8;
    reasons.push("Beløpet står nær månedlig pris");
  }

  if (/\b(subscription|abonnement|medlemskap|next payment|neste trekk|renewal|fornyes|billing)\b/i.test(window)) {
    score += 5;
    reasons.push("Beløpet står nær abonnement eller fornyelse");
  }

  if (/\b(receipt|kvittering|invoice|faktura|payment|betaling|beløp|belop|total)\b/i.test(window)) {
    score += 3;
    reasons.push("Beløpet står nær kvittering eller betaling");
  }

  if (/\b(order|ordre|invoice no|fakturanr|customer|kunde|phone|telefon)\b/i.test(window)) {
    score -= 4;
    warnings.push("Beløpet står nær ordre-, kunde- eller fakturatekst");
  }

  if (hasMonthlyContext && match.amount >= 500 && !hasYearlyContext) {
    score -= 7;
    warnings.push("Høyt beløp nedprioritert fordi e-posten ser månedlig ut");
  }

  if (hasYearlyContext && match.amount >= 500) {
    score += 2;
    reasons.push("Høyt beløp akseptert fordi årlig kontekst finnes");
  }

  if (match.amount <= 250) {
    score += 2;
    reasons.push("Beløpet ligner vanlig månedspris");
  }

  return {
    amount: match.amount,
    currency: match.currency,
    score,
    reasons: reasons.length > 0 ? reasons : ["Beløp funnet"],
    warnings,
  };
}

function looksLikeNonPriceNumber(text: string, start: number, end: number, amount: number) {
  const window = getWindow(text, start, end, 24);

  if (amount > 9999) {
    return true;
  }

  if (/\b(order|ordre|invoice no|fakturanr|customer|kunde|phone|telefon|id|nr)\b/i.test(window)) {
    return true;
  }

  return /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/.test(window);
}

function findBillingInterval(text: string): BillingInterval {
  if (/\b(trial|prøveperiode|proveperiode|free trial)\b/i.test(text)) {
    return "trial";
  }

  if (/\b(yearly|annual|annually|årlig|aarlig|per år|per ar)\b/i.test(text)) {
    return "yearly";
  }

  if (hasMonthlySignal(text)) {
    return "monthly";
  }

  return "unknown";
}

function hasMonthlySignal(text: string) {
  return /\b(monthly|månedlig|maanedlig|per måned|per mnd|kr\/mnd|\/mnd|\/month)\b/i.test(text);
}

function findNextPayment(text: string) {
  const dateMatch = text.match(
    /(?:neste|next|fornyes|renewal|trekk|betaling|billing)[^\d]{0,32}(\d{1,2}\.?\s*(?:jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des|january|february|march|april|may|june|july|august|september|october|november|december)?)/i,
  );

  return dateMatch?.[1]?.trim() || "Ukjent";
}

function inferCategory(text: string): SubscriptionCategory {
  if (/\b(streaming|film|serie|music|premium|video)\b/i.test(text)) {
    return "streaming";
  }

  if (/\b(avis|nyheter|magasin|newspaper)\b/i.test(text)) {
    return "news";
  }

  if (/\b(trening|helse|gym|fitness)\b/i.test(text)) {
    return "health";
  }

  return "software";
}

function getConfidenceLabel(confidence: number): "høy" | "middels" | "lav" {
  if (confidence >= 0.75) {
    return "høy";
  }

  if (confidence >= 0.5) {
    return "middels";
  }

  return "lav";
}

function hasReceiptOnlyWithoutRecurringSignal(text: string) {
  const hasReceipt = /\b(receipt|kvittering|invoice|faktura|payment|betaling|order|ordre)\b/i.test(text);
  const hasRecurring = /\b(subscription|abonnement|recurring|renewal|fornyes|monthly|månedlig|trial|prøveperiode)\b/i.test(text);

  return hasReceipt && !hasRecurring;
}

function countMerchantMentions(text: string, merchantName: string) {
  const escapedName = merchantName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(escapedName, "gi"))?.length ?? 0;
}

function isGenericGoogleMerchant(name: string) {
  return /google commerce limited|google play/i.test(name);
}

function normalizeEmailText(text: string) {
  return stripHtml(text)
    .normalize("NFKC")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120_000);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeCurrency(currency: string) {
  const normalized = currency.toUpperCase();
  return normalized === "KR" ? "NOK" : normalized;
}

function getWindow(text: string, start: number, end: number, padding: number) {
  return text.slice(Math.max(0, start - padding), Math.min(text.length, end + padding));
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
