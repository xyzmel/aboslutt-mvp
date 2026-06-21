import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { siteConfig } from "@/lib/site-config";

export default function TermsPage() {
  return (
    <PublicPageShell intro="Disse vilkårene gjelder for bruk av Aboslutt." title="Vilkår">
      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Tjenesten</h2>
        <p className="mt-2">
          Aboslutt er en abonnementoversikt som hjelper deg å samle abonnementer, følge med på kostnader
          og få bedre kontroll på kommende trekk.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Brukeransvar</h2>
        <p className="mt-2">
          Du er ansvarlig for å kontrollere forslag før du lagrer dem. Aboslutt kan vise feil eller
          ufullstendige abonnementskandidater, spesielt fra e-postkvitteringer som varierer i format.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Ingen automatisk oppsigelse</h2>
        <p className="mt-2">
          Aboslutt avslutter ikke abonnementer hos eksterne leverandører automatisk. Når du markerer noe
          som avsluttet i Aboslutt, gjelder det statusen i din egen oversikt.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Pris og betaling</h2>
        <p className="mt-2">
          Gratis-planen kan brukes uten betaling. Premium-priser og betalingsvilkår finner du på{" "}
          <Link className="font-semibold text-[#C8102E]" href="/pricing">
            prissiden
          </Link>{" "}
          og i{" "}
          <Link className="font-semibold text-[#C8102E]" href="/terms/sales">
            salgsbetingelsene
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Kontakt</h2>
        <p className="mt-2">
          Aboslutt drives av {siteConfig.companyName}, org.nr. {siteConfig.orgNumber}. Kontakt:{" "}
          <a className="font-semibold text-[#C8102E]" href={`mailto:${siteConfig.contactEmail}`}>
            {siteConfig.contactEmail}
          </a>
          .
        </p>
      </section>
    </PublicPageShell>
  );
}
