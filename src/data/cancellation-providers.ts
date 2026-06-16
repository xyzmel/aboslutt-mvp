export type CancellationProviderMethod =
  | "email"
  | "account_page"
  | "contact_form"
  | "chat"
  | "app_store"
  | "partner_billing"
  | "manual_unknown";

export type CancellationProviderConfidence = "verified" | "needs_review";

export type CancellationProvider = {
  id: string;
  displayName: string;
  normalizedNames: string[];
  category: string;
  method: CancellationProviderMethod;
  cancellationEmail?: string;
  cancellationUrl?: string;
  supportUrl?: string;
  notes: string;
  requiresLogin: boolean;
  requiresCustomerNumber: boolean;
  confidence: CancellationProviderConfidence;
};

export const cancellationProviders: CancellationProvider[] = [
  {
    id: "netflix",
    displayName: "Netflix",
    normalizedNames: ["netflix"],
    category: "streaming",
    method: "account_page",
    cancellationUrl: "https://www.netflix.com/account",
    supportUrl: "https://help.netflix.com/",
    notes: "Netflix avsluttes normalt fra kontosiden. Aboslutt har ikke en bekreftet e-postadresse for oppsigelse.",
    requiresLogin: true,
    requiresCustomerNumber: false,
    confidence: "verified",
  },
  {
    id: "spotify",
    displayName: "Spotify",
    normalizedNames: ["spotify", "spotify premium"],
    category: "streaming",
    method: "account_page",
    cancellationUrl: "https://www.spotify.com/account/subscription/",
    supportUrl: "https://support.spotify.com/",
    notes: "Spotify Premium avsluttes normalt fra kontosiden. Hvis abonnementet faktureres via en partner, må partneren brukes.",
    requiresLogin: true,
    requiresCustomerNumber: false,
    confidence: "verified",
  },
  {
    id: "hbo-max",
    displayName: "HBO Max",
    normalizedNames: ["hbo max", "max", "hbomax"],
    category: "streaming",
    method: "account_page",
    cancellationUrl: "https://www.max.com/subscription",
    supportUrl: "https://help.max.com/",
    notes: "HBO Max/Max avsluttes normalt i konto- eller abonnementsinnstillinger. Hvis kjøpet er gjort via Apple, Google Play eller partner, må den kanalen brukes.",
    requiresLogin: true,
    requiresCustomerNumber: false,
    confidence: "needs_review",
  },
  {
    id: "viaplay",
    displayName: "Viaplay",
    normalizedNames: ["viaplay"],
    category: "streaming",
    method: "account_page",
    supportUrl: "https://help.viaplay.com/",
    notes: "Viaplay avsluttes normalt fra konto/abonnement. Metode kan variere hvis abonnementet er kjøpt via partner.",
    requiresLogin: true,
    requiresCustomerNumber: false,
    confidence: "needs_review",
  },
  {
    id: "apple-subscriptions",
    displayName: "Apple-abonnementer",
    normalizedNames: ["apple", "apple services", "icloud", "icloud+", "app store"],
    category: "software",
    method: "app_store",
    cancellationUrl: "https://support.apple.com/billing",
    supportUrl: "https://support.apple.com/billing",
    notes: "Apple- og App Store-abonnementer må vanligvis administreres via Apple-ID eller App Store.",
    requiresLogin: true,
    requiresCustomerNumber: false,
    confidence: "verified",
  },
  {
    id: "google-play-subscriptions",
    displayName: "Google Play-abonnementer",
    normalizedNames: ["google play", "google commerce limited", "youtube premium", "google one"],
    category: "software",
    method: "app_store",
    cancellationUrl: "https://play.google.com/store/account/subscriptions",
    supportUrl: "https://support.google.com/googleplay/",
    notes: "Google Play-abonnementer må vanligvis administreres i Google Play-abonnementer.",
    requiresLogin: true,
    requiresCustomerNumber: false,
    confidence: "verified",
  },
  {
    id: "storytel",
    displayName: "Storytel",
    normalizedNames: ["storytel"],
    category: "news",
    method: "manual_unknown",
    supportUrl: "https://support.storytel.com/",
    notes: "Oppsigelsesmetode må bekreftes før Aboslutt kan anbefale en bestemt kanal.",
    requiresLogin: true,
    requiresCustomerNumber: false,
    confidence: "needs_review",
  },
  {
    id: "strim",
    displayName: "Strim",
    normalizedNames: ["strim"],
    category: "streaming",
    method: "manual_unknown",
    supportUrl: "https://strim.no/kundeservice",
    notes: "Oppsigelsesmetode må bekreftes. Bruk leverandørens egne kontosider eller kundeservice.",
    requiresLogin: true,
    requiresCustomerNumber: false,
    confidence: "needs_review",
  },
  {
    id: "tv2-play",
    displayName: "TV 2 Play",
    normalizedNames: ["tv 2 play", "tv2 play", "tv 2", "tv2"],
    category: "streaming",
    method: "manual_unknown",
    supportUrl: "https://hjelp.tv2.no/",
    notes: "Oppsigelsesmetode må bekreftes. Bruk leverandørens egne kontosider eller kundeservice.",
    requiresLogin: true,
    requiresCustomerNumber: false,
    confidence: "needs_review",
  },
  {
    id: "telia",
    displayName: "Telia",
    normalizedNames: ["telia"],
    category: "telecom",
    method: "manual_unknown",
    supportUrl: "https://www.telia.no/kundeservice/",
    notes: "Telekomabonnementer kan ha binding, oppsigelsestid eller partnerfakturering. Kontroller hos Telia.",
    requiresLogin: true,
    requiresCustomerNumber: true,
    confidence: "needs_review",
  },
  {
    id: "onecall",
    displayName: "OneCall",
    normalizedNames: ["onecall", "one call"],
    category: "telecom",
    method: "manual_unknown",
    supportUrl: "https://onecall.no/kundeservice",
    notes: "Telekomabonnementer kan ha binding, oppsigelsestid eller nummerflytting. Kontroller hos OneCall.",
    requiresLogin: true,
    requiresCustomerNumber: true,
    confidence: "needs_review",
  },
  {
    id: "telenor",
    displayName: "Telenor",
    normalizedNames: ["telenor"],
    category: "telecom",
    method: "manual_unknown",
    supportUrl: "https://www.telenor.no/kundeservice/",
    notes: "Telekomabonnementer kan ha binding, oppsigelsestid eller nummerflytting. Kontroller hos Telenor.",
    requiresLogin: true,
    requiresCustomerNumber: true,
    confidence: "needs_review",
  },
  {
    id: "sats",
    displayName: "SATS",
    normalizedNames: ["sats"],
    category: "health",
    method: "account_page",
    supportUrl: "https://www.sats.no/kundeservice",
    notes: "Treningsabonnementer kan ha bindingstid, frysing eller oppsigelsesfrist. Kontroller oppsigelse på SATS-kontoen eller hos kundeservice.",
    requiresLogin: true,
    requiresCustomerNumber: true,
    confidence: "needs_review",
  },
  {
    id: "evo",
    displayName: "EVO",
    normalizedNames: ["evo", "evo fitness"],
    category: "health",
    method: "account_page",
    supportUrl: "https://www.evofitness.no/",
    notes: "Treningsabonnementer kan ha bindingstid eller oppsigelsesfrist. Kontroller oppsigelse på EVO-kontoen eller hos kundeservice.",
    requiresLogin: true,
    requiresCustomerNumber: true,
    confidence: "needs_review",
  },
];

export function findCancellationProvider(...subscriptionNames: (string | null | undefined)[]) {
  const normalizedSubscriptionNames = subscriptionNames
    .map((name) => normalizeProviderName(name ?? ""))
    .filter(Boolean);

  if (normalizedSubscriptionNames.length === 0) {
    return null;
  }

  return (
    cancellationProviders.find((provider) =>
      provider.normalizedNames.some((name) => {
        const normalizedProviderName = normalizeProviderName(name);
        return normalizedSubscriptionNames.some((subscriptionName) =>
          subscriptionName.includes(normalizedProviderName),
        );
      }),
    ) ?? null
  );
}

export function getCancellationMethodLabel(method: CancellationProviderMethod) {
  const labels: Record<CancellationProviderMethod, string> = {
    email: "E-post",
    account_page: "Kontoside",
    contact_form: "Kontaktskjema",
    chat: "Chat",
    app_store: "App Store / Google Play",
    partner_billing: "Partnerfakturering",
    manual_unknown: "Må bekreftes manuelt",
  };

  return labels[method];
}

function normalizeProviderName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
