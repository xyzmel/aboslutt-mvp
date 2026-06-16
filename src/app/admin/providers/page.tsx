import Link from "next/link";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/navigation/AppHeader";
import { cancellationProviders, getCancellationMethodLabel } from "@/data/cancellation-providers";
import { AdminForbiddenError, requireAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof AdminForbiddenError) {
      return <AdminForbidden />;
    }

    return <AdminLoadError />;
  }

  return (
    <main className="min-h-screen bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader adminSection maxWidthClassName="max-w-7xl" />
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Admin</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Leverandørkatalog</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F6F82]">
              Statisk katalog over kjente oppsigelsesmetoder. E-postadresser skal bare legges inn når de er bekreftet.
            </p>
          </div>
          <Link className="text-sm font-bold text-[#C8102E] hover:underline" href="/admin">
            Til produktoversikt
          </Link>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DBE4EE]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#F7F9FC] text-xs uppercase tracking-wide text-[#5F6F82]">
                <tr>
                  <th className="px-4 py-3">Leverandør</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3">Tillit</th>
                  <th className="px-4 py-3">Krever</th>
                  <th className="px-4 py-3">Lenker</th>
                  <th className="px-4 py-3">Notat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBE4EE]">
                {cancellationProviders.map((provider) => (
                  <tr key={provider.id}>
                    <td className="px-4 py-3">
                      <p className="font-bold">{provider.displayName}</p>
                      <p className="mt-1 text-xs text-[#5F6F82]">{provider.normalizedNames.join(", ")}</p>
                    </td>
                    <td className="px-4 py-3">{provider.category}</td>
                    <td className="px-4 py-3">{getCancellationMethodLabel(provider.method)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          provider.confidence === "verified"
                            ? "bg-[#E7F6ED] text-[#17633A]"
                            : "bg-[#FFF6E8] text-[#8A4B13]"
                        }`}
                      >
                        {provider.confidence === "verified" ? "Verifisert" : "Må sjekkes"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {provider.requiresLogin ? <Tag>Innlogging</Tag> : null}
                        {provider.requiresCustomerNumber ? <Tag>Kundenummer</Tag> : null}
                        {!provider.requiresLogin && !provider.requiresCustomerNumber ? <span className="text-[#5F6F82]">Ingen kjente</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid gap-1">
                        {provider.cancellationEmail ? <span>{provider.cancellationEmail}</span> : null}
                        {provider.cancellationUrl ? (
                          <Link className="font-bold text-[#C8102E] hover:underline" href={provider.cancellationUrl}>
                            Oppsigelse
                          </Link>
                        ) : null}
                        {provider.supportUrl ? (
                          <Link className="font-bold text-[#C8102E] hover:underline" href={provider.supportUrl}>
                            Support
                          </Link>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-[#4A5568]">{provider.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-[#F7F9FC] px-3 py-1 text-xs font-bold text-[#5F6F82]">{children}</span>;
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
        <h1 className="text-2xl font-extrabold tracking-tight">Kunne ikke laste leverandørkatalogen.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6F82]">Prøv igjen senere.</p>
      </section>
    </main>
  );
}
