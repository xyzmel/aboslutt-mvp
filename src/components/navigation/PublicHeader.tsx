"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Logo } from "@/components/navigation/AppHeader";
import { MobileMenu, type NavigationLink } from "@/components/navigation/MobileMenu";
import { UserMenu } from "@/components/navigation/UserMenu";

type SafeUser = {
  name?: string | null;
  email?: string | null;
  isAdmin?: boolean;
  plan?: string | null;
};

export function PublicHeader({ maxWidthClassName = "max-w-6xl" }: { maxWidthClassName?: string }) {
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
  const links = useMemo(
    () => buildPublicLinks(pathname, Boolean(user)),
    [pathname, user],
  );

  return (
    <header className="px-5 py-5 text-white">
      <div className={`relative mx-auto flex ${maxWidthClassName} items-center justify-between gap-4`}>
        <Logo />
        <nav className="hidden items-center gap-1 text-sm font-semibold md:flex">
          {links.map((link) => (
            <HeaderLink key={`${link.href}-${link.label}`} link={link} />
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <div className="hidden sm:block">
              <UserMenu
                email={user.email}
                isAdmin={Boolean(safeUser?.isAdmin)}
                name={user.name}
                plan={safeUser?.plan}
              />
            </div>
          ) : null}
          <MobileMenu
            isAdmin={Boolean(safeUser?.isAdmin)}
            isAuthenticated={Boolean(user)}
            links={links}
            userLabel={user?.name ?? user?.email ?? null}
          />
        </div>
      </div>
    </header>
  );
}

function buildPublicLinks(pathname: string, isAuthenticated: boolean): NavigationLink[] {
  const links: NavigationLink[] = isAuthenticated
    ? [
        { href: "/dashboard", label: "Gå til oversikt" },
        { href: "/import/email", label: "Importer e-post" },
        { href: "/settings", label: "Innstillinger" },
      ]
    : [
        { href: "/#produkt", label: "Produkt" },
        { href: "/pricing", label: "Priser" },
        { href: "/login", label: "Logg inn" },
        { href: "/register", label: "Start gratis" },
      ];

  return links.map((link) => ({
    ...link,
    active: pathname === link.href || (link.href === "/pricing" && pathname === "/pricing"),
  }));
}

function HeaderLink({ link }: { link: NavigationLink }) {
  const isPrimary = link.href === "/register" || link.label === "Gå til oversikt";

  return (
    <Link
      className={`rounded-xl px-3 py-2 transition ${
        isPrimary
          ? "bg-[#C8102E] text-white hover:bg-[#a90d27]"
          : link.active
            ? "bg-white/10 text-white"
            : "text-white/65 hover:bg-white/10 hover:text-white"
      }`}
      href={link.href}
    >
      {link.label}
    </Link>
  );
}
