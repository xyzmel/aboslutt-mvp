/* eslint-disable react-hooks/error-boundaries */
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AdminForbiddenError, requireAdminUser } from "@/lib/admin";
import { formatSubscriptionDateForDisplay } from "@/lib/subscription-dates";
import { prisma } from "@/lib/prisma";

type AdminUserDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof AdminForbiddenError) {
      return <AdminForbidden />;
    }

    logAdminError("admin:user:auth", error);
    return <AdminLoadError />;
  }

  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        emailVerified: true,
        plan: true,
        emailRemindersEnabled: true,
        reminderDaysBefore: true,
        monthlySummaryEnabled: true,
        passwordHash: true,
        accounts: { select: { provider: true, scope: true } },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            monthlyCost: true,
            status: true,
            billingInterval: true,
            nextPayment: true,
            source: true,
            category: true,
          },
        },
        cancellationRequests: {
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            method: true,
            recipientEmail: true,
            customerEmail: true,
            sentAt: true,
            confirmedAt: true,
            rejectedAt: true,
            createdAt: true,
            subscription: { select: { name: true } },
            events: {
              orderBy: { createdAt: "asc" },
              select: { id: true, type: true, message: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!user) {
      notFound();
    }

    const providers = formatProviders(user.accounts, Boolean(user.passwordHash));
    const gmailConnected = user.accounts.some(
      (account) =>
        account.provider === "google" &&
        account.scope?.split(" ").includes("https://www.googleapis.com/auth/gmail.readonly"),
    );

    return (
      <main className="min-h-screen bg-[#F0F4F8] text-[#0D1B2A]">
        <AppHeader adminSection />

        <section className="mx-auto max-w-6xl px-5 py-8">
          <Link className="text-sm font-bold text-[#C8102E] hover:underline" href="/admin">
            Tilbake til admin
          </Link>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="grid gap-5">
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
                <h1 className="text-2xl font-extrabold tracking-tight">{user.name ?? "Uten navn"}</h1>
                <dl className="mt-5 grid gap-3 text-sm">
                  <InfoRow label="E-post" value={user.email ?? "Ingen e-post"} />
                  <InfoRow label="Opprettet" value={formatDate(user.createdAt)} />
                  <InfoRow label="E-post bekreftet" value={user.emailVerified ? "Ja" : "Nei"} />
                  <InfoRow label="Providers" value={providers} />
                  <InfoRow label="Gmail read-only" value={gmailConnected ? "Tilkoblet" : "Mangler"} />
                  <InfoRow label="Plan" value={user.plan} />
                  <InfoRow label="Abonnementer" value={String(user.subscriptions.length)} />
                </dl>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
                <h2 className="text-lg font-extrabold tracking-tight">Varselinnstillinger</h2>
                <dl className="mt-4 grid gap-3 text-sm">
                  <InfoRow
                    label="E-postvarsler"
                    value={user.emailRemindersEnabled ? "På" : "Av"}
                  />
                  <InfoRow label="Dager før trekk" value={String(user.reminderDaysBefore ?? 3)} />
                  <InfoRow
                    label="Månedsoppsummering"
                    value={user.monthlySummaryEnabled ? "På" : "Av"}
                  />
                </dl>
              </section>

              <AdminUserActions email={user.email} plan={user.plan} userId={user.id} />
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
                <h2 className="text-lg font-extrabold tracking-tight">Oppsigelser</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  {user.cancellationRequests.length > 0 ? (
                    user.cancellationRequests.map((request) => (
                      <div className="rounded-xl bg-[#F7F9FC] p-3" key={request.id}>
                        <p className="font-bold">{request.subscription.name}</p>
                        <p className="mt-1 text-[#5F6F82]">
                          {request.status} · {request.method} · {request.recipientEmail}
                        </p>
                        <p className="mt-1 text-xs text-[#5F6F82]">{formatDate(request.createdAt)}</p>
                        {request.events.length > 0 ? (
                          <ol className="mt-3 grid gap-2 border-t border-[#DBE4EE] pt-3">
                            {request.events.map((event) => (
                              <li key={event.id}>
                                <p className="text-xs font-bold text-[#0D1B2A]">{formatCancellationEvent(event.type)}</p>
                                <p className="mt-0.5 text-xs text-[#5F6F82]">
                                  {event.message} · {formatDate(event.createdAt)}
                                </p>
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-[#5F6F82]">Ingen oppsigelsesrequests.</p>
                  )}
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DBE4EE]">
              <div className="border-b border-[#DBE4EE] p-5">
                <h2 className="text-lg font-extrabold tracking-tight">Abonnementer</h2>
                <p className="mt-1 text-sm text-[#5F6F82]">
                  Viser trygge abonnementsfelt. Ingen tokens eller rå e-postinnhold.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-[#F7F9FC] text-xs uppercase tracking-wide text-[#5F6F82]">
                    <tr>
                      <th className="px-4 py-3">Navn</th>
                      <th className="px-4 py-3">Beløp</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Intervall</th>
                      <th className="px-4 py-3">Neste trekk</th>
                      <th className="px-4 py-3">Kilde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DBE4EE]">
                    {user.subscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <td className="px-4 py-3">
                          <p className="font-bold">{subscription.name}</p>
                          <p className="text-[#5F6F82]">{subscription.category}</p>
                        </td>
                        <td className="px-4 py-3">{subscription.monthlyCost} kr</td>
                        <td className="px-4 py-3">{subscription.status}</td>
                        <td className="px-4 py-3">{formatInterval(subscription.billingInterval)}</td>
                        <td className="px-4 py-3">
                          {formatSubscriptionDateForDisplay(subscription.nextPayment)}
                        </td>
                        <td className="px-4 py-3">{formatSource(subscription.source)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {user.subscriptions.length === 0 ? (
                <p className="p-5 text-sm text-[#5F6F82]">Brukeren har ingen abonnementer.</p>
              ) : null}
            </section>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    logAdminError("admin:user:data", error);
    return <AdminLoadError />;
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="font-semibold text-[#5F6F82]">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
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

function formatProviders(accounts: { provider: string }[], hasPassword: boolean) {
  const providers = new Set(accounts.map((account) => account.provider));

  if (hasPassword) {
    providers.add("email");
  }

  return Array.from(providers).sort().join(", ") || "Ingen";
}

function formatInterval(interval: string) {
  if (interval === "monthly") {
    return "Månedlig";
  }

  if (interval === "yearly") {
    return "Årlig";
  }

  return "Ukjent";
}

function formatSource(source: string | null) {
  if (source === "gmail_import") {
    return "Gmail";
  }

  if (source === "google") {
    return "Google";
  }

  if (source === "vipps") {
    return "Vipps";
  }

  if (source === "demo" && process.env.NODE_ENV !== "production") {
    return "Demo";
  }

  return "Manuell";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCancellationEvent(type: string) {
  const labels: Record<string, string> = {
    draft_created: "Utkast opprettet",
    ready: "Klar til sending",
    email_sent: "Sendt på vegne av bruker",
    awaiting_confirmation: "Venter på bekreftelse",
    confirmed_cancelled: "Bekreftet avsluttet",
    rejected: "Avvist",
    manual_required: "Krever manuell handling",
    note_added: "Notat",
  };

  return labels[type] ?? type;
}

function logAdminError(route: string, error: unknown, userId?: string) {
  const safeError =
    error instanceof Error ? { name: error.name, message: error.message } : { message: "Ukjent feil" };
  console.error("[admin]", { route, userId, ...safeError });
}
