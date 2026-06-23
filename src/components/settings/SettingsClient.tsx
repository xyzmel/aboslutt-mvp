"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { PremiumUpgradeDialog } from "@/components/billing/PremiumUpgradeDialog";
import { AuthPageHeader } from "@/components/ui/AuthPageHeader";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useToast } from "@/components/ui/ToastProvider";
import { resetAnalyticsIdentity } from "@/lib/analytics";

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

type NormalizedSettingsBillingState = {
  currentPlan: string;
  entitlementActive: boolean;
  subscriptionStatus: string;
  price: number | null;
  currency: string | null;
  billingInterval: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  historicalAgreement: SettingsBillingAgreement | null;
};

type SettingsClientProps = {
  name: string | null;
  email: string | null;
  billingAgreement: SettingsBillingAgreement | null;
  billingState: NormalizedSettingsBillingState;
  googleConnected: boolean;
  gmailScopeConnected: boolean;
  googleMailConnectEnabled: boolean;
  googleReconnectRequired: boolean;
  isAdmin: boolean;
  microsoftConfigured: boolean;
  microsoftConnected: boolean;
  microsoftEmail: string | null;
  microsoftReconnectRequired: boolean;
  plan: string;
  emailRemindersEnabled: boolean;
  emailRemindersAvailable: boolean;
  reminderDaysBefore: number;
  monthlySummaryEnabled: boolean;
  monthlySummaryAvailable: boolean;
  paymentsConfigured: boolean;
};

