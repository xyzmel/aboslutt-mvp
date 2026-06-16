"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminBetaRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function updateRequest(action: "approve" | "reject") {
    setIsWorking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/beta-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(result.message ?? "Kunne ikke oppdatere forespørselen.");
      }

      const result = (await response.json().catch(() => ({}))) as { message?: string; warning?: string };
      setMessage(result.warning ?? result.message ?? "Forespørselen er oppdatert.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke oppdatere forespørselen.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      <button
        className="rounded-lg bg-[#0D1B2A] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        disabled={isWorking}
        onClick={() => updateRequest("approve")}
        type="button"
      >
        Godkjenn
      </button>
      <button
        className="rounded-lg border border-[#F3C3CC] px-3 py-2 text-xs font-bold text-[#C8102E] disabled:opacity-50"
        disabled={isWorking}
        onClick={() => updateRequest("reject")}
        type="button"
      >
        Avvis
      </button>
      {message ? <p className="text-xs font-semibold text-[#5F6F82]">{message}</p> : null}
    </div>
  );
}

export function AdminFeedbackActions({ feedbackId }: { feedbackId: string }) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);

  async function markReviewed() {
    setIsWorking(true);
    try {
      const response = await fetch(`/api/admin/feedback/${feedbackId}`, { method: "PATCH" });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(result.message ?? "Kunne ikke markere som lest.");
      }

      router.refresh();
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <button
      className="mt-3 rounded-lg border border-[#DBE4EE] px-3 py-2 text-xs font-bold text-[#0D1B2A] disabled:opacity-50"
      disabled={isWorking}
      onClick={markReviewed}
      type="button"
    >
      Marker lest
    </button>
  );
}
