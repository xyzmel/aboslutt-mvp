"use client";

import { FormEvent, useState } from "react";
import { LoadingButton } from "@/components/ui/LoadingButton";

type Provider = {
  id: string;
  name: string;
  slug: string;
  category: string;
  aliases: string[];
  senderNames: string[];
  emailDomains: string[];
  logoPath: string | null;
  websiteUrl: string | null;
  accountManagementUrl: string | null;
  cancellationUrl: string | null;
  cancellationMethod: string | null;
  cancellationInstructions: string[];
  requiredInformation: string[];
  confirmationExpected: string | null;
  countryCode: string | null;
  verificationSource: string | null;
  isCancellationGuideActive: boolean;
  defaultBillingInterval: string | null;
  supportedCountries: string[];
  isActive: boolean;
  lastVerifiedAt: string | null;
};

const emptyProvider: Omit<Provider, "id"> = {
  name: "",
  slug: "",
  category: "other",
  aliases: [],
  senderNames: [],
  emailDomains: [],
  logoPath: null,
  websiteUrl: null,
  accountManagementUrl: null,
  cancellationUrl: null,
  cancellationMethod: null,
  cancellationInstructions: [],
  requiredInformation: [],
  confirmationExpected: null,
  countryCode: "NO",
  verificationSource: null,
  isCancellationGuideActive: false,
  defaultBillingInterval: "monthly",
  supportedCountries: ["NO"],
  isActive: true,
  lastVerifiedAt: null,
};

