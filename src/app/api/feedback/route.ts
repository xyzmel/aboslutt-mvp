import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "feedback",
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST", message: "Ugyldig forespørsel." },
      { status: 400 },
    );
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
  const rating = payload.rating === undefined || payload.rating === null ? null : Number(payload.rating);
  const website = typeof payload.website === "string" ? payload.website.trim() : "";

  if (website) {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST", message: "Ugyldig forespørsel." },
      { status: 400 },
    );
  }

  if (message.length < 3 || message.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "INVALID_MESSAGE", message: "Tilbakemeldingen må være mellom 3 og 2000 tegn." },
      { status: 400 },
    );
  }

  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_RATING", message: "Vurdering må være mellom 1 og 5." },
      { status: 400 },
    );
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  await prisma.feedback.create({
    data: {
      userId: currentUser.id,
      email: email || currentUser.email || null,
      message,
      rating,
      page: typeof payload.page === "string" ? payload.page.trim().slice(0, 240) : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, message: "Takk for tilbakemeldingen." });
}
