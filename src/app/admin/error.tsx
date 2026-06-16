"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-10 text-[#0D1B2A]">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#DBE4EE]">
        <h1 className="text-2xl font-extrabold tracking-tight">Kunne ikke laste admin-data.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6F82]">Prøv igjen senere.</p>
        <button
          className="mt-5 rounded-xl bg-[#0D1B2A] px-5 py-3 text-sm font-bold text-white hover:bg-[#15283c]"
          onClick={reset}
          type="button"
        >
          Prøv igjen
        </button>
      </section>
    </main>
  );
}
