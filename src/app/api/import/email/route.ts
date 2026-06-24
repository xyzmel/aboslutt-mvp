import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { parseEmailSubscriptionCandidates } from "@/lib/email-subscription-parser";
import { dedupeImportCandidates, enrichImportCandidate } from "@/lib/import-candidates";
import { prisma } from "@/lib/prisma";
import {
  enrichDetectedCandidates,
  loadActiveProviderCatalog,
  matchProviderContext,
} from "@/lib/provider-matching-service";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "import-email",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const payload = await request.json().catch(() => ({}));
  const emailText = typeof payload.emailText === "string" ? payload.emailText : "";

  if (emailText.trim().length < 20) {
    return NextResponse.json(
      { error: "Lim inn litt mer tekst fra kvitteringen." },
      { status: 400 },
    );
  }

  if (emailText.length > 20000) {
    return NextResponse.json({ error: "Teksten er for lang. Lim inn en kortere kvitteringstekst." }, { status: 400 });
  }

  const providers = await loadActiveProviderCatalog();
  const initialMatch = matchProviderContext({ receiptText: emailText }, providers);
  const baseCandidates = parseEmailSubscriptionCandidates(
    emailText,
    initialMatch ? { name: initialMatch.canonicalName, category: initialMatch.suggestedCategory } : null,
  )
    .map((candidate) => enrichImportCandidate(candidate, "pasted_email"))
    .filter((candidate) => candidate.confidenceScore >= 35);
  const parsedCandidates = await enrichDetectedCandidates(baseCandidates, {
    source: "pasted_email",
    userId: currentUser.id,
    contexts: baseCandidates.map((candidate) => ({
      providerName: candidate.merchantName,
      receiptText: emailText,
    })),
    providers,
  });
  const ignoredCandidates = await prisma.ignoredImportCandidate.findMany({
    where: { userId: currentUser.id },
    select: { sourceFingerprint: true },
  });
  const ignoredFingerprints = new Set(ignoredCandidates.map((candidate) => candidate.sourceFingerprint));
  const candidates = dedupeImportCandidates(parsedCandidates).filter(
    (candidate) => !ignoredFingerprints.has(candidate.sourceFingerprint),
  );

  return NextResponse.json({ candidates });
}
