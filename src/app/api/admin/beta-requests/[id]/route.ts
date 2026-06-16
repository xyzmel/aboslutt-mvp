import { NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/admin-audit";
import { AdminForbiddenError, isAdminUser } from "@/lib/admin";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { sendBetaAccessApprovedEmail } from "@/lib/notification-email";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

type AdminBetaRequestRouteProps = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: AdminBetaRequestRouteProps) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "admin-beta-request",
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const adminResponse = await requireAdminResponse();

  if (adminResponse) {
    return adminResponse;
  }

  const adminUser = await getCurrentUser();
  const { id } = await params;
  const payload = await request.json().catch(() => null);
  const action = payload && typeof payload === "object" ? payload.action : null;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { ok: false, error: "INVALID_ACTION", message: "Ugyldig handling." },
      { status: 400 },
    );
  }

  const betaRequest = await prisma.betaRequest.findUnique({
    where: { id },
    select: { id: true, email: true },
  });

  if (!betaRequest) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", message: "Beta-forespørselen finnes ikke." },
      { status: 404 },
    );
  }

  if (action === "approve") {
    const matchingUser = await prisma.user.findUnique({
      where: { email: betaRequest.email },
      select: { id: true, name: true, email: true, plan: true },
    });
    const shouldSendApprovalEmail = Boolean(matchingUser?.email && matchingUser.plan !== "beta");

    await prisma.$transaction(async (tx) => {
      if (matchingUser) {
        await tx.user.update({
          where: { id: matchingUser.id },
          data: { plan: "beta" },
          select: { id: true },
        });
      }
      await tx.betaRequest.update({
        where: { id },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: adminUser?.id ?? null,
        },
      });
    });

    let emailWarning: string | null = null;
    if (matchingUser?.email && shouldSendApprovalEmail) {
      try {
        const emailResult = await sendBetaAccessApprovedEmail({
          to: matchingUser.email,
          name: matchingUser.name,
        });
        if (!emailResult.sent) {
          emailWarning = "Beta ble godkjent, men e-post ble ikke sendt fordi SMTP ikke er konfigurert.";
        }
      } catch {
        emailWarning = "Beta ble godkjent, men e-postsending feilet.";
      }
    }

    if (adminUser) {
      await logAdminAudit({
        adminUserId: adminUser.id,
        action: "beta_request.approved",
        targetUserId: matchingUser?.id ?? null,
        metadata: { betaRequestId: id, emailMatchedUser: Boolean(matchingUser), emailWarning },
      });
    }

    return NextResponse.json({
      ok: true,
      message: emailWarning ?? "Beta-tilgang er godkjent. Hvis brukeren finnes, er planen satt til beta.",
      warning: emailWarning,
    });
  }

  await prisma.betaRequest.update({
    where: { id },
    data: {
      status: "rejected",
      reviewedAt: new Date(),
      reviewedBy: adminUser?.id ?? null,
    },
  });

  if (adminUser) {
    await logAdminAudit({
      adminUserId: adminUser.id,
      action: "beta_request.rejected",
      metadata: { betaRequestId: id },
    });
  }

  return NextResponse.json({ ok: true, message: "Beta-forespørselen er avvist." });
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
