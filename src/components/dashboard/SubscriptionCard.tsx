import Link from "next/link";
import { getCancellationStatusLabel } from "@/lib/cancellation";
import { getSubscriptionLifecycle } from "@/lib/subscription-lifecycle.mjs";
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
  const sourceBadge = getSourceBadge(subscription.source);
  const cancellationLabel = getCancellationStatusLabel(subscription.cancellationStatus);
  const lifecycle = getSubscriptionLifecycle(subscription);
  const actions = lifecycle.actions;
  const isCancelled = lifecycle.productStatus === "cancelled" || lifecycle.productStatus === "archived";
  const hasCancellationDocumentation = Boolean(subscription.cancellationRequest);
  const statusTone = getLifecycleTone(lifecycle.productStatus);

  return (
    <article
      className={`group flex h-full min-h-[348px] flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition sm:p-5 ${
        isSelected
          ? "border-[#C8102E]/60 bg-[#FFF8F9] ring-2 ring-[#C8102E]/10"
          : "border-[#DBE4EE] hover:border-[#C8102E]/35 hover:shadow-md"
      } ${isCancelled ? "opacity-75" : ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-extrabold tracking-tight text-[#0D1B2A]">
              {subscription.name}
            </h3>
            <Badge label={lifecycle.label} tone={statusTone} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge label={categoryLabels[subscription.category]} />
            <Badge label={sourceBadge.label} tone={sourceBadge.tone} />
            {cancellationLabel ? <Badge label={cancellationLabel} tone="amber" /> : null}
          </div>
        </div>
        <div className="shrink-0 rounded-xl bg-[#F7F9FC] px-4 py-3 ring-1 ring-[#DBE4EE] sm:min-w-32 sm:text-right">
          <p className="text-2xl font-extrabold tracking-tight text-[#0D1B2A]">
            {formatCurrency(subscription.monthlyCost)} kr
          </p>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-[#5F6F82]">
            {billingIntervalLabels[subscription.billingInterval] ?? "Månedlig"}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoItem label="Neste trekk" value={formatNextPaymentDate(subscription.nextPayment)} />
        <InfoItem label="Kategori" value={categoryLabels[subscription.category]} />
        <InfoItem label="Status" value={lifecycle.label} />
        <InfoItem label="Intervall" value={billingIntervalLabels[subscription.billingInterval] ?? "Månedlig"} />
      </dl>

      {subscription.note ? (
        <p className="mt-4 rounded-xl bg-[#F7F9FC] px-3 py-2 text-sm leading-6 text-[#5F6F82] ring-1 ring-[#E6EDF5]">
          {subscription.note}
        </p>
      ) : null}

      <div className="mt-auto pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {actions.canStartCancellation ? (
            <button
              aria-pressed={isSelected}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 sm:min-w-24 ${
                isSelected
                  ? "bg-[#C8102E] text-white shadow-sm shadow-[#C8102E]/20"
                  : "border border-[#DBE4EE] text-[#0D1B2A] hover:border-[#C8102E]/50 hover:bg-[#FFF8F9]"
              }`}
              onClick={() => onToggle(subscription.id)}
              type="button"
            >
              {isSelected ? "Valgt" : "Vurder"}
            </button>
          ) : null}
          {actions.canEdit ? (
            <button className={actionButtonClass} onClick={() => onEdit(subscription)} type="button">
              Rediger
            </button>
          ) : null}
          <Link className={actionLinkClass} href={`/subscriptions/${subscription.id}`}>
            Detaljer
          </Link>
          {actions.canContinueCancellation ? (
            <Link className={actionLinkClass} href={`/subscriptions/${subscription.id}/cancel`}>
              Fortsett oppsigelse
            </Link>
          ) : null}
          {actions.canStartCancellation ? (
            <Link className={actionLinkClass} href={`/subscriptions/${subscription.id}/cancel`}>
              Si opp
            </Link>
          ) : null}
          {actions.canDelete && hasCancellationDocumentation ? (
            <Link className={actionLinkClass} href={`/subscriptions/${subscription.id}/cancel`}>
              Se dokumentasjon
            </Link>
          ) : null}
          {actions.canDelete ? (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#F3C3CC] px-3 py-2.5 text-sm font-bold text-[#C8102E] transition hover:bg-[#F5E6E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 sm:ml-auto sm:min-w-20"
              onClick={() => onDelete(subscription.id)}
              disabled={isDeleting}
              type="button"
            >
              {isDeleting ? "Sletter..." : "Slett"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const actionButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DBE4EE] px-3 py-2.5 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50 hover:bg-[#F7F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 sm:min-w-24";
const actionLinkClass = `${actionButtonClass} text-center`;

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#FAFBFD] px-3 py-2.5 ring-1 ring-[#E6EDF5]">
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

function getLifecycleTone(productStatus: string): "neutral" | "red" | "green" | "amber" {
  if (productStatus === "cancelled") {
    return "green";
  }

  if (productStatus === "cancellation_in_progress") {
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
