"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void error.digest;
  }, [error.digest]);

  return (
    <html lang="no">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#F0F4F8] px-5 text-[#0D1B2A]">
          <section className="w-full max-w-xl rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
            <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Noe gikk galt</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Vi klarte ikke å laste siden</h1>
            <p className="mt-3 text-sm leading-6 text-[#5F6F82]">
              Prøv igjen. Hvis feilen fortsetter, kan du kontakte oss på kontakt@aboslutt.no.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
                onClick={reset}
                type="button"
              >
                Prøv igjen
              </button>
              <Link
                className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
                href="/dashboard"
              >
                Gå til oversikt
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
