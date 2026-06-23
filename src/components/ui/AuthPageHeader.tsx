import type { ReactNode } from "react";

export function AuthPageHeader({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-[#DBE4EE] bg-white p-5 shadow-sm sm:p-6 lg:flex lg:items-end lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#C8102E]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0D1B2A] sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F6F82]">{description}</p>
      </div>
      {actions ? <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:mt-0">{actions}</div> : null}
    </div>
  );
}
