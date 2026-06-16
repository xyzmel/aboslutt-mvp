"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

const safeMessage = "Hvis e-posten finnes, sender vi deg en lenke.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);

    setMessage(safeMessage);
    setIsSubmitting(false);
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0D1B2A] text-white">
      <PublicHeader />
      <section className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <Link className="mb-6 inline-flex text-sm font-medium text-white/55 hover:text-white" href="/login">
          Tilbake til innlogging
        </Link>
        <div className="rounded-[1.25rem] bg-white p-7 shadow-2xl shadow-black/20 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">Aboslutt</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0D1B2A]">
            Glemt passord?
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
            Skriv inn e-postadressen din. Hvis kontoen finnes, sender vi en lenke
            for å lage nytt passord.
          </p>

          <form className="mt-6" onSubmit={requestReset}>
            <label className="text-sm font-semibold text-[#4A5568]" htmlFor="email">
              E-post
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm text-[#0D1B2A] outline-none transition focus:border-[#0D1B2A]"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="navn@eksempel.no"
              required
              type="email"
              value={email}
            />
            <button
              className="mt-4 w-full rounded-xl bg-[#0D1B2A] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#15283c] disabled:opacity-55"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Sender..." : "Send lenke"}
            </button>
          </form>

          {message ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {message}
            </p>
          ) : null}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
