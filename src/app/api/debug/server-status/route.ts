import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isDevelopment = process.env.NODE_ENV !== "production";
  const authorization = request.headers.get("authorization");
  const authorizedBySecret = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);

  if (!isDevelopment && !authorizedBySecret) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Ikke tilgang." },
      { status: 401 },
    );
  }

  const session = await getServerSession(authOptions);
  let databaseConnected = false;
  let subscriptionCount: number | null = null;
  let userCount: number | null = null;

  try {
    const [users, subscriptions] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count(),
    ]);
    databaseConnected = true;
    userCount = users;
    subscriptionCount = subscriptions;
  } catch (error) {
    const safeError = error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
    console.error("[debug-server-status]", { route: "api/debug/server-status", ...safeError });
  }

  return NextResponse.json({
    ok: databaseConnected,
    environment: process.env.NODE_ENV,
    databaseConnected,
    userCount,
    subscriptionCount,
    session: {
      authenticated: Boolean(session?.user),
      userId: session?.user?.id ?? null,
    },
  });
}
