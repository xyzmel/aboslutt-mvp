import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { normalizeMerchantKey, normalizeMerchantName } from "@/lib/email-subscription-parser";
import {
  matchSelectedOutlookCandidates,
  parseStoredOutlookCandidates,
  summarizeOutlookImportResults,
  validateOutlookScanAccess,
  validateOutlookCandidateForImport,
} from "@/lib/outlook-import-validation.mjs";
import { canAddManualSubscription, getManualSubscriptionLimit } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";
import { normalizeNextPaymentDate } from "@/lib/subscription-dates";
import type { BillingInterval, SubscriptionCategory, SubscriptionStatus } from "@/types/subscription";

type ConfirmPayload = {
  scanId?: unknown;
  candidates?: unknown;
};

type EditedCandidate = {
  id?: unknown;
  selected?: unknown;
  name?: unknown;
  price?: unknown;
  currency?: unknown;
  billingInterval?: unknown;
  nextPayment?: unknown;
  category?: unknown;
  providerId?: unknown;
};

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "import:microsoft:confirm",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const payload = (await request.json().catch(() => ({}))) as ConfirmPayload;
  const scanId = typeof payload.scanId === "string" ? payload.scanId : "";
  const editedCandidates = Array.isArray(payload.candidates)
    ? payload.candidates.map(normalizeEditedCandidate)
    : [];

  if (!scanId) {
    return NextResponse.json(
      { ok: false, error: "INVALID_SCAN", message: "Importen mangler skannereferanse." },
      { status: 400 },
    );
  }

  const selectedCount = editedCandidates.filter((candidate) => candidate.selected).length;
  if (selectedCount === 0) {
    return NextResponse.json(
      { ok: false, error: "NO_CANDIDATES_SELECTED", message: "Velg minst ett forslag før du importerer." },
      { status: 400 },
    );
  }

  const scan = await prisma.outlookImportScan.findFirst({
    where: { id: scanId, userId: currentUser.id },
    select: { id: true, userId: true, candidates: true, status: true, expiresAt: true },
  });

  const access = validateOutlookScanAccess(scan, currentUser.id);
  if (!access.ok) {
    if (scan && access.error === "SCAN_EXPIRED") {
      await prisma.outlookImportScan.update({
        where: { id: scan.id },
        data: { status: "expired" },
      });
    }

    return NextResponse.json(
      { ok: false, error: access.error, message: access.message },
      { status: access.status },
    );
  }

  if (!scan) {
    return NextResponse.json(
      { ok: false, error: "SCAN_NOT_FOUND", message: "Fant ikke Outlook-skanningen." },
      { status: 404 },
    );
  }

  const lock = await prisma.outlookImportScan.updateMany({
    where: { id: scan.id, userId: currentUser.id, status: "pending", expiresAt: { gt: new Date() } },
    data: { status: "importing" },
  });

  if (lock.count !== 1) {
    return NextResponse.json(
      { ok: false, error: "IMPORT_CONFLICT", message: "Denne Outlook-skanningen behandles allerede." },
      { status: 409 },
    );
  }

  const storedCandidates = parseStoredOutlookCandidates(scan.candidates);
  const matchedCandidates = matchSelectedOutlookCandidates(storedCandidates, editedCandidates);
  const results = [];

  for (const match of matchedCandidates) {
    if (!match.stored) {
      results.push({
        id: String(match.edited.id ?? "unknown"),
        ok: false,
        error: "CANDIDATE_NOT_FOUND",
        message: "Forslaget finnes ikke i denne skanningen.",
      });
      continue;
    }

    const validation = validateOutlookCandidateForImport(match.stored, match.edited);
    if (!validation.ok) {
      results.push({
        id: match.stored.id,
        ok: false,
        error: "VALIDATION_ERROR",
        message: validation.errors.join(" "),
      });
      continue;
    }

    const value = validation.value;
    const selectedProvider = value.providerId
      ? await prisma.subscriptionProvider.findFirst({
          where: { id: value.providerId, isActive: true },
          select: { id: true, name: true },
        })
      : null;
    if (value.providerId && !selectedProvider) {
      results.push({
        id: match.stored.id,
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Valgt leverandør finnes ikke lenger.",
      });
      continue;
    }
    const normalizedName = normalizeMerchantName(selectedProvider?.name ?? value.name);

    const existingSubscriptionCount = await prisma.subscription.count({ where: { userId: currentUser.id } });
    if (!canAddManualSubscription(currentUser, existingSubscriptionCount)) {
      const limit = getManualSubscriptionLimit(currentUser);
      results.push({
        id: match.stored.id,
        ok: false,
        error: "PLAN_LIMIT_REACHED",
        message: `Du har brukt ${existingSubscriptionCount} av ${limit} abonnementer i gratisplanen.`,
      });
      continue;
    }

    const billingInterval = value.billingInterval as BillingInterval;
    const status: SubscriptionStatus = billingInterval === "yearly" ? "yearly" : "active";
    const subscription = await prisma.subscription.create({
      data: {
        providerId: selectedProvider?.id ?? null,
        name: normalizedName,
        normalizedName: normalizeMerchantKey(normalizedName),
        category: value.category as SubscriptionCategory,
        monthlyCost: value.monthlyCost,
        status,
        billingInterval,
        nextPayment: normalizeNextPaymentDate({
          nextPayment: value.nextPayment,
          billingInterval,
          status,
        }),
        note: value.note,
        source: "outlook_import",
        confidence: value.confidence,
        userId: currentUser.id,
      },
      select: { id: true, name: true },
    });

    results.push({
      id: match.stored.id,
      ok: true,
      subscriptionId: subscription.id,
      name: subscription.name,
      message: "Importert.",
    });
  }

  const summary = summarizeOutlookImportResults(results);

  await prisma.outlookImportScan.update({
    where: { id: scan.id },
    data: {
      status: summary.scanStatus,
      importedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: summary.ok,
    status: summary.status,
    importedCount: summary.importedCount,
    failedCount: summary.failedCount,
    results,
    message: summary.message,
  });
}

function normalizeEditedCandidate(candidate: EditedCandidate) {
  return {
    id: typeof candidate.id === "string" ? candidate.id : "",
    selected: Boolean(candidate.selected),
    name: typeof candidate.name === "string" ? candidate.name : undefined,
    price: typeof candidate.price === "number" || typeof candidate.price === "string" ? candidate.price : undefined,
    currency: typeof candidate.currency === "string" ? candidate.currency : undefined,
    billingInterval: typeof candidate.billingInterval === "string" ? candidate.billingInterval : undefined,
    nextPayment: typeof candidate.nextPayment === "string" ? candidate.nextPayment : undefined,
    category: typeof candidate.category === "string" ? candidate.category : undefined,
    providerId: typeof candidate.providerId === "string" ? candidate.providerId : null,
  };
}
