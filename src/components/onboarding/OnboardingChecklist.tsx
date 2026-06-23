"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type OnboardingChecklistProps = {
  hasSubscriptions: boolean;
  hasStartedCancellation: boolean;
  hasCompletedCancellation: boolean;
};

const storageKey = "aboslutt:onboarding-checklist-collapsed";

export function OnboardingChecklist({
  hasSubscriptions,
  hasStartedCancellation,
  hasCompletedCancellation,
}: OnboardingChecklistProps) {
  const [isCollapsed, setIsCollapsed] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "true",
  );

  const items = useMemo(
    () => [
      {
        label: "Opprett konto",
        completed: true,
        href: "/dashboard",
      },
      {
        label: "Legg til første abonnement",
        completed: hasSubscriptions,
        href: "#manual-add",
      },
      {
        label: "Start første oppsigelse",
        completed: hasStartedCancellation,
        href: hasSubscriptions ? "#subscriptions" : "#manual-add",
      },
      {
        label: "Fullfør første oppsigelse",
        completed: hasCompletedCancellation,
        href: hasStartedCancellation ? "#cancellations" : "#subscriptions",
      },
    ],
    [hasCompletedCancellation, hasStartedCancellation, hasSubscriptions],
  );
  const completedCount = items.filter((item) => item.completed).length;
  const progressLabel = `${completedCount}/${items.length}`;

  if (completedCount === items.length) {
    return null;
  }

  if (isCollapsed) {
    return (
      <button
        className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-[#DBE4EE] transition hover:ring-[#C8102E]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
        onClick={() => {
          window.localStorage.removeItem(storageKey);
          setIsCollapsed(false);
        }}
        type="button"
      >
        <span>
          <span className="block text-sm font-bold uppercase tracking-wide text-[#C8102E]">Kom i gang</span>
          <span className="mt-1 block text-sm font-semibold text-[#0D1B2A]">
            Oppstartsliste · {progressLabel} fullført
          </span>
        </span>
        <span className="rounded-full bg-[#F0F4F8] px-3 py-1 text-xs font-black text-[#4A5568]">Vis</span>
      </button>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Kom i gang</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">Oppstartsliste</h2>
          <p className="mt-1 text-sm leading-6 text-[#5F6F82]">
            {progressLabel} fullført. Følg stegene fra første abonnement til ferdig oppsigelse.
          </p>
        </div>
        <button
          className="rounded-xl border border-[#DBE4EE] px-3 py-2 text-sm font-bold text-[#0D1B2A] transition hover:border-[#C8102E]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
          onClick={() => {
            window.localStorage.setItem(storageKey, "true");
            setIsCollapsed(true);
          }}
          type="button"
        >
          Skjul
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <Link
            className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F9FC] px-3 py-2.5 text-sm font-bold text-[#0D1B2A] transition hover:bg-[#F0F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
            href={item.href}
            key={item.label}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  item.completed ? "bg-emerald-100 text-emerald-700" : "bg-white text-[#5F6F82] ring-1 ring-[#DBE4EE]"
                }`}
              >
                {item.completed ? "✓" : "•"}
              </span>
              <span className={item.completed ? "text-[#5F6F82]" : "text-[#0D1B2A]"}>{item.label}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                item.completed ? "bg-emerald-50 text-emerald-700" : "bg-white text-[#5F6F82]"
              }`}
            >
              {item.completed ? "Ferdig" : "Neste"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
