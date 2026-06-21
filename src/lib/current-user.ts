import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const demoUserEmail = "demo@aboslutt.local";
const currentUserSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  passwordHash: true,
  image: true,
  phoneNumber: true,
  plan: true,
  emailRemindersEnabled: true,
  reminderDaysBefore: true,
  monthlySummaryEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class UnauthorizedError extends Error {
  constructor(message = "Du må være logget inn.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function unauthorizedResponse(message = "Du må være logget inn.") {
  return NextResponse.json(
    {
      ok: false,
      error: "UNAUTHORIZED",
      message,
    },
    { status: 401 },
  );
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;
  const sessionEmail = session?.user?.email?.trim().toLowerCase();

  if (sessionUserId) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: currentUserSelect,
    });

    if (user) {
      return user;
    }
  }

  if (sessionEmail) {
    const sessionName = session?.user?.name ?? null;
    const sessionImage = session?.user?.image ?? null;

    return prisma.user.upsert({
      where: { email: sessionEmail },
      update: {
        name: sessionName ?? undefined,
        image: sessionImage ?? undefined,
      },
      create: {
        email: sessionEmail,
        name: sessionName,
        image: sessionImage,
      },
      select: currentUserSelect,
    });
  }

  if (isDevelopmentDemoFallbackEnabled()) {
    // TODO: Remove this local-only fallback when development no longer needs seeded demo data.
    return prisma.user.upsert({
      where: { email: demoUserEmail },
      update: {},
      create: {
        email: demoUserEmail,
        name: "Demo-bruker",
      },
      select: currentUserSelect,
    });
  }

  return null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export async function getCurrentAppUser() {
  return getCurrentUser();
}

export function isDevelopmentDemoFallbackEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ABOSLUTT_ENABLE_DEMO_FALLBACK === "true";
}
