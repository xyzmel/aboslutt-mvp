const allowedCategories = new Set(["streaming", "software", "news", "health"]);
const allowedIntervals = new Set(["monthly", "yearly", "unknown"]);
const allowedCurrencies = new Set(["NOK", "USD", "EUR", "GBP", "SEK", "DKK"]);

/**
 * @typedef {Object} StoredOutlookCandidate
 * @property {string} id
 * @property {string} providerName
 * @property {string | null} senderDomain
 * @property {string} subject
 * @property {string | null} receivedDate
 * @property {number | null} amount
 * @property {string | null} currency
 * @property {"monthly" | "yearly" | "unknown"} billingInterval
 * @property {"high" | "medium" | "low"} confidence
 * @property {string[]} reasons
 * @property {boolean} grouped
 * @property {number} relatedMessageCount
 */

/**
 * @typedef {Object} EditedOutlookCandidate
 * @property {string} id
 * @property {boolean | undefined} selected
 * @property {string | undefined} name
 * @property {number | string | undefined} price
 * @property {string | undefined} currency
 * @property {string | undefined} billingInterval
 * @property {string | undefined} nextPayment
 * @property {string | undefined} category
 */

/**
 * @param {StoredOutlookCandidate} stored
 * @param {EditedOutlookCandidate | undefined} edited
 */
export function validateOutlookCandidateForImport(stored, edited) {
  const name = sanitizeText(edited?.name ?? stored.providerName, 80);
  const price = Number(edited?.price ?? stored.amount);
  const currency = sanitizeText(edited?.currency ?? stored.currency ?? "NOK", 8).toUpperCase();
  const billingInterval = sanitizeText(edited?.billingInterval ?? stored.billingInterval, 16);
  const nextPayment = sanitizeText(edited?.nextPayment ?? "", 16);
  const category = sanitizeText(edited?.category ?? inferCategory(stored.providerName), 24);
  const errors = [];

  if (!name || name.length < 2) {
    errors.push("Navn må fylles ut.");
  }

  if (!Number.isInteger(price) || price < 0 || price > 100000) {
    errors.push("Pris må være et heltall mellom 0 og 100000.");
  }

  if (!allowedCurrencies.has(currency)) {
    errors.push("Valuta er ikke støttet.");
  }

  if (!allowedIntervals.has(billingInterval)) {
    errors.push("Ugyldig faktureringsintervall.");
  }

  if (!allowedCategories.has(category)) {
    errors.push("Ugyldig kategori.");
  }

  if (nextPayment && !/^\d{4}-\d{2}-\d{2}$/.test(nextPayment)) {
    errors.push("Neste trekk må være tom eller en gyldig dato.");
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      id: stored.id,
      name,
      monthlyCost: price,
      currency,
      billingInterval,
      nextPayment,
      category,
      confidence: confidenceToNumber(stored.confidence),
      note: `Importert fra Outlook. ${stored.grouped ? `${stored.relatedMessageCount} relaterte meldinger.` : "Ett forslag."}`,
      source: "outlook_import",
    },
  };
}

/**
 * @param {unknown} candidates
 * @returns {StoredOutlookCandidate[]}
 */
export function parseStoredOutlookCandidates(candidates) {
  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .map((candidate) => normalizeStoredCandidate(candidate))
    .filter((candidate) => candidate !== null);
}

/**
 * @param {Date | string} expiresAt
 * @param {Date} [now]
 */
export function isOutlookScanExpired(expiresAt, now = new Date()) {
  return new Date(expiresAt).getTime() <= now.getTime();
}

/**
 * @param {{ userId: string, status: string, expiresAt: Date | string } | null | undefined} scan
 * @param {string} userId
 * @param {Date} [now]
 */
export function validateOutlookScanAccess(scan, userId, now = new Date()) {
  if (!scan || scan.userId !== userId) {
    return { ok: false, error: "SCAN_NOT_FOUND", status: 404, message: "Fant ikke Outlook-skanningen." };
  }

  if (isOutlookScanExpired(scan.expiresAt, now)) {
    return { ok: false, error: "SCAN_EXPIRED", status: 410, message: "Outlook-skanningen er utløpt. Skann på nytt." };
  }

  if (scan.status !== "pending") {
    return { ok: false, error: "IMPORT_CONFLICT", status: 409, message: "Denne Outlook-skanningen er allerede behandlet." };
  }

  return { ok: true };
}

/**
 * @param {{ ok: boolean }[]} results
 */
export function summarizeOutlookImportResults(results) {
  const importedCount = results.filter((result) => result.ok).length;
  const failedCount = results.length - importedCount;

  return {
    importedCount,
    failedCount,
    status: importedCount === results.length ? "success" : importedCount > 0 ? "partial_success" : "failed",
    scanStatus: importedCount === results.length ? "imported" : importedCount > 0 ? "partial_failed" : "failed",
    ok: importedCount > 0,
    message:
      importedCount === results.length
        ? "Alle valgte forslag ble importert."
        : importedCount > 0
          ? "Noen forslag ble importert. Se hvilke som trenger oppfølging."
          : "Ingen forslag ble importert.",
  };
}

/**
 * @param {StoredOutlookCandidate[]} storedCandidates
 * @param {EditedOutlookCandidate[]} editedCandidates
 */
export function matchSelectedOutlookCandidates(storedCandidates, editedCandidates) {
  const storedById = new Map(storedCandidates.map((candidate) => [candidate.id, candidate]));
  const selected = editedCandidates.filter((candidate) => candidate.selected);

  return selected.map((edited) => ({
    edited,
    stored: storedById.get(edited.id) ?? null,
  }));
}

function normalizeStoredCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const record = /** @type {Record<string, unknown>} */ (candidate);
  const id = typeof record.id === "string" ? record.id : "";
  const providerName = sanitizeText(record.providerName, 80);

  if (!id || !providerName) {
    return null;
  }

  return {
    id,
    providerName,
    senderDomain: typeof record.senderDomain === "string" ? sanitizeText(record.senderDomain, 120) : null,
    subject: sanitizeText(record.subject, 180),
    receivedDate: typeof record.receivedDate === "string" ? record.receivedDate : null,
    amount: typeof record.amount === "number" ? record.amount : null,
    currency: typeof record.currency === "string" ? sanitizeText(record.currency, 8).toUpperCase() : null,
    billingInterval: allowedIntervals.has(String(record.billingInterval)) ? String(record.billingInterval) : "unknown",
    confidence: record.confidence === "high" || record.confidence === "medium" ? record.confidence : "low",
    reasons: Array.isArray(record.reasons) ? record.reasons.map((reason) => sanitizeText(reason, 120)).filter(Boolean) : [],
    grouped: Boolean(record.grouped),
    relatedMessageCount: typeof record.relatedMessageCount === "number" ? Math.max(1, record.relatedMessageCount) : 1,
  };
}

function sanitizeText(value, maxLength) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function inferCategory(name) {
  if (/\b(netflix|spotify|youtube|disney|viaplay|storytel|tv 2|hbo|max)\b/i.test(name)) {
    return "streaming";
  }

  if (/\b(sats|fitness|gym|strava)\b/i.test(name)) {
    return "health";
  }

  return "software";
}

function confidenceToNumber(confidence) {
  if (confidence === "high") {
    return 0.9;
  }

  if (confidence === "medium") {
    return 0.65;
  }

  return 0.45;
}
