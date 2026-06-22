import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getCurrentAppUser } from "@/lib/current-user";
import { logger } from "@/lib/logger";

type DashboardPageProps = {
  searchParams: Promise<{ start?: string }>;
};

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Oversikt | Aboslutt",
  robots: { index: false, follow: false },
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await searchParams;
  let currentUser;

  try {
    currentUser = await getCurrentAppUser();
  } catch (error) {
    logServerError("dashboard:getCurrentUser", error);
    return <DashboardLoadError />;
  }

  if (!currentUser) {
    redirect("/login");
  }

  return <DashboardClient />;
}

function DashboardLoadError() {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <h1 className="text-2xl font-extrabold tracking-tight">Kunne ikke laste oversikten akkurat nå.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6F82]">Prøv igjen.</p>
      </section>
    </main>
  );
}

function logServerError(route: string, error: unknown, userId?: string) {
  const safeError = error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  logger.error("[server-render]", { route, userId, ...safeError });
}
