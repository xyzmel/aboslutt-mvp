import type { BillingInterval, SubscriptionStatus } from "@/types/subscription";

type SubscriptionLike = {
  nextPayment?: string | null;
  billingInterval: BillingInterval;
  status?: SubscriptionStatus | string;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseSubscriptionDate(value?: string | null) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || !isoDatePattern.test(trimmedValue)) {
    return null;
  }

  const [year, month, day] = trimmedValue.split("-").map(Number);
  const date = startOfDay(new Date(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatSubscriptionDateForDisplay(value?: string | null) {
  const date = parseSubscriptionDate(value);

  if (!date || date < startOfDay(new Date())) {
    return "Ukjent";
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatSubscriptionDateForInput(value?: string | null) {
  const date = parseSubscriptionDate(value);
  return date && date >= startOfDay(new Date()) ? toIsoDate(date) : "";
}

export function calculateNextPaymentDate(
  currentDate: Date,
  billingInterval: BillingInterval,
  today = startOfDay(new Date()),
) {
  if (billingInterval === "unknown") {
    return currentDate < today ? null : startOfDay(currentDate);
  }

  const originalDay = currentDate.getDate();
  let nextDate = startOfDay(currentDate);

  while (nextDate < today) {
    nextDate =
      billingInterval === "yearly"
        ? addYearsPreservingDay(nextDate, 1, originalDay)
        : addMonthsPreservingDay(nextDate, 1, originalDay);
  }

  return nextDate;
}

export function normalizeNextPaymentDate(subscription: SubscriptionLike, today = startOfDay(new Date())) {
  if (subscription.status === "cancelled") {
    return subscription.nextPayment?.trim() ?? "";
  }

  const parsedDate = parseSubscriptionDate(subscription.nextPayment);

  if (!parsedDate) {
    return "";
  }

  const normalizedDate = calculateNextPaymentDate(parsedDate, subscription.billingInterval, today);
  return normalizedDate ? toIsoDate(normalizedDate) : "";
}

export function isValidSubscriptionDateInput(value: string) {
  return value === "" || Boolean(parseSubscriptionDate(value));
}

export function formatShortSubscriptionDate(value?: string | null) {
  const date = parseSubscriptionDate(value);

  if (!date || date < startOfDay(new Date())) {
    return "Ukjent";
  }

  return formatDateForShortDisplay(date);
}

export function formatDateForShortDisplay(date: Date | null) {
  if (!date) {
    return "Ukjent";
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toIsoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export const parseNextPaymentDate = parseSubscriptionDate;
export const normalizeDateInputValue = formatSubscriptionDateForInput;
export const formatNextPaymentDate = formatSubscriptionDateForDisplay;

function addMonthsPreservingDay(date: Date, monthsToAdd: number, originalDay: number) {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + monthsToAdd;
  return dateFromPartsClamped(targetYear, targetMonth, originalDay);
}

function addYearsPreservingDay(date: Date, yearsToAdd: number, originalDay: number) {
  return dateFromPartsClamped(date.getFullYear() + yearsToAdd, date.getMonth(), originalDay);
}

function dateFromPartsClamped(year: number, month: number, day: number) {
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
  return startOfDay(new Date(year, month, Math.min(day, lastDayOfTargetMonth)));
}
