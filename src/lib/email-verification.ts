import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured } from "@/lib/smtp";

const verificationTokenMaxAgeMs = 1000 * 60 * 60 * 24;

export async function createEmailVerificationToken(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + verificationTokenMaxAgeMs);

  await prisma.emailVerificationToken.deleteMany({
    where: { userId },
  });

  return prisma.emailVerificationToken.create({
    data: { userId, token, expires },
  });
}

export async function sendEmailVerification({
  to,
  token,
}: {
  to: string;
  token: string;
}) {
  if (!isSmtpConfigured()) {
    return { sent: false };
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = new URL("/verify-email", baseUrl);
  verifyUrl.searchParams.set("token", token);

  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    secure: Number(process.env.EMAIL_SERVER_PORT ?? 587) === 465,
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  await transport.sendMail({
    to,
    from: process.env.EMAIL_FROM,
    subject: "Bekreft e-posten din hos Aboslutt",
    text: [
      "Hei!",
      "",
      "Bekreft e-postadressen din for å aktivere Aboslutt-kontoen:",
      verifyUrl.toString(),
      "",
      "Lenken utløper om 24 timer. Hvis du ikke opprettet konto, kan du se bort fra denne e-posten.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0D1B2A;">
        <h1>Bekreft e-posten din</h1>
        <p>Bruk knappen under for å aktivere Aboslutt-kontoen din.</p>
        <p><a href="${verifyUrl.toString()}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Bekreft e-post</a></p>
        <p>Lenken utløper om 24 timer. Hvis du ikke opprettet konto, kan du se bort fra denne e-posten.</p>
      </div>
    `,
  });

  return { sent: true };
}
