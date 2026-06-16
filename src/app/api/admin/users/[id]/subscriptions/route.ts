import { NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/admin-audit";
import { AdminForbiddenError, isAdminUser } from "@/lib/admin";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

type AdminUserSubscriptionsRouteProps = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, { params }: AdminUserSubscriptionsRouteProps) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "admin-user-subscriptions-delete",
    limit: 15,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const adminResponse = await requireAdminResponse();

  if (adminResponse) {
    return adminResponse;
  }

  const { id } = await params;
  const currentUser = await getCurrentUser();
  const result = await prisma.subscription.deleteMany({
    where: { userId: id },
  });

  if (currentUser) {
    await logAdminAudit({
      adminUserId: currentUser.id,
      action: "user.subscriptions_deleted",
      targetUserId: id,
      metadata: { deletedCount: result.count },
    });
  }

  return NextResponse.json({
    ok: true,
    message: `${result.count} abonnementer er slettet.`,
    deletedCount: result.count,
  });
}

async function requireAdminResponse() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  if (!isAdminUser(currentUser)) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN", message: new AdminForbiddenError().message },
      { status: 403 },
    );
  }

  return null;
}
