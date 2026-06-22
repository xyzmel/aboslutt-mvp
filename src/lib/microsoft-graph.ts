import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import {
  getMicrosoftAuthorizeUrlBase,
  getMicrosoftTokenUrl,
  isMicrosoftReconnectTokenError,
  isTenantSpecificMicrosoftAuthority,
  microsoftCommonAuthority,
  normalizeMicrosoftProfile,
} from "@/lib/microsoft-oauth-config.mjs";
import { prisma } from "@/lib/prisma";

const provider = "microsoft";
const stateCookieName = "aboslutt_ms_oauth_state";
const graphScopes = ["User.Read", "Mail.Read", "offline_access"] as const;
const graphBaseUrl = "https://graph.microsoft.com/v1.0";

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type MicrosoftProfile = {
  id?: string;
  userPrincipalName?: string;
  mail?: string;
  displayName?: string;
};

type MicrosoftGraphMessageList = {
  "@odata.nextLink"?: string;
  value?: Array<{
    id?: string;
    receivedDateTime?: string;
    subject?: string;
    from?: { emailAddress?: { address?: string; name?: string } };
    bodyPreview?: string;
    hasAttachments?: boolean;
    webLink?: string;
  }>;
};

export class MicrosoftGraphError extends Error {
  constructor(
    public code:
      | "MICROSOFT_NOT_CONFIGURED"
      | "MICROSOFT_INVALID_STATE"
      | "MICROSOFT_TOKEN_EXCHANGE_FAILED"
      | "MICROSOFT_PROFILE_FAILED"
      | "MICROSOFT_RECONNECT_REQUIRED"
      | "MICROSOFT_GRAPH_UNAUTHORIZED"
      | "MICROSOFT_THROTTLED"
      | "MICROSOFT_PARTIAL_SCAN"
      | "MICROSOFT_GRAPH_FAILED",
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "MicrosoftGraphError";
  }
}

export type MicrosoftMailboxMessage = {
  id: string;
  receivedDateTime: string | null;
  subject: string | null;
  from: { emailAddress?: { address?: string | null; name?: string | null } } | null;
  bodyPreview: string | null;
  hasAttachments: boolean;
  webLink: string | null;
};

export type MicrosoftMailboxScanResult = {
  messages: MicrosoftMailboxMessage[];
  partial: boolean;
  throttled: boolean;
};

export function isMicrosoftGraphConfigured() {
  warnIfTenantSpecificMicrosoftConfig();
  return getMissingMicrosoftConfig().length === 0;
}

export function getMissingMicrosoftConfig() {
  const required = [
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "MICROSOFT_REDIRECT_URI",
    "MICROSOFT_TOKEN_ENCRYPTION_KEY",
  ] as const;

  return required.filter((name) => !process.env[name]?.trim());
}

