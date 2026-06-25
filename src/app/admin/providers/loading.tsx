export default function AdminProvidersLoading() {
  return (
    <main className="min-h-screen bg-[#F0F4F8] px-5 py-8 text-[#0D1B2A]">
      <section aria-busy="true" aria-label="Laster leverandørkatalog" className="mx-auto max-w-7xl">
        <div className="h-4 w-20 animate-pulse rounded bg-[#DCE4ED]" />
        <div className="mt-3 h-9 w-72 max-w-full animate-pulse rounded bg-[#DCE4ED]" />
        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-[#DBE4EE]" />
          <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-[#DBE4EE]" />
        </div>
        <span className="sr-only">Laster leverandører og logoer …</span>
      </section>
    </main>
  );
}
