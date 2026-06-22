import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { isMicrosoftGraphConfigured } from "@/lib/microsoft-graph";
import { canUseGmailScan } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

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
    where: { userId: currentUser.id, provider: "microsoft" },
    select: { scope: true, expires_at: true },
  });

  return NextResponse.json({
    googleConnected: Boolean(googleAccount),
    gmailScopeConnected: Boolean(googleAccount?.scope?.split(" ").includes(gmailReadonlyScope)),
    gmailScanAvailable: canUseGmailScan(currentUser),
    microsoftConnected: Boolean(microsoftAccount),
    microsoftMailScopeConnected: Boolean(microsoftAccount?.scope?.split(" ").includes("Mail.Read")),
    microsoftConfigured: isMicrosoftGraphConfigured(),
    plan: currentUser.plan,
  });
}
