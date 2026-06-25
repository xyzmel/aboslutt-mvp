"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Image from "next/image";
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
  supportsAbosluttSending: boolean;
  verifiedCancellationEmail: string | null;
  sendingVerifiedAt: string | null;
  requiresProviderLogin: boolean;
  requiresCustomerReference: boolean;
  defaultBillingInterval: string | null;
  supportedCountries: string[];
  isActive: boolean;
  lastVerifiedAt: string | null;
  latestLogoAsset: ProviderLogoAsset | null;
};

type ProviderLogoAsset = {
  id: string;
  sourceWebsite: string | null;
  sourceUrl: string;
  contentType: string;
  byteSize: number;
  blobUrl: string | null;
  status: string;
  fetchedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
};

type DraftLogoCandidate = {
  sourceUrl: string;
  contentType: string;
  byteSize: number;
  previewDataUrl: string;
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
  supportsAbosluttSending: false,
  verifiedCancellationEmail: null,
  sendingVerifiedAt: null,
  requiresProviderLogin: false,
  requiresCustomerReference: false,
  defaultBillingInterval: "monthly",
  supportedCountries: ["NO"],
  isActive: true,
  lastVerifiedAt: null,
  latestLogoAsset: null,
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
  const [logoActionId, setLogoActionId] = useState<string | null>(null);
  const [formLogoCandidate, setFormLogoCandidate] = useState<DraftLogoCandidate | null>(null);
  const [manualLogoFile, setManualLogoFile] = useState<File | null>(null);
  const [manualLogoPreview, setManualLogoPreview] = useState<string | null>(null);
  const [useFormLogoCandidate, setUseFormLogoCandidate] = useState(false);
  const [isFetchingFormLogo, setIsFetchingFormLogo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function edit(provider: Provider) {
    setEditing(provider);
    setForm({ ...provider });
    setFormLogoCandidate(null);
    setManualLogoFile(null);
    setManualLogoPreview(null);
    setUseFormLogoCandidate(false);
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
    if (!response.ok || !result.provider) {
      setIsSaving(false);
      setMessage(result.messages?.join(" ") ?? "Kunne ikke lagre leverandøren.");
      return;
    }
    const savedProvider = {
      ...result.provider,
      latestLogoAsset: result.provider.latestLogoAsset ?? editing?.latestLogoAsset ?? null,
    };
    setProviders((current) =>
      editing
        ? current.map((provider) => (provider.id === savedProvider.id ? savedProvider : provider))
        : [...current, savedProvider].sort((a, b) => a.name.localeCompare(b.name, "nb")),
    );
    const hadPendingLogo = Boolean(manualLogoFile || (formLogoCandidate && useFormLogoCandidate));
    const logoResult = await applyPendingFormLogo(savedProvider);
    if (hadPendingLogo && !logoResult) {
      setEditing(savedProvider);
      setIsSaving(false);
      return;
    }
    const finalProvider = logoResult ? { ...savedProvider, logoPath: logoResult.logoPath } : savedProvider;
    setProviders((current) =>
      current.map((provider) => provider.id === finalProvider.id ? finalProvider : provider),
    );
    setEditing(null);
    setForm(emptyProvider);
    setFormLogoCandidate(null);
    setManualLogoFile(null);
    setManualLogoPreview(null);
    setUseFormLogoCandidate(false);
    setIsSaving(false);
    if (logoResult) {
      setMessage("Leverandøren og logoen er lagret.");
    } else if (!formLogoCandidate && !manualLogoFile) {
      setMessage("Leverandøren er lagret.");
    }
  }

  async function fetchFormLogo() {
    if (!isValidHttpsUrl(form.websiteUrl)) {
      setMessage("Legg inn leverandørens nettside først.");
      return;
    }
    setIsFetchingFormLogo(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/providers/logo-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: form.websiteUrl, slug: form.slug }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        candidate?: DraftLogoCandidate;
        message?: string;
      };
      if (!response.ok || !result.candidate) {
        setMessage(result.message ?? "Logoen kunne ikke hentes. Prøv igjen.");
        return;
      }
      setFormLogoCandidate(result.candidate);
      setManualLogoFile(null);
      setManualLogoPreview(null);
      setUseFormLogoCandidate(false);
      setMessage("Logoen er klar for forhåndsvisning.");
    } catch {
      setMessage("Logoen kunne ikke hentes. Prøv igjen.");
    } finally {
      setIsFetchingFormLogo(false);
    }
  }

  async function applyPendingFormLogo(provider: Provider) {
    if (manualLogoFile) {
      const body = new FormData();
      body.set("file", manualLogoFile);
      const response = await fetch(`/api/admin/subscription-providers/${provider.id}/logo`, {
        method: "POST",
        body,
      });
      const result = (await response.json().catch(() => ({}))) as { logoPath?: string; message?: string };
      if (!response.ok || !result.logoPath) {
        setMessage(result.message ?? "Logoen kunne ikke lagres. Prøv igjen.");
        return null;
      }
      return { logoPath: result.logoPath };
    }
    if (!formLogoCandidate || !useFormLogoCandidate) return null;

    const staged = await fetch(`/api/admin/subscription-providers/${provider.id}/logo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stage", sourceUrl: formLogoCandidate.sourceUrl }),
    });
    const stagedResult = (await staged.json().catch(() => ({}))) as { asset?: ProviderLogoAsset; message?: string };
    if (!staged.ok || !stagedResult.asset) {
      setMessage(stagedResult.message ?? "Logoen kunne ikke lagres. Prøv igjen.");
      return null;
    }
    const approved = await fetch(`/api/admin/subscription-providers/${provider.id}/logo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", assetId: stagedResult.asset.id }),
    });
    const approvedResult = (await approved.json().catch(() => ({}))) as { logoPath?: string; message?: string };
    if (!approved.ok || !approvedResult.logoPath) {
      setMessage(approvedResult.message ?? "Logoen kunne ikke lagres. Prøv igjen.");
      return null;
    }
    return { logoPath: approvedResult.logoPath };
  }

  function selectManualLogo(file: File | null) {
    setManualLogoFile(file);
    setManualLogoPreview(null);
    setFormLogoCandidate(null);
    setUseFormLogoCandidate(false);
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setManualLogoPreview(typeof reader.result === "string" ? reader.result : null);
    }, { once: true });
    reader.readAsDataURL(file);
  }

  async function removeFormLogo() {
    if (!editing?.logoPath) return;
    setLogoActionId(`${editing.id}:remove`);
    try {
      const response = await fetch(`/api/admin/subscription-providers/${editing.id}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? "Logoen kunne ikke fjernes.");
        return;
      }
      setEditing((current) => current ? { ...current, logoPath: null } : null);
      setForm((current) => ({ ...current, logoPath: null }));
      setProviders((current) => current.map((provider) => provider.id === editing.id ? { ...provider, logoPath: null } : provider));
      setMessage("Logoen er fjernet.");
    } finally {
      setLogoActionId(null);
    }
  }

  async function toggle(provider: Provider) {
    const response = await fetch(`/api/admin/subscription-providers/${provider.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...provider, isActive: !provider.isActive }),
    });
    const result = (await response.json().catch(() => ({}))) as { provider?: Provider };
    if (response.ok && result.provider) {
      const updatedProvider = {
        ...result.provider,
        latestLogoAsset: result.provider.latestLogoAsset ?? provider.latestLogoAsset,
      };
      setProviders((current) => current.map((item) => (item.id === provider.id ? updatedProvider : item)));
    }
  }

  async function runLogoAction(provider: Provider, action: "fetch" | "refetch" | "approve" | "reject" | "remove") {
    setLogoActionId(`${provider.id}:${action}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/subscription-providers/${provider.id}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, assetId: provider.latestLogoAsset?.id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        asset?: ProviderLogoAsset;
        logoPath?: string | null;
        message?: string;
      };
      if (!response.ok) {
        setMessage(result.message ?? "Logo-handlingen kunne ikke fullføres.");
        return;
      }
      setProviders((current) =>
        current.map((item) =>
          item.id !== provider.id
            ? item
            : {
                ...item,
                ...(result.asset ? { latestLogoAsset: result.asset } : {}),
                ...("logoPath" in result ? { logoPath: result.logoPath ?? null } : {}),
                ...(action === "approve" && item.latestLogoAsset
                  ? { latestLogoAsset: { ...item.latestLogoAsset, status: "approved", approvedAt: new Date().toISOString() } }
                  : {}),
                ...(action === "reject" && item.latestLogoAsset
                  ? { latestLogoAsset: { ...item.latestLogoAsset, status: "rejected", rejectedAt: new Date().toISOString() } }
                  : {}),
              },
        ),
      );
      setMessage(
        action === "approve"
          ? "Logoen er godkjent og publisert."
          : action === "reject"
            ? "Logoen er avvist."
            : action === "remove"
              ? "Logoen er fjernet."
            : "Logoen er hentet og venter på godkjenning.",
      );
    } catch {
      setMessage("Logo-handlingen kunne ikke fullføres. Prøv igjen.");
    } finally {
      setLogoActionId(null);
    }
  }

  return (
    <>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DBE4EE]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#F7F9FC] text-xs uppercase text-[#5F6F82]">
              <tr><th className="px-4 py-3">Leverandør</th><th className="px-4 py-3">Logo</th><th className="px-4 py-3">Guide</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Handlinger</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DBE4EE]">
              {providers.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-[#5F6F82]" colSpan={5}>
                    Ingen leverandører er lagt til ennå.
                  </td>
                </tr>
              ) : null}
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td className="px-4 py-3"><p className="font-bold">{provider.name}</p><p className="text-xs text-[#5F6F82]">{provider.aliases.join(", ") || provider.slug}</p></td>
                  <td className="px-4 py-3"><ProviderLogoAdmin provider={provider} busyAction={logoActionId} onAction={runLogoAction} /></td>
                  <td className="px-4 py-3 text-xs">{provider.isCancellationGuideActive ? "Aktiv" : "Mangler"}</td>
                  <td className="px-4 py-3">{provider.isActive ? "Aktiv" : "Deaktivert"}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button className="font-bold text-[#C8102E]" onClick={() => edit(provider)} type="button">Rediger</button><button className="font-bold text-[#5F6F82]" onClick={() => toggle(provider)} type="button">{provider.isActive ? "Deaktiver" : "Aktiver"}</button></div><p className="mt-1 text-xs text-[#5F6F82]">{provider.category}</p></td>
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
          <Field label="Nettside" value={form.websiteUrl ?? ""} onChange={(websiteUrl) => setForm((current) => ({ ...current, websiteUrl }))} />
          <FormLogoSection
            candidate={formLogoCandidate}
            currentLogo={editing?.logoPath ?? null}
            file={manualLogoFile}
            filePreview={manualLogoPreview}
            isFetching={isFetchingFormLogo}
            onFetch={fetchFormLogo}
            onFile={selectManualLogo}
            onReject={() => { setFormLogoCandidate(null); setManualLogoFile(null); setManualLogoPreview(null); setUseFormLogoCandidate(false); }}
            onRemove={removeFormLogo}
            onUse={() => setUseFormLogoCandidate(true)}
            selected={useFormLogoCandidate || Boolean(manualLogoFile)}
            websiteUrl={form.websiteUrl}
          />
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
          <div className="rounded-xl border border-[#DBE4EE] p-3">
            <p className="text-sm font-extrabold">Sending via Aboslutt</p>
            <div className="mt-3 grid gap-3">
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input checked={form.supportsAbosluttSending} onChange={(event) => setForm((current) => ({ ...current, supportsAbosluttSending: event.target.checked }))} type="checkbox" />
                Verifisert for sending via Aboslutt
              </label>
              <Field label="Verifisert oppsigelsesadresse" value={form.verifiedCancellationEmail ?? ""} onChange={(verifiedCancellationEmail) => setForm((current) => ({ ...current, verifiedCancellationEmail }))} />
              <Field label="Sending verifisert (YYYY-MM-DD)" value={form.sendingVerifiedAt?.slice(0, 10) ?? ""} onChange={(sendingVerifiedAt) => setForm((current) => ({ ...current, sendingVerifiedAt }))} />
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input checked={form.requiresProviderLogin} onChange={(event) => setForm((current) => ({ ...current, requiresProviderLogin: event.target.checked }))} type="checkbox" />
                Krever innlogging hos leverandøren
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input checked={form.requiresCustomerReference} onChange={(event) => setForm((current) => ({ ...current, requiresCustomerReference: event.target.checked }))} type="checkbox" />
                Krever kundenummer eller medlemsreferanse
              </label>
            </div>
          </div>
          <Field label="Standardintervall" value={form.defaultBillingInterval ?? ""} onChange={(defaultBillingInterval) => setForm((current) => ({ ...current, defaultBillingInterval }))} />
          <ListField label="Landkoder" values={form.supportedCountries} onChange={(supportedCountries) => setForm((current) => ({ ...current, supportedCountries }))} />
          <Field label="Sist verifisert (YYYY-MM-DD)" value={form.lastVerifiedAt?.slice(0, 10) ?? ""} onChange={(lastVerifiedAt) => setForm((current) => ({ ...current, lastVerifiedAt }))} />
        </div>
        {message ? <p className="mt-3 text-sm font-semibold text-[#5F6F82]">{message}</p> : null}
        <div className="mt-4 flex gap-2">
          <LoadingButton isLoading={isSaving} type="submit">Lagre</LoadingButton>
          {editing ? <button className="rounded-xl border border-[#DBE4EE] px-4 text-sm font-bold" onClick={() => { setEditing(null); setForm(emptyProvider); setFormLogoCandidate(null); setManualLogoFile(null); setManualLogoPreview(null); setUseFormLogoCandidate(false); }} type="button">Avbryt</button> : null}
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

function ProviderLogoAdmin({
  provider,
  busyAction,
  onAction,
}: {
  provider: Provider;
  busyAction: string | null;
  onAction: (provider: Provider, action: "fetch" | "refetch" | "approve" | "reject" | "remove") => void;
}) {
  const asset = provider.latestLogoAsset;
  const previewUrl = asset ? `/api/admin/subscription-providers/${provider.id}/logo?assetId=${asset.id}` : null;
  return (
    <div className="min-w-52">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-[#F7F9FC] ring-1 ring-[#DBE4EE]">
          {provider.logoPath ? <Image alt={`Logo for ${provider.name}`} height={32} src={provider.logoPath} unoptimized width={32} /> : previewUrl ? <Image alt={`Forhåndsvisning av ${provider.name}`} height={32} src={previewUrl} unoptimized width={32} /> : <span className="text-xs font-black">{provider.name.slice(0, 2).toUpperCase()}</span>}
        </span>
        <div className="text-xs">
          <p className="font-bold">{provider.logoPath ? "Logo klar" : "Logo mangler"}</p>
          {asset ? <p className="text-[#5F6F82]">{Math.ceil(asset.byteSize / 1024)} kB · {new Date(asset.fetchedAt).toLocaleDateString("nb-NO")}</p> : null}
          {asset ? <p className="max-w-36 truncate text-[#5F6F82]" title={asset.sourceUrl}>{getHostname(asset.sourceUrl)}</p> : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
        <button disabled={!provider.websiteUrl || Boolean(busyAction)} onClick={() => onAction(provider, asset ? "refetch" : "fetch")} type="button">
          {provider.logoPath ? "Bytt logo" : "Hent logo"}
        </button>
        {previewUrl ? <a className="text-[#5F6F82]" href={previewUrl} rel="noreferrer" target="_blank">Forhåndsvis</a> : null}
        {asset?.status === "pending" ? (
          <>
            <button className="text-emerald-700" disabled={Boolean(busyAction)} onClick={() => onAction(provider, "approve")} type="button">Godkjenn</button>
            <button className="text-[#C8102E]" disabled={Boolean(busyAction)} onClick={() => onAction(provider, "reject")} type="button">Avvis</button>
          </>
        ) : null}
        {provider.logoPath ? <button className="text-[#C8102E]" disabled={Boolean(busyAction)} onClick={() => onAction(provider, "remove")} type="button">Fjern logo</button> : null}
      </div>
    </div>
  );
}

function FormLogoSection({
  currentLogo,
  candidate,
  file,
  filePreview,
  websiteUrl,
  isFetching,
  onFetch,
  onReject,
  onFile,
  onRemove,
  onUse,
  selected,
}: {
  currentLogo: string | null;
  candidate: DraftLogoCandidate | null;
  file: File | null;
  filePreview: string | null;
  websiteUrl: string | null;
  isFetching: boolean;
  onFetch: () => void;
  onReject: () => void;
  onFile: (file: File | null) => void;
  onRemove: () => void;
  onUse: () => void;
  selected: boolean;
}) {
  const preview = filePreview ?? candidate?.previewDataUrl ?? currentLogo;
  return (
    <section className="rounded-xl border border-[#DBE4EE] p-3">
      <p className="text-sm font-extrabold">Logo</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#F7F9FC] ring-1 ring-[#DBE4EE]">
          {preview ? <Image alt="Forhåndsvisning av logo" height={40} src={preview} unoptimized width={40} /> : <span className="text-xs font-bold text-[#5F6F82]">Ingen</span>}
        </span>
        <div className="text-xs text-[#5F6F82]">
          <p className="font-bold text-[#0D1B2A]">{candidate || file ? "Klar til bruk" : currentLogo ? "Nåværende logo" : "Logo mangler"}</p>
          {candidate ? <p>{Math.ceil(candidate.byteSize / 1024)} kB · {candidate.contentType}</p> : null}
          {file ? <p className="max-w-52 truncate" title={file.name}>{file.name}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg border border-[#DBE4EE] px-3 py-2 text-xs font-bold disabled:opacity-50" disabled={!isValidHttpsUrl(websiteUrl) || isFetching} onClick={onFetch} type="button">
          {isFetching ? "Henter logo …" : "Hent logo"}
        </button>
        {candidate && !selected ? <button className="rounded-lg bg-[#166534] px-3 py-2 text-xs font-bold text-white" onClick={onUse} type="button">Bruk denne logoen</button> : null}
        {candidate || file ? <span className="rounded-lg bg-[#EAF7EF] px-3 py-2 text-xs font-bold text-[#166534]">{selected ? "Brukes når leverandøren lagres" : "Forhåndsvisning"}</span> : null}
        {candidate || file ? <button className="rounded-lg px-3 py-2 text-xs font-bold text-[#C8102E]" onClick={onReject} type="button">Avvis</button> : null}
        {currentLogo ? <button className="rounded-lg px-3 py-2 text-xs font-bold text-[#C8102E]" onClick={onRemove} type="button">Fjern logo</button> : null}
      </div>
      <label className="mt-3 block text-xs font-semibold text-[#4A5568]">
        Eller last opp PNG, WebP, JPEG eller ICO
        <input accept=".png,.webp,.jpg,.jpeg,.ico,image/png,image/webp,image/jpeg,image/x-icon" className="mt-1 block w-full text-xs" onChange={(event: ChangeEvent<HTMLInputElement>) => { onFile(event.target.files?.[0] ?? null); }} type="file" />
      </label>
    </section>
  );
}

function isValidHttpsUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "Ukjent kilde";
  }
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
