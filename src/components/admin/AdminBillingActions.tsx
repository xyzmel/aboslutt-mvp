"use client";

import { useState } from "react";

type ReconcileResult = {
  ok?: boolean;
  result?: {
    ok: boolean;
    reference?: string;
    previousStatus?: string;
    nextStatus?: string;
    vippsStatus?: string | null;
    changed: boolean;
    error?: string;
  };
  checked?: number;
  results?: Array<{
    ok: boolean;
    reference?: string;
    nextStatus?: string;
    vippsStatus?: string | null;
    changed: boolean;
    error?: string;
  }>;
};

export function AdminBillingReconcileButton({ agreementId }: { agreementId?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reconcile() {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/billing/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agreementId ? { agreementId } : {}),
      });
      const result = (await response.json().catch(() => ({}))) as ReconcileResult;

      if (!response.ok || result.ok === false) {
        setMessage(formatError(result));
        return;
      }

      setMessage(formatSuccess(result));
    } catch {
      setMessage("Kunne ikke kjøre avstemming akkurat nå.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex w-fit items-center justify-center rounded-xl bg-[#0D1B2A] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#14263A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        onClick={reconcile}
        type="button"
      >
        {isLoading ? "Avstemmer..." : "Avstem med Vipps"}
      </button>
      {message ? <p className="text-xs font-semibold text-[#5F6F82]">{message}</p> : null}
    </div>
  );
}

function formatSuccess(result: ReconcileResult) {
  if (result.result) {
    if (result.result.changed) {
      return `Oppdatert til ${result.result.nextStatus ?? "ny status"} (${result.result.vippsStatus ?? "Vipps ukjent"}).`;
    }

    return `Ingen endring (${result.result.vippsStatus ?? "Vipps ukjent"}).`;
  }

  const changed = result.results?.filter((item) => item.changed).length ?? 0;
  return `Avstemt ${result.checked ?? 0} avtaler. Endret ${changed}.`;
}

function formatError(result: ReconcileResult) {
  const error = result.result?.error ?? "RECONCILE_FAILED";
  return `Avstemming feilet: ${error}.`;
}
