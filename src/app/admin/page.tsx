/* eslint-disable react-hooks/error-boundaries */
import Link from "next/link";
import type { Metadata } from "next";
import { AdminBetaRequestActions, AdminFeedbackActions } from "@/components/admin/AdminReviewActions";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AdminForbiddenError, requireAdminUser } from "@/lib/admin";
import { sessionStrategy } from "@/lib/auth";
import { isCronConfigured } from "@/lib/cron";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured } from "@/lib/smtp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin | Aboslutt",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  let adminUser;

  try {
    adminUser = await requireAdminUser();
  } catch (error) {
    if (error instanceof AdminForbiddenError) {
      return <AdminForbidden />;
    }

    logAdminError("admin:auth", error);
    return <AdminLoadError />;
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoForCancellations = new Date();
    sevenDaysAgoForCancellations.setDate(sevenDaysAgoForCancellations.getDate() - 7);

    const [
      totalUsers,
      recentUsers,
      totalSubscriptions,
      activeSubscriptions,
      cancelledSubscriptions,
      totalGoogleAccounts,
      emailPasswordUsers,
      gmailConnectedUsers,
      emailRemindersEnabledCount,
      monthlySummaryEnabledCount,
      confirmedImportCandidatesCount,
      ignoredImportCandidatesCount,
      wrongImportReportsCount,
      lowConfidenceConfirmedCount,
      totalCancellationRequests,
      awaitingCancellationRequests,
      staleAwaitingCancellationRequests,
      confirmedCancellationRequests,
      manualCancellationRequests,
      rejectedCancellationRequests,
      importIssueTypeCounts,
      latestImportFeedback,
      latestBetaRequests,
      latestUsers,
      latestFeedback,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: { in: ["active", "trial", "yearly"] } } }),
      prisma.subscription.count({ where: { status: "cancelled" } }),
      prisma.account.count({ where: { provider: "google" } }),
      prisma.user.count({ where: { passwordHash: { not: null } } }),
      prisma.account.count({
        where: {
          provider: "google",
          scope: { contains: "https://www.googleapis.com/auth/gmail.readonly" },
        },
      }),
      prisma.user.count({ where: { emailRemindersEnabled: true } }),
      prisma.user.count({ where: { monthlySummaryEnabled: true } }),
      prisma.subscription.count({ where: { source: { in: ["gmail_import", "pasted_email"] } } }),
      prisma.ignoredImportCandidate.count(),
      prisma.importFeedback.count(),
      prisma.subscription.count({
        where: {
          source: { in: ["gmail_import", "pasted_email"] },
          confidence: { lt: 0.5 },
        },
      }),
      prisma.cancellationRequest.count(),
      prisma.cancellationRequest.count({ where: { status: "awaiting_confirmation" } }),
      prisma.cancellationRequest.count({
        where: {
          status: "awaiting_confirmation",
          sentAt: { lt: sevenDaysAgoForCancellations },
        },
      }),
      prisma.cancellationRequest.count({ where: { status: "confirmed_cancelled" } }),
      prisma.cancellationRequest.count({ where: { status: "manual_required" } }),
      prisma.cancellationRequest.count({ where: { status: "rejected" } }),
      prisma.importFeedback.groupBy({
        by: ["issueType"],
        _count: { issueType: true },
        orderBy: { _count: { issueType: "desc" } },
        take: 5,
      }),
      prisma.importFeedback.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          merchantName: true,
          normalizedName: true,
          amount: true,
          confidenceScore: true,
          issueType: true,
          comment: true,
          sourceProvider: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
        },
      }),
      prisma.betaRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          message: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          emailVerified: true,
          plan: true,
          passwordHash: true,
          accounts: { select: { provider: true } },
          _count: { select: { subscriptions: true } },
        },
      }),
      prisma.feedback.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          email: true,
          message: true,
          rating: true,
          page: true,
          reviewedAt: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
        },
      }),
    ]);

    const metrics = [
      ["Totalt brukere", totalUsers],
      ["Nye brukere siste 7 dager", recentUsers],
      ["Totalt abonnementer", totalSubscriptions],
      ["Aktive abonnementer", activeSubscriptions],
      ["Avsluttede abonnementer", cancelledSubscriptions],
      ["Google-kontoer", totalGoogleAccounts],
      ["E-post/passord-brukere", emailPasswordUsers],
      ["Gmail tilkoblet", gmailConnectedUsers],
      ["E-postvarsler aktivert", emailRemindersEnabledCount],
      ["Import-funn lagret", confirmedImportCandidatesCount],
      ["Import-funn ignorert", ignoredImportCandidatesCount],
      ["Feilrapporterte funn", wrongImportReportsCount],
      ["Lav tillit lagret", lowConfidenceConfirmedCount],
      ["Oppsigelser startet", totalCancellationRequests],
      ["Venter bekreftelse", awaitingCancellationRequests],
      ["Venter over 7 dager", staleAwaitingCancellationRequests],
      ["Bekreftet avsluttet", confirmedCancellationRequests],
      ["Krever manuell handling", manualCancellationRequests],
      ["Avvist", rejectedCancellationRequests],
      ["Månedsoppsummering aktivert", monthlySummaryEnabledCount],
    ];

    return (
      <main className="min-h-screen bg-[#F0F4F8] text-[#0D1B2A]">
        <AppHeader adminSection maxWidthClassName="max-w-7xl" />

        <section className="mx-auto max-w-7xl px-5 py-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Admin</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Produktoversikt</h1>
            <p className="mt-2 text-sm text-[#5F6F82]">
              Sikker beta-administrasjon for brukere, abonnementer og systemstatus.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {metrics.map(([label, value]) => (
              <MetricCard key={label} label={String(label)} value={String(value)} />
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.42fr]">
            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DBE4EE]">
              <div className="border-b border-[#DBE4EE] p-5">
                <h2 className="text-lg font-extrabold tracking-tight">Siste 50 brukere</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-[#F7F9FC] text-xs uppercase tracking-wide text-[#5F6F82]">
                    <tr>
                      <th className="px-4 py-3">Bruker</th>
                      <th className="px-4 py-3">Opprettet</th>
                      <th className="px-4 py-3">Verifisert</th>
                      <th className="px-4 py-3">Providers</th>
                      <th className="px-4 py-3">Abonnementer</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Detaljer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DBE4EE]">
                    {latestUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="px-4 py-3">
                          <p className="font-bold">{user.name ?? "Uten navn"}</p>
                          <p className="text-[#5F6F82]">{user.email ?? "Ingen e-post"}</p>
                        </td>
                        <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3">{user.emailVerified ? "Ja" : "Nei"}</td>
                        <td className="px-4 py-3">{formatProviders(user.accounts, Boolean(user.passwordHash))}</td>
                        <td className="px-4 py-3">{user._count.subscriptions}</td>
                        <td className="px-4 py-3">{user.plan}</td>
                        <td className="px-4 py-3">
                          <Link className="font-bold text-[#C8102E] hover:underline" href={`/admin/users/${user.id}`}>
                            Åpne
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid gap-5">
              <AdminHealthPanel
                databaseConnected
                userCount={totalUsers}
                subscriptionCount={totalSubscriptions}
              />
              <ImportQualityPanel
                ignoredCount={ignoredImportCandidatesCount}
                issueTypeCounts={importIssueTypeCounts}
                latestReports={latestImportFeedback}
                lowConfidenceConfirmedCount={lowConfidenceConfirmedCount}
                savedCount={confirmedImportCandidatesCount}
                wrongReportsCount={wrongImportReportsCount}
              />
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
                <h2 className="text-lg font-extrabold tracking-tight">Beta-forespørsler</h2>
                <div className="mt-4 grid gap-3">
                  {latestBetaRequests.length > 0 ? (
                    latestBetaRequests.map((request) => (
                      <div className="rounded-xl bg-[#F7F9FC] p-4 text-sm" key={request.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{request.name ?? "Uten navn"}</p>
                            <p className="text-[#5F6F82]">{request.email}</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-[#5F6F82]">
                            {formatBetaStatus(request.status)}
                          </span>
                        </div>
                        {request.message ? (
                          <p className="mt-2 line-clamp-4 text-[#4A5568]">{request.message}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-[#5F6F82]">
                          {formatDate(request.createdAt)}
                          {request.reviewedAt ? ` · vurdert ${formatDate(request.reviewedAt)}` : ""}
                        </p>
                        {request.status === "pending" ? (
                          <AdminBetaRequestActions requestId={request.id} />
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl bg-[#F7F9FC] p-4 text-sm text-[#5F6F82]">
                      Ingen beta-forespørsler ennå.
                    </p>
                  )}
                </div>
              </section>
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
                <h2 className="text-lg font-extrabold tracking-tight">Siste tilbakemeldinger</h2>
                <div className="mt-4 grid gap-3">
                  {latestFeedback.length > 0 ? (
                    latestFeedback.map((feedback) => (
                      <div className="rounded-xl bg-[#F7F9FC] p-4 text-sm" key={feedback.id}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bold">
                            {feedback.user?.name ?? feedback.user?.email ?? feedback.email ?? "Anonym"}
                          </p>
                          <span className="text-xs font-semibold text-[#5F6F82]">
                            {feedback.rating ? `${feedback.rating}/5` : "Ingen rating"}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-4 text-[#4A5568]">{feedback.message}</p>
                        <p className="mt-2 text-xs text-[#5F6F82]">
                          {formatDate(feedback.createdAt)}
                          {feedback.page ? ` · ${feedback.page}` : ""}
                          {feedback.reviewedAt ? " · lest" : ""}
                        </p>
                        {!feedback.reviewedAt ? <AdminFeedbackActions feedbackId={feedback.id} /> : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl bg-[#F7F9FC] p-4 text-sm text-[#5F6F82]">
                      Ingen tilbakemeldinger ennå.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    logAdminError("admin:data", error, adminUser.id);
    return <AdminLoadError />;
  }
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <p className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function AdminHealthPanel({
  databaseConnected,
  userCount,
  subscriptionCount,
}: {
  databaseConnected: boolean;
  userCount: number;
  subscriptionCount: number;
}) {
  const authConfigured = Boolean(process.env.NEXTAUTH_URL && process.env.NEXTAUTH_SECRET);
  const healthRows = [
    ["Database", databaseConnected ? "Tilkoblet" : "Feil"],
    ["E-post", isSmtpConfigured() ? "Konfigurert" : "Mangler"],
    ["Cron", isCronConfigured() ? "Konfigurert" : "Mangler"],
    ["Auth", authConfigured ? "Konfigurert" : "Mangler"],
    ["Session", sessionStrategy],
    ["Brukere", String(userCount)],
    ["Abonnementer", String(subscriptionCount)],
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <h2 className="text-lg font-extrabold tracking-tight">Systemstatus</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        {healthRows.map(([label, value]) => (
          <div className="flex items-center justify-between gap-4" key={label}>
            <dt className="font-semibold text-[#5F6F82]">{label}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ImportQualityPanel({
  savedCount,
  ignoredCount,
  wrongReportsCount,
  lowConfidenceConfirmedCount,
  issueTypeCounts,
  latestReports,
}: {
  savedCount: number;
  ignoredCount: number;
  wrongReportsCount: number;
  lowConfidenceConfirmedCount: number;
  issueTypeCounts: { issueType: string; _count: { issueType: number } }[];
  latestReports: {
    id: string;
    merchantName: string | null;
    normalizedName: string | null;
    amount: number | null;
    confidenceScore: number | null;
    issueType: string;
    comment: string | null;
    sourceProvider: string;
    createdAt: Date;
    user: { email: string | null; name: string | null } | null;
  }[];
}) {
  const qualityRows = [
    ["Lagrede importfunn", savedCount],
    ["Ignorerte funn", ignoredCount],
    ["Rapportert feil", wrongReportsCount],
    ["Lagret med lav tillit", lowConfidenceConfirmedCount],
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <h2 className="text-lg font-extrabold tracking-tight">Importkvalitet</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        {qualityRows.map(([label, value]) => (
          <div className="flex items-center justify-between gap-4" key={label}>
            <dt className="font-semibold text-[#5F6F82]">{label}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">Vanligste feil</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {issueTypeCounts.length > 0 ? (
            issueTypeCounts.map((issue) => (
              <span
                className="rounded-full bg-[#F7F9FC] px-3 py-1 text-xs font-bold text-[#4A5568]"
                key={issue.issueType}
              >
                {formatImportIssue(issue.issueType)}: {issue._count.issueType}
              </span>
            ))
          ) : (
            <span className="text-sm text-[#5F6F82]">Ingen feilrapporter ennå.</span>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">Siste rapporter</p>
        <div className="mt-3 grid gap-3">
          {latestReports.length > 0 ? (
            latestReports.map((report) => (
              <div className="rounded-xl bg-[#F7F9FC] p-3 text-sm" key={report.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {report.merchantName ?? report.normalizedName ?? "Ukjent leverandør"}
                    </p>
                    <p className="text-xs text-[#5F6F82]">
                      {formatImportIssue(report.issueType)} · {report.sourceProvider}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#5F6F82]">
                    {report.confidenceScore ?? "-"}%
                  </span>
                </div>
                {report.comment ? (
                  <p className="mt-2 line-clamp-3 text-[#4A5568]">{report.comment}</p>
                ) : null}
                <p className="mt-2 text-xs text-[#5F6F82]">
                  {formatDate(report.createdAt)}
                  {report.user?.email ? ` · ${report.user.email}` : ""}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-xl bg-[#F7F9FC] p-4 text-sm text-[#5F6F82]">
              Ingen rapporterte importfunn ennå.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function AdminForbidden() {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">403</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Du har ikke tilgang til admin.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6F82]">
          Logg inn med en e-postadresse som er lagt inn i ADMIN_EMAILS.
        </p>
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

function formatBetaStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "Venter",
    approved: "Godkjent",
    rejected: "Avvist",
  };

  return labels[status] ?? status;
}

function formatImportIssue(issueType: string) {
  const labels: Record<string, string> = {
    wrong_amount: "Feil beløp",
    wrong_merchant: "Feil leverandør",
    not_subscription: "Ikke abonnement",
    duplicate: "Duplikat",
    other: "Annet",
  };

  return labels[issueType] ?? issueType;
}

function formatProviders(accounts: { provider: string }[], hasPassword: boolean) {
  const providers = new Set(accounts.map((account) => account.provider));

  if (hasPassword) {
    providers.add("email");
  }

  return Array.from(providers).sort().join(", ") || "Ingen";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function logAdminError(route: string, error: unknown, userId?: string) {
  const safeError =
    error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  console.error("[admin]", { route, userId, ...safeError });
}
