/* eslint-disable react-hooks/error-boundaries */
import Link from "next/link";
import { AdminJobsClient } from "@/components/admin/AdminJobsClient";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AdminForbiddenError, requireAdminUser } from "@/lib/admin";
import { isCronConfigured } from "@/lib/cron";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured } from "@/lib/smtp";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  let adminUser;

  try {
    adminUser = await requireAdminUser();
  } catch (error) {
    if (error instanceof AdminForbiddenError) {
      return <AdminForbidden />;
    }

    logAdminError("admin:jobs:auth", error);
    return <AdminLoadError />;
  }

  try {
    const [lastReminderRun, lastMonthlySummaryRun] = await Promise.all([
      prisma.jobRun.findFirst({
        where: { type: "upcoming_payment_reminders" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobRun.findFirst({
        where: { type: "monthly_summary" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return (
      <main className="min-h-screen bg-[#F0F4F8] text-[#0D1B2A]">
        <AppHeader adminSection maxWidthClassName="max-w-5xl" />

        <section className="mx-auto max-w-5xl px-5 py-8">
          <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Admin</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">E-postjobber</h1>
          <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
            Test kommende trekk-varsler og månedlige oppsummeringer uten å eksponere cron-secret i nettleseren.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <StatusCard label="E-post konfigurert" value={isSmtpConfigured() ? "Ja" : "Nei"} />
            <StatusCard label="Cron konfigurert" value={isCronConfigured() ? "Ja" : "Nei"} />
            <JobRunCard title="Siste trekk-varsel" run={lastReminderRun} />
            <JobRunCard title="Siste månedsoppsummering" run={lastMonthlySummaryRun} />
          </div>

          <div className="mt-6">
            <AdminJobsClient />
          </div>
        </section>
      </main>
    );
  } catch (error) {
    logAdminError("admin:jobs:data", error, adminUser.id);
    return <AdminLoadError />;
  }
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <p className="text-sm font-semibold text-[#5F6F82]">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function JobRunCard({
  title,
  run,
}: {
  title: string;
  run: {
    status: string;
    dryRun: boolean;
    usersChecked: number;
    emailsSent: number;
    remindersCreated: number;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <p className="text-sm font-semibold text-[#5F6F82]">{title}</p>
      {run ? (
        <dl className="mt-3 grid gap-2 text-sm">
          <InfoRow label="Status" value={run.status} />
          <InfoRow label="Dry-run" value={run.dryRun ? "Ja" : "Nei"} />
          <InfoRow label="Kjørt" value={formatDate(run.completedAt ?? run.createdAt)} />
          <InfoRow label="Brukere" value={String(run.usersChecked)} />
          <InfoRow label="E-poster" value={String(run.emailsSent)} />
          <InfoRow label="Påminnelser" value={String(run.remindersCreated)} />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-[#5F6F82]">Ingen kjøring logget ennå.</p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-semibold text-[#5F6F82]">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

function AdminForbidden() {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">403</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Du har ikke tilgang til admin.</h1>
        <Link className="mt-5 inline-flex rounded-xl bg-[#0D1B2A] px-5 py-3 text-sm font-bold text-white" href="/dashboard">
          Til oversikten
        </Link>
      </section>
    </main>
  );
}

function AdminLoadError() {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <h1 className="text-2xl font-extrabold tracking-tight">Kunne ikke laste admin-data.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6F82]">Prøv igjen senere.</p>
      </section>
    </main>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function logAdminError(route: string, error: unknown, userId?: string) {
  const safeError =
    error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  console.error("[admin]", { route, userId, ...safeError });
}
