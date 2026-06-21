import type { BillingAgreement, User } from "@prisma/client";
import { siteConfig } from "@/lib/site-config";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type BillingEmailType = "premium_activated" | "premium_cancelled" | "payment_failed";

type BillingAgreementWithUser = BillingAgreement & {
  user: Pick<User, "email" | "name">;
};

const emailEventPrefix = "aboslutt.billing.email";

export async function sendPremiumActivatedEmailOnce(agreement: BillingAgreementWithUser) {
  const siteUrl = getSiteUrl();
  const planLabel = formatPlan(agreement.plan);
  const priceLabel = `${agreement.priceNok} ${agreement.currency} / ${formatInterval(agreement.interval)}`;

  return sendBillingEmailOnce({
    agreement,
    emailType: "premium_activated",
    subject: "Premium er aktivert i Aboslutt",
    text: [
      `Hei${agreement.user.name ? ` ${agreement.user.name}` : ""},`,
      "",
      "Premium er nå aktivert på Aboslutt-kontoen din.",
      `Plan: ${planLabel}`,
      `Pris: ${priceLabel}`,
      "",
      `Gå til oversikt: ${siteUrl}/dashboard`,
      `Administrer abonnement og betaling: ${siteUrl}/settings`,
    ].join("\n"),
    html: [
      `<p>Hei${agreement.user.name ? ` ${escapeHtml(agreement.user.name)}` : ""},</p>`,
      "<p>Premium er nå aktivert på Aboslutt-kontoen din.</p>",
      "<ul>",
      `<li><strong>Plan:</strong> ${escapeHtml(planLabel)}</li>`,
      `<li><strong>Pris:</strong> ${escapeHtml(priceLabel)}</li>`,
      "</ul>",
      `<p><a href="${siteUrl}/dashboard">Gå til oversikt</a></p>`,
      `<p><a href="${siteUrl}/settings">Administrer abonnement og betaling</a></p>`,
    ].join(""),
  });
}

export async function sendPremiumCancelledEmailOnce(agreement: BillingAgreementWithUser) {
  const siteUrl = getSiteUrl();
  const accessText = agreement.expiresAt
    ? `Tilgang er registrert til ${formatDate(agreement.expiresAt)}.`
    : "Hvis perioden allerede er betalt, beholder du tilgang ut perioden dersom dette støttes av avtalen.";

  return sendBillingEmailOnce({
    agreement,
    emailType: "premium_cancelled",
    subject: "Premium-avtalen er avsluttet",
    text: [
      `Hei${agreement.user.name ? ` ${agreement.user.name}` : ""},`,
      "",
      "Premium-abonnementet eller den faste Vipps-avtalen er avsluttet.",
      accessText,
      "",
      `Innstillinger: ${siteUrl}/settings`,
      `Kontakt: ${siteConfig.contactEmail}`,
    ].join("\n"),
    html: [
      `<p>Hei${agreement.user.name ? ` ${escapeHtml(agreement.user.name)}` : ""},</p>`,
      "<p>Premium-abonnementet eller den faste Vipps-avtalen er avsluttet.</p>",
      `<p>${escapeHtml(accessText)}</p>`,
      `<p><a href="${siteUrl}/settings">Åpne innstillinger</a></p>`,
      `<p>Kontakt: <a href="mailto:${siteConfig.contactEmail}">${siteConfig.contactEmail}</a></p>`,
    ].join(""),
  });
}

