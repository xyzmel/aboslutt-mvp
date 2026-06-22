"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useToast } from "@/components/ui/ToastProvider";
import { formatNextPaymentDate, normalizeDateInputValue } from "@/lib/subscription-date";
import type {
  BillingInterval,
  Subscription,
  SubscriptionCategory,
  SubscriptionStatus,
} from "@/types/subscription";

type SubscriptionForm = {
  name: string;
  category: SubscriptionCategory;
  monthlyCost: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  nextPayment: string;
  note: string;
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

const intervalOptions: [BillingInterval, string][] = [
  ["monthly", "Månedlig"],
  ["yearly", "Årlig"],
  ["unknown", "Ukjent"],
];

export function SubscriptionDetailClient({
  initialSubscription,
}: {
  initialSubscription: Subscription;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [subscription, setSubscription] = useState(initialSubscription);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<SubscriptionForm>({
    name: initialSubscription.name,
    category: initialSubscription.category,
    monthlyCost: String(initialSubscription.monthlyCost),
    status: initialSubscription.status,
    billingInterval: initialSubscription.billingInterval,
    nextPayment: normalizeDateInputValue(initialSubscription.nextPayment),
    note: initialSubscription.note ?? "",
  });

  async function saveSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || Number(form.monthlyCost) <= 0) {
      const message = "Skriv inn navn og et gyldig beløp før du lagrer.";
      setErrorMessage(message);
      showToast({ title: "Sjekk feltene", message, tone: "error" });
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          monthlyCost: Number(form.monthlyCost),
        }),
      });

      if (!response.ok) {
        throw new Error("Kunne ikke lagre endringene.");
      }

      const updatedSubscription = (await response.json()) as Subscription;
      setSubscription(updatedSubscription);
      setIsEditing(false);
      showToast({ title: "Endringer lagret", message: "Abonnementet er oppdatert.", tone: "success" });
    } catch {
      const message = "Kunne ikke lagre endringene akkurat nå.";
      setErrorMessage(message);
      showToast({ title: "Lagring feilet", message, tone: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function markAsCancelled() {
    const confirmed = window.confirm("Vil du markere abonnementet som avsluttet?");

    if (!confirmed) {
      return;
    }

    setIsCancelling(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!response.ok) {
        throw new Error("Kunne ikke markere abonnementet som avsluttet.");
      }

      setSubscription((await response.json()) as Subscription);
      showToast({ title: "Abonnement avsluttet", message: "Statusen er oppdatert.", tone: "success" });
    } catch {
      const message = "Kunne ikke markere abonnementet som avsluttet akkurat nå.";
      setErrorMessage(message);
      showToast({ title: "Oppdatering feilet", message, tone: "error" });
    } finally {
      setIsCancelling(false);
    }
  }

  async function deleteSubscription() {
    const confirmed = window.confirm("Vil du slette abonnementet?");

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Kunne ikke slette abonnementet.");
      }

      showToast({ title: "Abonnement slettet", message: "Du sendes tilbake til oversikten.", tone: "success" });
      router.push("/dashboard");
    } catch {
      const message = "Kunne ikke slette abonnementet akkurat nå.";
      setErrorMessage(message);
      showToast({ title: "Sletting feilet", message, tone: "error" });
      setIsDeleting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader maxWidthClassName="max-w-4xl" />

      <section className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-[#F3C3CC] bg-[#F5E6E9] p-4 text-sm font-semibold text-[#C8102E]">
            {errorMessage}
          </div>
        ) : null}

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#DBE4EE]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">
                Abonnement
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
                {subscription.name}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-[#DBE4EE] px-4 py-2.5 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
                onClick={() => setIsEditing((current) => !current)}
                type="button"
              >
                {isEditing ? "Lukk redigering" : "Rediger"}
              </button>
              <Link
                className="rounded-xl border border-[#DBE4EE] px-4 py-2.5 text-center text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
                href={`/subscriptions/${subscription.id}/cancel`}
              >
                Lag oppsigelse
              </Link>
              <LoadingButton
                className="px-4 py-2.5"
                isLoading={isCancelling}
                loadingLabel="Oppdaterer..."
                onClick={markAsCancelled}
                type="button"
                variant="destructive"
              >
                Marker avsluttet
              </LoadingButton>
              <LoadingButton
                className="px-4 py-2.5"
                isLoading={isDeleting}
                loadingLabel="Sletter..."
                onClick={deleteSubscription}
                type="button"
                variant="destructive"
              >
                Slett
              </LoadingButton>
            </div>
          </div>

          {isEditing ? (
            <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={saveSubscription}>
              <TextInput
                label="Navn"
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                value={form.name}
              />
              <TextInput
                inputMode="numeric"
                label="Kr/mnd"
                onChange={(value) => setForm((current) => ({ ...current, monthlyCost: value }))}
                value={form.monthlyCost}
              />
              <SelectInput
                label="Kategori"
                onChange={(value) =>
                  setForm((current) => ({ ...current, category: value as SubscriptionCategory }))
                }
                options={categoryOptions}
                value={form.category}
              />
              <SelectInput
                label="Status"
                onChange={(value) =>
                  setForm((current) => ({ ...current, status: value as SubscriptionStatus }))
                }
                options={statusOptions}
                value={form.status}
              />
              <SelectInput
                label="Intervall"
                onChange={(value) =>
                  setForm((current) => ({ ...current, billingInterval: value as BillingInterval }))
                }
                options={intervalOptions}
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
                  value={form.note}
                />
              </label>
              <LoadingButton
                className="sm:col-span-2"
                isLoading={isSaving}
                loadingLabel="Lagrer..."
                type="submit"
              >
                Lagre endringer
              </LoadingButton>
            </form>
          ) : (
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Pris" value={`${subscription.monthlyCost} kr/mnd`} />
              <DetailItem label="Kategori" value={getCategoryLabel(subscription.category)} />
              <DetailItem label="Status" value={getStatusLabel(subscription.status)} />
              <DetailItem label="Kilde" value={getSourceLabel(subscription.source)} />
              <DetailItem label="Neste trekk" value={formatNextPaymentDate(subscription.nextPayment)} />
              <DetailItem label="Intervall" value={getIntervalLabel(subscription.billingInterval)} />
              <DetailItem label="Notat" value={subscription.note || "Ingen notat"} />
              <DetailItem
                label="Opprettet"
                value={
                  subscription.createdAt
                    ? new Date(subscription.createdAt).toLocaleDateString("nb-NO")
                    : "Ukjent"
                }
              />
            </dl>
          )}
        </div>
      </section>
      <AppFooter compact />
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F7F9FC] p-4">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-[#0D1B2A]">{value}</dd>
    </div>
  );
}

function TextInput({
  label,
  value,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  inputMode?: "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-[#4A5568]">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        required
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
    <label className="text-sm font-semibold text-[#4A5568]">
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
    <label className="text-sm font-semibold text-[#4A5568]">
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

function getCategoryLabel(category: SubscriptionCategory) {
  return categoryOptions.find(([value]) => value === category)?.[1] ?? category;
}

function getStatusLabel(status: SubscriptionStatus) {
  return statusOptions.find(([value]) => value === status)?.[1] ?? status;
}

function getIntervalLabel(interval: BillingInterval) {
  return intervalOptions.find(([value]) => value === interval)?.[1] ?? interval;
}

function getSourceLabel(source?: string | null) {
  if (source === "gmail_import") {
    return "Gmail";
  }

  if (source === "google") {
    return "Google";
  }

  return "Manuell";
}
