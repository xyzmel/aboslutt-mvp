import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { handleMicrosoftOAuthCallback, MicrosoftGraphError } from "@/lib/microsoft-graph";
import { logger } from "@/lib/logger";
import { trackServerFunnelEvent } from "@/lib/server-analytics";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  const redirectUrl = new URL("/import/email", getBaseUrl());

  if (!currentUser) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("callbackUrl", "/import/email");
    return NextResponse.redirect(redirectUrl);
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");

  if (error) {
    redirectUrl.searchParams.set("microsoft", "cancelled");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await handleMicrosoftOAuthCallback({
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      userId: currentUser.id,
    });
    trackServerFunnelEvent("email_provider_connected", { provider: "outlook", result: "success" }, currentUser.id);
    redirectUrl.searchParams.set("microsoft", "connected");
    return NextResponse.redirect(redirectUrl);
  } catch (callbackError) {
    logger.error("[microsoft:callback]", {
      error: callbackError instanceof MicrosoftGraphError ? callbackError.code : "MICROSOFT_CONNECT_FAILED",
      userId: currentUser.id,
    });
    redirectUrl.searchParams.set("microsoft", mapMicrosoftCallbackError(callbackError));
    return NextResponse.redirect(redirectUrl);
  }
}

function mapMicrosoftCallbackError(error: unknown) {
  if (!(error instanceof MicrosoftGraphError)) {
    return "failed";
  }

  if (error.code === "MICROSOFT_NOT_CONFIGURED") {
    return "unavailable";
  }

  if (error.code === "MICROSOFT_RECONNECT_REQUIRED") {
    return "expired";
  }

  return "failed";
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
}
