import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { logAdminAudit } from "@/lib/admin-audit";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { validateProviderAdminInput } from "@/lib/subscription-provider-catalog.mjs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getCurrentUser();
  if (!admin) return unauthorizedResponse();
  if (!isAdminUser(admin)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.subscriptionProvider.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const validation = validateProviderAdminInput(await request.json().catch(() => ({})));
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: "INVALID_PROVIDER", messages: validation.errors }, { status: 400 });
  }

  try {
    const provider = await prisma.subscriptionProvider.update({ where: { id }, data: validation.value });
    await logAdminAudit({
      adminUserId: admin.id,
      action: "subscription_provider_updated",
      metadata: { providerId: provider.id, slug: provider.slug, isActive: provider.isActive },
    });
    return NextResponse.json({ ok: true, provider });
  } catch {
    return NextResponse.json({ ok: false, error: "PROVIDER_CONFLICT" }, { status: 409 });
  }
}
