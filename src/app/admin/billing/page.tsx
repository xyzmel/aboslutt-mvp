/* eslint-disable react-hooks/error-boundaries */
import Link from "next/link";
import { AdminBillingReconcileButton } from "@/components/admin/AdminBillingActions";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AdminForbiddenError, requireAdminUser } from "@/lib/admin";
import { getAgreement, isVippsRecurringConfigured } from "@/lib/billing/vipps-recurring";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BillingDiagnosticRow = {
  id: string;
  reference: string;
  providerAgreementId: string | null;
  localStatus: string;
  vippsStatus: string;
  safeError: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastEvent: {
    eventType: string;
    createdAt: Date;
  } | null;
  userEmail: string | null;
};

export default async function AdminBillingPage() {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof AdminForbiddenError) {
      return <AdminForbidden />;
    }

    logger.error("[admin:billing:auth]", { error });
    return <AdminLoadError />;
  }

  try {
    const agreements = await prisma.billingAgreement.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        reference: true,
        providerAgreementId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { email: true } },
      },
    });

    const events = await prisma.billingEvent.findMany({
      where: { reference: { in: agreements.map((agreement) => agreement.reference) } },
      orderBy: { createdAt: "desc" },
      select: {
        reference: true,
        eventType: true,
        createdAt: true,
      },
      take: 100,
    });

    const latestEventByReference = new Map<string, { eventType: string; createdAt: Date }>();

    for (const event of events) {
      if (event.reference && !latestEventByReference.has(event.reference)) {
        latestEventByReference.set(event.reference, {
          eventType: event.eventType,
          createdAt: event.createdAt,
        });
      }
    }

    const rows = await Promise.all(
      agreements.map(async (agreement) => {
        const vippsStatusResult = await getSafeVippsStatus(agreement.providerAgreementId);

        return {
          id: agreement.id,
          reference: agreement.reference,
          providerAgreementId: agreement.providerAgreementId,
          localStatus: agreement.status,
          vippsStatus: vippsStatusResult.status,
          safeError: vippsStatusResult.error,
          createdAt: agreement.createdAt,
          updatedAt: agreement.updatedAt,
          lastEvent: latestEventByReference.get(agreement.reference) ?? null,
          userEmail: agreement.user.email,
        } satisfies BillingDiagnosticRow;
      }),
    );

    return (
      <main className="min-h-screen bg-[#F0F4F8] text-[#0D1B2A]">
        <AppHeader adminSection maxWidthClassName="max-w-7xl" />

        <section className="mx-auto max-w-7xl px-5 py-8">
          <Link className="text-sm font-bold text-[#C8102E] hover:underline" href="/admin">
            Tilbake til admin
          </Link>

          <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE] sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Vipps billing</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Billing-diagnostikk</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5F6F82]">
                Viser trygge avtaledata og siste webhookstatus. Bruk avstemming for å sjekke Vipps server-side og
                oppdatere lokale pending-avtaler uten å stole på frontend state.
              </p>
            </div>
            <AdminBillingReconcileButton />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Vipps config" value={isVippsRecurringConfigured() ? "Til stede" : "Mangler"} />
            <MetricCard
              label="Pending eldre enn 10 min"
              value={String(rows.filter((row) => row.localStatus === "pending" && isOlderThanTenMinutes(row.createdAt)).length)}
            />
            <MetricCard label="Siste avtaler" value={String(rows.length)} />
          </div>

          <section className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DBE4EE]">
            <div className="border-b border-[#DBE4EE] p-5">
              <h2 className="text-lg font-extrabold tracking-tight">Avtaler</h2>
              <p className="mt-1 text-sm text-[#5F6F82]">
                Ingen secrets, tokens, auth-headere eller full rå payload vises her.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-[#F7F9FC] text-xs uppercase tracking-wide text-[#5F6F82]">
                  <tr>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Bruker</th>
                    <th className="px-4 py-3">Lokal status</th>
                    <th className="px-4 py-3">Vipps status</th>
                    <th className="px-4 py-3">Opprettet</th>
                    <th className="px-4 py-3">Oppdatert</th>
                    <th className="px-4 py-3">Siste event</th>
                    <th className="px-4 py-3">Feil</th>
                    <th className="px-4 py-3">Handling</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBE4EE]">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold">{row.reference}</p>
                        <p className="mt-1 text-xs text-[#5F6F82]">
                          {row.providerAgreementId ? "Vipps agreement registrert" : "Mangler Vipps agreement"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{row.userEmail ?? "Ingen e-post"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={row.localStatus} />
                      </td>
                      <td className="px-4 py-3">{row.vippsStatus}</td>
                      <td className="px-4 py-3">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3">{formatDateTime(row.updatedAt)}</td>
                      <td className="px-4 py-3">
                        {row.lastEvent ? (
                          <span>
                            {row.lastEvent.eventType}
                            <br />
                            <span className="text-xs text-[#5F6F82]">{formatDateTime(row.lastEvent.createdAt)}</span>
                          </span>
                        ) : (
                          "Ingen event"
                        )}
                      </td>
                      <td className="px-4 py-3">{row.safeError ?? "Ingen"}</td>
                      <td className="px-4 py-3">
                        <AdminBillingReconcileButton agreementId={row.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 ? (
              <p className="p-5 text-sm text-[#5F6F82]">Ingen billing-avtaler registrert.</p>
            ) : null}
          </section>
        </section>
      </main>
    );
  } catch (error) {
    logger.error("[admin:billing:data]", { error });
    return <AdminLoadError />;
  }
}

async function getSafeVippsStatus(providerAgreementId: string | null) {
  if (!providerAgreementId) {
    return { status: "Mangler agreement id", error: null };
  }

  if (!isVippsRecurringConfigured()) {
    return { status: "Ikke sjekket", error: "PAYMENTS_NOT_CONFIGURED" };
  }

  try {
    const payload = await getAgreement(providerAgreementId);

    if (typeof payload === "object" && payload !== null && "status" in payload) {
      const status = (payload as { status?: unknown }).status;
      return { status: typeof status === "string" ? status : "Ukjent", error: null };
    }

    return { status: "Ukjent", error: null };
  } catch (error) {
    logger.warn("[admin:billing:vipps-status]", { error });
    return { status: "Kunne ikke sjekke", error: error instanceof Error ? error.name : "UNKNOWN_ERROR" };
  }
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-[#F7F9FC] px-3 py-1 text-xs font-bold text-[#0D1B2A] ring-1 ring-[#DBE4EE]">
      {value}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <p className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
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
        <h1 className="text-2xl font-extrabold tracking-tight">Kunne ikke laste billing-diagnostikk.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6F82]">Prøv igjen senere.</p>
      </section>
    </main>
  );
}

function isOlderThanTenMinutes(date: Date) {
  return date.getTime() < Date.now() - 10 * 60_000;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
