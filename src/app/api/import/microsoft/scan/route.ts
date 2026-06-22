import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import {
  getMicrosoftProviderName,
  getValidMicrosoftAccessToken,
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
    return rateLimitResponse;
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
        error: "MICROSOFT_NOT_CONNECTED",
        message: "Koble til Microsoft før du skanner Outlook.",
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
            : "Fant ingen sikre abonnementer i Outlook denne gangen.",
    });
  } catch (error) {
    const status = error instanceof MicrosoftGraphError ? error.status : 500;
    return NextResponse.json(
      {
        ok: false,
        status: "scan_failed",
        error: error instanceof MicrosoftGraphError ? error.code : "MICROSOFT_SCAN_FAILED",
        message: getSafeMicrosoftScanMessage(error),
      },
      { status },
    );
  }
}

function getSafeMicrosoftScanMessage(error: unknown) {
  if (error instanceof MicrosoftGraphError) {
    if (error.code === "MICROSOFT_RECONNECT_REQUIRED") {
      return "Microsoft-tilgangen er utløpt eller trukket tilbake. Koble til Outlook på nytt.";
    }

    if (error.code === "MICROSOFT_THROTTLED") {
      return "Microsoft begrenset skanningen midlertidig. Prøv igjen om litt.";
    }

    return error.message;
  }

  return "Kunne ikke skanne Outlook akkurat nå.";
}
