import { PublicPageShell } from "@/components/public/PublicPageShell";
import { siteConfig } from "@/lib/site-config";

export default function PrivacyPage() {
  return (
    <PublicPageShell intro="Slik behandler Aboslutt data når du bruker tjenesten." title="Personvern">
      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Hvem står bak</h2>
        <p className="mt-2">
          Aboslutt drives av {siteConfig.companyName}, org.nr. {siteConfig.orgNumber}. Du kan kontakte
          oss på{" "}
          <a className="font-semibold text-[#C8102E]" href={`mailto:${siteConfig.contactEmail}`}>
            {siteConfig.contactEmail}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Hva Aboslutt gjør</h2>
        <p className="mt-2">
          Aboslutt hjelper deg å samle abonnementer, følge med på kostnader og få bedre kontroll på
          tjenester du betaler for. Du kan legge inn abonnementer manuelt, og Premium kan bruke
          Gmail-skanning for å foreslå mulige abonnementer.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Data som kan behandles</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Kontoinformasjon fra innlogging, som navn og e-postadresse.</li>
          <li>Abonnementsdata du legger inn eller bekrefter, som navn, pris og kategori.</li>
          <li>Gmail-snutter og e-posttekst under skanning for å lage forslag.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Gmail og e-postinnhold</h2>
        <p className="mt-2">
          Gmail brukes kun med read-only tilgang. Rå e-postinnhold lagres ikke. Parseren bruker
          innholdet midlertidig for å foreslå abonnementer, og du må bekrefte kandidaten før metadata
          lagres i oversikten.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Lagring og sletting</h2>
        <p className="mt-2">
          Aboslutt bruker en produksjonsklar Postgres-database. Du kan slette abonnementer fra
          dashboardet og administrere kontodata i innstillinger. Kontakt oss hvis du vil be om innsyn
          eller sletting av kontodata.
        </p>
      </section>
    </PublicPageShell>
  );
}
