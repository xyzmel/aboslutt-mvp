"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AdminUserActionsProps = {
  userId: string;
  email: string | null;
  plan: string;
};

const planOptions = ["free", "beta", "premium", "admin"];

export function AdminUserActions({ userId, email, plan }: AdminUserActionsProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState(plan);

  async function runAction(action: () => Promise<Response>, successMessage: string) {
    setIsWorking(true);
    setMessage(null);

    try {
      const response = await action();
      const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "Admin-handlingen feilet.");
      }

      setMessage(result.message ?? successMessage);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin-handlingen feilet.");
    } finally {
      setIsWorking(false);
    }
  }

  function markEmailVerified() {
    runAction(
      () =>
        fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailVerified: true }),
        }),
      "E-post er markert som bekreftet.",
    );
  }

  function savePlan(nextPlan = selectedPlan) {
    runAction(
      () =>
        fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: nextPlan }),
        }),
      "Plan er oppdatert.",
    );
  }

  function deleteSubscriptions() {
    if (!window.confirm(`Slette alle abonnementer for ${email ?? "denne brukeren"}?`)) {
      return;
    }

    runAction(
      () => fetch(`/api/admin/users/${userId}/subscriptions`, { method: "DELETE" }),
      "Alle abonnementer er slettet.",
    );
  }

  function deleteUser() {
    const confirmation = window.prompt(
      `Skriv SLETT for å slette ${email ?? "denne brukeren"} og alle tilhørende data.`,
    );

    if (confirmation !== "SLETT") {
      return;
    }

    runAction(
      () =>
        fetch(`/api/admin/users/${userId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: "SLETT" }),
        }),
      "Brukeren er slettet.",
    ).then(() => router.push("/admin"));
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <h2 className="text-lg font-extrabold tracking-tight">Admin-handlinger</h2>
      <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
        Manuell planendring brukes frem til betaling er aktivert.
      </p>
      {message ? (
        <p className="mt-4 rounded-xl bg-[#F7F9FC] px-4 py-3 text-sm font-semibold text-[#0D1B2A]">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#4A5568]">
          Plan
          <select
            className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A]"
            disabled={isWorking}
            onChange={(event) => {
              setSelectedPlan(event.target.value);
              savePlan(event.target.value);
            }}
            value={selectedPlan}
          >
            {planOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50 disabled:opacity-50"
          disabled={isWorking}
          onClick={markEmailVerified}
          type="button"
        >
          Marker e-post bekreftet
        </button>

        <button
          className="rounded-xl border border-[#F3C3CC] px-5 py-3 text-sm font-bold text-[#C8102E] hover:bg-[#F5E6E9] disabled:opacity-50"
          disabled={isWorking}
          onClick={deleteSubscriptions}
          type="button"
        >
          Slett brukerens abonnementer
        </button>

        <button
          className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] disabled:opacity-50"
          disabled={isWorking}
          onClick={deleteUser}
          type="button"
        >
          Slett bruker
        </button>
      </div>
    </section>
  );
}
