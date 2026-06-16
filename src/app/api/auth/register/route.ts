import { NextResponse } from "next/server";
import { createEmailVerificationToken, sendEmailVerification } from "@/lib/email-verification";
import { hashPassword, validatePassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { rateLimitResponseIfNeeded } from "@/lib/rate-limit";

type RegisterResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

const existingUserSafeMessage = "Hvis e-posten kan registreres, sender vi deg en bekreftelse.";

export async function POST(request: Request) {
  const rateLimitResponse = rateLimitResponseIfNeeded(request, {
    keyPrefix: "auth-register",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      website?: string;
    };

    if (payload.website) {
      return registerError("Ugyldig forespørsel.", 400);
    }

    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const password = payload.password ?? "";
    const confirmPassword = payload.confirmPassword ?? "";

    if (!name || !email || !password || !confirmPassword) {
      return registerError("Fyll ut alle feltene.", 400);
    }

    if (!validatePassword(password)) {
      return registerError("Passordet må være minst 8 tegn.", 400);
    }

    if (password !== confirmPassword) {
      return registerError("Passordene er ikke like.", 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ ok: true, message: existingUserSafeMessage } satisfies RegisterResponse);
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: { id: true },
    });

    const verificationToken = await createEmailVerificationToken(user.id);
    const emailResult = await sendEmailVerification({
      to: email,
      token: verificationToken.token,
    }).catch(() => ({ sent: false }));

    return NextResponse.json(
      {
        ok: true,
        message: emailResult.sent
          ? "Kontoen er opprettet. Sjekk e-posten din for å bekrefte kontoen."
          : "Kontoen er opprettet, men e-postverifisering er ikke konfigurert.",
      } satisfies RegisterResponse,
      { status: 201 },
    );
  } catch (error) {
    if (/Unique constraint/i.test(String(error))) {
      return NextResponse.json({ ok: true, message: existingUserSafeMessage } satisfies RegisterResponse);
    }

    return registerError("Kunne ikke opprette konto akkurat nå. Prøv igjen senere.", 500);
  }
}

function registerError(error: string, status: number) {
  return NextResponse.json({ ok: false, error } satisfies RegisterResponse, { status });
}
