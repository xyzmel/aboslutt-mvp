"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { MobileMenu, type NavigationLink } from "@/components/navigation/MobileMenu";
import { UserMenu } from "@/components/navigation/UserMenu";

type SafeUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean;
  plan?: string | null;
};

type AppHeaderProps = {
  adminSection?: boolean;
  maxWidthClassName?: string;
};

export function AppHeader({ adminSection = false, maxWidthClassName = "max-w-6xl" }: AppHeaderProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [safeUser, setSafeUser] = useState<SafeUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      if (status !== "authenticated") {
        setSafeUser(null);
        return;
      }

      const response = await fetch("/api/me", { cache: "no-store" }).catch(() => null);
      if (!isMounted || !response?.ok) {
        return;
      }

      const result = (await response.json()) as { user?: SafeUser };
      setSafeUser(result.user ?? null);
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [status]);

  const user = safeUser ?? session?.user ?? null;
  const isAdmin = Boolean(safeUser?.isAdmin);
  const userLabel = user?.name ?? user?.email ?? null;
  const links = useMemo(() => buildAppLinks(pathname, adminSection), [adminSection, pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D1B2A]/96 px-4 py-3 text-white shadow-sm shadow-black/10 backdrop-blur sm:px-5">
      <div className={`mx-auto flex ${maxWidthClassName} items-center justify-between gap-4`}>
        <Logo href={adminSection ? "/admin" : "/dashboard"} suffix={adminSection ? "Admin" : undefined} />

        <nav className="hidden items-center gap-1 rounded-2xl bg-white/[0.04] p-1 text-sm font-semibold ring-1 ring-white/10 md:flex">
          {links.map((link) => (
            <NavLink key={`${link.href}-${link.label}`} link={link} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {status === "loading" ? (
              <span className="hidden rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 sm:inline">
              Henter bruker...
            </span>
          ) : user ? (
            <div className="hidden sm:block">
              <UserMenu email={user.email} isAdmin={isAdmin} name={user.name} plan={safeUser?.plan} />
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link className="rounded-xl px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50" href="/login">
                Logg inn
              </Link>
              <Link className="rounded-xl bg-[#C8102E] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#a90d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50" href="/register">
                Start gratis
              </Link>
            </div>
          )}
          <MobileMenu isAdmin={isAdmin} isAuthenticated={Boolean(user)} links={links} userLabel={userLabel} />
        </div>
      </div>
    </header>
  );
}

function buildAppLinks(pathname: string, adminSection: boolean): NavigationLink[] {
  const userLinks: NavigationLink[] = [
    { href: "/dashboard", label: "Oversikt" },
    { href: "/import/email", label: "Importer" },
    { href: "/settings", label: "Innstillinger" },
  ];

  const adminLinks: NavigationLink[] = [
    { href: "/admin", label: "Produktoversikt" },
    { href: "/admin/billing", label: "Billing" },
    { href: "/admin/providers", label: "Leverandører" },
    { href: "/admin/jobs", label: "Jobber" },
    { href: "/admin/audit", label: "Audit" },
  ];

  const links = adminSection ? adminLinks : userLinks;

  return links.map((link) => ({
    ...link,
    active:
      pathname === link.href || (link.href !== "/admin" && pathname.startsWith(`${link.href}/`)),
  }));
}

function NavLink({ link }: { link: NavigationLink }) {
  return (
    <Link
      aria-current={link.active ? "page" : undefined}
      className={`whitespace-nowrap rounded-xl px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
        link.active ? "bg-white text-[#0D1B2A] shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
      href={link.href}
    >
      {link.label}
    </Link>
  );
}

export function Logo({ href = "/", suffix }: { href?: string; suffix?: string }) {
  return (
    <Link aria-label="Aboslutt" className="inline-flex min-w-0 items-center gap-3" href={href}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C8102E] text-lg font-black text-white">
        A
      </span>
      <span className="truncate text-xl font-extrabold tracking-tight text-white">
        Abo<span className="text-[#C8102E]">slutt</span>
        {suffix ? <span className="ml-2 text-sm font-bold text-white/45">{suffix}</span> : null}
      </span>
    </Link>
  );
}