export async function createMicrosoftAuthorizationUrl(userId: string) {
  const config = getMicrosoftConfig();
  const state = randomBytes(32).toString("hex");
  const cookieValue = signStateCookie(state, userId);
  const cookieStore = await cookies();

  cookieStore.set(stateCookieName, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const url = new URL(getMicrosoftAuthorizeUrlBase());
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", graphScopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

export async function handleMicrosoftOAuthCallback({
  code,
  state,
  userId,
}: {
  code: string | null;
  state: string | null;
  userId: string;
}) {
  if (!code || !state) {
    throw new MicrosoftGraphError("MICROSOFT_INVALID_STATE", "Microsoft-koblingen mangler godkjenningsdata.", 400);
  }

  await validateAndClearStateCookie(state, userId);

  const tokenResponse = await exchangeCodeForTokens(code);

  if (!tokenResponse.access_token) {
    throw new MicrosoftGraphError(
      "MICROSOFT_TOKEN_EXCHANGE_FAILED",
      "Microsoft-koblingen kunne ikke fullføres.",
      502,
    );
  }

  const profile = await getMicrosoftProfile(tokenResponse.access_token);
  const { providerAccountId, providerEmail } = normalizeMicrosoftProfile(profile);

  if (!providerAccountId) {
    throw new MicrosoftGraphError("MICROSOFT_PROFILE_FAILED", "Microsoft-kontoen mangler konto-ID.", 502);
  }

  await prisma.account.deleteMany({
    where: {
      userId,
      provider,
      providerAccountId: { not: providerAccountId },
    },
  });

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
    create: {
      userId,
      type: "oauth",
      provider,
      providerAccountId,
      providerEmail,
      access_token: encryptToken(tokenResponse.access_token),
      refresh_token: tokenResponse.refresh_token ? encryptToken(tokenResponse.refresh_token) : null,
      expires_at: tokenResponse.expires_in ? Math.floor(Date.now() / 1000) + tokenResponse.expires_in : null,
      token_type: tokenResponse.token_type ?? "Bearer",
      scope: tokenResponse.scope ?? graphScopes.join(" "),
    },
    update: {
      userId,
      providerEmail,
      access_token: encryptToken(tokenResponse.access_token),
      refresh_token: tokenResponse.refresh_token ? encryptToken(tokenResponse.refresh_token) : undefined,
      expires_at: tokenResponse.expires_in ? Math.floor(Date.now() / 1000) + tokenResponse.expires_in : undefined,
      token_type: tokenResponse.token_type ?? "Bearer",
      scope: tokenResponse.scope ?? graphScopes.join(" "),
    },
  });

  return {
    email: providerEmail,
    name: profile.displayName ?? null,
  };
}

export async function getValidMicrosoftAccessToken(account: {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
}) {
  const expiresAtMs = account.expires_at ? account.expires_at * 1000 : null;
  const expiresSoon = expiresAtMs ? expiresAtMs <= Date.now() + 60_000 : true;

  if (account.access_token && !expiresSoon) {
    return decryptToken(account.access_token);
  }

  return refreshMicrosoftAccessToken(account);
}

export async function validateMicrosoftConnection(account: {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
}) {
  const accessToken = await getValidMicrosoftAccessToken(account);
  const profile = await getMicrosoftProfile(accessToken);

  return {
    email: profile.mail ?? profile.userPrincipalName ?? null,
    name: profile.displayName ?? null,
  };
}

export async function refreshMicrosoftAccessToken(account: {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
}) {
  if (!account.refresh_token) {
    throw new MicrosoftGraphError(
      "MICROSOFT_RECONNECT_REQUIRED",
      "Microsoft-tilgangen er utløpt. Koble til Outlook på nytt.",
      401,
    );
  }

  const config = getMicrosoftConfig();
  const refreshToken = decryptToken(account.refresh_token);
  const response = await fetch(getMicrosoftTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: graphScopes.join(" "),
    }),
    cache: "no-store",
  });
  const tokenResponse = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;

  if (!response.ok || !tokenResponse.access_token) {
    const reconnectRequired = isMicrosoftReconnectTokenError(response.status, tokenResponse);
    throw new MicrosoftGraphError(
      "MICROSOFT_RECONNECT_REQUIRED",
      "Microsoft-tilgangen er utløpt. Koble til Outlook på nytt.",
      reconnectRequired ? 401 : response.status === 403 ? 403 : 401,
    );
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: encryptToken(tokenResponse.access_token),
      refresh_token: tokenResponse.refresh_token ? encryptToken(tokenResponse.refresh_token) : undefined,
      expires_at: tokenResponse.expires_in ? Math.floor(Date.now() / 1000) + tokenResponse.expires_in : undefined,
      token_type: tokenResponse.token_type ?? undefined,
      scope: tokenResponse.scope ?? undefined,
    },
  });

  return tokenResponse.access_token;
}

