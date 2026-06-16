"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ConfirmCancellation } from "@/components/cancellation/ConfirmCancellation";
import { SuccessScreen } from "@/components/cancellation/SuccessScreen";
import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { PlanStatusCard } from "@/components/plans/PlanStatusCard";
import { getCancellationStatusLabel } from "@/lib/cancellation";
import {
  formatDateForShortDisplay,
  normalizeDateInputValue,
  parseNextPaymentDate,
  startOfDay,
} from "@/lib/subscription-dates";
import type {
  BillingInterval,
  Subscription,
  SubscriptionCategory,
  SubscriptionStatus,
} from "@/types/subscription";

type DashboardStep = "overview" | "confirm" | "success";
type CategoryFilter = "all" | SubscriptionCategory;
type UpcomingPayment = {
  subscription: Subscription;
  paymentDate: Date;
};

type SubscriptionForm = {
  name: string;
  category: SubscriptionCategory;
  monthlyCost: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  nextPayment: string;
  note: string;
};

const filters: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "streaming", label: "Streaming" },
  { value: "software", label: "Programvare" },
  { value: "news", label: "Nyheter" },
  { value: "health", label: "Helse" },
];

const defaultForm: SubscriptionForm = {
  name: "",
  category: "streaming",
  monthlyCost: "",
  status: "active",
  billingInterval: "monthly",
  nextPayment: "",
  note: "",
};

const categoryOptions: [SubscriptionCategory, string][] = [
  ["streaming", "Streaming"],
  ["software", "Programvare"],
  ["news", "Nyheter"],
  ["health", "Helse"],
];

const statusOptions: [SubscriptionStatus, string][] = [
  ["active", "Aktiv"],
  ["trial", "Prøveperiode"],
  ["yearly", "Årlig"],
  ["cancelled", "Avsluttet"],
];

const billingIntervalOptions: [BillingInterval, string][] = [
  ["monthly", "Månedlig"],
  ["yearly", "Årlig"],
  ["unknown", "Ukjent"],
];

