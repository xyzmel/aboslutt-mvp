import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { logAdminAudit } from "@/lib/admin-audit";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import {
  fetchProviderLogoSource,
  importProviderLogo,
  ProviderLogoImportError,
  validateIconResponse,
} from "@/lib/provider-logo-importer.mjs";
import {
  deleteProviderLogoBlob,
  extensionForContentType,
  isManagedProviderLogoBlob,
  uploadProviderLogo,
} from "@/lib/provider-logo-storage.mjs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const admin = await getAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const assetId = new URL(request.url).searchParams.get("assetId");
  const asset = await prisma.subscriptionProviderLogo.findFirst({
    where: { providerId: id, ...(assetId ? { id: assetId } : {}) },
    orderBy: { fetchedAt: "desc" },
    include: { provider: { select: { websiteUrl: true } } },
  });
  if (!asset) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (asset.blobUrl && asset.status === "approved") {
    return NextResponse.redirect(asset.blobUrl);
  }
  if (!asset.provider.websiteUrl) return websiteRequiredResponse();

  try {
    const image = await fetchProviderLogoSource(asset.sourceUrl, asset.provider.websiteUrl);
    return imageResponse(image.data, image.contentType);
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_IMAGE", message: "Filen vi fant var ikke et gyldig bilde." },
      { status: 422 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const admin = await getAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const provider = await prisma.subscriptionProvider.findUnique({
    where: { id },
    select: { id: true, slug: true, websiteUrl: true, logoPath: true },
  });
  if (!provider) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.startsWith("multipart/form-data")) {
    return uploadManualLogo(request, provider, admin.id);
  }

  const payload = await request.json().catch(() => ({}));
  const action = typeof payload.action === "string" ? payload.action : "";

  if (action === "fetch" || action === "refetch" || action === "stage") {
    if (!provider.websiteUrl) return websiteRequiredResponse();
    try {
      const imported = action === "stage" && typeof payload.sourceUrl === "string"
        ? await fetchProviderLogoSource(payload.sourceUrl, provider.websiteUrl)
        : await importProviderLogo(provider.websiteUrl);
      const asset = await prisma.subscriptionProviderLogo.create({
        data: {
          providerId: provider.id,
          sourceWebsite: provider.websiteUrl,
          sourceUrl: imported.sourceUrl,
          contentType: imported.contentType,
          byteSize: imported.byteSize,
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
      return logoImportErrorResponse(error);
    }
  }

  if (action === "remove") {
    const previousLogo = provider.logoPath;
    await prisma.subscriptionProvider.update({ where: { id: provider.id }, data: { logoPath: null } });
    if (isManagedProviderLogoBlob(previousLogo)) {
      await deleteProviderLogoBlob(previousLogo).catch(() => null);
    }
    await logAdminAudit({
      adminUserId: admin.id,
      action: "subscription_provider_logo_removed",
      metadata: { providerId: provider.id, removedBlob: isManagedProviderLogoBlob(previousLogo) },
    });
    return NextResponse.json({ ok: true, logoPath: null });
  }

  const assetId = typeof payload.assetId === "string" ? payload.assetId : "";
  const asset = assetId
    ? await prisma.subscriptionProviderLogo.findFirst({ where: { id: assetId, providerId: provider.id } })
    : null;
  if (!asset) return NextResponse.json({ ok: false, error: "ASSET_NOT_FOUND" }, { status: 404 });

  if (action === "approve") {
    if (!provider.websiteUrl) return websiteRequiredResponse();
    try {
      const image = await fetchProviderLogoSource(asset.sourceUrl, provider.websiteUrl);
      const uploaded = await uploadProviderLogo({
        slug: provider.slug,
        filename: `logo.${extensionForContentType(image.contentType)}`,
        contentType: image.contentType,
        data: image.data,
      });
      const approvedAt = new Date();
      try {
        await prisma.$transaction([
          prisma.subscriptionProviderLogo.updateMany({
            where: { providerId: provider.id, status: "approved", id: { not: asset.id } },
            data: { status: "rejected", rejectedAt: approvedAt },
          }),
          prisma.subscriptionProviderLogo.update({
            where: { id: asset.id },
            data: {
              sourceWebsite: provider.websiteUrl,
              sourceUrl: image.sourceUrl,
              contentType: image.contentType,
              byteSize: image.byteSize,
              blobUrl: uploaded.url,
              data: null,
              status: "approved",
              approvedAt,
              approvedBy: admin.id,
              rejectedAt: null,
            },
          }),
          prisma.subscriptionProvider.update({ where: { id: provider.id }, data: { logoPath: uploaded.url } }),
        ]);
      } catch (error) {
        await deleteProviderLogoBlob(uploaded.url).catch(() => null);
        throw error;
      }
      if (isManagedProviderLogoBlob(provider.logoPath) && provider.logoPath !== uploaded.url) {
        await deleteProviderLogoBlob(provider.logoPath).catch(() => null);
      }
      await logAdminAudit({
        adminUserId: admin.id,
        action: "subscription_provider_logo_approved",
        metadata: { providerId: provider.id, assetId: asset.id, blobHost: new URL(uploaded.url).hostname },
      });
      return NextResponse.json({ ok: true, logoPath: uploaded.url, status: "approved" });
    } catch (error) {
      if (error instanceof ProviderLogoImportError) return logoImportErrorResponse(error);
      return uploadFailedResponse();
    }
  }

  if (action === "reject") {
    await prisma.subscriptionProviderLogo.update({
      where: { id: asset.id },
      data: { status: "rejected", rejectedAt: new Date() },
    });
    await logAdminAudit({
      adminUserId: admin.id,
      action: "subscription_provider_logo_rejected",
      metadata: { providerId: provider.id, assetId: asset.id },
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
}

async function uploadManualLogo(
  request: Request,
  provider: { id: string; slug: string; websiteUrl: string | null; logoPath: string | null },
  adminUserId: string,
) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_IMAGE", message: "Filen vi fant var ikke et gyldig bilde." },
        { status: 400 },
      );
    }
    const data = Buffer.from(await file.arrayBuffer());
    const contentType = validateIconResponse(file.type, data);
    const uploaded = await uploadProviderLogo({
      slug: provider.slug,
      filename: file.name || `logo.${extensionForContentType(contentType)}`,
      contentType,
      data,
    });
    const approvedAt = new Date();
    try {
      await prisma.$transaction([
        prisma.subscriptionProviderLogo.create({
          data: {
            providerId: provider.id,
            sourceWebsite: provider.websiteUrl,
            sourceUrl: "manual-upload",
            contentType,
            byteSize: data.length,
            blobUrl: uploaded.url,
            status: "approved",
            approvedAt,
            approvedBy: adminUserId,
          },
        }),
        prisma.subscriptionProviderLogo.updateMany({
          where: { providerId: provider.id, status: "approved", blobUrl: { not: uploaded.url } },
          data: { status: "rejected", rejectedAt: approvedAt },
        }),
        prisma.subscriptionProvider.update({ where: { id: provider.id }, data: { logoPath: uploaded.url } }),
      ]);
    } catch (error) {
      await deleteProviderLogoBlob(uploaded.url).catch(() => null);
      throw error;
    }
    if (isManagedProviderLogoBlob(provider.logoPath) && provider.logoPath !== uploaded.url) {
      await deleteProviderLogoBlob(provider.logoPath).catch(() => null);
    }
    await logAdminAudit({
      adminUserId,
      action: "subscription_provider_logo_uploaded",
      metadata: { providerId: provider.id, contentType, byteSize: data.length },
    });
    return NextResponse.json({ ok: true, logoPath: uploaded.url, status: "approved" });
  } catch (error) {
    if (error instanceof ProviderLogoImportError) {
      return NextResponse.json(
        { ok: false, error: "INVALID_IMAGE", message: "Filen vi fant var ikke et gyldig bilde." },
        { status: 422 },
      );
    }
    return uploadFailedResponse();
  }
}

async function getAdmin() {
  const admin = await getCurrentUser();
  if (!admin) return unauthorizedResponse();
  if (!isAdminUser(admin)) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  return admin;
}

function logoImportErrorResponse(error: unknown) {
  const code = error instanceof ProviderLogoImportError ? error.code : "FETCH_FAILED";
  if (code === "NO_ICONS" || code === "NO_VALID_ICON") {
    return NextResponse.json(
      { ok: false, error: code, message: "Vi fant ingen egnet logo på leverandørens nettside." },
      { status: 422 },
    );
  }
  if (["INVALID_URL", "UNSAFE_URL", "UNSUPPORTED_PROTOCOL", "SSRF_BLOCKED", "UNRELATED_DOMAIN"].includes(code)) {
    return NextResponse.json(
      { ok: false, error: code, message: "Nettsiden kunne ikke brukes av sikkerhetshensyn." },
      { status: 422 },
    );
  }
  if (["INVALID_CONTENT_TYPE", "FILE_TOO_LARGE"].includes(code)) {
    return NextResponse.json(
      { ok: false, error: code, message: "Filen vi fant var ikke et gyldig bilde." },
      { status: 422 },
    );
  }
  return NextResponse.json(
    { ok: false, error: code, message: "Logoen kunne ikke hentes. Prøv igjen." },
    { status: 422 },
  );
}

function websiteRequiredResponse() {
  return NextResponse.json(
    { ok: false, error: "WEBSITE_REQUIRED", message: "Legg inn leverandørens nettside først." },
    { status: 400 },
  );
}

function uploadFailedResponse() {
  return NextResponse.json(
    { ok: false, error: "UPLOAD_FAILED", message: "Logoen kunne ikke lagres. Prøv igjen." },
    { status: 503 },
  );
}

function imageResponse(data: Buffer, contentType: string) {
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const assetMetadataSelect = {
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
} as const;

function serializeAsset(asset: {
  id: string;
  sourceWebsite: string | null;
  sourceUrl: string;
  contentType: string;
  byteSize: number;
  blobUrl: string | null;
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
