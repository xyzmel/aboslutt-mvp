import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { logAdminAudit } from "@/lib/admin-audit";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { validateProviderAdminInput } from "@/lib/subscription-provider-catalog.mjs";

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin) return unauthorizedResponse();
  if (!isAdminUser(admin)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const validation = validateProviderAdminInput(await request.json().catch(() => ({})));
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: "INVALID_PROVIDER", messages: validation.errors }, { status: 400 });
  }

  try {
    const provider = await prisma.subscriptionProvider.create({ data: validation.value });
    await logAdminAudit({
      adminUserId: admin.id,
      action: "subscription_provider_created",
      metadata: { providerId: provider.id, slug: provider.slug },
    });
    return NextResponse.json({ ok: true, provider }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "PROVIDER_CONFLICT" }, { status: 409 });
  }
}
