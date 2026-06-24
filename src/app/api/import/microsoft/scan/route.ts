import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import {
  getMicrosoftProviderName,
  getValidMicrosoftAccessToken,
  invalidateMicrosoftAccount,
  MicrosoftGraphError,
  readSignedInMicrosoftMailbox,
} from "@/lib/microsoft-graph";
import { getMicrosoftScanErrorCode } from "@/lib/microsoft-oauth-config.mjs";
import { detectOutlookSubscriptionCandidates } from "@/lib/microsoft-outlook-detector.mjs";
import { toPrismaJson } from "@/lib/prisma-json";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";
import {
  enrichDetectedCandidates,
  loadActiveProviderCatalog,
  matchProviderContext,
} from "@/lib/provider-matching-service";

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "import:microsoft:scan",
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitResponse) {
    return NextResponse.json(
      {
        ok: false,
        status: "scan_failed",
        error: "SCAN_RATE_LIMITED",
        message: "Microsoft bruker litt lengre tid akkurat nå. Prøv igjen om et øyeblikk.",
      },
      { status: 429 },
    );
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const account = await prisma.account.findFirst({
    where: { userId: currentUser.id, provider: getMicrosoftProviderName() },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!account) {
    return NextResponse.json(
      {
        ok: false,
        status: "scan_failed",
        error: "NOT_CONNECTED",
        message: "Koble til Outlook for å skanne e-post.",
      },
      { status: 403 },
    );
  }

  try {
    const accessToken = await getValidMicrosoftAccessToken(account);
    const scanResult = await readSignedInMicrosoftMailbox(accessToken, 100);
    const providers = await loadActiveProviderCatalog();
    const providerHints = Object.fromEntries(
      scanResult.messages.flatMap((message) => {
        const fromAddress = message.from?.emailAddress?.address ?? "";
        const match = matchProviderContext(
          {
            senderName: message.from?.emailAddress?.name ?? null,
            senderDomain: fromAddress.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1] ?? null,
            receiptText: `${message.subject ?? ""} ${message.bodyPreview ?? ""}`,
          },
          providers,
        );
        return match ? [[message.id, match]] : [];
      }),
    );
    const detectedCandidates = detectOutlookSubscriptionCandidates(scanResult.messages, providerHints);
    const candidates = await enrichDetectedCandidates(detectedCandidates, {
      source: "outlook",
      userId: currentUser.id,
      contexts: detectedCandidates.map((candidate) => ({
        providerName: candidate.providerName,
        senderDomain: candidate.senderDomain,
        receiptText: candidate.subject,
      })),
      providers,
    });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scan = await prisma.outlookImportScan.create({
      data: {
        userId: currentUser.id,
        candidates: toPrismaJson(candidates),
        status: "pending",
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    return NextResponse.json({
      ok: true,
      scanId: scan.id,
      status: candidates.length > 0 ? "review_results" : "no_candidates",
      messagesChecked: scanResult.messages.length,
      candidates,
      expiresAt: scan.expiresAt.toISOString(),
      partial: scanResult.partial,
      throttled: scanResult.throttled,
      message:
        candidates.length > 0
          ? `${candidates.length} mulige abonnementer er klare for gjennomgang.`
          : scanResult.partial
            ? "Skanningen ble delvis fullført, men vi fant ingen sikre abonnementer."
            : "Vi fant ingen sikre abonnementer i denne skanningen.",
    });
  } catch (error) {
    if (
      error instanceof MicrosoftGraphError &&
      (error.code === "MICROSOFT_RECONNECT_REQUIRED" || error.code === "MICROSOFT_GRAPH_UNAUTHORIZED")
    ) {
      await invalidateMicrosoftAccount(currentUser.id);
    }

    const status = error instanceof MicrosoftGraphError ? error.status : 500;
    return NextResponse.json(
      {
        ok: false,
        status: "scan_failed",
        error: error instanceof MicrosoftGraphError ? getMicrosoftScanErrorCode(error.code) : "SCAN_FAILED",
        message: getSafeMicrosoftScanMessage(error),
      },
      { status },
    );
  }
}

function getSafeMicrosoftScanMessage(error: unknown) {
  if (error instanceof MicrosoftGraphError) {
    if (error.code === "MICROSOFT_RECONNECT_REQUIRED" || error.code === "MICROSOFT_GRAPH_UNAUTHORIZED") {
      return "Tilkoblingen til Outlook har utløpt.";
    }

    if (error.code === "MICROSOFT_THROTTLED") {
      return "Microsoft bruker litt lengre tid akkurat nå. Prøv igjen om et øyeblikk.";
    }

    return "Vi klarte ikke å skanne e-posten. Prøv igjen.";
  }

  return "Vi klarte ikke å skanne e-posten. Prøv igjen.";
}
