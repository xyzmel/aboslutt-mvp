import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { getCandidateFingerprint } from "@/lib/import-candidates";
import { normalizeMerchantKey, normalizeMerchantName } from "@/lib/email-subscription-parser";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "import-candidate-ignore",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const payload = await request.json().catch(() => ({}));
  const merchantName = typeof payload.merchantName === "string" ? payload.merchantName.trim() : "";
  const normalizedName =
    typeof payload.normalizedName === "string" && payload.normalizedName.trim()
      ? normalizeMerchantName(payload.normalizedName)
      : merchantName
        ? normalizeMerchantName(merchantName)
        : null;
  const amount = Number.isInteger(Number(payload.amount)) ? Number(payload.amount) : null;
  const sourceProvider = payload.sourceProvider === "gmail" ? "gmail" : "pasted_email";
  const billingInterval = typeof payload.billingInterval === "string" ? payload.billingInterval : "unknown";
  const sourceFingerprint =
    typeof payload.sourceFingerprint === "string" && payload.sourceFingerprint
      ? payload.sourceFingerprint
      : getCandidateFingerprint({ normalizedName, merchantName, amount, billingInterval, sourceProvider });

  await prisma.ignoredImportCandidate.upsert({
    where: { userId_sourceFingerprint: { userId: currentUser.id, sourceFingerprint } },
    update: { reason: typeof payload.reason === "string" ? payload.reason.slice(0, 300) : null },
    create: {
      userId: currentUser.id,
      sourceProvider,
      normalizedName: normalizedName ? normalizeMerchantKey(normalizedName) : null,
      merchantName: merchantName || normalizedName,
      amount,
      sourceFingerprint,
      reason: typeof payload.reason === "string" ? payload.reason.slice(0, 300) : null,
    },
    select: { id: true },
  });

  logger.info("import_candidate_ignored", {
    userId: currentUser.id,
    sourceProvider,
    normalizedName: normalizedName ? normalizeMerchantKey(normalizedName) : null,
    amount,
  });

  return NextResponse.json({ ok: true, message: "Kandidaten er ignorert." });
}
