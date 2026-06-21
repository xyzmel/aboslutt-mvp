import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import {
  normalizeMerchantKey,
  parseEmailSubscriptionCandidates,
} from "@/lib/email-subscription-parser";
import { getValidGoogleAccessToken, GoogleTokenError } from "@/lib/google-tokens";
import { dedupeImportCandidates, enrichImportCandidate } from "@/lib/import-candidates";
import { canUseGmailScan } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

export const runtime = "nodejs";

const gmailReadonlyScope = "https://www.googleapis.com/auth/gmail.readonly";
const maxMessages = 100;

type GmailMessageList = {
  messages?: { id: string }[];
};

type GmailMessage = {
  snippet?: string;
  payload?: GmailPayloadPart;
};

type GmailPayloadPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
};

class GmailImportError extends Error {
  constructor(
    public code:
      | "UNAUTHORIZED"
      | "GOOGLE_NOT_CONNECTED"
      | "GMAIL_SCOPE_MISSING"
      | "GMAIL_TOKEN_EXPIRED"
      | "GMAIL_RATE_LIMITED"
      | "GMAIL_UPSTREAM_ERROR"
      | "GMAIL_INTERNAL_ERROR"
      | "PLAN_REQUIRED",
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "GmailImportError";
  }
}

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "import-gmail",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    debugLog("start");
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      throw new GmailImportError("UNAUTHORIZED", "Du må være logget inn.", 401);
    }

    if (!canUseGmailScan(currentUser)) {
      throw new GmailImportError(
        "PLAN_REQUIRED",
        "Automatisk skanning er en Premium-funksjon. Du kan fortsatt legge inn abonnementer manuelt gratis.",
        403,
      );
    }

    const account = await prisma.account.findFirst({
      where: { userId: currentUser.id, provider: "google" },
      orderBy: { id: "desc" },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
        scope: true,
      },
    });

    if (!account) {
      throw new GmailImportError("GOOGLE_NOT_CONNECTED", "Koble til Google/Gmail først.", 403);
    }

    if (!account.scope?.split(" ").includes(gmailReadonlyScope)) {
      throw new GmailImportError(
        "GMAIL_SCOPE_MISSING",
        "Gmail-tilgang mangler. Koble til Google/Gmail på nytt.",
        403,
      );
    }

    const accessToken = await getValidGoogleAccessToken(account);
    const messageIds = await searchGmail(accessToken);
    debugLog("gmail_search_complete", { userId: currentUser.id, messagesFound: messageIds.length });

    const fetchedMessages = await fetchGmailMessages(messageIds, accessToken);
    const parsed = parseMessagesSafely(fetchedMessages.messageTexts);

    const existingActiveSubscriptions = await prisma.subscription.findMany({
      where: {
        userId: currentUser.id,
        status: { in: ["active", "trial", "yearly"] },
      },
      select: { name: true, normalizedName: true },
    });
    const existingMerchantKeys = new Set(
      existingActiveSubscriptions.map((subscription) =>
        subscription.normalizedName ?? normalizeMerchantKey(subscription.name),
      ),
    );
    const ignoredCandidates = await prisma.ignoredImportCandidate.findMany({
      where: { userId: currentUser.id },
      select: { sourceFingerprint: true },
    });
    const ignoredFingerprints = new Set(ignoredCandidates.map((candidate) => candidate.sourceFingerprint));
    const candidates = dedupeImportCandidates(
      parsed.candidates.map((candidate) => enrichImportCandidate(candidate, "gmail")),
    )
      .filter((candidate) => candidate.confidenceScore >= 50)
      .filter((candidate) => !existingMerchantKeys.has(normalizeMerchantKey(candidate.merchantName)));
    const visibleCandidates = candidates.filter(
      (candidate) => !ignoredFingerprints.has(candidate.sourceFingerprint),
    );

    return NextResponse.json({
      ok: true,
      scannedMessages: messageIds.length,
      fetchedMessages: fetchedMessages.messageTexts.length,
      skippedMessages: fetchedMessages.warningCount + parsed.warningCount,
      candidates: visibleCandidates,
    });
  } catch (error) {
    if (error instanceof GoogleTokenError) {
      debugLog("gmail_token_error", {
        error: error.code,
        status: error.status,
        message: error.message,
      });

      return NextResponse.json(
        { ok: false, error: "GMAIL_TOKEN_EXPIRED", message: error.message },
        { status: error.status },
      );
    }

    if (error instanceof GmailImportError) {
      debugLog("gmail_import_error", {
        error: error.code,
        status: error.status,
        message: error.message,
      });

      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : "Ukjent feil";
    debugLog("gmail_internal_error", { error: "GMAIL_INTERNAL_ERROR", message });

    return NextResponse.json(
      {
        ok: false,
        error: "GMAIL_INTERNAL_ERROR",
        message: "Kunne ikke skanne Gmail akkurat nå. Prøv igjen.",
      },
      { status: 500 },
    );
  }
}

