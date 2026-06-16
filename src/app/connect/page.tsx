import Link from "next/link";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

export default function ConnectPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0D1B2A] text-white">
      <PublicHeader maxWidthClassName="max-w-3xl" />
      <section className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 text-[#0D1B2A]">
        <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-[#DBE4EE] sm:p-10">
          <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Kommer senere</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Flere måter å finne abonnementer på
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#5F6F82]">
            Gmail read-only import er tilgjengelig nå. Senere kan Aboslutt få flere
            tilkoblinger, som e-postvideresending, Outlook og Open Banking.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {["E-postvideresending", "Outlook", "Open Banking"].map((item) => (
              <div className="rounded-2xl border border-[#DBE4EE] bg-[#F7F9FC] p-5" key={item}>
                <h2 className="text-sm font-bold">{item}</h2>
                <p className="mt-2 text-sm leading-6 text-[#5F6F82]">
                  Planlagt integrasjon. Ingen data hentes fra denne kilden ennå.
                </p>
              </div>
            ))}
          </div>

          <Link
            className="mt-8 inline-flex rounded-xl bg-[#0D1B2A] px-5 py-3 text-sm font-bold text-white hover:bg-[#15283c]"
            href="/dashboard"
          >
            Gå til oversikt
          </Link>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
