"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="nb">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-6 py-16">
          <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-[#DBE4EE]">
            <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Noe gikk galt</p>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#0D1B2A]">Vi klarte ikke å vise siden</h1>
            <p className="mt-3 text-sm leading-6 text-[#5F6F82]">
              Prøv igjen om litt. Hvis problemet fortsetter, kan du kontakte oss på kontakt@aboslutt.no.
            </p>
            <button
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2"
              onClick={reset}
              type="button"
            >
              Prøv igjen
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
