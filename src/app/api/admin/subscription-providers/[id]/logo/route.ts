import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { logAdminAudit } from "@/lib/admin-audit";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { importProviderLogo, ProviderLogoImportError } from "@/lib/provider-logo-importer.mjs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const admin = await getCurrentUser();
  if (!admin) return unauthorizedResponse();
  if (!isAdminUser(admin)) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await context.params;
  const assetId = new URL(request.url).searchParams.get("assetId");
  const asset = await prisma.subscriptionProviderLogo.findFirst({
    where: { providerId: id, ...(assetId ? { id: assetId } : {}) },
    orderBy: { fetchedAt: "desc" },
  });
  if (!asset) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  return new NextResponse(asset.data, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.byteSize),
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const admin = await getCurrentUser();
  if (!admin) return unauthorizedResponse();
  if (!isAdminUser(admin)) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await context.params;
  const payload = await request.json().catch(() => ({}));
  const action = typeof payload.action === "string" ? payload.action : "";
  const provider = await prisma.subscriptionProvider.findUnique({
    where: { id },
    select: { id: true, slug: true, websiteUrl: true },
  });
  if (!provider) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (action === "fetch" || action === "refetch") {
    if (!provider.websiteUrl) {
      return NextResponse.json(
        { ok: false, error: "WEBSITE_REQUIRED", message: "Leverandøren mangler verifisert nettside." },
        { status: 400 },
      );
    }
    try {
      const imported = await importProviderLogo(provider.websiteUrl);
      const asset = await prisma.subscriptionProviderLogo.create({
        data: {
          providerId: provider.id,
          sourceUrl: imported.sourceUrl,
          contentType: imported.contentType,
          byteSize: imported.byteSize,
          data: imported.data,
          status: "pending",
        },
        select: assetMetadataSelect,
      });
      await logAdminAudit({
        adminUserId: admin.id,
        action: "subscription_provider_logo_fetched",
        metadata: { providerId: provider.id, assetId: asset.id, sourceHost: new URL(asset.sourceUrl).hostname },
      });
      return NextResponse.json({ ok: true, asset: serializeAsset(asset) }, { status: 201 });
    } catch (error) {
      const code = error instanceof ProviderLogoImportError ? error.code : "FETCH_FAILED";
      return NextResponse.json(
        { ok: false, error: code, message: "Kunne ikke hente et trygt leverandørikon." },
        { status: 422 },
      );
    }
  }

  const assetId = typeof payload.assetId === "string" ? payload.assetId : "";
  const asset = assetId
    ? await prisma.subscriptionProviderLogo.findFirst({ where: { id: assetId, providerId: provider.id } })
    : null;
  if (!asset) return NextResponse.json({ ok: false, error: "ASSET_NOT_FOUND" }, { status: 404 });

  if (action === "approve") {
    const logoPath = `/api/provider-logos/${asset.id}`;
    await prisma.$transaction([
      prisma.subscriptionProviderLogo.updateMany({
        where: { providerId: provider.id, status: "approved", id: { not: asset.id } },
        data: { status: "rejected", rejectedAt: new Date() },
      }),
      prisma.subscriptionProviderLogo.update({
        where: { id: asset.id },
        data: { status: "approved", approvedAt: new Date(), approvedBy: admin.id, rejectedAt: null },
      }),
      prisma.subscriptionProvider.update({ where: { id: provider.id }, data: { logoPath } }),
    ]);
    await logAdminAudit({
      adminUserId: admin.id,
      action: "subscription_provider_logo_approved",
      metadata: { providerId: provider.id, assetId: asset.id },
    });
    return NextResponse.json({ ok: true, logoPath, status: "approved" });
  }

  if (action === "reject") {
    await prisma.$transaction([
      prisma.subscriptionProviderLogo.update({
        where: { id: asset.id },
        data: { status: "rejected", rejectedAt: new Date() },
      }),
      ...(providerLogoPathMatches(asset.id, await getProviderLogoPath(provider.id))
        ? [prisma.subscriptionProvider.update({ where: { id: provider.id }, data: { logoPath: null } })]
        : []),
    ]);
    await logAdminAudit({
      adminUserId: admin.id,
      action: "subscription_provider_logo_rejected",
      metadata: { providerId: provider.id, assetId: asset.id },
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
}

async function getProviderLogoPath(providerId: string) {
  const provider = await prisma.subscriptionProvider.findUnique({ where: { id: providerId }, select: { logoPath: true } });
  return provider?.logoPath ?? null;
}

function providerLogoPathMatches(assetId: string, logoPath: string | null) {
  return logoPath === `/api/provider-logos/${assetId}`;
}

const assetMetadataSelect = {
  id: true,
  sourceUrl: true,
  contentType: true,
  byteSize: true,
  status: true,
  fetchedAt: true,
  approvedAt: true,
  rejectedAt: true,
} as const;

function serializeAsset(asset: {
  id: string;
  sourceUrl: string;
  contentType: string;
  byteSize: number;
  status: string;
  fetchedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
}) {
  return {
    ...asset,
    fetchedAt: asset.fetchedAt.toISOString(),
    approvedAt: asset.approvedAt?.toISOString() ?? null,
    rejectedAt: asset.rejectedAt?.toISOString() ?? null,
  };
}
