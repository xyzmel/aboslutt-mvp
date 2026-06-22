import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { createMicrosoftAuthorizationUrl, getMissingMicrosoftConfig, MicrosoftGraphError } from "@/lib/microsoft-graph";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const missingConfig = getMissingMicrosoftConfig();
  if (missingConfig.length > 0) {
    logger.error("[microsoft:connect:missing-config]", {
      missingConfig,
      userId: currentUser.id,
    });
    return NextResponse.redirect(new URL("/import/email?microsoft=unavailable", getBaseUrl()));
  }

  try {
    const authorizationUrl = await createMicrosoftAuthorizationUrl(currentUser.id);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    logger.error("[microsoft:connect]", {
      error: error instanceof MicrosoftGraphError ? error.code : "MICROSOFT_CONNECT_FAILED",
      userId: currentUser.id,
    });

    if (error instanceof MicrosoftGraphError) {
      return NextResponse.redirect(new URL(`/import/email?microsoft=${mapMicrosoftConnectError(error.code)}`, getBaseUrl()));
    }

    return NextResponse.redirect(new URL("/import/email?microsoft=failed", getBaseUrl()));
  }
}

function mapMicrosoftConnectError(code: MicrosoftGraphError["code"]) {
  if (code === "MICROSOFT_NOT_CONFIGURED") {
    return "unavailable";
  }

  if (code === "MICROSOFT_RECONNECT_REQUIRED") {
    return "expired";
  }

  return "failed";
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
}
