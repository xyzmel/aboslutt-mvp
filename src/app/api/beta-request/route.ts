import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "beta-request",
    limit: 5,
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

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const website = typeof payload.website === "string" ? payload.website.trim() : "";

  if (website) {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST", message: "Ugyldig forespørsel." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_EMAIL", message: "Skriv inn en gyldig e-postadresse." },
      { status: 400 },
    );
  }

  if (name.length > 120 || message.length > 1200) {
    return NextResponse.json(
      { ok: false, error: "INVALID_LENGTH", message: "Teksten er for lang." },
      { status: 400 },
    );
  }

  await prisma.betaRequest.create({
    data: {
      name: name || null,
      email,
      message: message || null,
    },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    message: "Takk! Vi har mottatt ønsket ditt om beta-tilgang.",
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
