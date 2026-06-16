import { NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/admin-audit";
import { AdminForbiddenError, isAdminUser } from "@/lib/admin";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { isValidPlan } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

type AdminUserRouteProps = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: AdminUserRouteProps) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "admin-user-patch",
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

  const { id } = await params;
  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST", message: "Ugyldig forespørsel." },
      { status: 400 },
    );
  }

  const data: { emailVerified?: Date; plan?: string } = {};

  if ("emailVerified" in payload) {
    if (payload.emailVerified !== true) {
      return NextResponse.json(
        { ok: false, error: "INVALID_EMAIL_VERIFICATION", message: "Ugyldig e-postbekreftelse." },
        { status: 400 },
      );
    }
    data.emailVerified = new Date();
  }

  if ("plan" in payload) {
    if (typeof payload.plan !== "string" || !isValidPlan(payload.plan)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_PLAN", message: "Ugyldig plan." },
        { status: 400 },
      );
    }
    data.plan = payload.plan;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { ok: false, error: "NO_CHANGES", message: "Ingen endringer å lagre." },
      { status: 400 },
    );
  }

  const currentUser = await getCurrentUser();
  await prisma.user.update({
    where: { id },
    data,
    select: { id: true },
  });

  if (currentUser) {
    await logAdminAudit({
      adminUserId: currentUser.id,
      action: data.plan ? "user.plan_changed" : "user.email_marked_verified",
      targetUserId: id,
      metadata: { plan: data.plan, emailVerified: Boolean(data.emailVerified) },
    });
  }

  return NextResponse.json({ ok: true, message: "Brukeren er oppdatert." });
}

export async function DELETE(request: Request, { params }: AdminUserRouteProps) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "admin-user-delete",
    limit: 10,
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
  const payload = await request.json().catch(() => null);

  if (!payload || payload.confirm !== "SLETT") {
    return NextResponse.json(
      { ok: false, error: "CONFIRMATION_REQUIRED", message: "Sletting må bekreftes." },
      { status: 400 },
    );
  }

  const currentUser = await getCurrentUser();
  if (currentUser) {
    await logAdminAudit({
      adminUserId: currentUser.id,
      action: "user.deleted",
      targetUserId: id,
    });
  }

  await prisma.user.delete({
    where: { id },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, message: "Brukeren er slettet." });
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
