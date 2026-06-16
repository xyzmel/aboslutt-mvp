"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <h1 className="text-2xl font-extrabold tracking-tight">Kunne ikke laste oversikten akkurat nå.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6F82]">Prøv igjen.</p>
        <button
          className="mt-5 rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
          onClick={reset}
          type="button"
        >
          Prøv igjen
        </button>
      </section>
    </main>
  );
}
