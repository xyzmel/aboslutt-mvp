import { AppHeader } from "@/components/navigation/AppHeader";
import { AdminForbiddenError, requireAdminUser } from "@/lib/admin";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AuditLogRow = {
  id: string;
  action: string;
  metadataJson: string | null;
  createdAt: Date;
  adminUser: { email: string | null; name: string | null };
  targetUser: { email: string | null; name: string | null } | null;
};

export default async function AdminAuditPage() {
  let auditLogs: AuditLogRow[];

  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof AdminForbiddenError) {
      return <AdminForbidden />;
    }

    logger.error("[admin-audit]", { route: "admin/audit:auth", error });
    return <AdminLoadError />;
  }

  try {
    auditLogs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        metadataJson: true,
        createdAt: true,
        adminUser: { select: { email: true, name: true } },
        targetUser: { select: { email: true, name: true } },
      },
    });
  } catch (error) {
    logger.error("[admin-audit]", { route: "admin/audit:data", error });
    return <AdminLoadError />;
  }

  return <AdminAuditScreen auditLogs={auditLogs} />;
}

function AdminAuditScreen({ auditLogs }: { auditLogs: AuditLogRow[] }) {
  return (
    <main className="min-h-screen bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader adminSection maxWidthClassName="max-w-7xl" />

      <section className="mx-auto max-w-7xl px-5 py-8">
        <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Admin</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Audit logg</h1>
        <p className="mt-2 text-sm text-[#5F6F82]">
          Siste 100 adminhandlinger. Secrets, tokens og passordhash skal aldri logges her.
        </p>

        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DBE4EE]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#F7F9FC] text-xs uppercase tracking-wide text-[#5F6F82]">
                <tr>
                  <th className="px-4 py-3">Dato</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Handling</th>
                  <th className="px-4 py-3">Mål</th>
                  <th className="px-4 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBE4EE]">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      {log.adminUser.name ?? log.adminUser.email ?? "Ukjent admin"}
                    </td>
                    <td className="px-4 py-3 font-bold">{log.action}</td>
                    <td className="px-4 py-3">
                      {log.targetUser?.name ?? log.targetUser?.email ?? "Ikke satt"}
                    </td>
                    <td className="px-4 py-3 text-[#5F6F82]">{formatMetadata(log.metadataJson)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {auditLogs.length === 0 ? (
            <p className="p-5 text-sm text-[#5F6F82]">Ingen audit entries ennå.</p>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function formatMetadata(metadataJson: string | null) {
  if (!metadataJson) {
    return "";
  }

  try {
    return JSON.stringify(JSON.parse(metadataJson));
  } catch {
    return "";
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function AdminForbidden() {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">403</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Du har ikke tilgang til admin.</h1>
      </section>
    </main>
  );
}

function AdminLoadError() {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <h1 className="text-2xl font-extrabold tracking-tight">Kunne ikke laste audit-loggen.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6F82]">Prøv igjen senere.</p>
      </section>
    </main>
  );
}
