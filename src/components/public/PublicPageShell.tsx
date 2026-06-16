import type { ReactNode } from "react";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

type PublicPageShellProps = {
  title: string;
  intro: string;
  children: ReactNode;
};

export function PublicPageShell({ title, intro, children }: PublicPageShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-[#0D1B2A] text-white">
      <PublicHeader maxWidthClassName="max-w-3xl" />
      <section className="flex-1 px-5 py-10">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl bg-white p-6 text-[#0D1B2A] shadow-2xl shadow-black/20 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">
              Aboslutt
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#5F6F82]">{intro}</p>
            <div className="mt-8 space-y-7 text-sm leading-6 text-[#334155]">{children}</div>
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
