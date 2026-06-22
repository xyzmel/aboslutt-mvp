import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { createMicrosoftAuthorizationUrl, MicrosoftGraphError } from "@/lib/microsoft-graph";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  try {
    const authorizationUrl = await createMicrosoftAuthorizationUrl(currentUser.id);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof MicrosoftGraphError) {
      return NextResponse.redirect(new URL(`/import/email?microsoft=${error.code}`, getBaseUrl()));
    }

    return NextResponse.redirect(new URL("/import/email?microsoft=MICROSOFT_CONNECT_FAILED", getBaseUrl()));
  }
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
}