export function DashboardClient() {
  const { data: session } = useSession();
  const [subscriptionList, setSubscriptionList] = useState<Subscription[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>("all");
  const [step, setStep] = useState<DashboardStep>("overview");
  const [lastCancelledCount, setLastCancelledCount] = useState(0);
  const [lastMonthlySavings, setLastMonthlySavings] = useState(0);
  const [form, setForm] = useState<SubscriptionForm>(defaultForm);
  const [editForm, setEditForm] = useState<SubscriptionForm>(defaultForm);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(false);
  const [hasGoogleGmailConnected, setHasGoogleGmailConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubscriptions() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/subscriptions", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Kunne ikke hente abonnementer.");
        }
        const subscriptions = (await response.json()) as Subscription[];
        setSubscriptionList(subscriptions);

        const meResponse = await fetch("/api/me", { cache: "no-store" });
        if (meResponse.ok) {
          const meResult = (await meResponse.json()) as {
            user?: { plan?: string; emailRemindersEnabled?: boolean };
          };
          setCurrentPlan(meResult.user?.plan ?? "free");
          setEmailRemindersEnabled(Boolean(meResult.user?.emailRemindersEnabled));
        }

        const connectionsResponse = await fetch("/api/connections", { cache: "no-store" });
        if (connectionsResponse.ok) {
          const connections = (await connectionsResponse.json()) as { gmailScopeConnected?: boolean };
          setHasGoogleGmailConnected(Boolean(connections.gmailScopeConnected));
        }
      } catch {
        setErrorMessage("Kunne ikke hente abonnementer fra databasen.");
      } finally {
        setIsLoading(false);
      }
    }

    loadSubscriptions();
  }, []);

  const cancellableSubscriptions = subscriptionList.filter(
    (subscription) => subscription.status !== "cancelled",
  );
  const visibleSubscriptions = subscriptionList.filter(
    (subscription) => activeFilter === "all" || subscription.category === activeFilter,
  );
  const selectedSubscriptions = subscriptionList.filter((subscription) =>
    selectedIds.includes(subscription.id),
  );

  const totalMonthlyCost = useMemo(
    () =>
      subscriptionList
        .filter((subscription) => subscription.status !== "cancelled")
        .reduce((sum, subscription) => sum + getMonthlyEquivalent(subscription), 0),
    [subscriptionList],
  );
  const yearlyEstimate = totalMonthlyCost * 12;
  const activeCount = subscriptionList.filter((subscription) =>
    ["active", "trial", "yearly"].includes(subscription.status),
  ).length;
  const trialCount = subscriptionList.filter((subscription) => subscription.status === "trial").length;
  const monthlySavings = selectedSubscriptions.reduce(
    (sum, subscription) => sum + getMonthlyEquivalent(subscription),
    0,
  );
  const upcomingPayments = useMemo(() => getUpcomingPayments(subscriptionList), [subscriptionList]);
  const cancellationFollowUps = useMemo(() => getCancellationFollowUps(subscriptionList), [subscriptionList]);
  const hasSubscriptions = subscriptionList.length > 0;
  const hasAnyNextPayment = subscriptionList.some((subscription) =>
    Boolean(parseNextPaymentDate(subscription.nextPayment)),
  );
  const showOnboardingChecklist =
    !hasSubscriptions ||
    !hasAnyNextPayment ||
    !emailRemindersEnabled ||
    !hasGoogleGmailConnected ||
    totalMonthlyCost <= 0;
  const isDevelopment = process.env.NODE_ENV !== "production";

  function toggleSubscription(id: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((selectedId) => selectedId !== id)
        : [...currentIds, id],
    );
  }

  function toggleSelectAll() {
    const visibleCancellableIds = visibleSubscriptions
      .filter((subscription) => subscription.status !== "cancelled")
      .map((subscription) => subscription.id);
    const allVisibleSelected = visibleCancellableIds.every((id) => selectedIds.includes(id));

    setSelectedIds((currentIds) =>
      allVisibleSelected
        ? currentIds.filter((id) => !visibleCancellableIds.includes(id))
        : Array.from(new Set([...currentIds, ...visibleCancellableIds])),
    );
  }

  async function addSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          monthlyCost: Number(form.monthlyCost),
        }),
      });

      if (!response.ok) {
        throw new Error("Kunne ikke legge til abonnementet.");
      }

      const subscription = (await response.json()) as Subscription;
      setSubscriptionList((currentSubscriptions) => [...currentSubscriptions, subscription]);
      setForm(defaultForm);
    } catch {
      setErrorMessage("Kunne ikke legge til abonnementet.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSubscription(id: string) {
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Kunne ikke slette abonnementet.");
      }

      setSubscriptionList((currentSubscriptions) =>
        currentSubscriptions.filter((subscription) => subscription.id !== id),
      );
      setSelectedIds((currentIds) => currentIds.filter((selectedId) => selectedId !== id));
    } catch {
      setErrorMessage("Kunne ikke slette abonnementet.");
    }
  }

  function startEditingSubscription(subscription: Subscription) {
    setEditingSubscription(subscription);
    setEditForm({
      name: subscription.name,
      category: subscription.category,
      monthlyCost: String(subscription.monthlyCost),
      status: subscription.status,
      billingInterval: subscription.billingInterval ?? "monthly",
      nextPayment: normalizeDateInputValue(subscription.nextPayment),
      note: subscription.note ?? "",
    });
  }

  async function updateSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingSubscription) {
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/subscriptions/${editingSubscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          monthlyCost: Number(editForm.monthlyCost),
        }),
      });

      if (!response.ok) {
        throw new Error("Kunne ikke oppdatere abonnementet.");
      }

      const updatedSubscription = (await response.json()) as Subscription;
      setSubscriptionList((currentSubscriptions) =>
        currentSubscriptions.map((subscription) =>
          subscription.id === updatedSubscription.id ? updatedSubscription : subscription,
        ),
      );
      setEditingSubscription(null);
      setEditForm(defaultForm);
    } catch {
      setErrorMessage("Kunne ikke oppdatere abonnementet.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function confirmCancellation() {
    const subscriptionsToCancel = [...selectedSubscriptions];
    setErrorMessage(null);

    try {
      const updatedSubscriptions = await Promise.all(
        subscriptionsToCancel.map(async (subscription) => {
          const response = await fetch(`/api/subscriptions/${subscription.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          });

          if (!response.ok) {
            throw new Error("Kunne ikke avslutte abonnementet.");
          }

          return (await response.json()) as Subscription;
        }),
      );

      const updatedById = new Map(
        updatedSubscriptions.map((subscription) => [subscription.id, subscription]),
      );
      setLastCancelledCount(subscriptionsToCancel.length);
      setLastMonthlySavings(monthlySavings);
      setSubscriptionList((currentSubscriptions) =>
        currentSubscriptions.map((subscription) => updatedById.get(subscription.id) ?? subscription),
      );
      setSelectedIds([]);
      setStep("success");
    } catch {
      setErrorMessage("Kunne ikke lagre avslutningen. Prøv igjen.");
      setStep("overview");
    }
  }

  async function updateCancellationRequest(
    subscription: Subscription,
    action: "send" | "status",
    status?: "confirmed_cancelled" | "manual_required",
  ) {
    if (!subscription.cancellationRequest) {
      return;
    }

    setErrorMessage(null);

    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/cancellation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          requestId: subscription.cancellationRequest.id,
          status,
        }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(result.message ?? "Kunne ikke oppdatere oppsigelsen.");
      }

      const subscriptionsResponse = await fetch("/api/subscriptions", { cache: "no-store" });
      if (subscriptionsResponse.ok) {
        setSubscriptionList((await subscriptionsResponse.json()) as Subscription[]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Kunne ikke oppdatere oppsigelsen.");
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] pb-28 text-[#0D1B2A]">
      <AppHeader />

      <section className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-[#F3C3CC] bg-[#F5E6E9] p-4 text-sm font-semibold text-[#C8102E]">
            {errorMessage}
          </div>
        ) : null}

        {step === "confirm" ? (
          <ConfirmCancellation
            monthlySavings={monthlySavings}
            onBack={() => setStep("overview")}
            onConfirm={confirmCancellation}
            selectedSubscriptions={selectedSubscriptions}
          />
        ) : null}

        {step === "success" ? (
          <SuccessScreen
            cancelledCount={lastCancelledCount}
            monthlySavings={lastMonthlySavings}
            onDone={() => setStep("overview")}
          />
        ) : null}

        {step === "overview" ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">
                  {isDevelopment && !session ? "Lokal utvikling" : "Oversikt"}
                </p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Abonnementene dine
                </h1>
              </div>
              <button
                className="rounded-xl border border-[#DBE4EE] bg-white px-4 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
                onClick={toggleSelectAll}
                type="button"
              >
                Velg alle synlige
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Totalt per måned" value={`${totalMonthlyCost} kr`} />
              <SummaryCard label="Aktive abonnementer" value={String(activeCount)} />
              <SummaryCard label="Estimert per år" value={`${formatCurrency(yearlyEstimate)} kr`} />
              <SummaryCard label="Prøveperioder" value={String(trialCount)} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <PlanStatusCard plan={currentPlan} />
              {showOnboardingChecklist ? (
                <OnboardingChecklist
                  emailRemindersEnabled={emailRemindersEnabled}
                  hasAnyNextPayment={hasAnyNextPayment}
                  hasGoogleGmailConnected={hasGoogleGmailConnected}
                  hasSubscriptions={hasSubscriptions}
                  monthlyTotal={totalMonthlyCost}
                />
              ) : (
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
                  <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Kom i gang</p>
                  <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Oppstarten ser bra ut</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
                    Du har lagt inn abonnementer, datoer, varsler, Gmail og månedlig total.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <UpcomingPayments subscriptions={upcomingPayments} />
              <SavingsInsight
                monthlySavings={monthlySavings}
                selectedCount={selectedIds.length}
                trialCount={trialCount}
              />
            </div>

            {cancellationFollowUps.length > 0 ? (
              <CancellationFollowUpSection
                onAction={updateCancellationRequest}
                subscriptions={cancellationFollowUps}
              />
            ) : null}

            <form
              className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]"
              id="manual-add"
              onSubmit={addSubscription}
            >
              <h2 className="text-lg font-extrabold tracking-tight">Legg til abonnement</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-6">
                <TextInput
                  label="Navn"
                  onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                  placeholder="F.eks. HBO Max"
                  value={form.name}
                />
                <TextInput
                  inputMode="numeric"
                  label="Kr/mnd"
                  onChange={(value) => setForm((current) => ({ ...current, monthlyCost: value }))}
                  placeholder="149"
                  value={form.monthlyCost}
                />
                <SelectInput
                  label="Kategori"
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      category: value as SubscriptionCategory,
                    }))
                  }
                  options={[...categoryOptions]}
                  value={form.category}
                />
                <SelectInput
                  label="Status"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, status: value as SubscriptionStatus }))
                  }
                  options={[
                    ["active", "Aktiv"],
                    ["trial", "Prøveperiode"],
                    ["yearly", "Årlig"],
                  ]}
                  value={form.status}
                />
                <SelectInput
                  label="Intervall"
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      billingInterval: value as BillingInterval,
                    }))
                  }
                  options={[...billingIntervalOptions]}
                  value={form.billingInterval}
                />
                <DateInput
                  label="Neste trekk"
                  onChange={(value) => setForm((current) => ({ ...current, nextPayment: value }))}
                  value={form.nextPayment}
                />
                <TextInput
                  label="Notat"
                  onChange={(value) => setForm((current) => ({ ...current, note: value }))}
                  placeholder="Valgfritt"
                  value={form.note}
                />
              </div>
              <button
                className="mt-4 rounded-xl bg-[#0D1B2A] px-5 py-3 text-sm font-bold text-white hover:bg-[#15283c] disabled:opacity-50"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Lagrer..." : "Legg til"}
              </button>
            </form>

            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {filters.map((filter) => (
                <button
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                    activeFilter === filter.value
                      ? "bg-[#0D1B2A] text-white"
                      : "bg-white text-[#4A5568] ring-1 ring-[#DBE4EE] hover:text-[#0D1B2A]"
                  }`}
                  key={filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="mt-4 rounded-2xl bg-white p-6 text-center text-sm text-[#5F6F82] ring-1 ring-[#DBE4EE]">
                Henter abonnementer...
              </div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {visibleSubscriptions.map((subscription) => (
                  <SubscriptionCard
                    isSelected={selectedIds.includes(subscription.id)}
                    key={subscription.id}
                    onDelete={deleteSubscription}
                    onEdit={startEditingSubscription}
                    onToggle={toggleSubscription}
                    subscription={subscription}
                  />
                ))}
              </div>
            )}

            {!isLoading && visibleSubscriptions.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-white p-6 text-center text-sm text-[#5F6F82] ring-1 ring-[#DBE4EE]">
                <h2 className="text-xl font-extrabold tracking-tight text-[#0D1B2A]">
                  Ingen abonnementer ennå
                </h2>
                <p className="mx-auto mt-2 max-w-xl">
                  Start med å legge inn abonnementene du allerede kjenner. Gmail-skanning
                  er valgfritt når du vil finne flere automatisk.
                </p>
                <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                  <a
                    className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
                    href="#manual-add"
                  >
                    Legg til manuelt
                  </a>
                  <Link
                    className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
                    href="/import/email"
                  >
                    Skann Gmail
                  </Link>
                  <Link
                    className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
                    href="/onboarding"
                  >
                    Se hvordan det fungerer
                  </Link>
                </div>
              </div>
            ) : null}

            {!isLoading && cancellableSubscriptions.length === 0 && subscriptionList.length > 0 ? (
              <div className="mt-6 rounded-2xl bg-white p-6 text-center text-sm text-[#5F6F82] ring-1 ring-[#DBE4EE]">
                Alle abonnementer er markert som avsluttet.
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <AppFooter compact />

      {step === "overview" && selectedIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-[#DBE4EE] bg-white/95 px-5 py-4 shadow-2xl backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">{selectedIds.length} vurderes avsluttet</p>
              <p className="text-sm text-[#5F6F82]">
                Potensiell sparing: {formatCurrency(monthlySavings)} kr/mnd
              </p>
            </div>
            <button
              className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
              onClick={() => setStep("confirm")}
              type="button"
            >
              Fortsett
            </button>
          </div>
        </div>
      ) : null}

      {editingSubscription ? (
        <SubscriptionEditModal
          form={editForm}
          isSaving={isUpdating}
          onClose={() => setEditingSubscription(null)}
          onSubmit={updateSubscription}
          setForm={setEditForm}
        />
      ) : null}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <p className="text-sm font-semibold text-[#5F6F82]">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-[#0D1B2A]">{value}</p>
    </div>
  );
}

function UpcomingPayments({ subscriptions }: { subscriptions: UpcomingPayment[] }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Kommende trekk</h2>
          <p className="mt-1 text-sm text-[#5F6F82]">Neste 30 dager, sortert etter dato.</p>
        </div>
        <span className="rounded-full bg-[#F0F4F8] px-3 py-1 text-xs font-bold text-[#4A5568]">
          {subscriptions.length}
        </span>
      </div>

      {subscriptions.length > 0 ? (
        <div className="mt-4 divide-y divide-[#DBE4EE]">
          {subscriptions.map(({ subscription, paymentDate }) => (
            <div className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center" key={subscription.id}>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-[#0D1B2A]">
                  {subscription.name}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge label={getCategoryLabel(subscription.category)} />
                  <Badge label={getSourceLabel(subscription.source)} />
                </div>
              </div>
              <div className="text-sm sm:text-right">
                <p className="font-black text-[#0D1B2A]">
                  {formatCurrency(getMonthlyEquivalent(subscription))} kr
                </p>
                <p className="mt-1 text-[#5F6F82]">{formatDateForShortDisplay(paymentDate)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-[#F7F9FC] p-4 text-sm text-[#5F6F82]">
          Ingen kjente trekk de neste 30 dagene. Legg inn neste trekk på abonnementene dine for
          å få bedre varsling.
        </div>
      )}
    </section>
  );
}

function CancellationFollowUpSection({
  subscriptions,
  onAction,
}: {
  subscriptions: Subscription[];
  onAction: (
    subscription: Subscription,
    action: "send" | "status",
    status?: "confirmed_cancelled" | "manual_required",
  ) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Oppfølging av oppsigelser</h2>
          <p className="mt-1 text-sm text-[#5F6F82]">
            Oppsigelser som venter på svar, er avvist eller krever manuell handling.
          </p>
        </div>
        <span className="rounded-full bg-[#F0F4F8] px-3 py-1 text-xs font-bold text-[#4A5568]">
          {subscriptions.length}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {subscriptions.map((subscription) => {
          const request = subscription.cancellationRequest;
          const sentAt = request?.sentAt ? new Date(request.sentAt) : null;
          const isStale = Boolean(sentAt && getDaysSince(sentAt) >= 7 && request?.status === "awaiting_confirmation");

          return (
            <div className="rounded-xl bg-[#F7F9FC] p-4" key={subscription.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-extrabold">{subscription.name}</p>
                  <p className="mt-1 text-sm text-[#5F6F82]">
                    {getCancellationStatusLabel(request?.status) ?? "Oppsigelse startet"}
                    {sentAt ? ` · sendt ${formatDateForShortDisplay(sentAt)}` : ""}
                  </p>
                  {isStale ? (
                    <p className="mt-2 rounded-xl bg-[#FFF6E8] px-3 py-2 text-sm font-semibold text-[#8A4B13]">
                      Oppsigelse sendt for 7 dager siden. Har du fått svar?
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    className="rounded-xl border border-[#DBE4EE] bg-white px-4 py-2 text-sm font-bold hover:border-[#C8102E]/50"
                    onClick={() => onAction(subscription, "status", "confirmed_cancelled")}
                    type="button"
                  >
                    Marker som avsluttet
                  </button>
                  <button
                    className="rounded-xl border border-[#DBE4EE] bg-white px-4 py-2 text-sm font-bold hover:border-[#C8102E]/50"
                    onClick={() => onAction(subscription, "status", "manual_required")}
                    type="button"
                  >
                    Krever manuell handling
                  </button>
                  <button
                    className="rounded-xl border border-[#DBE4EE] bg-white px-4 py-2 text-sm font-bold hover:border-[#C8102E]/50"
                    onClick={() => onAction(subscription, "send")}
                    type="button"
                  >
                    Send på nytt
                  </button>
                </div>
              </div>
              <Link
                className="mt-3 inline-flex text-sm font-bold text-[#C8102E] hover:underline"
                href={`/subscriptions/${subscription.id}/cancel`}
              >
                Åpne oppsigelse
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SavingsInsight({
  monthlySavings,
  selectedCount,
  trialCount,
}: {
  monthlySavings: number;
  selectedCount: number;
  trialCount: number;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <h2 className="text-lg font-extrabold tracking-tight">Sparingsinnsikt</h2>
      <p className="mt-1 text-sm text-[#5F6F82]">
        Velg abonnementer du vurderer å avslutte for å se potensiell sparing.
      </p>
      <div className="mt-5 rounded-2xl bg-[#0D1B2A] p-5 text-white">
        <p className="text-sm font-semibold text-white/65">Potensiell sparing per måned</p>
        <p className="mt-2 text-4xl font-black">{formatCurrency(monthlySavings)} kr</p>
        <p className="mt-2 text-sm text-white/65">
          {selectedCount > 0
            ? `${selectedCount} abonnementer vurderes avsluttet.`
            : "Velg abonnementer du vurderer å avslutte for å se potensiell sparing."}
        </p>
      </div>
      {trialCount > 0 ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Du har {trialCount} prøveperioder. Sjekk dem før neste trekk.
        </p>
      ) : null}
    </section>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[#F0F4F8] px-2.5 py-1 text-xs font-bold text-[#4A5568]">
      {label}
    </span>
  );
}

function getUpcomingPayments(subscriptions: Subscription[]): UpcomingPayment[] {
  const today = startOfDay(new Date());
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  return subscriptions
    .filter((subscription) => ["active", "trial", "yearly"].includes(subscription.status))
    .map((subscription) => ({
      subscription,
      paymentDate: parseNextPaymentDate(subscription.nextPayment),
    }))
    .filter((payment): payment is UpcomingPayment => {
      const paymentDate = payment.paymentDate;
      return Boolean(paymentDate && paymentDate >= today && paymentDate <= thirtyDaysFromNow);
    })
    .sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());
}

function getCancellationFollowUps(subscriptions: Subscription[]) {
  return subscriptions.filter((subscription) =>
    ["awaiting_confirmation", "manual_required", "rejected"].includes(
      subscription.cancellationRequest?.status ?? "",
    ),
  );
}

function getDaysSince(date: Date) {
  const today = startOfDay(new Date());
  const startedAt = startOfDay(date);
  return Math.floor((today.getTime() - startedAt.getTime()) / 86_400_000);
}

function getMonthlyEquivalent(subscription: Subscription) {
  if (subscription.billingInterval === "yearly") {
    return Math.round(subscription.monthlyCost / 12);
  }

  return subscription.monthlyCost;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(value);
}

function getCategoryLabel(category: SubscriptionCategory) {
  return categoryOptions.find(([value]) => value === category)?.[1] ?? category;
}

function getSourceLabel(source?: string | null) {
  if (source === "gmail_import") {
    return "Gmail";
  }

  if (source === "google") {
    return "Google";
  }

  if (source === "vipps") {
    return "Vipps";
  }

  if (source === "demo" && process.env.NODE_ENV !== "production") {
    return "Demo";
  }

  return "Manuell";
}

function TextInput({
  label,
  value,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  inputMode?: "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-[#4A5568] md:col-span-1">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={label !== "Notat"}
        value={value}
      />
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-[#4A5568] md:col-span-1">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
      <span className="mt-1 block text-xs font-medium text-[#5F6F82]">Valgfritt</span>
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-[#4A5568] md:col-span-1">
      {label}
      <select
        className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubscriptionEditModal({
  form,
  setForm,
  onClose,
  onSubmit,
  isSaving,
}: {
  form: SubscriptionForm;
  setForm: Dispatch<SetStateAction<SubscriptionForm>>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#0D1B2A]/50 p-4 sm:items-center sm:justify-center">
      <form
        className="w-full rounded-2xl bg-white p-5 shadow-2xl sm:max-w-2xl"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Rediger abonnement</h2>
            <p className="mt-1 text-sm text-[#5F6F82]">
              Oppdater pris, status, intervall og notater når noe endrer seg.
            </p>
          </div>
          <button
            className="rounded-full border border-[#DBE4EE] px-3 py-1.5 text-sm font-bold text-[#0D1B2A]"
            onClick={onClose}
            type="button"
          >
            Lukk
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Navn"
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            placeholder="F.eks. HBO Max"
            value={form.name}
          />
          <TextInput
            inputMode="numeric"
            label="Kr/mnd"
            onChange={(value) => setForm((current) => ({ ...current, monthlyCost: value }))}
            placeholder="149"
            value={form.monthlyCost}
          />
          <SelectInput
            label="Kategori"
            onChange={(value) =>
              setForm((current) => ({ ...current, category: value as SubscriptionCategory }))
            }
            options={[...categoryOptions]}
            value={form.category}
          />
          <SelectInput
            label="Status"
            onChange={(value) =>
              setForm((current) => ({ ...current, status: value as SubscriptionStatus }))
            }
            options={[...statusOptions]}
            value={form.status}
          />
          <SelectInput
            label="Intervall"
            onChange={(value) =>
              setForm((current) => ({ ...current, billingInterval: value as BillingInterval }))
            }
            options={[...billingIntervalOptions]}
            value={form.billingInterval}
          />
          <DateInput
            label="Neste trekk"
            onChange={(value) => setForm((current) => ({ ...current, nextPayment: value }))}
            value={form.nextPayment}
          />
          <label className="text-sm font-semibold text-[#4A5568] sm:col-span-2">
            Notat
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
              onChange={(event) =>
                setForm((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="Valgfritt"
              value={form.note}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
            onClick={onClose}
            type="button"
          >
            Avbryt
          </button>
          <button
            className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Lagrer..." : "Lagre endringer"}
          </button>
        </div>
      </form>
    </div>
  );
}
