import { PublicPageShell } from "@/components/public/PublicPageShell";
import { siteConfig } from "@/lib/site-config";

export default function TermsPage() {
  return (
    <PublicPageShell
      intro="Disse vilkårene gjelder for bruk av Aboslutt som offentlig MVP/beta."
      title="Vilkår"
    >
      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Tjenesten</h2>
        <p className="mt-2">
          Aboslutt er en abonnementoversikt som hjelper deg å finne og organisere
          mulige abonnementer. Tjenesten er under utvikling og tilbys som MVP/beta.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Brukeransvar</h2>
        <p className="mt-2">
          Du er ansvarlig for å kontrollere forslag før du lagrer dem. Aboslutt
          kan vise feil eller ufullstendige abonnementskandidater, spesielt fra
          e-postkvitteringer som varierer i format.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Ingen automatisk oppsigelse</h2>
        <p className="mt-2">
          MVP-en avslutter ikke abonnementer hos eksterne leverandører. Når du
          markerer noe som avsluttet i Aboslutt, gjelder det bare statusen i din
          lokale oversikt.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Pris</h2>
        <p className="mt-2">
          MVP/beta er gratis. Fremtidige betalte planer kan komme senere, men vil
          bli presentert tydelig før eventuell betaling.
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
