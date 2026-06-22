import Link from "next/link";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

export default function ConnectPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0D1B2A] text-white">
      <PublicHeader maxWidthClassName="max-w-3xl" />
      <section className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 text-[#0D1B2A]">
        <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-[#DBE4EE] sm:p-10">
          <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">E-postimport</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Finn abonnementer fra e-post
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#5F6F82]">
            Koble til Gmail eller Outlook fra import-siden, skann etter mulige abonnementer og bekreft selv
            hva som skal lagres.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <FeatureCard
              title="Du bestemmer"
              text="Forslag vises til gjennomgang før noe legges til i oversikten."
            />
            <FeatureCard
              title="Manuell oversikt først"
              text="Du kan alltid legge inn abonnementer selv uten å koble til e-post."
            />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
              href="/import/email"
            >
              Gå til e-postimport
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:border-[#C8102E]/50"
              href="/dashboard"
            >
              Gå til oversikt
            </Link>
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#DBE4EE] bg-[#F7F9FC] p-5">
      <h2 className="text-sm font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5F6F82]">{text}</p>
    </div>
  );
}
