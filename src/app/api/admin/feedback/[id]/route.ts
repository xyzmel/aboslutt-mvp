import { NextResponse } from "next/server";
import { AdminForbiddenError, isAdminUser } from "@/lib/admin";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

type AdminFeedbackRouteProps = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, { params }: AdminFeedbackRouteProps) {
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

  const { id } = await params;
  await prisma.feedback.update({
    where: { id },
    data: {
      reviewedAt: new Date(),
      reviewedBy: currentUser.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, message: "Tilbakemeldingen er markert som lest." });
}