export async function readSignedInMicrosoftMailbox(accessToken: string, limit = 100): Promise<MicrosoftMailboxScanResult> {
  const maxMessages = Math.min(Math.max(limit, 1), 100);
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  const url = new URL(`${graphBaseUrl}/me/messages`);
  url.searchParams.set("$top", "25");
  url.searchParams.set("$select", "id,subject,from,receivedDateTime,bodyPreview,hasAttachments,webLink");
  url.searchParams.set("$filter", `receivedDateTime ge ${since.toISOString()}`);
  url.searchParams.set("$orderby", "receivedDateTime desc");

  const messages: MicrosoftMailboxMessage[] = [];
  let nextUrl: string | null = url.toString();
  let pageCount = 0;
  let partial = false;
  let throttled = false;

  while (nextUrl && messages.length < maxMessages && pageCount < 8) {
    pageCount += 1;
    const page: MicrosoftGraphMessageList | null = await fetchMicrosoftGraphPage(nextUrl, accessToken).catch((error: unknown) => {
      if (error instanceof MicrosoftGraphError && messages.length > 0) {
        partial = true;
        throttled = error.code === "MICROSOFT_THROTTLED";
        return null;
      }

      throw error;
    });

    if (!page) {
      break;
    }

    for (const message of page.value ?? []) {
      if (typeof message.id !== "string") {
        continue;
      }

      messages.push({
        id: message.id,
        receivedDateTime: message.receivedDateTime ?? null,
        subject: message.subject ?? null,
        from: message.from ?? null,
        bodyPreview: message.bodyPreview ?? null,
        hasAttachments: Boolean(message.hasAttachments),
        webLink: message.webLink ?? null,
      });

      if (messages.length >= maxMessages) {
        break;
      }
    }

    nextUrl = page["@odata.nextLink"] ?? null;
  }

  return { messages, partial, throttled };
}

async function fetchMicrosoftGraphPage(url: string, accessToken: string): Promise<MicrosoftGraphMessageList> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as MicrosoftGraphMessageList;

    if (response.ok && Array.isArray(body.value)) {
      return body;
    }

    if (response.status === 401 || response.status === 403) {
      throw new MicrosoftGraphError(
        "MICROSOFT_GRAPH_UNAUTHORIZED",
        "Microsoft-tilgangen er utløpt eller trukket tilbake. Koble til Outlook på nytt.",
        response.status,
      );
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxAttempts) {
        await waitForRetry(response, attempt);
        continue;
      }

      throw new MicrosoftGraphError(
        response.status === 429 ? "MICROSOFT_THROTTLED" : "MICROSOFT_GRAPH_FAILED",
        response.status === 429
          ? "Microsoft begrenset skanningen midlertidig. Prøv igjen om litt."
          : "Outlook svarte ikke akkurat nå. Prøv igjen senere.",
        response.status === 429 ? 429 : 502,
      );
    }

    throw new MicrosoftGraphError("MICROSOFT_GRAPH_FAILED", "Kunne ikke lese Outlook-innboksen akkurat nå.", 502);
  }

  throw new MicrosoftGraphError("MICROSOFT_GRAPH_FAILED", "Kunne ikke lese Outlook-innboksen akkurat nå.", 502);
}

async function waitForRetry(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get("retry-after"));
  const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 500;
  await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfterMs, 2000)));
}

export async function disconnectMicrosoftAccount(userId: string) {
  await prisma.account.deleteMany({
    where: { userId, provider },
  });
}

export async function invalidateMicrosoftAccount(userId: string) {
  await disconnectMicrosoftAccount(userId);
}

export function getMicrosoftProviderName() {
  return provider;
}

async function exchangeCodeForTokens(code: string) {
  const config = getMicrosoftConfig();
  const response = await fetch(getMicrosoftTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      scope: graphScopes.join(" "),
    }),
    cache: "no-store",
  });
  const tokenResponse = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;

  if (!response.ok) {
    throw new MicrosoftGraphError(
      "MICROSOFT_TOKEN_EXCHANGE_FAILED",
      "Microsoft-koblingen kunne ikke fullføres.",
      502,
    );
  }

  return tokenResponse;
}

