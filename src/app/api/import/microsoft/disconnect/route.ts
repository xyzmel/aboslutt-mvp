import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { disconnectMicrosoftAccount } from "@/lib/microsoft-graph";
import { logger } from "@/lib/logger";
import { trackServerFunnelEvent } from "@/lib/server-analytics";

export async function POST() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  await disconnectMicrosoftAccount(currentUser.id);
  logger.info("[microsoft:disconnect]", { userId: currentUser.id });
  trackServerFunnelEvent("email_provider_disconnected", { provider: "outlook", result: "success" }, currentUser.id);

  return NextResponse.json({
    ok: true,
    status: "disconnected",
    message: "Microsoft er koblet fra.",
  });
}
