import { PublicPageShell } from "@/components/public/PublicPageShell";
import { siteConfig } from "@/lib/site-config";

export default function PrivacyPage() {
  return (
    <PublicPageShell
      intro="Denne siden forklarer hvordan Aboslutt behandler data i offentlig MVP/beta."
      title="Personvern"
    >
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
          Aboslutt er en abonnementoversikt. I MVP-en kan du logge inn, skanne
          Gmail med read-only tilgang, se mulige abonnementer og selv bekrefte hva
          som skal lagres.
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
          Gmail brukes kun med read-only tilgang. Rå e-postinnhold lagres ikke.
          Parseren bruker innholdet midlertidig for å foreslå abonnementer, og du
          må bekrefte kandidaten før metadata lagres i oversikten.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Lagring og sletting</h2>
        <p className="mt-2">
          Aboslutt bruker databasen som er konfigurert i miljøvariabelen
          `DATABASE_URL`. For offentlig demo brukes en produksjonsklar
          Postgres-database. Du kan slette abonnementer fra dashboardet. Kontakt
          oss hvis du vil be om innsyn eller sletting av kontodata.
        </p>
      </section>
    </PublicPageShell>
  );
}