async function getMicrosoftProfile(accessToken: string) {
  const response = await fetch(`${graphBaseUrl}/me?$select=id,displayName,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const profile = (await response.json().catch(() => ({}))) as MicrosoftProfile;

  if (response.status === 401 || response.status === 403) {
    throw new MicrosoftGraphError("MICROSOFT_GRAPH_UNAUTHORIZED", "Kunne ikke lese Microsoft-profilen.", response.status);
  }

  if (!response.ok || !profile.id) {
    throw new MicrosoftGraphError("MICROSOFT_PROFILE_FAILED", "Kunne ikke lese Microsoft-profilen.", 502);
  }

  return profile;
}

async function validateAndClearStateCookie(state: string, userId: string) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(stateCookieName)?.value;
  cookieStore.delete(stateCookieName);

  if (!cookieValue || !verifyStateCookie(cookieValue, state, userId)) {
    throw new MicrosoftGraphError("MICROSOFT_INVALID_STATE", "Microsoft-koblingen kunne ikke verifiseres.", 400);
  }
}

function signStateCookie(state: string, userId: string) {
  const signature = createHmac("sha256", getStateSecret()).update(`${state}:${userId}`).digest("hex");
  return `${state}.${signature}`;
}

function verifyStateCookie(cookieValue: string, state: string, userId: string) {
  const [cookieState, signature] = cookieValue.split(".");

  if (!cookieState || !signature || cookieState !== state) {
    return false;
  }

  const expected = signStateCookie(state, userId).split(".")[1] ?? "";
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptToken(value: string) {
  if (!value.startsWith("v1.")) {
    throw new MicrosoftGraphError(
      "MICROSOFT_RECONNECT_REQUIRED",
      "Microsoft-tilgangen må kobles til på nytt.",
      401,
    );
  }

  const [, ivText, tagText, encryptedText] = value.split(".");

  if (!ivText || !tagText || !encryptedText) {
    throw new MicrosoftGraphError(
      "MICROSOFT_RECONNECT_REQUIRED",
      "Microsoft-tilgangen må kobles til på nytt.",
      401,
    );
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getEncryptionKey() {
  const secret = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY?.trim();

  if (!secret) {
    throw new MicrosoftGraphError(
      "MICROSOFT_NOT_CONFIGURED",
      "Microsoft-import er ikke ferdig konfigurert.",
      503,
    );
  }

  return createHash("sha256").update(secret).digest();
}

function getStateSecret() {
  const secret = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY?.trim();

  if (!secret) {
    throw new MicrosoftGraphError(
      "MICROSOFT_NOT_CONFIGURED",
      "Microsoft-import er ikke ferdig konfigurert.",
      503,
    );
  }

  return secret;
}

function getMicrosoftConfig() {
  const missing = getMissingMicrosoftConfig();
  if (missing.length > 0) {
    throw new MicrosoftGraphError(
      "MICROSOFT_NOT_CONFIGURED",
      "Outlook er midlertidig utilgjengelig.",
      503,
    );
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI?.trim();
  warnIfTenantSpecificMicrosoftConfig();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new MicrosoftGraphError(
      "MICROSOFT_NOT_CONFIGURED",
      "Outlook er midlertidig utilgjengelig.",
      503,
    );
  }

  return {
    clientId,
    clientSecret,
    authority: microsoftCommonAuthority,
    redirectUri,
  };
}

function warnIfTenantSpecificMicrosoftConfig() {
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim();

  if (isTenantSpecificMicrosoftAuthority(tenantId)) {
    logger.warn("[microsoft:tenant-specific-config]", {
      message: "Microsoft OAuth uses /common, but MICROSOFT_TENANT_ID is tenant-specific. Entra signInAudience must support personal and organizational accounts.",
      tenantConfigured: true,
    });
  }
}
