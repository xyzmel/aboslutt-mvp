import nodemailer from "nodemailer";
import { isSmtpConfigured } from "@/lib/smtp";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  cc?: string;
  from?: string;
};

export async function sendTransactionalEmail({ to, subject, text, html, replyTo, cc, from }: SendEmailInput) {
  if (!isSmtpConfigured()) {
    return { sent: false };
  }

  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    secure: Number(process.env.EMAIL_SERVER_PORT ?? 587) === 465,
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  const result = await transport.sendMail({
    to,
    from: from ?? process.env.EMAIL_FROM,
    replyTo,
    cc,
    subject,
    text,
    html,
  });

  return { sent: true, messageId: typeof result.messageId === "string" ? result.messageId : null };
}
