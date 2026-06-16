"use client";

import { FormEvent, useState } from "react";

export function FeedbackButton({ page }: { page: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState("5");
  const [website, setWebsite] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          rating: Number(rating),
          page,
          website,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "Kunne ikke sende tilbakemeldingen.");
      }

      setStatusMessage(result.message ?? "Takk for tilbakemeldingen.");
      setMessage("");
      setRating("5");
      setWebsite("");
      setTimeout(() => setIsOpen(false), 900);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Kunne ikke sende tilbakemeldingen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        className="rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-white/70 hover:border-white/30 hover:text-white"
        onClick={() => {
          setStatusMessage(null);
          setIsOpen(true);
        }}
        type="button"
      >
        Gi feedback
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-4 sm:items-center sm:justify-center">
          <form
            className="w-full max-w-md rounded-2xl bg-white p-5 text-[#0D1B2A] shadow-2xl"
            onSubmit={submitFeedback}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Feedback</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">Hva bør vi forbedre?</h2>
              </div>
              <button className="text-sm font-bold text-[#5F6F82]" onClick={() => setIsOpen(false)} type="button">
                Lukk
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold text-[#4A5568]">
              Tilbakemelding
              <textarea
                className="mt-2 min-h-32 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm outline-none focus:border-[#0D1B2A]"
                maxLength={2000}
                onChange={(event) => setMessage(event.target.value)}
                required
                value={message}
              />
            </label>
            <label className="hidden" aria-hidden="true">
              Nettside
              <input
                autoComplete="off"
                tabIndex={-1}
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-[#4A5568]">
              Vurdering
              <select
                className="mt-2 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0D1B2A]"
                onChange={(event) => setRating(event.target.value)}
                value={rating}
              >
                <option value="5">5 - Veldig nyttig</option>
                <option value="4">4 - Bra</option>
                <option value="3">3 - Ok</option>
                <option value="2">2 - Litt uklart</option>
                <option value="1">1 - Trenger arbeid</option>
              </select>
            </label>
            <button
              className="mt-5 w-full rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Sender..." : "Send feedback"}
            </button>
            {statusMessage ? <p className="mt-3 text-sm font-semibold text-[#5F6F82]">{statusMessage}</p> : null}
          </form>
        </div>
      ) : null}
    </>
  );
}
