import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured } from "@/lib/smtp";

const passwordResetTokenMaxAgeMs = 1000 * 60 * 60;

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + passwordResetTokenMaxAgeMs);

  await prisma.passwordResetToken.deleteMany({
    where: { userId },
  });

  return prisma.passwordResetToken.create({
    data: { userId, token, expires },
  });
}

export async function sendPasswordResetEmail({
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
  const resetUrl = new URL("/reset-password", baseUrl);
  resetUrl.searchParams.set("token", token);

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
    subject: "Tilbakestill passordet ditt hos Aboslutt",
    text: [
      "Hei!",
      "",
      "Bruk lenken under for å lage et nytt passord hos Aboslutt:",
      resetUrl.toString(),
      "",
      "Lenken utløper om 1 time. Hvis du ikke ba om dette, kan du se bort fra e-posten.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0D1B2A;">
        <h1>Tilbakestill passordet ditt</h1>
        <p>Bruk knappen under for å lage et nytt passord hos Aboslutt.</p>
        <p><a href="${resetUrl.toString()}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Lag nytt passord</a></p>
        <p>Lenken utløper om 1 time. Hvis du ikke ba om dette, kan du se bort fra e-posten.</p>
      </div>
    `,
  });

  return { sent: true };
}
