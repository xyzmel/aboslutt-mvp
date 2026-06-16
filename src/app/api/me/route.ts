import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { canUseEmailReminders, canUseMonthlySummary } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const accounts = await prisma.account.findMany({
    where: { userId: currentUser.id },
    select: { provider: true },
  });
  const providerSet = new Set(accounts.map((account) => account.provider));

  return NextResponse.json({
    ok: true,
    user: {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      image: currentUser.image,
      plan: currentUser.plan,
      emailRemindersEnabled: canUseEmailReminders(currentUser) && currentUser.emailRemindersEnabled,
      monthlySummaryEnabled: canUseMonthlySummary(currentUser) && currentUser.monthlySummaryEnabled,
      isAdmin: isAdminUser(currentUser),
      providers: {
        email: Boolean(currentUser.passwordHash || currentUser.emailVerified),
        google: providerSet.has("google"),
        vipps: providerSet.has("vipps"),
      },
    },
  });
}
