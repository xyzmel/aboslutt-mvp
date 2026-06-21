"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";

export type NavigationLink = {
  href: string;
  label: string;
  active?: boolean;
};

type MobileMenuProps = {
  links: NavigationLink[];
  isAuthenticated: boolean;
  userLabel?: string | null;
  isAdmin?: boolean;
};

export function MobileMenu({ links, isAuthenticated, userLabel, isAdmin = false }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Lukk meny" : "Åpne meny"}
        className="min-h-11 rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        Meny
      </button>

      {isOpen ? (
        <div className="absolute left-3 right-3 top-16 z-50 overflow-hidden rounded-2xl bg-white text-[#0D1B2A] shadow-2xl ring-1 ring-[#DBE4EE] sm:left-auto sm:right-5 sm:w-80">
          {userLabel ? (
            <div className="border-b border-[#DBE4EE] px-4 py-3 text-sm">
              <p className="font-bold">Logget inn</p>
              <p className="truncate text-[#5F6F82]">{userLabel}</p>
            </div>
          ) : null}
          <nav className="grid p-2 text-sm font-semibold">
            {links.map((link) => (
              <Link
                aria-current={link.active ? "page" : undefined}
                className={`rounded-xl px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] ${
                  link.active ? "bg-[#F5E6E9] text-[#C8102E]" : "hover:bg-[#F0F4F8]"
                }`}
                href={link.href}
                key={`${link.href}-${link.label}`}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && isAdmin ? (
              <Link
                className="rounded-xl px-3 py-3 font-semibold text-[#C8102E] hover:bg-[#F5E6E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]"
                href="/admin"
                onClick={() => setIsOpen(false)}
              >
                Admin
              </Link>
            ) : null}
            {isAuthenticated ? (
              <button
                className="rounded-xl px-3 py-3 text-left font-semibold text-[#C8102E] hover:bg-[#F5E6E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]"
                onClick={() => signOut({ callbackUrl: "/login" })}
                type="button"
              >
                Logg ut
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