type NotificationForm = {
  emailRemindersEnabled: boolean;
  reminderDaysBefore: number;
  monthlySummaryEnabled: boolean;
};

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#C8102E] px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-[#C8102E]/15 transition hover:bg-[#a90d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55";
const primaryLinkClass = primaryButtonClass;
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DBE4EE] bg-white px-4 py-2.5 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50 hover:bg-[#FFF8F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55";
const secondaryLinkClass = secondaryButtonClass;

export function SettingsClient({
  name,
  email,
  billingAgreement,
  billingState,
  googleConnected,
  googleMailConnectEnabled,
  googleReconnectRequired,
  isAdmin,
  microsoftConfigured,
  microsoftConnected,
  microsoftEmail,
  microsoftReconnectRequired,
  plan,
  emailRemindersEnabled,
  emailRemindersAvailable,
  reminderDaysBefore,
  monthlySummaryEnabled,
  monthlySummaryAvailable,
  paymentsConfigured,
}: SettingsClientProps) {
  const { showToast } = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isDisconnectingOutlook, setIsDisconnectingOutlook] = useState(false);
  const [billingStatus, setBillingStatus] = useState(billingAgreement?.status ?? null);
  const [normalizedBillingState, setNormalizedBillingState] = useState(billingState);
  const [isCancellingBilling, setIsCancellingBilling] = useState(false);
  const [premiumDialogReason, setPremiumDialogReason] = useState<string | null>(null);
  const [notificationForm, setNotificationForm] = useState<NotificationForm>({
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
      showToast({
        title: "Abonnementer slettet",
        message: "Alle abonnementene dine er fjernet.",
        tone: "success",
      });
    } catch {
      const userMessage = "Kunne ikke slette abonnementene akkurat nå.";
      setMessage(userMessage);
      showToast({ title: "Sletting feilet", message: userMessage, tone: "error" });
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteAccountData() {
    if (!window.confirm("Vil du slette kontoen din? Du blir logget ut etterpå.")) {
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Kunne ikke slette kontoen.");
      }
      showToast({
        title: "Kontoen slettes",
        message: "Du logges ut når slettingen er fullført.",
        tone: "success",
      });
      await signOut({ callbackUrl: "/login" });
    } catch {
      const userMessage = "Kunne ikke slette kontoen akkurat nå.";
      setMessage(userMessage);
      showToast({ title: "Sletting feilet", message: userMessage, tone: "error" });
      setIsWorking(false);
    }
  }

  async function disconnectOutlook() {
    if (!window.confirm("Vil du koble fra Outlook?")) {
      return;
    }

    setIsDisconnectingOutlook(true);
    setMessage(null);

    try {
      const response = await fetch("/api/import/microsoft/disconnect", { method: "POST" });
      if (!response.ok) {
        throw new Error("Kunne ikke koble fra Outlook.");
      }
      setMessage("Outlook er koblet fra.");
      showToast({
        title: "Outlook koblet fra",
        message: "Tilkoblingen er fjernet.",
        tone: "success",
      });
      window.location.reload();
    } catch {
      const userMessage = "Kunne ikke koble fra Outlook akkurat nå.";
      setMessage(userMessage);
      showToast({ title: "Frakobling feilet", message: userMessage, tone: "error" });
    } finally {
      setIsDisconnectingOutlook(false);
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
        preferences?: NotificationForm;
      };

      if (!response.ok) {
        throw new Error("Kunne ikke lagre varselinnstillinger.");
      }

      if (result.preferences) {
        setNotificationForm(result.preferences);
      }
      setMessage("Varselinnstillinger er lagret.");
      showToast({ title: "Varsler lagret", message: "Innstillingene er oppdatert.", tone: "success" });
    } catch {
      const userMessage = "Kunne ikke lagre varselinnstillinger akkurat nå.";
      setMessage(userMessage);
      showToast({ title: "Lagring feilet", message: userMessage, tone: "error" });
    } finally {
      setIsWorking(false);
    }
  }

  function updateNotificationForm(update: Partial<NotificationForm>) {
    const nextForm = { ...notificationForm, ...update };
    setNotificationForm(nextForm);
    saveNotificationPreferences(nextForm);
  }

  async function cancelBillingAgreement() {
    const confirmed = window.confirm(
      "Vil du stoppe den faste betalingen for Aboslutt Premium? Du beholder tilgang ut perioden som allerede er betalt når sluttdatoen er registrert.",
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
      };

      if (!response.ok || !result.ok) {
        throw new Error("Kunne ikke stoppe betalingsavtalen akkurat nå.");
      }

      setBillingStatus(result.status ?? "cancellation_pending");
      setNormalizedBillingState((current) => ({
        ...current,
        subscriptionStatus: "cancellation_scheduled",
      }));
      setMessage("Betalingsavtalen er sendt til avslutning.");
      showToast({
        title: "Avtale sendt til avslutning",
        message: "Vi oppdaterer status når endringen er bekreftet.",
        tone: "success",
      });
    } catch {
      const userMessage = "Kunne ikke stoppe betalingsavtalen akkurat nå.";
      setMessage(userMessage);
      showToast({ title: "Avslutning feilet", message: userMessage, tone: "error" });
    } finally {
      setIsCancellingBilling(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 lg:py-7">
      <AuthPageHeader
        description="Administrer plan, profil, tilkoblinger og varsler for Aboslutt-kontoen din."
        eyebrow="Konto"
        title="Innstillinger"
      />

      {message ? (
        <div className="mt-5 rounded-2xl bg-white p-4 text-sm font-semibold text-[#0D1B2A] shadow-sm ring-1 ring-[#DBE4EE]">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        <BillingSection
          agreement={billingAgreement ? { ...billingAgreement, status: billingStatus ?? billingAgreement.status } : null}
          billingState={normalizedBillingState}
          isAdmin={isAdmin}
          isCancelling={isCancellingBilling}
          onCancel={cancelBillingAgreement}
          onUpgrade={() => setPremiumDialogReason("Se hva Premium inkluderer før du eventuelt fortsetter med Vipps.")}
          paymentsConfigured={paymentsConfigured}
          plan={plan}
        />

        <SectionCard
          description="Dette vises på kontoen din og brukes til innlogging og kvitteringer."
          title="Profil"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <InfoItem label="Navn" value={name ?? "Ikke satt"} />
            <InfoItem label="E-post" value={email ?? "Ikke satt"} />
            <LoadingButton
              className="w-full sm:w-auto"
              onClick={() => {
                resetAnalyticsIdentity();
                signOut({ callbackUrl: "/login" });
              }}
              type="button"
              variant="secondary"
            >
              Logg ut
            </LoadingButton>
          </div>
        </SectionCard>

        <SectionCard
          description="Koble til e-postkontoer du vil bruke for å finne mulige abonnementer."
          title="Tilkoblinger"
        >
          <div className="grid gap-3">
            {!googleMailConnectEnabled ? (
              <ConnectionRow
                description="Gmail-import blir tilgjengelig når godkjenningen er fullført."
                logoAlt="Gmail"
                logoSrc="/gmail.png"
                primaryAction={
                  <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F8F1E8] px-4 py-2.5 text-sm font-bold text-[#8A4B13]">
                    Midlertidig utilgjengelig
                  </span>
                }
                status="Midlertidig utilgjengelig"
                statusTone="warning"
                title="Gmail"
              />
            ) : (
            <ConnectionRow
              description="Finn mulige abonnementer fra Gmail-kvitteringer når du selv starter en skanning."
              logoAlt="Gmail"
              logoSrc="/gmail.png"
              primaryAction={
                googleConnected ? (
                  <a className={primaryLinkClass} href="/import/email">
                    Administrer
                  </a>
                ) : (
                  <button
                    className={primaryButtonClass}
                    onClick={() => signIn("google", { callbackUrl: "/settings" })}
                    type="button"
                  >
                    {googleReconnectRequired ? "Koble til på nytt" : "Koble til Gmail"}
                  </button>
                )
              }
              secondaryAction={
                googleMailConnectEnabled && googleConnected ? (
                  <a
                    className={secondaryLinkClass}
                    href="https://myaccount.google.com/permissions"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Koble fra
                  </a>
                ) : null
              }
              status={googleConnected ? "Tilkoblet" : googleReconnectRequired ? "Må kobles til på nytt" : "Ikke tilkoblet"}
              statusTone={googleConnected ? "success" : googleReconnectRequired ? "warning" : "neutral"}
              title="Gmail"
            />
            )}

            {microsoftConfigured || microsoftConnected || microsoftReconnectRequired ? (
              <ConnectionRow
                description="Finn mulige abonnementer fra Outlook-kvitteringer når du selv starter en skanning."
                detail={microsoftConnected ? microsoftEmail : null}
                logoAlt="Outlook"
                logoSrc="/outlook.png"
                primaryAction={
                  microsoftConnected ? (
                    <a className={primaryLinkClass} href="/import/email">
                      Administrer
                    </a>
                  ) : (
                    <a className={primaryLinkClass} href="/api/import/microsoft/connect">
                      {microsoftReconnectRequired ? "Koble til på nytt" : "Koble til Outlook"}
                    </a>
                  )
                }
                secondaryAction={
                  microsoftConnected ? (
                    <button
                      className={secondaryButtonClass}
                      disabled={isDisconnectingOutlook}
                      onClick={disconnectOutlook}
                      type="button"
                    >
                      {isDisconnectingOutlook ? "Kobler fra..." : "Koble fra"}
                    </button>
                  ) : null
                }
                status={microsoftConnected ? "Tilkoblet" : microsoftReconnectRequired ? "Må kobles til på nytt" : "Ikke tilkoblet"}
                statusTone={microsoftConnected ? "success" : microsoftReconnectRequired ? "warning" : "neutral"}
                title="Outlook"
              />
            ) : null}
          </div>
        </SectionCard>

        <NotificationsSection
          emailRemindersAvailable={emailRemindersAvailable}
          isWorking={isWorking}
          monthlySummaryAvailable={monthlySummaryAvailable}
          notificationForm={notificationForm}
          onPremiumClick={() =>
            setPremiumDialogReason("Premium gir e-postvarsler før kommende trekk og en månedlig oppsummering.")
          }
          onUpdate={updateNotificationForm}
        />

        <SectionCard
          description="Se vilkår, kontakt oss eller slett data du ikke vil beholde."
          title="Personvern og konto"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a className={secondaryLinkClass} href="/privacy">
              Personvernerklæring
            </a>
            <a className={secondaryLinkClass} href="/terms">
              Vilkår
            </a>
            <a className={secondaryLinkClass} href="/terms/sales">
              Salgsbetingelser
            </a>
            <a className={secondaryLinkClass} href="mailto:kontakt@aboslutt.no">
              Kontakt support
            </a>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-[#E6EDF5] pt-5 sm:flex-row">
            <LoadingButton
              className="w-full sm:w-auto"
              isLoading={isWorking}
              loadingLabel="Sletter..."
              onClick={deleteAllSubscriptions}
              type="button"
              variant="destructive"
            >
              Slett alle abonnementer
            </LoadingButton>
            <LoadingButton
              className="w-full sm:w-auto"
              isLoading={isWorking}
              loadingLabel="Sletter..."
              onClick={deleteAccountData}
              type="button"
              variant="destructive"
            >
              Slett konto
            </LoadingButton>
          </div>
        </SectionCard>
      </div>

      <PremiumUpgradeDialog
        onClose={() => setPremiumDialogReason(null)}
        open={Boolean(premiumDialogReason)}
        reason={premiumDialogReason ?? undefined}
      />
    </section>
  );
}

function SectionCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="mb-5">
        <h2 className="text-lg font-extrabold tracking-tight text-[#0D1B2A]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#5F6F82]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F7F9FC] px-4 py-3 ring-1 ring-[#E6EDF5]">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">{label}</dt>
      <dd className="mt-1 truncate text-sm font-extrabold text-[#0D1B2A]" title={value}>
        {value}
      </dd>
    </div>
  );
}

function ConnectionRow({
  description,
  detail,
  logoAlt,
  logoSrc,
  primaryAction,
  secondaryAction,
  status,
  statusTone,
  title,
}: {
  description: string;
  detail?: string | null;
  logoAlt: string;
  logoSrc: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  status: string;
  statusTone: "success" | "warning" | "neutral";
  title: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#F7F9FC] p-4 ring-1 ring-[#E6EDF5] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-2 ring-1 ring-[#DBE4EE]">
          <Image alt={logoAlt} className="h-8 w-8 object-contain" height={32} src={logoSrc} width={32} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold tracking-tight text-[#0D1B2A]">{title}</h3>
            <StatusBadge label={status} tone={statusTone} />
          </div>
          <p className="mt-1 text-sm leading-6 text-[#5F6F82]">{description}</p>
          {detail ? (
            <p className="mt-1 max-w-xs truncate text-sm font-semibold text-[#0D1B2A]" title={detail}>
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        {primaryAction}
        {secondaryAction}
      </div>
    </div>
  );
}

function NotificationsSection({
  emailRemindersAvailable,
  isWorking,
  monthlySummaryAvailable,
  notificationForm,
  onPremiumClick,
  onUpdate,
}: {
  emailRemindersAvailable: boolean;
  isWorking: boolean;
  monthlySummaryAvailable: boolean;
  notificationForm: NotificationForm;
  onPremiumClick: () => void;
  onUpdate: (update: Partial<NotificationForm>) => void;
}) {
  const notificationsAvailable = emailRemindersAvailable || monthlySummaryAvailable;

  return (
    <SectionCard
      description="Velg hvordan Aboslutt skal minne deg på kommende trekk og oppsummere måneden."
      title="Varsler"
    >
      {!notificationsAvailable ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#F3C3CC] bg-[#FFF8F9] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold text-[#0D1B2A]">Varsler er inkludert i Premium</p>
            <p className="mt-1 text-sm leading-6 text-[#5F6F82]">
              Få e-post før kommende trekk og en månedlig oversikt over abonnementene dine.
            </p>
          </div>
          <button className={`${primaryButtonClass} w-full sm:w-auto`} onClick={onPremiumClick} type="button">
            Se Premium
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {emailRemindersAvailable ? (
            <>
              <ToggleRow
                checked={notificationForm.emailRemindersEnabled}
                description="Vi sender en e-post før datoen du har lagt inn på abonnementet."
                disabled={isWorking}
                label="Påminnelse før trekk"
                onChange={(checked) => onUpdate({ emailRemindersEnabled: checked })}
              />
              <label className="text-sm font-semibold text-[#4A5568]">
                Send påminnelse
                <select
                  className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A] focus:ring-2 focus:ring-[#C8102E]/20"
                  disabled={isWorking || !notificationForm.emailRemindersEnabled}
                  onChange={(event) => onUpdate({ reminderDaysBefore: Number(event.target.value) })}
                  value={notificationForm.reminderDaysBefore}
                >
                  <option value={1}>1 dag før</option>
                  <option value={3}>3 dager før</option>
                  <option value={7}>7 dager før</option>
                </select>
              </label>
            </>
          ) : null}

          {monthlySummaryAvailable ? (
            <ToggleRow
              checked={notificationForm.monthlySummaryEnabled}
              description="En kort e-post med aktive abonnementer og kommende trekk."
              disabled={isWorking}
              label="Månedlig oppsummering"
              onChange={(checked) => onUpdate({ monthlySummaryEnabled: checked })}
            />
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

function ToggleRow({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl bg-[#F7F9FC] p-4 text-sm ring-1 ring-[#E6EDF5]">
      <span>
        <span className="block font-bold text-[#0D1B2A]">{label}</span>
        <span className="mt-1 block text-[#5F6F82]">{description}</span>
      </span>
      <input
        checked={checked}
        className="mt-1 h-5 w-5 shrink-0 accent-[#C8102E]"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function BillingSection({
  agreement,
  billingState,
  isAdmin,
  isCancelling,
  onCancel,
  onUpgrade,
  paymentsConfigured,
  plan,
}: {
  agreement: SettingsBillingAgreement | null;
  billingState: NormalizedSettingsBillingState;
  isAdmin: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  onUpgrade: () => void;
  paymentsConfigured: boolean;
  plan: string;
}) {
  const isPaidPlan = billingState.currentPlan === "premium";
  const planLabel = formatNormalizedPlan(billingState.currentPlan, isAdmin, plan);
  const showPricingLink = billingState.currentPlan === "free" && !isAdmin;
  const canCancel = isPaidPlan && agreement?.status === "active";

  return (
    <SectionCard
      description="Se plan, pris og status for Premium-betalingen din."
      title="Abonnement og betaling"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <dl className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <BillingDetail label="Plan" value={planLabel} />
          <BillingDetail label="Intervall" value={formatNormalizedBillingInterval(billingState.billingInterval)} />
          <BillingDetail label="Pris" value={formatNormalizedPrice(billingState)} />
          <BillingDetail label="Status" value={formatNormalizedBillingStatus(billingState.subscriptionStatus)} />
          <BillingDetail label="Tilgang" value={formatAccessState(billingState)} />
        </dl>
        <StatusBadge label={planLabel} tone={isPaidPlan || isAdmin ? "success" : "neutral"} />
      </div>

      {isPaidPlan && billingState.expiresAt ? (
        <p className="mt-4 rounded-xl bg-[#F7F9FC] px-4 py-3 text-sm font-semibold text-[#5F6F82]">
          Tilgang er registrert til {formatDate(billingState.expiresAt)}.
        </p>
      ) : null}

      {billingState.currentPlan === "free" && billingState.historicalAgreement ? (
        <PreviousBillingAgreement agreement={billingState.historicalAgreement} />
      ) : null}

      <p className="mt-4 rounded-xl bg-[#F7F9FC] px-4 py-3 text-sm leading-6 text-[#5F6F82]">
        Det er ingen bindingstid. Fast betaling kan stoppes når du vil, og tilgang beholdes ut perioden som
        allerede er betalt når sluttdatoen er registrert.
      </p>

      {!paymentsConfigured && showPricingLink ? (
        <p className="mt-4 rounded-xl bg-[#FFF6E8] px-4 py-3 text-sm font-semibold text-[#8A4B13]">
          Denne funksjonen er midlertidig utilgjengelig.
        </p>
      ) : null}

      {isPaidPlan ? (
        <div className="mt-5">
          {canCancel ? (
            <LoadingButton
              isLoading={isCancelling}
              loadingLabel="Stopper avtale..."
              onClick={onCancel}
              type="button"
              variant="destructive"
            >
              Stopp fast betaling
            </LoadingButton>
          ) : (
            <p className="text-sm font-semibold text-[#5F6F82]">
              {agreement ? "Betalingsstatusen oppdateres automatisk." : "Ingen aktiv betalingsavtale er funnet."}
            </p>
          )}
        </div>
      ) : showPricingLink ? (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#DBE4EE] bg-[#F7F9FC] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold text-[#0D1B2A]">Du bruker gratisplanen</p>
            <p className="mt-1 text-sm leading-6 text-[#5F6F82]">
              Du kan legge inn og holde oversikt over abonnementene dine gratis.
            </p>
          </div>
          <button className={`${primaryButtonClass} w-full sm:w-auto`} onClick={onUpgrade} type="button">
            Se Premium
          </button>
        </div>
      ) : (
        <p className="mt-5 text-sm font-semibold text-[#5F6F82]">Det finnes ingen aktiv betalingsavtale for denne kontoen.</p>
      )}
    </SectionCard>
  );
}

function BillingDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F7F9FC] px-4 py-3 ring-1 ring-[#E6EDF5]">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">{label}</dt>
      <dd className="mt-1 text-sm font-extrabold text-[#0D1B2A]">{value}</dd>
    </div>
  );
}

function PreviousBillingAgreement({ agreement }: { agreement: SettingsBillingAgreement }) {
  const endedAt = agreement.expiresAt ?? agreement.cancelledAt;
  const description =
    agreement.status === "expired" && endedAt
      ? `Premium utløp ${formatDate(endedAt)}.`
      : agreement.status === "cancelled" && endedAt
        ? `Premium ble avsluttet ${formatDate(endedAt)}.`
        : `Siste Premium-status: ${formatBillingStatus(agreement.status)}.`;

  return (
    <div className="mt-4 rounded-xl bg-[#F7F9FC] px-4 py-3 text-sm text-[#5F6F82] ring-1 ring-[#E6EDF5]">
      <p className="font-extrabold text-[#0D1B2A]">Tidligere abonnement</p>
      <p className="mt-1 font-semibold">{description}</p>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "warning" | "neutral" }) {
  const toneClass = {
    success: "bg-[#EAF8EF] text-[#1F7A3A] ring-[#BFE8CB]",
    warning: "bg-[#FFF6E8] text-[#8A4B13] ring-[#F2D2A4]",
    neutral: "bg-white text-[#5F6F82] ring-[#DBE4EE]",
  }[tone];

  return (
    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${toneClass}`}>
      {label}
    </span>
  );
}

function formatNormalizedPlan(currentPlan: string, isAdmin: boolean, rawPlan: string) {
  if (isAdmin && rawPlan === "admin") {
    return "Admin";
  }

  return currentPlan === "premium" ? "Premium" : "Gratis";
}

function formatNormalizedBillingInterval(interval: string | null) {
  if (interval === "monthly") {
    return "Månedlig";
  }

  if (interval === "yearly") {
    return "Årlig";
  }

  return "Ingen betaling";
}

function formatNormalizedPrice(state: NormalizedSettingsBillingState) {
  if (state.currentPlan === "free") {
    return "0 kr";
  }

  if (typeof state.price === "number" && state.currency) {
    return `${state.price} ${state.currency}`;
  }

  return "-";
}

function formatNormalizedBillingStatus(status: string) {
  const labels: Record<string, string> = {
    active: "Aktiv",
    pending: "Venter på godkjenning",
    cancellation_scheduled: "Avslutning registrert",
    cancelled: "Avsluttet",
    expired: "Utløpt",
    none: "Aktiv",
  };

  return labels[status];
}

function formatAccessState(state: NormalizedSettingsBillingState) {
  if (state.currentPlan === "free") {
    return "Gratisplan aktiv";
  }

  if (state.activatedAt) {
    return `Aktivert ${formatDate(state.activatedAt)}`;
  }

  return "Premium aktiv";
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
