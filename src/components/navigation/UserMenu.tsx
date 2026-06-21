"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

type UserMenuProps = {
  name?: string | null;
  email?: string | null;
  plan?: string | null;
  isAdmin?: boolean;
};

export function UserMenu({ name, email, plan, isAdmin = false }: UserMenuProps) {
  const label = name ?? email ?? "Min konto";
  const initials = getInitials(name, email);

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-white/85 outline-none ring-white/20 transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/50">
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#C8102E] px-2 text-xs font-black text-white">
          {initials}
        </span>
        <span className="hidden max-w-40 truncate sm:block">{label}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-white text-[#0D1B2A] shadow-2xl ring-1 ring-[#DBE4EE]">
        <div className="border-b border-[#DBE4EE] p-4">
          <p className="truncate text-sm font-bold">{label}</p>
          {email ? <p className="mt-1 truncate text-xs text-[#5F6F82]">{email}</p> : null}
          <span className="mt-2 inline-flex rounded-full bg-[#F5E6E9] px-2.5 py-1 text-xs font-bold text-[#C8102E]">
            {formatPlan(plan)}
          </span>
        </div>
        <div className="grid p-2 text-sm font-semibold">
          <Link className="rounded-xl px-3 py-2 hover:bg-[#F0F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]" href="/dashboard">
            Oversikt
          </Link>
          {isAdmin ? (
            <Link className="rounded-xl px-3 py-2 text-[#C8102E] hover:bg-[#F5E6E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]" href="/admin">
              Admin
            </Link>
          ) : null}
          <Link className="rounded-xl px-3 py-2 hover:bg-[#F0F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]" href="/pricing">
            Min plan/priser
          </Link>
          <Link className="rounded-xl px-3 py-2 hover:bg-[#F0F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]" href="/settings">
            Innstillinger
          </Link>
          <button
            className="rounded-xl px-3 py-2 text-left font-semibold text-[#C8102E] hover:bg-[#F5E6E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]"
            onClick={() => signOut({ callbackUrl: "/login" })}
            type="button"
          >
            Logg ut
          </button>
        </div>
      </div>
    </details>
  );
}

export function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "A";
  const parts = source
    .replace(/@.*/, "")
    .split(/\s|[._-]/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatPlan(plan?: string | null) {
  const labels: Record<string, string> = {
    free: "Gratis",
    beta: "Premium",
    premium: "Premium",
    admin: "Admin",
  };

  return labels[plan ?? ""] ?? "Gratis";
}
