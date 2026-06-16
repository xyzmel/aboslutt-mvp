import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  await prisma.user.delete({
    where: { id: currentUser.id },
  });

  return NextResponse.json({ ok: true });
}