export async function sendPaymentFailedEmailOnce(agreement: BillingAgreementWithUser) {
  const siteUrl = getSiteUrl();

  return sendBillingEmailOnce({
    agreement,
    emailType: "payment_failed",
    subject: "Betalingen ble ikke fullført",
    text: [
      `Hei${agreement.user.name ? ` ${agreement.user.name}` : ""},`,
      "",
      "Vipps-betalingen eller betalingsavtalen ble ikke fullført.",
      "Premium er ikke aktivert for denne betalingen.",
      "",
      `Prøv igjen fra prissiden: ${siteUrl}/pricing`,
      `Kontakt: ${siteConfig.contactEmail}`,
    ].join("\n"),
    html: [
      `<p>Hei${agreement.user.name ? ` ${escapeHtml(agreement.user.name)}` : ""},</p>`,
      "<p>Vipps-betalingen eller betalingsavtalen ble ikke fullført.</p>",
      "<p>Premium er ikke aktivert for denne betalingen.</p>",
      `<p><a href="${siteUrl}/pricing">Prøv igjen fra prissiden</a></p>`,
      `<p>Kontakt: <a href="mailto:${siteConfig.contactEmail}">${siteConfig.contactEmail}</a></p>`,
    ].join(""),
  });
}

async function sendBillingEmailOnce({
  agreement,
  emailType,
  subject,
  text,
  html,
}: {
  agreement: BillingAgreementWithUser;
  emailType: BillingEmailType;
  subject: string;
  text: string;
  html: string;
}) {
  if (!agreement.user.email) {
    logBillingEmail({
      reference: agreement.reference,
      status: agreement.status,
      emailType,
      sent: false,
      reason: "missing_email",
    });
    return { sent: false, skipped: true };
  }

  const eventType = `${emailEventPrefix}.${emailType}.v1`;
  const existing = await prisma.billingEvent.findFirst({
    where: {
      provider: "aboslutt",
      eventType,
      reference: agreement.reference,
    },
    select: { id: true },
  });

  if (existing) {
    logBillingEmail({
      reference: agreement.reference,
      status: agreement.status,
      emailType,
      sent: false,
      reason: "already_sent",
    });
    return { sent: false, skipped: true };
  }

  const marker = await prisma.billingEvent.create({
    data: {
      provider: "aboslutt",
      eventType,
      providerAgreementId: agreement.providerAgreementId,
      providerChargeId: agreement.providerChargeId,
      reference: agreement.reference,
      rawJson: {
        emailType,
        status: "pending",
      },
    },
    select: { id: true },
  });

  try {
    const result = await sendTransactionalEmail({
      to: agreement.user.email,
      replyTo: siteConfig.contactEmail,
      subject,
      text,
      html,
    });

    await prisma.billingEvent.update({
      where: { id: marker.id },
      data: {
        rawJson: {
          emailType,
          status: result.sent ? "sent" : "skipped",
          sent: result.sent,
        },
      },
    });

    logBillingEmail({
      reference: agreement.reference,
      status: agreement.status,
      emailType,
      sent: result.sent,
      reason: result.sent ? "sent" : "smtp_not_configured",
    });

    return result;
  } catch (error) {
    await prisma.billingEvent.update({
      where: { id: marker.id },
      data: {
        rawJson: {
          emailType,
          status: "failed",
          error: error instanceof Error ? error.name : "UnknownError",
        },
      },
    });

    logBillingEmail({
      reference: agreement.reference,
      status: agreement.status,
      emailType,
      sent: false,
      reason: error instanceof Error ? error.name : "send_failed",
    });

    return { sent: false, error };
  }
}

function logBillingEmail({
  reference,
  status,
  emailType,
  sent,
  reason,
}: {
  reference: string;
  status: string;
  emailType: BillingEmailType;
  sent: boolean;
  reason: string;
}) {
  logger.info("[billing:email]", {
    reference,
    agreementStatus: status,
    emailType,
    sent,
    reason,
  });
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.aboslutt.no").replace(/\/+$/, "");
}

function formatPlan(plan: string) {
  const labels: Record<string, string> = {
    premium_monthly: "Premium månedlig",
    premium_yearly: "Premium årlig",
  };

  return labels[plan] ?? plan;
}

function formatInterval(interval: string) {
  const labels: Record<string, string> = {
    month: "måned",
    monthly: "måned",
    year: "år",
    yearly: "år",
  };

  return labels[interval] ?? interval;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
