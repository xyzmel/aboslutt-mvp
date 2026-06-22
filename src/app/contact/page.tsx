import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { siteConfig } from "@/lib/site-config";

export default function ContactPage() {
  return (
    <PublicPageShell intro="Ta kontakt om Aboslutt, betaling, personvern eller hjelp til å komme i gang." title="Kontakt">
      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">{siteConfig.companyName}</h2>
        <div className="mt-2 space-y-1">
          <p>Org.nr. {siteConfig.orgNumber}</p>
          <p>Adresse: {siteConfig.address}</p>
          <p>Telefon: {siteConfig.phone}</p>
          <p>
            E-post:{" "}
            <a className="font-semibold text-[#C8102E]" href={`mailto:${siteConfig.contactEmail}`}>
              {siteConfig.contactEmail}
            </a>
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#0D1B2A]">Hva du kan spørre om</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Hjelp til å få oversikt over abonnementer.</li>
          <li>Premium, Vipps-betaling og faste trekk.</li>
          <li>Personvern, e-postimport og sletting av data.</li>
          <li>Feil i abonnementskandidater eller import fra e-post.</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-[#F0F4F8] p-5">
        <h2 className="text-lg font-bold text-[#0D1B2A]">Pris</h2>
        <p className="mt-2">Gratis: 0 kr</p>
        <p>Premium månedlig: 79 kr/mnd</p>
        <p>Premium årlig: 499 kr/år</p>
        <p className="mt-2 text-sm text-[#5F6F82]">
          Premium aktiveres automatisk når betalingen er bekreftet av Vipps.
        </p>
      </section>

      <Link
        className="inline-flex rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a90d27]"
        href="/login"
      >
        Gå til innlogging
      </Link>
    </PublicPageShell>
  );
}
