import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { importProviderLogo, ProviderLogoImportError } from "@/lib/provider-logo-importer.mjs";

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin) return unauthorizedResponse();
  if (!isAdminUser(admin)) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const payload = await request.json().catch(() => ({}));
  const websiteUrl = typeof payload.websiteUrl === "string" ? payload.websiteUrl.trim() : "";
  if (!websiteUrl) {
    return NextResponse.json(
      { ok: false, error: "WEBSITE_REQUIRED", message: "Legg inn leverandørens nettside først." },
      { status: 400 },
    );
  }
  try {
    const imported = await importProviderLogo(websiteUrl);
    return NextResponse.json({
      ok: true,
      candidate: {
        sourceUrl: imported.sourceUrl,
        contentType: imported.contentType,
        byteSize: imported.byteSize,
        previewDataUrl: `data:${imported.contentType};base64,${imported.data.toString("base64")}`,
      },
    });
  } catch (error) {
    const code = error instanceof ProviderLogoImportError ? error.code : "FETCH_FAILED";
    const message = code === "NO_ICONS" || code === "NO_VALID_ICON"
      ? "Vi fant ingen egnet logo på leverandørens nettside."
      : ["INVALID_URL", "UNSAFE_URL", "UNSUPPORTED_PROTOCOL", "SSRF_BLOCKED", "UNRELATED_DOMAIN"].includes(code)
        ? "Nettsiden kunne ikke brukes av sikkerhetshensyn."
        : ["INVALID_CONTENT_TYPE", "FILE_TOO_LARGE"].includes(code)
          ? "Filen vi fant var ikke et gyldig bilde."
          : "Logoen kunne ikke hentes. Prøv igjen.";
    return NextResponse.json({ ok: false, error: code, message }, { status: 422 });
  }
}
