import { formatSubscriptionDateForDisplay } from "@/lib/subscription-dates";
import { sendTransactionalEmail } from "@/lib/transactional-email";

type ReminderSubscription = {
  name: string;
  monthlyCost: number;
  nextPayment: string;
};

type MonthlySummarySubscription = ReminderSubscription & {
  billingInterval: string;
};

export async function sendUpcomingPaymentReminder({
  to,
  name,
  subscriptions,
}: {
  to: string;
  name?: string | null;
  subscriptions: ReminderSubscription[];
}) {
  const dashboardUrl = getDashboardUrl();
  const totalAmount = subscriptions.reduce((sum, subscription) => sum + subscription.monthlyCost, 0);
  const greeting = name ? `Hei ${name}!` : "Hei!";
  const lines = subscriptions.map(
    (subscription) =>
      `- ${subscription.name}: ${subscription.monthlyCost} kr, trekk ${formatSubscriptionDateForDisplay(subscription.nextPayment)}`,
  );

  return sendTransactionalEmail({
    to,
    subject: "Kommende abonnementstrekk hos Aboslutt",
    text: [
      greeting,
      "",
      "Dette er en påminnelse om kommende abonnementstrekk:",
      ...lines,
      "",
      `Totalt: ${totalAmount} kr`,
      "",
      `Se oversikten din: ${dashboardUrl}`,
      "",
      "Personvern: Aboslutt sender bare varsler basert på abonnementer du har lagret. Rå Gmail- eller e-postinnhold lagres ikke.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0D1B2A;">
        <h1>Kommende abonnementstrekk</h1>
        <p>${escapeHtml(greeting)}</p>
        <ul>
          ${subscriptions
            .map(
              (subscription) =>
                `<li><strong>${escapeHtml(subscription.name)}</strong>: ${subscription.monthlyCost} kr, trekk ${escapeHtml(formatSubscriptionDateForDisplay(subscription.nextPayment))}</li>`,
            )
            .join("")}
        </ul>
        <p><strong>Totalt:</strong> ${totalAmount} kr</p>
        <p><a href="${dashboardUrl}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Gå til oversikten</a></p>
        <p style="color:#5F6F82;font-size:13px;">Aboslutt sender bare varsler basert på abonnementer du har lagret. Rå Gmail- eller e-postinnhold lagres ikke.</p>
      </div>
    `,
  });
}

export async function sendMonthlySummaryEmail({
  to,
  name,
  activeCount,
  monthlyTotal,
  yearlyEstimate,
  upcomingSubscriptions,
}: {
  to: string;
  name?: string | null;
  activeCount: number;
  monthlyTotal: number;
  yearlyEstimate: number;
  upcomingSubscriptions: MonthlySummarySubscription[];
}) {
  const dashboardUrl = getDashboardUrl();
  const greeting = name ? `Hei ${name}!` : "Hei!";
  const upcomingLines = upcomingSubscriptions.length
    ? upcomingSubscriptions.map(
        (subscription) =>
          `- ${subscription.name}: ${subscription.monthlyCost} kr, trekk ${formatSubscriptionDateForDisplay(subscription.nextPayment)}`,
      )
    : ["- Ingen kjente trekk de neste 30 dagene."];

  return sendTransactionalEmail({
    to,
    subject: "Månedlig abonnementoppsummering fra Aboslutt",
    text: [
      greeting,
      "",
      `Aktive abonnementer: ${activeCount}`,
      `Estimert per måned: ${monthlyTotal} kr`,
      `Estimert per år: ${yearlyEstimate} kr`,
      "",
      "Kommende trekk:",
      ...upcomingLines,
      "",
      `Se oversikten din: ${dashboardUrl}`,
      "",
      "Personvern: Aboslutt sender bare varsler basert på abonnementer du har lagret. Rå Gmail- eller e-postinnhold lagres ikke.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0D1B2A;">
        <h1>Månedlig abonnementoppsummering</h1>
        <p>${escapeHtml(greeting)}</p>
        <p><strong>Aktive abonnementer:</strong> ${activeCount}</p>
        <p><strong>Estimert per måned:</strong> ${monthlyTotal} kr</p>
        <p><strong>Estimert per år:</strong> ${yearlyEstimate} kr</p>
        <h2>Kommende trekk</h2>
        <ul>
          ${upcomingSubscriptions.length
            ? upcomingSubscriptions
                .map(
                  (subscription) =>
                    `<li><strong>${escapeHtml(subscription.name)}</strong>: ${subscription.monthlyCost} kr, trekk ${escapeHtml(formatSubscriptionDateForDisplay(subscription.nextPayment))}</li>`,
                )
                .join("")
            : "<li>Ingen kjente trekk de neste 30 dagene.</li>"}
        </ul>
        <p><a href="${dashboardUrl}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Gå til oversikten</a></p>
        <p style="color:#5F6F82;font-size:13px;">Aboslutt sender bare varsler basert på abonnementer du har lagret. Rå Gmail- eller e-postinnhold lagres ikke.</p>
      </div>
    `,
  });
}

export async function sendBetaAccessApprovedEmail({
  to,
  name,
}: {
  to: string;
  name?: string | null;
}) {
  const dashboardUrl = getDashboardUrl();
  const greeting = name ? `Hei ${name}!` : "Hei!";

  return sendTransactionalEmail({
    to,
    subject: "Du har fått beta-tilgang til Aboslutt",
    text: [
      greeting,
      "",
      "Du har nå fått beta-tilgang til Aboslutt.",
      "",
      "Beta gir tilgang til Gmail-skanning, e-postpåminnelser og månedlig oppsummering. Manuell abonnementssporing fungerer fortsatt som før.",
      "",
      `Gå til oversikten din: ${dashboardUrl}`,
      "",
      "Personvern: Aboslutt lagrer ikke rå Gmail- eller e-postinnhold. Du bekrefter selv hva som lagres.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0D1B2A;">
        <h1>Beta-tilgang er aktivert</h1>
        <p>${escapeHtml(greeting)}</p>
        <p>Du har nå fått beta-tilgang til Aboslutt.</p>
        <p>Beta gir tilgang til Gmail-skanning, e-postpåminnelser og månedlig oppsummering. Manuell abonnementssporing fungerer fortsatt som før.</p>
        <p><a href="${dashboardUrl}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Gå til oversikten</a></p>
        <p style="color:#5F6F82;font-size:13px;">Aboslutt lagrer ikke rå Gmail- eller e-postinnhold. Du bekrefter selv hva som lagres.</p>
      </div>
    `,
  });
}

function getDashboardUrl() {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return new URL("/dashboard", baseUrl).toString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
