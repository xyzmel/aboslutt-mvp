"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { siteConfig } from "@/lib/site-config";

export function AppFooter({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);

  if (compact) {
    return (
      <footer className="border-t border-[#DBE4EE] bg-[#F0F4F8] px-5 py-5 text-xs text-[#5F6F82]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {siteConfig.siteName} · {siteConfig.companyName} · Org.nr. {siteConfig.orgNumber}
          </p>
          <nav className="flex flex-wrap gap-3 font-semibold">
            <Link className="hover:text-[#C8102E]" href="/privacy">
              Personvern
            </Link>
            <Link className="hover:text-[#C8102E]" href="/terms">
              Vilkår
            </Link>
            <Link className="hover:text-[#C8102E]" href="/terms/sales">
              Salgsbetingelser
            </Link>
            <Link className="hover:text-[#C8102E]" href="/contact">
              Kontakt
            </Link>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-white/10 bg-[#0D1B2A] px-5 py-10 text-sm text-white/62">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <Link aria-label="Aboslutt" className="inline-flex items-center gap-3 text-white" href="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8102E] text-lg font-black">
              A
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              Abo<span className="text-[#C8102E]">slutt</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs leading-6">
            Få kontroll på abonnementene dine. Oppdag hva du betaler for, og kutt det du ikke trenger.
          </p>
          <div className="mt-5 leading-6">
            <p className="font-semibold text-white">{siteConfig.companyName}</p>
            <p>Org.nr. {siteConfig.orgNumber}</p>
            <p>Adresse: {siteConfig.address}</p>
            <p>Telefon: {siteConfig.phone}</p>
            <a className="hover:text-white" href={`mailto:${siteConfig.contactEmail}`}>
              {siteConfig.contactEmail}
            </a>
          </div>
        </div>

        <FooterColumn
          links={[
            ["Produkt", "/#produkt"],
            ["Premium", "/pricing"],
            ["Logg inn", "/login"],
            ["Opprett konto", "/register"],
          ]}
          title="Produkt"
        />

        <FooterColumn
          links={[
            ["Oversikt", "/dashboard"],
            ["E-postimport", "/import/email"],
            ["Innstillinger", "/settings"],
          ]}
          title="App"
        />

        <FooterColumn
          links={[
            ["Personvern", "/privacy"],
            ["Vilkår", "/terms"],
            ["Salgsbetingelser", "/terms/sales"],
            ["Kontakt", "/contact"],
          ]}
          title="Juridisk"
        />

        <FooterColumn
          links={[
            ["Start gratis", isLoggedIn ? "/dashboard" : "/register"],
            ["Se Premium", "/pricing"],
            ["Kontakt oss", "/contact"],
          ]}
          title="Kom i gang"
        />
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav className="grid content-start gap-2">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">{title}</p>
      {links.map(([label, href]) => (
        <Link className="font-semibold hover:text-white" href={href} key={`${title}-${href}-${label}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
