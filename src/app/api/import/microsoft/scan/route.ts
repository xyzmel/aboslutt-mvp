import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import {
  getMicrosoftProviderName,
  getValidMicrosoftAccessToken,
  invalidateMicrosoftAccount,
  MicrosoftGraphError,
  readSignedInMicrosoftMailbox,
} from "@/lib/microsoft-graph";
import { detectOutlookSubscriptionCandidates } from "@/lib/microsoft-outlook-detector.mjs";
import { toPrismaJson } from "@/lib/prisma-json";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

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
        error: "RECONNECT_REQUIRED",
        message: "Tilkoblingen til Outlook har utløpt.",
      },
      { status: 403 },
    );
  }

  try {
    const accessToken = await getValidMicrosoftAccessToken(account);
    const scanResult = await readSignedInMicrosoftMailbox(accessToken, 100);
    const candidates = detectOutlookSubscriptionCandidates(scanResult.messages);
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
    if (error instanceof MicrosoftGraphError && error.code === "MICROSOFT_RECONNECT_REQUIRED") {
      await invalidateMicrosoftAccount(currentUser.id);
    }

    const status = error instanceof MicrosoftGraphError ? error.status : 500;
    return NextResponse.json(
      {
        ok: false,
        status: "scan_failed",
        error: getMicrosoftScanErrorCode(error),
        message: getSafeMicrosoftScanMessage(error),
      },
      { status },
    );
  }
}

function getSafeMicrosoftScanMessage(error: unknown) {
  if (error instanceof MicrosoftGraphError) {
    if (error.code === "MICROSOFT_RECONNECT_REQUIRED") {
      return "Tilkoblingen til Outlook har utløpt.";
    }

    if (error.code === "MICROSOFT_THROTTLED") {
      return "Microsoft bruker litt lengre tid akkurat nå. Prøv igjen om et øyeblikk.";
    }

    return "Vi klarte ikke å skanne e-posten. Prøv igjen.";
  }

  return "Vi klarte ikke å skanne e-posten. Prøv igjen.";
}

function getMicrosoftScanErrorCode(error: unknown) {
  if (!(error instanceof MicrosoftGraphError)) {
    return "SCAN_FAILED";
  }

  if (error.code === "MICROSOFT_RECONNECT_REQUIRED") {
    return "CONNECTION_EXPIRED";
  }

  if (error.code === "MICROSOFT_THROTTLED") {
    return "MICROSOFT_THROTTLED";
  }

  return "SCAN_FAILED";
}
