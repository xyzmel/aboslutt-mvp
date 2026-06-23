import { NextResponse } from "next/server";
import { isGoogleMailConnectEnabled } from "@/lib/auth-provider-config.mjs";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import {
  getMicrosoftProviderName,
  invalidateMicrosoftAccount,
  isMicrosoftGraphConfigured,
  MicrosoftGraphError,
  validateMicrosoftConnection,
} from "@/lib/microsoft-graph";
import { canUseGmailScan } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sanitizeMicrosoftMailboxAddress } from "@/lib/microsoft-oauth-config.mjs";

const gmailReadonlyScope = "https://www.googleapis.com/auth/gmail.readonly";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const googleAccount = await prisma.account.findFirst({
    where: { userId: currentUser.id, provider: "google" },
    select: { scope: true },
  });
  const microsoftAccount = await prisma.account.findFirst({
    where: { userId: currentUser.id, provider: getMicrosoftProviderName() },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true, scope: true, providerEmail: true },
  });
  let microsoftConnected = false;
  let microsoftEmail: string | null = null;
  let microsoftExpired = false;

  if (microsoftAccount) {
    try {
      const connection = await validateMicrosoftConnection(microsoftAccount);
      microsoftConnected = true;
      microsoftEmail = sanitizeMicrosoftMailboxAddress(connection.email ?? microsoftAccount.providerEmail);
    } catch (error) {
      microsoftExpired =
        error instanceof MicrosoftGraphError &&
        (error.code === "MICROSOFT_RECONNECT_REQUIRED" || error.code === "MICROSOFT_GRAPH_UNAUTHORIZED");
      if (microsoftExpired) {
        await invalidateMicrosoftAccount(currentUser.id);
      }
      logger.warn("[microsoft:connection-invalid]", {
        error: error instanceof MicrosoftGraphError ? error.code : "MICROSOFT_CONNECTION_INVALID",
        userId: currentUser.id,
      });
    }
  }

  return NextResponse.json({
    googleMailConnectEnabled: isGoogleMailConnectEnabled(),
    googleConnected: Boolean(googleAccount),
    gmailScopeConnected: Boolean(googleAccount?.scope?.split(" ").includes(gmailReadonlyScope)),
    gmailScanAvailable: canUseGmailScan(currentUser),
    microsoftConnected,
    microsoftExpired,
    microsoftStatus: microsoftConnected ? "connected" : microsoftExpired ? "expired" : "disconnected",
    microsoftMailScopeConnected: microsoftConnected && Boolean(microsoftAccount?.scope?.split(" ").includes("Mail.Read")),
    microsoftConfigured: isMicrosoftGraphConfigured(),
    microsoftEmail,
    plan: currentUser.plan,
  });
}
