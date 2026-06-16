import { createHash } from "crypto";
import type { EmailSubscriptionCandidate } from "@/lib/email-subscription-parser";
import { normalizeMerchantKey, normalizeMerchantName } from "@/lib/email-subscription-parser";

export type SourceProvider = "gmail" | "pasted_email";

export type EnrichedImportCandidate = Omit<EmailSubscriptionCandidate, "confidenceLabel"> & {
  normalizedName: string;
  confidenceScore: number;
  confidenceLabel: "high" | "medium" | "low";
  sourceProvider: SourceProvider;
  sourceMessageDate: string | null;
  sourceFingerprint: string;
};

export function enrichImportCandidate(
  candidate: EmailSubscriptionCandidate,
  sourceProvider: SourceProvider,
  sourceMessageDate: string | null = null,
): EnrichedImportCandidate {
  const normalizedName = normalizeMerchantName(candidate.merchantName);
  const confidenceScore = Math.round(candidate.confidence * 100);
  const enriched = {
    ...candidate,
    merchantName: normalizedName,
    normalizedName,
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    sourceProvider,
    sourceMessageDate,
    sourceFingerprint: "",
  };

  return {
    ...enriched,
    sourceFingerprint: getCandidateFingerprint(enriched),
    warnings: addSuspiciousWarnings(enriched),
  };
}

export function getCandidateFingerprint(candidate: {
  normalizedName?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  billingInterval?: string | null;
  sourceProvider?: string | null;
}) {
  const key = [
    candidate.sourceProvider ?? "unknown",
    normalizeMerchantKey(candidate.normalizedName || candidate.merchantName || "unknown"),
    candidate.amount ?? "missing",
    candidate.billingInterval ?? "unknown",
  ].join("|");

  return createHash("sha256").update(key).digest("hex");
}

export function dedupeImportCandidates<T extends EnrichedImportCandidate>(candidates: T[]) {
  const byKey = new Map<string, T>();

  for (const candidate of candidates) {
    const key = [
      normalizeMerchantKey(candidate.normalizedName || candidate.merchantName),
      candidate.amount,
      candidate.billingInterval,
    ].join("|");
    const current = byKey.get(key);

    if (!current || candidate.confidenceScore > current.confidenceScore) {
      byKey.set(key, candidate);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function getConfidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 75) {
    return "high";
  }

  if (score >= 50) {
    return "medium";
  }

  return "low";
}

function addSuspiciousWarnings(candidate: EnrichedImportCandidate) {
  const warnings = [...candidate.warnings];

  if (!candidate.amount) {
    warnings.push("Mangler beløp");
  }

  if (!candidate.merchantName) {
    warnings.push("Mangler leverandør");
  }

  if (
    ["monthly", "unknown"].includes(candidate.billingInterval) &&
    candidate.amount &&
    candidate.amount > 500
  ) {
    warnings.push("Beløpet virker høyt for månedlig eller ukjent intervall");
  }

  if (/\b(google play|apple|paypal|stripe)\b/i.test(candidate.merchantName)) {
    warnings.push("Generisk leverandørnavn. Sjekk at riktig tjeneste er valgt");
  }

  return Array.from(new Set(warnings));
}
