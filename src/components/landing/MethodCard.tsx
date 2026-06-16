import Link from "next/link";

type MethodCardProps = {
  title: string;
  description: string;
  icon: string;
  href: string;
  badge?: string;
  disabled?: boolean;
  recommended?: boolean;
};

export function MethodCard({
  title,
  description,
  icon,
  href,
  badge,
  disabled = false,
  recommended = false,
}: MethodCardProps) {
  const cardClasses = [
    "flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition",
    recommended
      ? "border-[#C8102E]/50 bg-[#C8102E]/15 hover:bg-[#C8102E]/25"
      : "border-white/10 bg-white/[0.06] hover:border-white/20 hover:bg-white/[0.1]",
    disabled ? "pointer-events-none opacity-60" : "hover:-translate-y-0.5",
  ].join(" ");

  return (
    <Link aria-disabled={disabled} className={cardClasses} href={disabled ? "#" : href}>
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
          recommended ? "bg-[#C8102E]/30" : "bg-white/[0.08]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-white/50">{description}</span>
      </span>
      {badge ? (
        <span className="rounded-full bg-[#C8102E] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
