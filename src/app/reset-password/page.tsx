"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0D1B2A] text-white">
      <PublicHeader />
      <section className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <Link className="mb-6 inline-flex text-sm font-medium text-white/55 hover:text-white" href="/login">
          Tilbake til innlogging
        </Link>
        <div className="rounded-[1.25rem] bg-white p-7 shadow-2xl shadow-black/20 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">Aboslutt</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0D1B2A]">Lag nytt passord</h1>
          <Suspense
            fallback={
              <p className="mt-4 rounded-xl bg-[#F0F4F8] px-4 py-3 text-sm font-semibold text-[#5F6F82]">
                Laster lenken ...
              </p>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "Kunne ikke oppdatere passordet.");
      }

      setIsSuccess(true);
      setMessage(result.message ?? "Passordet er oppdatert.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke oppdatere passordet.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <p className="mt-4 rounded-xl bg-[#F5E6E9] px-4 py-3 text-sm font-semibold text-[#C8102E]">
        Lenken er ugyldig eller utløpt. Be om en ny lenke for å lage nytt passord.
      </p>
    );
  }

  return (
    <>
      <form className="mt-6 grid gap-4" onSubmit={savePassword}>
        <PasswordInput label="Nytt passord" onChange={setPassword} value={password} />
        <PasswordInput label="Bekreft nytt passord" onChange={setConfirmPassword} value={confirmPassword} />
        <button
          className="rounded-xl bg-[#0D1B2A] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#15283c] disabled:opacity-55"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Lagrer..." : "Lagre nytt passord"}
        </button>
      </form>

      {message ? (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
            isSuccess ? "bg-emerald-50 text-emerald-700" : "bg-[#F5E6E9] text-[#C8102E]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-[#4A5568]">
      {label}
      <input
        autoComplete="new-password"
        className="mt-2 w-full rounded-xl border border-[#DBE4EE] px-4 py-3 text-sm text-[#0D1B2A] outline-none transition focus:border-[#0D1B2A]"
        minLength={8}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Minst 8 tegn"
        required
        type="password"
        value={value}
      />
    </label>
  );
}
