"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type OnboardingChecklistProps = {
  hasSubscriptions: boolean;
  hasAnyNextPayment: boolean;
  emailRemindersEnabled: boolean;
  hasGoogleGmailConnected: boolean;
  monthlyTotal: number;
};

const storageKey = "aboslutt:onboarding-checklist-collapsed";

export function OnboardingChecklist({
  hasSubscriptions,
  hasAnyNextPayment,
  emailRemindersEnabled,
  hasGoogleGmailConnected,
  monthlyTotal,
}: OnboardingChecklistProps) {
  const [isCollapsed, setIsCollapsed] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "true",
  );

  const items = useMemo(
    () => [
      {
        label: "Legg til første abonnement",
        completed: hasSubscriptions,
        href: "#manual-add",
      },
      {
        label: "Legg inn neste trekk",
        completed: hasAnyNextPayment,
        href: "#manual-add",
      },
      {
        label: "Aktiver varsler",
        completed: emailRemindersEnabled,
        href: "/settings",
      },
      {
        label: "Koble til Gmail",
        completed: hasGoogleGmailConnected,
        href: "/import/email",
      },
      {
        label: "Se månedlig total",
        completed: monthlyTotal > 0,
        href: "/dashboard",
      },
    ],
    [emailRemindersEnabled, hasAnyNextPayment, hasGoogleGmailConnected, hasSubscriptions, monthlyTotal],
  );
  const completedCount = items.filter((item) => item.completed).length;

  if (isCollapsed) {
    return (
      <button
        className="rounded-xl border border-[#DBE4EE] bg-white px-4 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
        onClick={() => {
          window.localStorage.removeItem(storageKey);
          setIsCollapsed(false);
        }}
        type="button"
      >
        Vis oppstartsliste
      </button>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Kom i gang</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Oppstartsliste</h2>
          <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
            {completedCount} av {items.length} steg er fullført. Start manuelt, og koble på automasjon når du vil.
          </p>
        </div>
        <button
          className="rounded-xl border border-[#DBE4EE] px-3 py-2 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
          onClick={() => {
            window.localStorage.setItem(storageKey, "true");
            setIsCollapsed(true);
          }}
          type="button"
        >
          Skjul
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Link
            className="flex items-center gap-3 rounded-xl bg-[#F7F9FC] p-4 text-sm font-bold text-[#0D1B2A] hover:bg-[#F0F4F8]"
            href={item.href}
            key={item.label}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                item.completed ? "bg-emerald-100 text-emerald-700" : "bg-white text-[#5F6F82]"
              }`}
            >
              {item.completed ? "✓" : "•"}
            </span>
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