async function searchGmail(accessToken: string) {
  const afterDate = new Date();
  afterDate.setMonth(afterDate.getMonth() - 24);
  const gmailAfterDate = [
    afterDate.getFullYear(),
    String(afterDate.getMonth() + 1).padStart(2, "0"),
    String(afterDate.getDate()).padStart(2, "0"),
  ].join("/");
  const query = [
    `after:${gmailAfterDate}`,
    "(receipt OR kvittering OR invoice OR faktura OR subscription OR abonnement OR renewal OR fornyelse)",
  ].join(" ");

  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", String(maxMessages));

  const response = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw await createGmailApiError(response, "Kunne ikke søke i Gmail akkurat nå. Prøv igjen.");
  }

  const messageList = (await response.json()) as GmailMessageList;
  return messageList.messages?.slice(0, maxMessages).map((message) => message.id) ?? [];
}

async function fetchGmailMessages(messageIds: string[], accessToken: string) {
  let warningCount = 0;
  const messageTexts: string[] = [];

  await Promise.all(
    messageIds.map(async (messageId) => {
      try {
        const messageUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`);
        messageUrl.searchParams.set("format", "full");
        messageUrl.searchParams.set("fields", "snippet,payload");

        const response = await fetch(messageUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          warningCount += 1;
          debugLog("gmail_message_fetch_failed", { status: response.status });
          return;
        }

        const message = (await response.json()) as GmailMessage;
        const messageText = [message.snippet ?? "", extractTextFromPayload(message.payload)]
          .join(" ")
          .trim();

        if (messageText) {
          messageTexts.push(messageText);
        }
      } catch (error) {
        warningCount += 1;
        debugLog("gmail_message_fetch_error", {
          message: error instanceof Error ? error.message : "Ukjent feil",
        });
      }
    }),
  );

  return { messageTexts, warningCount };
}

function parseMessagesSafely(messageTexts: string[]) {
  let warningCount = 0;
  const candidates = messageTexts.flatMap((messageText) => {
    try {
      return parseEmailSubscriptionCandidates(messageText);
    } catch (error) {
      warningCount += 1;
      debugLog("gmail_message_parse_error", {
        message: error instanceof Error ? error.message : "Ukjent parserfeil",
      });
      return [];
    }
  });

  return { candidates, warningCount };
}

async function createGmailApiError(response: Response, fallbackMessage: string) {
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  const upstreamMessage = body.error?.message ?? fallbackMessage;

  debugLog("gmail_api_error", { status: response.status, message: upstreamMessage });

  if (response.status === 401) {
    return new GmailImportError(
      "GMAIL_TOKEN_EXPIRED",
      "Google-tilgangen er utløpt. Koble til Gmail på nytt.",
      401,
    );
  }

  if (response.status === 403 && /scope|permission|insufficient/i.test(upstreamMessage)) {
    return new GmailImportError(
      "GMAIL_SCOPE_MISSING",
      "Gmail-tilgang mangler. Koble til Google/Gmail på nytt.",
      403,
    );
  }

  if (response.status === 429) {
    return new GmailImportError(
      "GMAIL_RATE_LIMITED",
      "Google begrenset forespørselen akkurat nå. Prøv igjen senere.",
      429,
    );
  }

  return new GmailImportError("GMAIL_UPSTREAM_ERROR", fallbackMessage, 502);
}

function extractTextFromPayload(payload?: GmailPayloadPart): string {
  if (!payload) {
    return "";
  }

  try {
    const currentText =
      payload.body?.data && isReadableMimeType(payload.mimeType)
        ? decodeBase64Url(payload.body.data)
        : "";
    const childText = payload.parts?.map((part) => extractTextFromPayload(part)).join(" ") ?? "";

    return stripHtml([currentText, childText].join(" "));
  } catch {
    return "";
  }
}

function isReadableMimeType(mimeType?: string) {
  return !mimeType || mimeType === "text/plain" || mimeType === "text/html";
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function debugLog(step: string, metadata: Record<string, unknown> = {}) {
  if (process.env.GMAIL_IMPORT_DEBUG !== "true") {
    return;
  }

  console.info("[gmail-import]", { step, ...metadata });
}
