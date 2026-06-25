import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { AdminProviderCatalog } from "@/components/admin/AdminProviderCatalog";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AdminForbiddenError, requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getCancellationGuideCoverage } from "@/lib/provider-cancellation-guide.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leverandørkatalog", robots: { index: false, follow: false } };

export default async function AdminProvidersPage() {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof AdminForbiddenError) {
      return <AdminMessage title="Du har ikke tilgang til admin." />;
    }
    return <AdminMessage title="Kunne ikke laste leverandørkatalogen." />;
  }

  const [providers, unmatchedSignals] = await Promise.all([
    prisma.subscriptionProvider.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { subscriptions: true } },
        logoAssets: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: {
            id: true,
            sourceWebsite: true,
            sourceUrl: true,
            contentType: true,
            byteSize: true,
            blobUrl: true,
            status: true,
            fetchedAt: true,
            approvedAt: true,
            rejectedAt: true,
          },
        },
      },
    }),
    prisma.unmatchedProviderSignal.findMany({
      orderBy: [{ count: "desc" }, { lastSeenAt: "desc" }],
      take: 50,
      select: { id: true, displayName: true, source: true, count: true, lastSeenAt: true },
    }),
  ]);

  const coverage = getCancellationGuideCoverage(providers);
  return (
    <main className="min-h-screen bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader adminSection maxWidthClassName="max-w-7xl" />
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Admin</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Leverandørkatalog</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F6F82]">
              Vedlikehold navn, søkeord, avsenderdomener, lenker og tilgjengelighet.
            </p>
          </div>
          <Link className="text-sm font-bold text-[#C8102E] hover:underline" href="/admin">Til produktoversikt</Link>
        </div>
        <AdminProviderCatalog
          initialProviders={providers.map(serializeProvider)}
          unmatchedSignals={unmatchedSignals.map((signal) => ({
            ...signal,
            lastSeenAt: signal.lastSeenAt.toISOString(),
          }))}
          coverage={{
            complete: coverage.withCompleteGuides.map(toCoverageItem),
            missing: coverage.missingGuides.map(toCoverageItem),
            missingLogos: coverage.missingLogos.map(toCoverageItem),
            stale: coverage.staleGuides.map(toCoverageItem),
            mostUsed: [...providers]
              .sort((a, b) => b._count.subscriptions - a._count.subscriptions)
              .slice(0, 10)
              .map(toCoverageItem),
          }}
        />
      </section>
    </main>
  );
}

type ProviderWithCount = Prisma.SubscriptionProviderGetPayload<{
  include: {
    _count: { select: { subscriptions: true } };
    logoAssets: {
      select: {
        id: true;
        sourceWebsite: true;
        sourceUrl: true;
        contentType: true;
        byteSize: true;
        blobUrl: true;
        status: true;
        fetchedAt: true;
        approvedAt: true;
        rejectedAt: true;
      };
    };
  };
}>;

function serializeProvider(provider: ProviderWithCount) {
  const latestLogoAsset = provider.logoAssets[0] ?? null;
  return {
    ...provider,
    _count: undefined,
    logoAssets: undefined,
    latestLogoAsset: latestLogoAsset
      ? {
          ...latestLogoAsset,
          fetchedAt: latestLogoAsset.fetchedAt.toISOString(),
          approvedAt: latestLogoAsset.approvedAt?.toISOString() ?? null,
          rejectedAt: latestLogoAsset.rejectedAt?.toISOString() ?? null,
        }
      : null,
    lastVerifiedAt: provider.lastVerifiedAt?.toISOString() ?? null,
    sendingVerifiedAt: provider.sendingVerifiedAt?.toISOString() ?? null,
  };
}

function toCoverageItem(provider: ProviderWithCount) {
  return { id: provider.id, name: provider.name, subscriptionCount: provider._count.subscriptions };
}

function AdminMessage({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <Link className="mt-5 inline-flex rounded-xl bg-[#0D1B2A] px-5 py-3 text-sm font-bold text-white" href="/dashboard">Til oversikten</Link>
      </section>
    </main>
  );
}
