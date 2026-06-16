import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { normalizeMerchantKey, normalizeMerchantName } from "@/lib/email-subscription-parser";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

const allowedIssues = ["wrong_amount", "wrong_merchant", "not_subscription", "duplicate", "other"];

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "import-candidate-report",
    limit: 30,
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
  const issueType = typeof payload.issueType === "string" ? payload.issueType : "";

  if (!allowedIssues.includes(issueType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ISSUE", message: "Velg hva som var feil." },
      { status: 400 },
    );
  }

  const merchantName = typeof payload.merchantName === "string" ? payload.merchantName.trim() : "";
  const normalizedName = merchantName ? normalizeMerchantName(merchantName) : null;
  const amount = Number.isInteger(Number(payload.amount)) ? Number(payload.amount) : null;
  const sourceProvider = payload.sourceProvider === "gmail" ? "gmail" : "pasted_email";
  const confidenceScore = Number.isInteger(Number(payload.confidenceScore))
    ? Number(payload.confidenceScore)
    : null;
  const comment = typeof payload.comment === "string" ? payload.comment.trim().slice(0, 1000) : null;

  await prisma.importFeedback.create({
    data: {
      userId: currentUser.id,
      sourceProvider,
      merchantName: merchantName || null,
      normalizedName: normalizedName ? normalizeMerchantKey(normalizedName) : null,
      amount,
      confidenceScore,
      issueType,
      comment: comment || null,
    },
    select: { id: true },
  });

  logger.info("import_candidate_reported_wrong", {
    userId: currentUser.id,
    sourceProvider,
    normalizedName: normalizedName ? normalizeMerchantKey(normalizedName) : null,
    amount,
    confidenceScore,
    issueType,
  });

  return NextResponse.json({ ok: true, message: "Takk, feilen er rapportert." });
}
