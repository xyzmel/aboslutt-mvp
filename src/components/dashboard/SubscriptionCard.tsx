import Link from "next/link";
import { getCancellationStatusLabel } from "@/lib/cancellation";
import { formatNextPaymentDate } from "@/lib/subscription-date";
import type { Subscription } from "@/types/subscription";

type SubscriptionCardProps = {
  subscription: Subscription;
  isSelected: boolean;
  isDeleting?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (subscription: Subscription) => void;
};

const categoryLabels: Record<Subscription["category"], string> = {
  streaming: "Streaming",
  software: "Programvare",
  news: "Nyheter",
  health: "Helse",
};

const statusLabels: Record<Subscription["status"], string> = {
  active: "Aktiv",
  trial: "Prøveperiode",
  yearly: "Årlig",
  cancelled: "Avsluttet",
};

const billingIntervalLabels: Record<Subscription["billingInterval"], string> = {
  monthly: "Månedlig",
  yearly: "Årlig",
  unknown: "Ukjent intervall",
};

export function SubscriptionCard({
  subscription,
  isSelected,
  isDeleting = false,
  onToggle,
  onDelete,
  onEdit,
}: SubscriptionCardProps) {
  const isCancelled = subscription.status === "cancelled";
  const sourceBadge = getSourceBadge(subscription.source);
  const cancellationLabel = getCancellationStatusLabel(subscription.cancellationStatus);
  const statusTone = getStatusTone(subscription.status);

  return (
    <article
      className={`group rounded-3xl border bg-white p-4 text-left shadow-sm transition sm:p-5 ${
        isSelected
          ? "border-[#C8102E]/60 bg-[#FFF8F9] ring-2 ring-[#C8102E]/10"
          : "border-[#DBE4EE] hover:-translate-y-0.5 hover:border-[#C8102E]/35 hover:shadow-md"
      } ${isCancelled ? "opacity-75" : ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-extrabold tracking-tight text-[#0D1B2A]">
              {subscription.name}
            </h3>
            <Badge label={statusLabels[subscription.status]} tone={statusTone} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge label={categoryLabels[subscription.category]} />
            <Badge label={sourceBadge.label} tone={sourceBadge.tone} />
            {cancellationLabel ? <Badge label={cancellationLabel} tone="amber" /> : null}
          </div>
        </div>
        <div className="rounded-2xl bg-[#F7F9FC] px-4 py-3 ring-1 ring-[#DBE4EE] sm:text-right">
          <p className="text-2xl font-black tracking-tight text-[#0D1B2A]">
            {formatCurrency(subscription.monthlyCost)} kr
          </p>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-[#5F6F82]">
            {billingIntervalLabels[subscription.billingInterval] ?? "Månedlig"}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoItem label="Neste trekk" value={formatNextPaymentDate(subscription.nextPayment)} />
        <InfoItem label="Kategori" value={categoryLabels[subscription.category]} />
        <InfoItem label="Status" value={statusLabels[subscription.status]} />
      </dl>

      {subscription.note ? (
        <p className="mt-4 rounded-2xl bg-[#F7F9FC] px-3 py-2 text-sm leading-6 text-[#5F6F82] ring-1 ring-[#E6EDF5]">
          {subscription.note}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <button
          aria-pressed={isSelected}
          className={`rounded-xl px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 ${
            isSelected
              ? "bg-[#C8102E] text-white shadow-sm shadow-[#C8102E]/20"
              : "border border-[#DBE4EE] text-[#0D1B2A] hover:border-[#C8102E]/50 hover:bg-[#FFF8F9]"
          } disabled:cursor-not-allowed disabled:opacity-55`}
          disabled={isCancelled}
          onClick={() => onToggle(subscription.id)}
          type="button"
        >
          {isSelected ? "Valgt" : isCancelled ? "Avsluttet" : "Vurder"}
        </button>
        <button
          className="rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50 hover:bg-[#F7F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
          onClick={() => onEdit(subscription)}
          type="button"
        >
          Rediger
        </button>
        <Link
          className="rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-center text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50 hover:bg-[#F7F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
          href={`/subscriptions/${subscription.id}`}
        >
          Detaljer
        </Link>
        <Link
          className="rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-center text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50 hover:bg-[#FFF8F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
          href={`/subscriptions/${subscription.id}/cancel`}
        >
          Si opp
        </Link>
        <button
          className="rounded-xl border border-[#F3C3CC] px-3 py-2.5 text-sm font-bold text-[#C8102E] transition hover:bg-[#F5E6E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
          onClick={() => onDelete(subscription.id)}
          disabled={isDeleting}
          type="button"
        >
          {isDeleting ? "Sletter..." : "Slett"}
        </button>
      </div>
    </article>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#FAFBFD] px-3 py-2.5 ring-1 ring-[#E6EDF5]">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#5F6F82]">{label}</dt>
      <dd className="mt-1 truncate text-sm font-extrabold text-[#0D1B2A]">{value}</dd>
    </div>
  );
}

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "red" | "green" | "blue" | "amber";
}) {
  const toneClasses = {
    neutral: "bg-[#F0F4F8] text-[#4A5568]",
    red: "bg-[#F5E6E9] text-[#C8102E]",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-800",
  };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${toneClasses[tone]}`}>{label}</span>;
}

function getStatusTone(status: Subscription["status"]): "neutral" | "red" | "green" | "amber" {
  if (status === "cancelled") {
    return "green";
  }

  if (status === "trial") {
    return "amber";
  }

  return "neutral";
}

function getSourceBadge(source?: string | null): { label: string; tone: "neutral" | "red" | "green" | "blue" } {
  if (source === "gmail_import" || source === "google") {
    return {
      label: source === "gmail_import" ? "Gmail" : "Google",
      tone: "blue",
    };
  }

  if (source === "vipps") {
    return {
      label: "Vipps",
      tone: "red",
    };
  }

  return {
    label: "Manuell",
    tone: "green",
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(value);
}
