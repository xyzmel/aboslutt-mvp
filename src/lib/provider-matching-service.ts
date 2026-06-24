import "server-only";
import { prisma } from "@/lib/prisma";
import {
  buildProviderCandidate,
  getLikelyDuplicateWarning,
  matchSubscriptionProvider,
  sanitizeUnmatchedProviderName,
} from "@/lib/provider-matcher.mjs";

const providerSelect = {
  id: true,
  name: true,
  category: true,
  aliases: true,
  senderNames: true,
  emailDomains: true,
  logoPath: true,
  isActive: true,
} as const;

export async function loadActiveProviderCatalog() {
  return prisma.subscriptionProvider.findMany({ where: { isActive: true }, select: providerSelect });
}

export function matchProviderContext(
  context: {
    providerName?: string | null;
    senderName?: string | null;
    senderDomain?: string | null;
    receiptText?: string | null;
  },
  providers: Awaited<ReturnType<typeof loadActiveProviderCatalog>>,
) {
  return matchSubscriptionProvider(context, providers);
}

export async function enrichDetectedCandidates<T extends Record<string, unknown>>(
  candidates: T[],
  {
    source,
    userId,
    contexts = [],
    providers: suppliedProviders,
  }: {
    source: "gmail" | "outlook" | "pasted_email" | "ai";
    userId: string;
    contexts?: {
      providerName?: string | null;
      senderName?: string | null;
      senderDomain?: string | null;
      receiptText?: string | null;
    }[];
    providers?: Awaited<ReturnType<typeof loadActiveProviderCatalog>>;
  },
) {
  const [providers, existingSubscriptions] = await Promise.all([
    suppliedProviders ? Promise.resolve(suppliedProviders) : loadActiveProviderCatalog(),
    prisma.subscription.findMany({
      where: { userId, status: { in: ["active", "trial", "yearly"] } },
      select: { providerId: true, name: true, billingInterval: true, status: true },
    }),
  ]);

  const enriched = candidates.map((candidate, index) => {
    const context = contexts[index] ?? {};
    const detectedName = String(candidate.merchantName ?? candidate.providerName ?? context.providerName ?? "");
    const match = matchSubscriptionProvider(
      {
        providerName: detectedName,
        senderName: context.senderName,
        senderDomain: context.senderDomain ?? candidate.senderDomain,
        receiptText: context.receiptText,
        hasAmount: candidate.amount !== null && candidate.amount !== undefined,
        hasInterval: Boolean(candidate.billingInterval && candidate.billingInterval !== "unknown"),
      },
      providers,
    );
    const matchedCandidate = buildProviderCandidate(candidate, match);
    const duplicate = getLikelyDuplicateWarning(matchedCandidate, existingSubscriptions);
    if (!match) void recordUnmatchedProviderName(detectedName, source);
    return {
      ...matchedCandidate,
      ...duplicate,
      reasons: match
        ? [...new Set([...(Array.isArray(candidate.reasons) ? candidate.reasons : []), match.explanation])]
        : candidate.reasons,
    };
  });
  return enriched;
}

export async function enrichAiReceiptCandidates<T extends Record<string, unknown>>(
  candidates: T[],
  userId: string,
) {
  return enrichDetectedCandidates(candidates, {
    source: "ai",
    userId,
    contexts: candidates.map((candidate) => ({
      providerName: String(candidate.merchantName ?? candidate.providerName ?? ""),
      receiptText: String(candidate.receiptText ?? ""),
      senderName: typeof candidate.senderName === "string" ? candidate.senderName : null,
      senderDomain: typeof candidate.senderDomain === "string" ? candidate.senderDomain : null,
    })),
  });
}

export async function recordUnmatchedProviderName(value: unknown, source: string) {
  const safe = sanitizeUnmatchedProviderName(value);
  if (!safe) return;
  await prisma.unmatchedProviderSignal.upsert({
    where: { normalizedName: safe.normalizedName },
    update: { count: { increment: 1 }, displayName: safe.displayName, source },
    create: { ...safe, source },
    select: { id: true },
  }).catch(() => undefined);
}
