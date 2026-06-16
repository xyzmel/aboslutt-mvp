"use client";

import { FormEvent, useState } from "react";

const defaultForm = {
  name: "",
  email: "",
  message: "",
  website: "",
};

export function BetaRequestForm() {
  const [form, setForm] = useState(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const response = await fetch("/api/beta-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "Kunne ikke sende beta-forespørselen.");
      }

      setIsSuccess(true);
      setMessage(result.message ?? "Takk! Vi har mottatt forespørselen din.");
      setForm(defaultForm);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke sende beta-forespørselen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submitRequest}>
      <TextInput
        label="Navn"
        onChange={(value) => setForm((current) => ({ ...current, name: value }))}
        placeholder="Navnet ditt"
        value={form.name}
      />
      <TextInput
        label="E-post"
        onChange={(value) => setForm((current) => ({ ...current, email: value }))}
        placeholder="navn@eksempel.no"
        required
        type="email"
        value={form.email}
      />
      <label className="hidden" aria-hidden="true">
        Nettside
        <input
          autoComplete="off"
          tabIndex={-1}
          value={form.website}
          onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
        />
      </label>
      <label className="text-sm font-semibold text-[#4A5568]">
        Hvorfor vil du teste Aboslutt?
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm text-[#0D1B2A] outline-none transition focus:border-[#0D1B2A]"
          maxLength={1200}
          onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
          placeholder="Valgfritt"
          value={form.message}
        />
      </label>
      <button
        className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Sender..." : "Be om beta-tilgang"}
      </button>
      {message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            isSuccess ? "bg-emerald-50 text-emerald-700" : "bg-[#F5E6E9] text-[#C8102E]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  type = "text",
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: "text" | "email";
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-[#4A5568]">
      {label}
      <input
        className="mt-2 h-12 w-full rounded-xl border border-[#DBE4EE] px-4 text-sm text-[#0D1B2A] outline-none transition focus:border-[#0D1B2A]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
