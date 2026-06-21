"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { PlanStatusCard } from "@/components/plans/PlanStatusCard";

const vippsLoginButtonAsset = "/vipps-login-pill-default.svg";

type SettingsBillingAgreement = {
  plan: string;
  status: string;
  priceNok: number;
  interval: string;
  currency: string;
  activatedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
};

type SettingsClientProps = {
  name: string | null;
  email: string | null;
  billingAgreement: SettingsBillingAgreement | null;
  googleConnected: boolean;
  gmailScopeConnected: boolean;
  googleReconnectRequired: boolean;
  vippsConnected: boolean;
  vippsConfigured: boolean;
  isAdmin: boolean;
  plan: string;
  emailRemindersEnabled: boolean;
  emailRemindersAvailable: boolean;
  reminderDaysBefore: number;
  monthlySummaryEnabled: boolean;
  monthlySummaryAvailable: boolean;
  paymentsConfigured: boolean;
};

export function SettingsClient({
  name,
  email,
  billingAgreement,
  googleConnected,
  gmailScopeConnected,
  googleReconnectRequired,
  vippsConnected,
  vippsConfigured,
  isAdmin,
  plan,
  emailRemindersEnabled,
  emailRemindersAvailable,
  reminderDaysBefore,
  monthlySummaryEnabled,
  monthlySummaryAvailable,
  paymentsConfigured,
}: SettingsClientProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [billingStatus, setBillingStatus] = useState(billingAgreement?.status ?? null);
  const [isCancellingBilling, setIsCancellingBilling] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    emailRemindersEnabled,
    reminderDaysBefore,
    monthlySummaryEnabled,
  });

  async function deleteAllSubscriptions() {
    if (!window.confirm("Vil du slette alle abonnementene dine?")) {
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const response = await fetch("/api/subscriptions", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Kunne ikke slette abonnementene.");
      }
      setMessage("Alle abonnementer er slettet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke slette abonnementene.");
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteAccountData() {
    if (
      !window.confirm(
        "Vil du slette kontodata, tilkoblinger og abonnementer? Du blir logget ut etterpå.",
      )
    ) {
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Kunne ikke slette kontodata.");
      }
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke slette kontodata.");
      setIsWorking(false);
    }
  }

  async function saveNotificationPreferences(nextForm = notificationForm) {
    setIsWorking(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextForm),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        preferences?: typeof notificationForm;
      };

      if (!response.ok) {
        throw new Error(
          result.message ?? "Varselinnstillinger kunne ikke lastes. Prøv igjen senere.",
        );
      }

      if (result.preferences) {
        setNotificationForm(result.preferences);
      }
      setMessage("Varselinnstillinger er lagret.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke lagre varselinnstillinger.");
    } finally {
      setIsWorking(false);
    }
  }

  function updateNotificationForm(update: Partial<typeof notificationForm>) {
    const nextForm = { ...notificationForm, ...update };
    setNotificationForm(nextForm);
    saveNotificationPreferences(nextForm);
  }

  async function cancelBillingAgreement() {
    const confirmed = window.confirm(
      "Vil du stoppe den faste Vipps-betalingen for Aboslutt Premium? Du beholder tilgang ut perioden du allerede har betalt for dersom dette støttes av avtalen.",
    );

    if (!confirmed) {
      return;
    }

    setIsCancellingBilling(true);
    setMessage(null);

    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: string;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Kunne ikke stoppe betalingsavtalen akkurat nå.");
      }

      setBillingStatus(result.status ?? "cancellation_pending");
      setMessage("Vipps-avtalen er sendt til avslutning.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke stoppe betalingsavtalen akkurat nå.");
    } finally {
      setIsCancellingBilling(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Konto</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Innstillinger</h1>

      {message ? (
        <div className="mt-5 rounded-2xl bg-white p-4 text-sm font-semibold text-[#0D1B2A] ring-1 ring-[#DBE4EE]">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        <PlanStatusCard plan={plan} />

        <BillingSection
          agreement={billingAgreement ? { ...billingAgreement, status: billingStatus ?? billingAgreement.status } : null}
          isAdmin={isAdmin}
          isCancelling={isCancellingBilling}
          onCancel={cancelBillingAgreement}
          paymentsConfigured={paymentsConfigured}
          plan={plan}
        />

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
          <h2 className="text-lg font-extrabold tracking-tight">Profil</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-[#5F6F82]">Navn</dt>
              <dd>{name ?? "Ikke satt"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#5F6F82]">E-post</dt>
              <dd>{email ?? "Ikke satt"}</dd>
            </div>
          </dl>
          <button
            className="mt-5 rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold hover:border-[#C8102E]/50"
            onClick={() => signOut({ callbackUrl: "/login" })}
            type="button"
          >
            Logg ut
          </button>
          {isAdmin ? (
            <a
              className="ml-3 inline-flex rounded-xl bg-[#0D1B2A] px-5 py-3 text-sm font-bold text-white hover:bg-[#15283c]"
              href="/admin"
            >
              Admin
            </a>
          ) : null}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#DBE4EE]">
          <h2 className="text-lg font-extrabold tracking-tight">Tilkoblinger</h2>
          <div className="mt-4 grid gap-3">
            <ConnectionRow
              action={
                !googleConnected || googleReconnectRequired ? (
                  <button
                    className="rounded-xl bg-[#C8102E] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#a90d27]"
                    onClick={() => signIn("google", { callbackUrl: "/settings" })}
                    type="button"
                  >
                    {googleReconnectRequired ? "Koble til på nytt" : "Koble til Google/Gmail"}
                  </button>
                ) : null
              }
              eyebrow="Google/Gmail"
              status={gmailScopeConnected ? "Gmail read-only er aktiv" : "Gmail read-only mangler"}
              title={
                googleConnected
                  ? "Google/Gmail er tilkoblet"
                  : googleReconnectRequired
                    ? "Koble til Google/Gmail på nytt"
                    : "Google/Gmail er ikke koblet til"
              }
            />
            <ConnectionRow
              action={
                !vippsConnected && vippsConfigured ? (
                  <button
                    aria-label="Logg inn med Vipps"
                    className="inline-flex h-11 w-48 items-center justify-center rounded-full bg-transparent p-0 focus:outline-none focus:ring-2 focus:ring-[#FF5B24] focus:ring-offset-2"
                    onClick={() => signIn("vipps", { callbackUrl: "/settings" })}
                    type="button"
                  >
                    <Image
                      alt="Logg inn med Vipps"
                      className="h-11 w-full object-contain"
                      height={44}
                      src={vippsLoginButtonAsset}
                      width={240}
                    />
                  </button>
                ) : null
              }
              eyebrow="Vipps"
              logo={<VippsLogo />}
              status={vippsConnected ? "Vipps er tilkoblet" : "Vipps er ikke koblet til"}
              title={vippsConnected ? "Vipps er tilkoblet" : "Koble til Vipps"}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-[#5F6F82]">
            Full tilbakekalling hos Google er ikke implementert ennå. Du kan fjerne
            tilgangen i Google-kontoen din under tredjepartstilganger.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
          <h2 className="text-lg font-extrabold tracking-tight">Varsler</h2>
          <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
            Få e-post før kommende abonnementstrekk og en valgfri månedlig oversikt.
          </p>
          {!emailRemindersAvailable || !monthlySummaryAvailable ? (
            <p className="mt-3 rounded-xl bg-[#FFF6E8] px-4 py-3 text-sm font-semibold text-[#8A4B13]">
              Varsler er tilgjengelig med Premium. Du kan fortsatt legge inn abonnementer manuelt gratis.
            </p>
          ) : null}
          <div className="mt-5 grid gap-4">
            <label className="flex items-start justify-between gap-4 rounded-xl bg-[#F7F9FC] p-4 text-sm">
              <span>
                <span className="block font-bold text-[#0D1B2A]">
                  Varsle meg før kommende trekk
                </span>
                <span className="mt-1 block text-[#5F6F82]">
                  Sender en e-post før datoen du har lagt inn på abonnementet.
                </span>
              </span>
              <input
                checked={notificationForm.emailRemindersEnabled}
                className="mt-1 h-5 w-5 accent-[#C8102E]"
                disabled={isWorking || !emailRemindersAvailable}
                onChange={(event) =>
                  updateNotificationForm({ emailRemindersEnabled: event.target.checked })
                }
                type="checkbox"
              />
            </label>

            <label className="text-sm font-semibold text-[#4A5568]">
              Send påminnelse
              <select
                className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
                disabled={isWorking || !notificationForm.emailRemindersEnabled}
                onChange={(event) =>
                  updateNotificationForm({ reminderDaysBefore: Number(event.target.value) })
                }
                value={notificationForm.reminderDaysBefore}
              >
                <option value={1}>1 dag før</option>
                <option value={3}>3 dager før</option>
                <option value={7}>7 dager før</option>
              </select>
            </label>

            <label className="flex items-start justify-between gap-4 rounded-xl bg-[#F7F9FC] p-4 text-sm">
              <span>
                <span className="block font-bold text-[#0D1B2A]">
                  Send månedlig oppsummering
                </span>
                <span className="mt-1 block text-[#5F6F82]">
                  Gir en enkel oversikt over aktive abonnementer og kommende trekk.
                </span>
              </span>
              <input
                checked={notificationForm.monthlySummaryEnabled}
                className="mt-1 h-5 w-5 accent-[#C8102E]"
                disabled={isWorking || !monthlySummaryAvailable}
                onChange={(event) =>
                  updateNotificationForm({ monthlySummaryEnabled: event.target.checked })
                }
                type="checkbox"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
          <h2 className="text-lg font-extrabold tracking-tight">Personvern</h2>
          <p className="mt-3 text-sm leading-6 text-[#5F6F82]">
            Aboslutt lagrer ikke rå e-postinnhold. Bare abonnementene du bekrefter
            lagres i databasen.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-xl border border-[#F3C3CC] px-5 py-3 text-sm font-bold text-[#C8102E] hover:bg-[#F5E6E9] disabled:opacity-50"
              disabled={isWorking}
              onClick={deleteAllSubscriptions}
              type="button"
            >
              Slett alle abonnementer
            </button>
            <button
              className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] disabled:opacity-50"
              disabled={isWorking}
              onClick={deleteAccountData}
              type="button"
            >
              Slett kontodata
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function ConnectionRow({
  eyebrow,
  title,
  status,
  logo,
  action,
}: {
  eyebrow: string;
  title: string;
  status: string;
  logo?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#F7F9FC] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-32 shrink-0 items-center justify-center rounded-xl bg-white px-2 ring-1 ring-[#DBE4EE]">
          {logo ?? <span className="text-sm font-black text-[#0D1B2A]">G</span>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">{eyebrow}</p>
          <p className="mt-1 text-sm font-extrabold text-[#0D1B2A]">{title}</p>
          <p className="mt-1 text-sm text-[#5F6F82]">{status}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function BillingSection({
  agreement,
  isAdmin,
  isCancelling,
  onCancel,
  paymentsConfigured,
  plan,
}: {
  agreement: SettingsBillingAgreement | null;
  isAdmin: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  paymentsConfigured: boolean;
  plan: string;
}) {
  const isPaidPlan = plan === "premium" || plan === "beta";
  const showPricingLink = plan === "free" && !isAdmin;
  const canCancel = agreement?.status === "active";

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Abonnement og betaling</h2>
          <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
            Administrer plan, fast trekk og status for Aboslutt Premium.
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#F0F4F8] px-3 py-1 text-xs font-bold text-[#4A5568]">
          {formatPlan(plan)}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <BillingDetail label="Plan" value={formatPlan(plan)} />
        <BillingDetail label="Intervall" value={agreement ? formatBillingInterval(agreement.interval) : "Ingen aktiv avtale"} />
        <BillingDetail label="Pris" value={agreement ? `${agreement.priceNok} ${agreement.currency}` : "-"} />
        <BillingDetail label="Status" value={agreement ? formatBillingStatus(agreement.status) : "Ingen betalingsavtale"} />
        <BillingDetail label="Aktivert" value={agreement?.activatedAt ? formatDate(agreement.activatedAt) : "Ikke aktivert"} />
      </dl>

      {agreement?.expiresAt ? (
        <p className="mt-4 rounded-xl bg-[#F7F9FC] px-4 py-3 text-sm font-semibold text-[#5F6F82]">
          Tilgang er registrert til {formatDate(agreement.expiresAt)}.
        </p>
      ) : null}

      <p className="mt-4 rounded-xl bg-[#F7F9FC] px-4 py-3 text-sm leading-6 text-[#5F6F82]">
        Det er ingen bindingstid. Du kan stoppe fast trekk når du vil. Tilgang beholdes ut perioden du allerede
        har betalt for dersom dette støttes av gjeldende betalingslogikk.
      </p>

      {!paymentsConfigured ? (
        <p className="mt-4 rounded-xl bg-[#FFF6E8] px-4 py-3 text-sm font-semibold text-[#8A4B13]">
          Vipps-betaling er ikke tilgjengelig akkurat nå. Du kan fortsatt bruke gratisplanen.
        </p>
      ) : null}

      {isPaidPlan ? (
        <div className="mt-5">
          {canCancel ? (
            <button
              className="rounded-xl border border-[#F3C3CC] px-5 py-3 text-sm font-bold text-[#C8102E] hover:bg-[#F5E6E9] disabled:opacity-50"
              disabled={isCancelling}
              onClick={onCancel}
              type="button"
            >
              {isCancelling ? "Stopper avtale..." : "Stopp fast trekk"}
            </button>
          ) : (
            <p className="text-sm font-semibold text-[#5F6F82]">
              {agreement ? "Denne betalingsavtalen kan ikke stoppes fra denne statusen." : "Ingen aktiv Vipps-avtale er funnet."}
            </p>
          )}
        </div>
      ) : showPricingLink ? (
        <div className="mt-5 rounded-xl border border-dashed border-[#C8D4E2] bg-[#F7F9FC] p-4">
          <p className="text-sm font-extrabold text-[#0D1B2A]">Ingen betalingshistorikk ennå</p>
          <p className="mt-1 text-sm leading-6 text-[#5F6F82]">
            Du bruker gratisplanen. Når du starter Premium, vises betalingsstatusen her.
          </p>
          <a
            className="mt-3 inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
            href="/pricing"
          >
            Se Premium
          </a>
        </div>
      ) : (
        <p className="mt-5 text-sm font-semibold text-[#5F6F82]">
          Det finnes ingen aktiv betalingsavtale for denne kontoen.
        </p>
      )}
    </section>
  );
}

function BillingDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F7F9FC] p-4 ring-1 ring-[#E6EDF5]">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">{label}</dt>
      <dd className="mt-2 text-sm font-extrabold text-[#0D1B2A]">{value}</dd>
    </div>
  );
}

function VippsLogo() {
  return (
    <Image
      alt="Vipps"
      className="h-8 w-auto object-contain"
      height={44}
      src={vippsLoginButtonAsset}
      width={160}
    />
  );
}

function formatPlan(plan: string) {
  const labels: Record<string, string> = {
    free: "Gratis",
    beta: "Premium",
    premium: "Premium",
    admin: "Admin",
  };

  return labels[plan] ?? plan;
}

function formatBillingInterval(interval: string) {
  const labels: Record<string, string> = {
    month: "Månedlig",
    monthly: "Månedlig",
    year: "Årlig",
    yearly: "Årlig",
  };

  return labels[interval] ?? interval;
}

function formatBillingStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "Venter på godkjenning",
    active: "Aktiv",
    cancellation_pending: "Avslutning sendt",
    cancelled: "Avsluttet",
    expired: "Utløpt",
    failed: "Feilet",
    aborted: "Avbrutt",
    terminated: "Stoppet",
  };

  return labels[status] ?? status;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
