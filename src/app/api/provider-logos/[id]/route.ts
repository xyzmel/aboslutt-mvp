import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const asset = await prisma.subscriptionProviderLogo.findFirst({
    where: { id, status: "approved", provider: { logoPath: `/api/provider-logos/${id}` } },
    select: { data: true, blobUrl: true, contentType: true, byteSize: true, fetchedAt: true },
  });
  if (!asset) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (asset.blobUrl) return NextResponse.redirect(asset.blobUrl);
  if (!asset.data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.byteSize),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Last-Modified": asset.fetchedAt.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
