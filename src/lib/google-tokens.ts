import { prisma } from "@/lib/prisma";

export class GoogleTokenError extends Error {
  constructor(
    public code: "GOOGLE_RECONNECT_REQUIRED" | "GOOGLE_TOKEN_REFRESH_FAILED",
    message: string,
    public status = 401,
  ) {
    super(message);
    this.name = "GoogleTokenError";
  }
}

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

const reconnectMessage = "Google-tilgangen er utløpt. Koble til Gmail på nytt.";

export async function getValidGoogleAccessToken(account: {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
}) {
  if (!account.access_token && !account.refresh_token) {
    throw new GoogleTokenError("GOOGLE_RECONNECT_REQUIRED", reconnectMessage);
  }

  const expiresAtMs = account.expires_at ? account.expires_at * 1000 : null;
  const expiresSoon = expiresAtMs ? expiresAtMs <= Date.now() + 60_000 : true;

  if (account.access_token && !expiresSoon) {
    return account.access_token;
  }

  return refreshGoogleAccessToken(account);
}

export async function refreshGoogleAccessToken(account: {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
}) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !account.refresh_token) {
    throw new GoogleTokenError("GOOGLE_RECONNECT_REQUIRED", reconnectMessage);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokenResponse = (await response.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!response.ok || !tokenResponse.access_token) {
    throw new GoogleTokenError(
      "GOOGLE_TOKEN_REFRESH_FAILED",
      reconnectMessage,
      response.status === 403 ? 403 : 401,
    );
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: tokenResponse.access_token,
      expires_at: tokenResponse.expires_in
        ? Math.floor(Date.now() / 1000) + tokenResponse.expires_in
        : undefined,
      refresh_token: tokenResponse.refresh_token ?? undefined,
      scope: tokenResponse.scope ?? undefined,
      token_type: tokenResponse.token_type ?? undefined,
    },
  });

  return tokenResponse.access_token;
}