export function AdminProviderCatalog({
  initialProviders,
  unmatchedSignals,
  coverage,
}: {
  initialProviders: Provider[];
  unmatchedSignals: { id: string; displayName: string; source: string; count: number; lastSeenAt: string }[];
  coverage: {
    complete: CoverageItem[];
    missing: CoverageItem[];
    missingLogos: CoverageItem[];
    stale: CoverageItem[];
    mostUsed: CoverageItem[];
  };
}) {
  const [providers, setProviders] = useState(initialProviders);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<Omit<Provider, "id">>(emptyProvider);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function edit(provider: Provider) {
    setEditing(provider);
    setForm({ ...provider });
    setMessage(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    const response = await fetch(
      editing ? `/api/admin/subscription-providers/${editing.id}` : "/api/admin/subscription-providers",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      },
    );
    const result = (await response.json().catch(() => ({}))) as { provider?: Provider; messages?: string[] };
    setIsSaving(false);
    if (!response.ok || !result.provider) {
      setMessage(result.messages?.join(" ") ?? "Kunne ikke lagre leverandøren.");
      return;
    }
    setProviders((current) =>
      editing
        ? current.map((provider) => (provider.id === result.provider?.id ? result.provider : provider))
        : [...current, result.provider!].sort((a, b) => a.name.localeCompare(b.name, "nb")),
    );
    setEditing(null);
    setForm(emptyProvider);
    setMessage("Leverandøren er lagret.");
  }

  async function toggle(provider: Provider) {
    const response = await fetch(`/api/admin/subscription-providers/${provider.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...provider, isActive: !provider.isActive }),
    });
    const result = (await response.json().catch(() => ({}))) as { provider?: Provider };
    if (response.ok && result.provider) {
      setProviders((current) => current.map((item) => (item.id === provider.id ? result.provider! : item)));
    }
  }

  return (
    <>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DBE4EE]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#F7F9FC] text-xs uppercase text-[#5F6F82]">
              <tr><th className="px-4 py-3">Leverandør</th><th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Guide</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Handlinger</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DBE4EE]">
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td className="px-4 py-3"><p className="font-bold">{provider.name}</p><p className="text-xs text-[#5F6F82]">{provider.aliases.join(", ") || provider.slug}</p></td>
                  <td className="px-4 py-3">{provider.category}</td>
                  <td className="px-4 py-3 text-xs">{provider.isCancellationGuideActive ? "Aktiv" : "Mangler"}</td>
                  <td className="px-4 py-3">{provider.isActive ? "Aktiv" : "Deaktivert"}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button className="font-bold text-[#C8102E]" onClick={() => edit(provider)} type="button">Rediger</button><button className="font-bold text-[#5F6F82]" onClick={() => toggle(provider)} type="button">{provider.isActive ? "Deaktiver" : "Aktiver"}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <form className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]" onSubmit={save}>
        <h2 className="text-lg font-extrabold">{editing ? "Rediger leverandør" : "Legg til leverandør"}</h2>
        <div className="mt-4 grid gap-3">
          <Field label="Navn" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} />
          <Field label="Slug" value={form.slug} onChange={(slug) => setForm((current) => ({ ...current, slug }))} />
          <Field label="Kategori" value={form.category} onChange={(category) => setForm((current) => ({ ...current, category }))} />
          <ListField label="Aliaser" values={form.aliases} onChange={(aliases) => setForm((current) => ({ ...current, aliases }))} />
          <ListField label="Avsendernavn" values={form.senderNames} onChange={(senderNames) => setForm((current) => ({ ...current, senderNames }))} />
          <ListField label="E-postdomener" values={form.emailDomains} onChange={(emailDomains) => setForm((current) => ({ ...current, emailDomains }))} />
          <Field label="Logo (/providers/...)" value={form.logoPath ?? ""} onChange={(logoPath) => setForm((current) => ({ ...current, logoPath }))} />
          <Field label="Nettside" value={form.websiteUrl ?? ""} onChange={(websiteUrl) => setForm((current) => ({ ...current, websiteUrl }))} />
          <Field label="Kontoside" value={form.accountManagementUrl ?? ""} onChange={(accountManagementUrl) => setForm((current) => ({ ...current, accountManagementUrl }))} />
          <Field label="Oppsigelseslenke" value={form.cancellationUrl ?? ""} onChange={(cancellationUrl) => setForm((current) => ({ ...current, cancellationUrl }))} />
          <label className="text-sm font-semibold text-[#4A5568]">
            Anbefalt oppsigelsesmetode
            <select className="mt-1 w-full rounded-xl border border-[#DBE4EE] bg-white px-3 py-2.5" onChange={(event) => setForm((current) => ({ ...current, cancellationMethod: event.target.value || null }))} value={form.cancellationMethod ?? ""}>
              <option value="">Ingen valgt</option>
              <option value="website">Nettside</option>
              <option value="email">E-post</option>
              <option value="phone">Telefon</option>
              <option value="app">App</option>
              <option value="manual">Manuell kontakt</option>
              <option value="unknown">Ukjent</option>
            </select>
          </label>
          <MultilineField label="Nummererte instruksjoner" values={form.cancellationInstructions} onChange={(cancellationInstructions) => setForm((current) => ({ ...current, cancellationInstructions }))} />
          <MultilineField label="Opplysninger brukeren kan trenge" values={form.requiredInformation} onChange={(requiredInformation) => setForm((current) => ({ ...current, requiredInformation }))} />
          <Field label="Forventet bekreftelse" value={form.confirmationExpected ?? ""} onChange={(confirmationExpected) => setForm((current) => ({ ...current, confirmationExpected }))} />
          <Field label="Landkode" value={form.countryCode ?? ""} onChange={(countryCode) => setForm((current) => ({ ...current, countryCode }))} />
          <Field label="Intern verifikasjonskilde" value={form.verificationSource ?? ""} onChange={(verificationSource) => setForm((current) => ({ ...current, verificationSource }))} />
          <label className="flex items-center gap-3 rounded-xl bg-[#F7F9FC] p-3 text-sm font-semibold">
            <input checked={form.isCancellationGuideActive} onChange={(event) => setForm((current) => ({ ...current, isCancellationGuideActive: event.target.checked }))} type="checkbox" />
            Veiledningen er aktiv
          </label>
          <Field label="Standardintervall" value={form.defaultBillingInterval ?? ""} onChange={(defaultBillingInterval) => setForm((current) => ({ ...current, defaultBillingInterval }))} />
          <ListField label="Landkoder" values={form.supportedCountries} onChange={(supportedCountries) => setForm((current) => ({ ...current, supportedCountries }))} />
          <Field label="Sist verifisert (YYYY-MM-DD)" value={form.lastVerifiedAt?.slice(0, 10) ?? ""} onChange={(lastVerifiedAt) => setForm((current) => ({ ...current, lastVerifiedAt }))} />
        </div>
        {message ? <p className="mt-3 text-sm font-semibold text-[#5F6F82]">{message}</p> : null}
        <div className="mt-4 flex gap-2">
          <LoadingButton isLoading={isSaving} type="submit">Lagre</LoadingButton>
          {editing ? <button className="rounded-xl border border-[#DBE4EE] px-4 text-sm font-bold" onClick={() => { setEditing(null); setForm(emptyProvider); }} type="button">Avbryt</button> : null}
        </div>
      </form>
    </div>
    <CoverageView coverage={coverage} />
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <h2 className="text-lg font-extrabold">Umatchede navn</h2>
      <p className="mt-1 text-sm text-[#5F6F82]">Kun aggregert navn, kilde og antall lagres. Ingen e-postinnhold eller brukerinformasjon vises.</p>
      {unmatchedSignals.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unmatchedSignals.map((signal) => (
            <div className="rounded-xl bg-[#F7F9FC] p-3 ring-1 ring-[#DBE4EE]" key={signal.id}>
              <p className="font-bold">{signal.displayName}</p>
              <p className="mt-1 text-xs text-[#5F6F82]">{signal.count} funn · {signal.source}</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-4 text-sm text-[#5F6F82]">Ingen aggregerte unmatched-funn ennå.</p>}
    </section>
    </>
  );
}

type CoverageItem = { id: string; name: string; subscriptionCount: number };

function CoverageView({ coverage }: { coverage: {
  complete: CoverageItem[];
  missing: CoverageItem[];
  missingLogos: CoverageItem[];
  stale: CoverageItem[];
  mostUsed: CoverageItem[];
} }) {
  return (
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DBE4EE]">
      <h2 className="text-lg font-extrabold">Dekning for oppsigelsesguider</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CoverageCard label="Komplette guider" items={coverage.complete} />
        <CoverageCard label="Mangler guide" items={coverage.missing} />
        <CoverageCard label="Mangler logo" items={coverage.missingLogos} />
        <CoverageCard label="Ikke verifisert siste 6 måneder" items={coverage.stale} />
      </div>
      <div className="mt-4 rounded-xl bg-[#F7F9FC] p-4">
        <h3 className="text-sm font-extrabold">Mest brukte leverandører</h3>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {coverage.mostUsed.map((provider) => (
            <li className="flex justify-between gap-3 text-sm" key={provider.id}>
              <span>{provider.name}</span>
              <span className="font-bold">{provider.subscriptionCount}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CoverageCard({ label, items }: { label: string; items: CoverageItem[] }) {
  return (
    <div className="rounded-xl bg-[#F7F9FC] p-4 ring-1 ring-[#DBE4EE]">
      <p className="text-sm font-extrabold">{label}</p>
      <p className="mt-1 text-2xl font-black">{items.length}</p>
      {items.length > 0 ? (
        <details className="mt-2 text-xs leading-5 text-[#5F6F82]">
          <summary className="cursor-pointer font-bold">Vis leverandører</summary>
          <ul className="mt-2 max-h-48 overflow-y-auto">
            {items.map((item) => <li key={item.id}>{item.name}</li>)}
          </ul>
        </details>
      ) : <p className="mt-2 text-xs text-[#5F6F82]">Ingen</p>}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-[#4A5568]">{label}<input className="mt-1 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5" onChange={(event) => onChange(event.target.value)} required={["Navn", "Slug", "Kategori"].includes(label)} value={value} /></label>;
}

function ListField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <Field label={`${label} (kommaseparert)`} value={values.join(", ")} onChange={(value) => onChange(value.split(",").map((item) => item.trim()).filter(Boolean))} />;
}

function MultilineField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <label className="text-sm font-semibold text-[#4A5568]">
      {label} (ett punkt per linje)
      <textarea
        className="mt-1 min-h-28 w-full rounded-xl border border-[#DBE4EE] px-3 py-2.5"
        onChange={(event) => onChange(event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))}
        value={values.join("\n")}
      />
    </label>
  );
}
