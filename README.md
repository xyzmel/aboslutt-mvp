# Aboslutt MVP

Aboslutt er en Next.js + TypeScript + Tailwind MVP for en norsk abonnementstjeneste. Demoen bruker Prisma med Postgres og markerer oppsigelser i databasen.

## Beta Positioning

Aboslutt er først og fremst en manuell abonnementoversikt: alle brukere kan legge inn eksisterende abonnementer selv uten å koble til Gmail. Automatisk Gmail-/e-postskanning er en valgfri SaaS-funksjon som kan foreslå kandidater basert på kvitteringer. Brukeren må alltid bekrefte kandidatene før de lagres, og rå e-postinnhold lagres ikke.

Vipps Login er aktivt når Vipps-miljøvariablene er konfigurert. Hvis de mangler, vises Vipps-knappen som deaktivert.

## Kom I Gang

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

## Miljøvariabler

Kopier `.env.example` til `.env.local` for Next.js. Prisma CLI leser `.env` når du kjører lokale Prisma-kommandoer, så `.env` må også ha en gyldig Postgres `DATABASE_URL` når du kjører migrering eller seed fra terminalen.

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-local-secret
# Bruk lokal Postgres eller en hosted development database fra Neon, Supabase eller Vercel Postgres.
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"

EMAIL_SERVER_HOST=smtp.resend.com
EMAIL_SERVER_PORT=465
EMAIL_SERVER_USER=resend
EMAIL_SERVER_PASSWORD=
EMAIL_FROM="Aboslutt <no-reply@aboslutt.no>"
BETA_SIGNUPS_ENABLED=true
BETA_ALLOWED_EMAILS=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_IMPORT_DEBUG=false

# Vipps Login. Bekreft nøyaktige URL-er i Vipps MobilePay developer portal.
# Test eksempel:
# VIPPS_WELL_KNOWN_URL=https://apitest.vipps.no/access-management-1.0/access/.well-known/openid-configuration
# Produksjon eksempel:
# VIPPS_WELL_KNOWN_URL=https://api.vipps.no/access-management-1.0/access/.well-known/openid-configuration
VIPPS_CLIENT_ID=
VIPPS_CLIENT_SECRET=
VIPPS_WELL_KNOWN_URL=
```

Ingen ekte hemmeligheter skal committes. `.env.local` skal ikke overskrives av oppsettet.

Viktig: Etter bytte til `provider = "postgresql"` i `prisma/schema.prisma` skal du ikke bruke `DATABASE_URL="file:./dev.db"`. Bruk en Postgres URL som starter med `postgresql://` eller `postgres://`.

## Sider

- `/` landingsside med valg av metode
- `/login` e-post/passord, Google og Vipps Login når konfigurert
- `/register` opprett konto med e-post/passord, Google eller Vipps
- `/pricing` plan- og prisoversikt
- `/terms/sales` salgsbetingelser for betaling og Vipps-godkjenning
- `/dashboard` databasebasert abonnementoversikt med legg til, rediger, slett og vedvarende avslutning
- `/subscriptions/[id]` detaljside for et abonnement med redigering, avslutning og sletting
- `/import/email` lokal import fra Gmail-skanning eller innlimt kvitteringstekst
- `/connect` placeholder for fremtidige koblinger

## Subscription Management

Aboslutt beta har manuell abonnementshåndtering som kjernefunksjon. Brukeren kan legge til, redigere, slette og markere abonnementer som avsluttet uten å koble til Gmail.

Abonnementer har nå navn, månedlig kostnad, kategori, status, faktureringsintervall, neste trekk, notat, kilde og eventuell import-confidence. Faktureringsintervall lagres som `monthly`, `yearly` eller `unknown`, og vises i UI som `Månedlig`, `Årlig` eller `Ukjent`.

Importkilder vises som brukervennlige merker som `Manuell`, `Gmail` eller `Google`, ikke rå verdier som `gmail_import`.

Gmail- og e-postimport viser en bekreftelsesdialog før lagring. Brukeren kan rette leverandørnavn, beløp, kategori, faktureringsintervall og neste trekk. Hvis et importert månedlig eller ukjent beløp er over 500 NOK, vises varselet `Beløpet virker høyt. Sjekk før du lagrer.`

## Oppsigelsesflyt

Aboslutt har en Level 2-oppsigelsesflyt for beta/premium/admin-brukere. Brukeren kan lage et redigerbart oppsigelsesutkast for et abonnement, kopiere teksten, eller sende e-post via Aboslutt når planen tillater det og brukeren har gitt eksplisitt samtykke.

Viktig produktregel: Aboslutt markerer ikke et abonnement som avsluttet bare fordi en e-post er sendt. Status blir `Venter på bekreftelse` etter sending, og abonnementet blir først markert som avsluttet når brukeren selv velger `Bekreftet avsluttet`.

Gratis-brukere kan lage og kopiere utkast, men kan ikke sende oppsigelsesepost via Aboslutt. Sending via Aboslutt krever beta, premium eller admin.

### Leverandørkatalog

Oppsigelsesflyten bruker en statisk leverandørkatalog i `src/data/cancellation-providers.ts`. Den beskriver kjente eller antatte oppsigelsesmetoder som:

- `account_page`
- `app_store`
- `contact_form`
- `chat`
- `partner_billing`
- `manual_unknown`
- `email`

Katalogen skal være konservativ. Ikke legg inn oppsigelsesepost for en leverandør uten bekreftet kilde. Mange tjenester, som strømmetjenester og app-butikkabonnementer, krever at brukeren avslutter via kontoside, App Store, Google Play eller partnerfakturering. I slike tilfeller viser Aboslutt anbefalt metode og lar brukeren kopiere utkastet, men e-postsending er ikke primærvalget.

Admin kan se katalogen på `/admin/providers`. Full CRUD for leverandørkatalogen er ikke implementert ennå.

## Auth

Auth-konfigurasjonen ligger i `src/lib/auth.ts`, og route handleren ligger i `src/app/api/auth/[...nextauth]/route.ts`.

Aktive providers:

- E-post/passord med verifisering
- Google OAuth med Gmail read-only
- Vipps Login via OIDC/OAuth når Vipps-miljøvariablene er satt

Vipps-provideren registreres bare når `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET` og `VIPPS_WELL_KNOWN_URL` finnes. Hvis de mangler, krasjer ikke appen, og Vipps-knappen på `/login` vises som deaktivert.

## Planer Og Prising

Manuell abonnementssporing er gratis å starte med. Brukere kan legge inn abonnementer selv uten Gmail eller andre integrasjoner. Automatisk Gmail-/e-postskanning, varsler og oppsummeringer er beta-/SaaS-funksjoner, og premium-betaling er ikke aktivert ennå.

- `Gratis`: 0 kr, opptil 10 manuelle abonnementer, månedlig/årlig oversikt og grunnleggende dashboard.
- `Beta`: gratis for utvalgte tidlige brukere, ubegrensede abonnementer, Gmail-skanning, e-postpåminnelser og månedlig oppsummering.
- `Premium`: kommer senere med automatisk skanning, varsler, innsikt, fremtidige bank/Open Banking-funksjoner og fremtidig hjelp til oppsigelse. Betaling er ikke implementert ennå.
- `Admin`: alt aktivert for intern administrasjon og testing.

Planlogikken ligger i `src/lib/plans.ts`. Backend håndhever at Gratis-brukere kan legge til maks 10 abonnementer, men de kan fortsatt se, redigere og slette eksisterende abonnementer. Gratis-brukere får ikke bruke Gmail-skanning, e-postvarsler eller månedlig oppsummering. Admin kan endre brukerplan fra `/admin/users/[id]`.

Dashboard og innstillinger viser en planstatus-card med gjeldende plan, inkluderte funksjoner, låste funksjoner og riktig CTA. Gratis-brukere får tydelige meldinger om at manuell sporing fortsatt er gratis når Gmail-skanning eller varsler er låst.

## Onboarding Checklist

Dashboardet viser en oppstartsliste for nye eller uferdige kontoer. Listen bruker lagrede brukerdata og abonnementer:

- første abonnement er lagt til
- minst ett abonnement har neste trekk
- e-postvarsler er aktivert og tilgjengelige for planen
- Gmail read-only er koblet til
- månedlig total er større enn 0

Brukeren kan skjule listen lokalt. Skjulingen lagres i `localStorage`, ikke i databasen.

## Beta Requests And Feedback

Besøkende kan be om beta-tilgang fra `/pricing`. Skjemaet lagrer navn, e-post og valgfri melding i `BetaRequest` med status `pending`.

Innloggede brukere kan sende feedback fra appen. Feedback lagres med bruker, melding, valgfri rating og hvilken side den kom fra. OAuth tokens, passordhash, Gmail-innhold og secrets lagres aldri i feedback.

Admin-portalen viser siste beta-forespørsler og siste feedback:

- `Godkjenn` setter beta-forespørselen til `approved` og setter brukerens plan til `beta` hvis e-postadressen allerede finnes som bruker.
- `Avvis` setter beta-forespørselen til `rejected`.
- Feedback kan markeres som lest.

Når en beta-forespørsel godkjennes og en eksisterende bruker endres til `beta`, forsøker appen å sende e-posten `Du har fått beta-tilgang til Aboslutt`. Hvis SMTP feiler, skal godkjenningen fortsatt lykkes og admin får en advarsel i UI.

Etter migrasjonen `20260612133000_add_beta_requests_feedback_review` må produksjonsdatabasen oppdateres:

```bash
npm run prisma:deploy
```

## Security And Abuse Protection

Aboslutt har enkel rate limiting i `src/lib/rate-limit.ts` for offentlige skrive-endepunkter, import-endepunkter og adminhandlinger. Uten Redis/KV bruker dette en in-memory store. Det er produksjonssikkert som et best-effort vern, men i serverless kan minnet nullstilles eller være forskjellig per instans. Før større trafikk bør dette flyttes til Upstash Redis, Vercel KV eller tilsvarende delt rate limit-store.

Rate limit-feil returnerer:

```json
{
  "ok": false,
  "error": "RATE_LIMITED",
  "message": "For mange forsøk. Prøv igjen senere."
}
```

Adminhandlinger logges i `AdminAuditLog` og kan leses på `/admin/audit`. Audit-loggen skal bare inneholde trygge metadata som handling, admin, målbruker og tellinger. Secrets, OAuth tokens, passordhash, `DATABASE_URL` og rå Gmail-/e-postinnhold skal aldri logges.

`src/lib/logger.ts` saniterer metadata før logging. Gmail-import skal fortsatt aldri logge rå e-postinnhold eller OAuth tokens.

## Beta Registration

`/register` bruker nå e-post og passord for beta-registrering. Passord lagres kun som bcrypt-hash i `User.passwordHash`. Brukeren må bekrefte e-postadressen via `/verify-email?token=...` før innlogging med passord fungerer.

Google-login fungerer fortsatt, og Vipps Login fungerer når Vipps-miljøvariablene er konfigurert.

Tidligere magic-link e-postprovider ligger fortsatt i auth-oppsettet når SMTP er konfigurert, men beta-flyten prioriterer e-post/passord med verifisering.

Beta-registrering styres med:

```bash
BETA_SIGNUPS_ENABLED=true
BETA_ALLOWED_EMAILS=
```

Hvis `BETA_SIGNUPS_ENABLED=false`, kan nye brukere ikke registrere seg, men eksisterende brukere kan fortsatt logge inn. Hvis `BETA_ALLOWED_EMAILS` er satt, må e-postadressen være i den kommaseparerte listen for å få magic-link:

```bash
BETA_ALLOWED_EMAILS=person@example.com,annen@example.com
```

## SMTP Setup

For Resend SMTP i produksjon:

```bash
EMAIL_SERVER_HOST=smtp.resend.com
EMAIL_SERVER_PORT=465
EMAIL_SERVER_USER=resend
EMAIL_SERVER_PASSWORD=din-resend-api-key
EMAIL_FROM="Aboslutt <no-reply@aboslutt.no>"
```

Produksjonssending krever ofte at domenet er verifisert hos SMTP-leverandøren. For Resend betyr det normalt DNS-verifisering av `aboslutt.no`.

Brevo kan brukes som alternativ SMTP-leverandør. Da bruker du SMTP-verdiene fra Brevo dashboardet i de samme `EMAIL_SERVER_*` miljøvariablene.

Etter endring av SMTP- eller beta-env vars i Vercel må prosjektet redeployes.

## Vipps Login Setup

Vipps Login bruker well-known discovery fra Vipps MobilePay og scopes:

```text
openid name phoneNumber email
```

Legg inn callback/redirect URI hos Vipps:

```text
https://www.aboslutt.no/api/auth/callback/vipps
http://localhost:3000/api/auth/callback/vipps
```

Legg deretter inn verdiene i `.env.local`:

```bash
VIPPS_CLIENT_ID=...
VIPPS_CLIENT_SECRET=...
VIPPS_WELL_KNOWN_URL=...
```

Eksempler på well-known URL-er som må bekreftes i Vipps MobilePay developer portal før bruk:

```text
Test: https://apitest.vipps.no/access-management-1.0/access/.well-known/openid-configuration
Produksjon: https://api.vipps.no/access-management-1.0/access/.well-known/openid-configuration
```

Ikke commit Vipps-nøkler. Bruk `.env.local` lokalt og sikre secret-håndtering i hostingmiljøet.

Vipps Login-knappen bruker det lokale offisielle login-pill assetet `public/vipps-login-pill-default.svg`. `Pay with Vipps`-assets er reservert for eventuell fremtidig betaling/checkout. Før større offentlig markedsføring bør offisielle Vipps MobilePay brand guidelines og nyeste logoressurser kontrolleres.

### Vipps Troubleshooting

Hvis Vipps-knappen fortsatt viser `Vipps Login kommer snart`:

- Sjekk at `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET` og `VIPPS_WELL_KNOWN_URL` er lagt inn i riktig Vercel-miljo, for eksempel Production og eventuelt Preview.
- Redeploy prosjektet etter at Vercel env vars er endret.
- Provider-id i koden er `vipps`, og knappen bruker `signIn("vipps")`.
- Callback URL hos Vipps skal vaere `https://www.aboslutt.no/api/auth/callback/vipps`.
- Sjekk `/api/health` og kontroller at `vippsConfigured` er `true`.
- Sjekk `/api/auth/providers` og kontroller at `vipps` finnes i provider-listen.

## Google Cloud Setup

For lokal Gmail-skanning:

1. Opprett eller velg et prosjekt i Google Cloud Console.
2. Aktiver Gmail API.
3. Konfigurer OAuth consent screen. Bruk "External" for privat testing hvis kontoen krever det.
4. Legg til deg selv under test users.
5. Opprett OAuth Client ID av typen Web application.
6. Legg inn lokal redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

7. Kopier verdiene til `.env.local`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Gmail read-only er en Google restricted scope. For privat lokal MVP-testing kan du bruke test users på OAuth consent screen. Produksjonsbruk krever normalt ekstra verifisering og en sikkerhetsvurdering fra Google.

## Google OAuth Troubleshooting

Hvis innlogging feiler med `Unknown argument refresh_token_expires_in`, mangler Prisma `Account`-modellen feltet Google sender tilbake. Kjør:

```bash
npm run prisma:migrate
npm run prisma:generate
```

Hvis du får `OAuthAccountNotLinked` etter et tidligere feilet Google-forsøk, kan databasen ha en delvis bruker eller konto fra forsøket. For lokal utviklingsdatabase er raskeste opprydding:

```bash
npm run prisma:reset
```

Dette sletter og reoppretter databasen som `DATABASE_URL` peker på, kjører migrasjoner og seed på nytt. Ikke bruk reset mot en database med data du vil beholde.

Merk: Den lokale SQLite-migrasjonshistorikken ble ryddet i MVP-fasen fordi gamle testmigrasjoner hadde feil rekkefølge for en fersk database. Prosjektet bruker nå Postgres-migrasjoner for å kunne deployes til Vercel med en produksjonsklar database.

## Gmail Scan Troubleshooting

`POST /api/import/gmail` returnerer nå konkrete feilkoder i JSON, for eksempel `NO_SESSION`, `GOOGLE_NOT_CONNECTED`, `GMAIL_SCOPE_MISSING`, `GMAIL_TOKEN_EXPIRED`, `GMAIL_RATE_LIMITED`, `GMAIL_UPSTREAM_ERROR` og `GMAIL_INTERNAL_ERROR`.

Hvis du ser en gammel generisk 502-feil, prøv først å starte dev-serveren på nytt og logge inn med Google igjen.

Vanlige årsaker:

- Manglende Gmail scope: Google-kontoen ble koblet til før Gmail read-only scope var lagt til. Koble til Google på nytt.
- Utløpt access token: Appen prøver å fornye token hvis `refresh_token` finnes. Hvis fornying feiler, koble til Google på nytt.
- Manglende refresh token: Google sender ofte bare refresh token første gang. Revoke lokal app-tilgang i Google-kontoen og koble til på nytt.
- Rate limit: Vent litt og prøv igjen.

For å revoke/reconnect lokalt:

1. Gå til Google Account > Security > Third-party access.
2. Fjern tilgangen for den lokale Aboslutt/OAuth-testappen.
3. Kjør eventuelt `npm run prisma:reset` hvis lokale testkontoer er i en rar tilstand.
4. Start `npm run dev` og koble til Gmail på nytt fra `/import/email`.

Sett `GMAIL_IMPORT_DEBUG=true` i `.env.local` for trygge debuglogger. Debuglogger viser steg, statuskoder og tellinger, men skal aldri logge access tokens, refresh tokens, ID tokens eller rå e-postinnhold.

## User Ownership

Abonnementer er koblet til `User` i Prisma. Auth.js/NextAuth bruker Prisma-adapteren med modellene `User`, `Account`, `Session` og `VerificationToken`.

I utvikling kan appen falle tilbake til demo-brukeren `demo@aboslutt.local` når ingen session finnes. Dette gjør at `/dashboard` fortsatt fungerer uten ekte Vipps-, Google- eller SMTP-oppsett. Fallbacken er midlertidig og markert med TODO i `src/lib/current-user.ts`.

I produksjon brukes ikke demo-bruker fallback. Uinnloggede brukere sendes til `/login`, og API-ruter for abonnementer returnerer `401`.

Merk: Lokal demo fallback er nå opt-in og krever `ABOSLUTT_ENABLE_DEMO_FALLBACK=true`. Uten denne verdien kreves en ekte session også lokalt.

## Session Handling

Auth.js/NextAuth bruker en bevisst `jwt` session strategy slik at e-post/passord via Credentials, Google OAuth og fremtidig Vipps Login kan dele samme sessionmodell. Session callbacken legger trygt inn `user.id`, `user.email`, `user.name`, `user.image` og en enkel provider-markør uten å eksponere OAuth tokens.

`src/lib/current-user.ts` er felles inngang for server-side brukeroppslag:

- `getCurrentUser()` returnerer innlogget Prisma-bruker eller `null`.
- `requireCurrentUser()` kaster `UnauthorizedError` når bruker mangler.
- `unauthorizedResponse()` returnerer `{ "ok": false, "error": "UNAUTHORIZED", "message": "Du må være logget inn." }`.
- Lokal demo fallback krever `ABOSLUTT_ENABLE_DEMO_FALLBACK=true` og fungerer aldri i produksjon.

Alle abonnement-, konto- og tilkoblings-API-er filtrerer på gjeldende `userId`, slik at en bruker ikke kan lese, endre eller slette en annen brukers data.

Slik tester du session-håndtering:

- `/api/auth/session` skal vise session for innlogget bruker og tom session når utlogget.
- `/api/me` skal returnere trygg brukerinfo og tilkoblede providers når innlogget.
- `/api/health` skal vise `authConfigured` og `sessionStrategy` uten secrets.
- Utlogget `/dashboard`, `/settings`, `/import/email` og `/subscriptions/[id]` skal sende brukeren til `/login`.
- Innlogget `/dashboard` skal vise riktig bruker og bare brukerens egne abonnementer.

## Admin Portal

`/admin` er en enkel beta-admin for produktoversikt og brukerhandtering. Den krever innlogging, og bare e-postadresser i `ADMIN_EMAILS` far tilgang.

Legg inn lokalt i `.env.local` og i Vercel Environment Variables:

```bash
ADMIN_EMAILS=kjetil@example.com,admin@example.com
```

Admin-portalen viser bare trygge felt: brukerstatistikk, abonnementstellinger, provider-navn, varselstatus, plan og bekreftet e-poststatus. Den skal aldri eksponere passordhash, OAuth access tokens, refresh tokens, ID tokens, `DATABASE_URL`, secrets eller ra Gmail-innhold.

Etter admin-/feedback-migrasjonen ma produksjonsdatabasen migreres:

```bash
npm run prisma:deploy
```

## Notifications And Cron Jobs

Aboslutt kan sende e-postvarsler før kommende abonnementstrekk. Brukeren styrer dette fra `/settings` under `Varsler`:

- `Varsle meg før kommende trekk`
- påminnelse `1`, `3` eller `7` dager før
- `Send månedlig oppsummering`

Påminnelser bruker bare lagrede abonnementer og `nextPayment`. Rå Gmail- eller e-postinnhold sendes eller lagres ikke.

Varsler og månedlig oppsummering sendes bare for `beta`, `premium` og `admin`. Cron-jobbene hopper over `free`-brukere selv om eldre databaseverdier har varselinnstillinger aktivert.

Legg til i Vercel:

```bash
CRON_SECRET=lag-en-lang-tilfeldig-verdi
```

Ikke eksponer `CRON_SECRET` i frontend eller logger. Vercel Cron treffer:

- `POST /api/jobs/send-reminders` daglig kl. 06:00 UTC
- `POST /api/jobs/send-monthly-summary` den 1. hver måned kl. 07:00 UTC

Begge rutene krever:

```http
Authorization: Bearer CRON_SECRET
```

Lokal test med PowerShell:

```powershell
$env:CRON_SECRET="local-test-secret"
npm run dev
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/jobs/send-reminders" -Headers @{ Authorization = "Bearer local-test-secret" }
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/jobs/send-monthly-summary" -Headers @{ Authorization = "Bearer local-test-secret" }
```

Produksjonstest etter deploy:

```powershell
Invoke-RestMethod -Method Post -Uri "https://www.aboslutt.no/api/jobs/send-reminders" -Headers @{ Authorization = "Bearer <CRON_SECRET>" }
Invoke-RestMethod -Method Post -Uri "https://www.aboslutt.no/api/jobs/send-monthly-summary" -Headers @{ Authorization = "Bearer <CRON_SECRET>" }
```

`/api/health` viser `cronConfigured` og `emailConfigured` som trygge booleans uten å lekke verdier.

Etter notification/cron-endringer må produksjonsdatabasen migreres:

```bash
npm run prisma:deploy
```

Ikke bruk `prisma migrate reset` i produksjon.

### Test Notification Jobs From Admin

Admin-brukere kan teste e-postjobber fra `/admin/jobs`.

- `Dry-run` teller hvor mange brukere og e-poster som ville blitt behandlet uten aa sende e-post.
- `Test kommende trekk-varsler` kjorer kommende trekk-jobben via en intern admin-API.
- `Test maanedlig oppsummering` kjorer maanedsoppsummeringen via en intern admin-API.
- `Send test-e-post` sender en test til innlogget admin-e-post.

Nettleseren faar aldri `CRON_SECRET`, SMTP-passord eller andre secrets. Admin-API-ene krever innlogget admin-bruker via `ADMIN_EMAILS`.

## Email Og Gmail Import

`/import/email` har to flyter:

- Lim inn tekst fra en kvittering eller videresendt e-post.
- Koble til Gmail og skann inntil 100 sannsynlige kvitteringer fra de siste 24 månedene.

`POST /api/import/email` parser innlimt tekst med `src/lib/email-subscription-parser.ts`.

`POST /api/import/gmail` bruker den innloggede brukerens Google `access_token`, søker i Gmail med read-only scope, henter snippets/tekst fra maks 100 meldinger og parser abonnementskandidater.

Gmail-deteksjon bruker heuristisk scoring. Den gir pluss for kjente abonnementsleverandører, abonnement/fornyelse/månedlig/prøveperiode, beløp, neste betalingsdato og kvitteringsspråk. Den trekker ned for refusjon, kansellering, gratis, frakt/levering, sikkerhetsvarsler, verifiseringskoder og engangskjøp.

Falske positive kan fortsatt skje. Derfor må brukeren alltid bekrefte kandidaten før den lagres. Kandidater normaliseres og dedupliseres før visning, for eksempel `Max` og `HBO Max`, og generiske Google Play-avsendere forsøkes erstattet med faktisk produktnavn.

Rå e-posttekst lagres ikke. Bare kandidaten brukeren bekrefter blir lagret via eksisterende `POST /api/subscriptions`, med importkilde og confidence-score. Google Gmail read-only er fortsatt en restricted scope og krever Google-verifisering før produksjonsbruk.

## API

- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `PATCH /api/subscriptions/[id]`
- `DELETE /api/subscriptions/[id]`
- `POST /api/import/email`
- `POST /api/import/gmail`

Subscription-rutene finner gjeldende app-bruker og filtrerer på `userId`, slik at en bruker ikke kan lese, endre eller slette abonnementene til en annen bruker.

## Prisma

Prisma-skjemaet bruker `provider = "postgresql"` og leser tilkoblingen fra `DATABASE_URL`.

### Prisma Env Feilsøking

Next.js leser `.env.local` når appen kjøres lokalt. Prisma CLI leser `.env` når du kjører kommandoer som `npm run prisma:deploy`, `npm run prisma:seed`, `npm run prisma:migrate` og `npm run prisma:reset` fra terminalen.

Hvis `.env` fortsatt inneholder:

```bash
DATABASE_URL="file:./dev.db"
```

vil Prisma feile fordi skjemaet nå bruker Postgres. Bytt verdien i `.env` manuelt til en Postgres connection string:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

Slik kopierer du URL-en trygt:

1. Gå til Vercel, Neon eller Supabase dashboard.
2. Åpne databaseprosjektet og finn connection string for Postgres.
3. Kopier verdien inn i lokal `.env` som `DATABASE_URL`.
4. Kopier samme verdi inn i `.env.local` hvis Next.js lokalt skal bruke samme database.
5. Ikke commit `.env` eller `.env.local`.

`prisma:deploy` og `prisma:seed` kjører `scripts/check-database-url.mjs` først. Scriptet stopper kommandoen hvis `DATABASE_URL` ikke starter med `postgresql://` eller `postgres://`.

Hvis Postgres feiler på første migrasjon med `syntax error at or near "\u{feff}"`, ligger det en UTF-8 BOM i starten av en `migration.sql`-fil. Fjern BOM og lagre `migration.sql` som UTF-8 uten BOM. Hvis Prisma allerede rakk å registrere migrasjonen som feilet, marker den som rullet tilbake før du prøver igjen:

```bash
npx prisma migrate resolve --rolled-back 20260610203000_init
npm run prisma:deploy
npm run prisma:seed
```

### Lokal Database

Den enkleste lokale utviklingsflyten er å bruke en gratis hosted Postgres-database også lokalt, for eksempel Neon, Supabase eller Vercel Postgres. Da slipper du å installere Postgres på maskinen og bruker samme databasetype som i produksjon.

1. Opprett en development database hos Neon, Supabase eller Vercel Postgres.
2. Kopier Postgres connection string til `.env` og `.env.local` som `DATABASE_URL`.
3. Kjør:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

For en helt lokal Postgres-installasjon kan `DATABASE_URL` se slik ut:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aboslutt_dev?schema=public"
```

`npm run prisma:reset` kan brukes i lokal utvikling når du vil slette og reseede utviklingsdatabasen:

```bash
npm run prisma:reset
```

Ikke bruk `prisma:reset` mot produksjon eller data du vil beholde.

### Produksjon Med Postgres

Bruk en managed Postgres-database i produksjon. Gode alternativer for Vercel-demo er:

- Neon
- Supabase
- Vercel Postgres

Legg produksjons-URL-en inn som `DATABASE_URL` i Vercel Project Settings. Ikke hardkod connection string i repoet.

Kjør produksjonsmigrasjoner med:

```bash
npm run prisma:deploy
npm run prisma:seed
```

På Vercel kan dette kjøres som en separat deploy-/release-kommando, eller manuelt fra en trygg terminal med produksjonsmiljøvariabler lastet inn.

## Produksjonsdeploy

Anbefalt enkel demo-deploy er Vercel:

1. Koble GitHub-repoet til Vercel.
2. Legg inn alle nødvendige miljøvariabler i Vercel Project Settings.
3. Sett `NEXTAUTH_URL` til den offentlige domenen, for eksempel `https://aboslutt.no`.
4. Legg til custom domain i Vercel når domenet er klart.
5. Kjør `npm run prisma:deploy` mot produksjonsdatabasen før offentlig bruk.

Auth callback/redirect URI-er må matche domenet:

```text
Google: https://ditt-domene.no/api/auth/callback/google
Vipps: https://ditt-domene.no/api/auth/callback/vipps
```

For lokal testing er callbackene:

```text
Google: http://localhost:3000/api/auth/callback/google
Vipps: http://localhost:3000/api/auth/callback/vipps
```

SQLite var kun for tidlig lokal MVP-testing. Hovedskjemaet bruker nå Postgres. Bruk Neon, Supabase, Vercel Postgres eller en annen produksjonsklar Postgres-database før offentlig lansering, og oppdater `DATABASE_URL` i Vercel. Ikke legg inn hemmeligheter i repoet.

## Produksjonssjekkliste

- Legg inn Vercel env vars: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, Google OAuth-vars, SMTP-vars, `BETA_SIGNUPS_ENABLED`, `BETA_ALLOWED_EMAILS` og Vipps-vars hvis Vipps er aktivert.
- Sett `NEXTAUTH_URL` til kanonisk domene, for eksempel `https://www.aboslutt.no`.
- Legg inn Google redirect URI: `https://www.aboslutt.no/api/auth/callback/google`.
- Legg inn Vipps redirect URI: `https://www.aboslutt.no/api/auth/callback/vipps`.
- Kjør Neon/Postgres-migrasjoner med `npm run prisma:deploy`.
- Kjør seed bare hvis du ønsker utviklings-/startdata: `npm run prisma:seed`.
- Kontroller at demo fallback ikke vises i produksjon. Den er kun aktiv når `NODE_ENV !== "production"`.
- Test `/api/health` og sjekk at `databaseConnected` er `true`.
- Sjekk at `/api/health` viser `smtpConfigured: true` før e-postregistrering annonseres.
- Redeploy Vercel etter endringer i env vars.

## Produksjonsfeilsøking

- `401` fra `/api/subscriptions` betyr at brukeren ikke er innlogget eller at session mangler.
- `redirect_uri_mismatch` fra Google betyr at callback URL i Google Cloud ikke matcher domenet. Legg inn `https://www.aboslutt.no/api/auth/callback/google` og eventuelt `https://aboslutt.no/api/auth/callback/google`.
- Tom database betyr vanligvis at migrasjoner eller seed ikke er kjørt mot riktig Postgres `DATABASE_URL`.
- Hvis `/api/health` viser `databaseConnected: false`, kontroller `DATABASE_URL`, Neon-tilgang og at migrasjoner er kjørt.
- `EmailSignin` betyr ofte at SMTP-verdier mangler eller at SMTP-leverandøren avviser sendingen.
- `ECONNREFUSED ::1:587` betyr vanligvis at appen prøver å bruke lokal SMTP på port 587. Sett riktige `EMAIL_SERVER_*` verdier i Vercel og redeploy.
- Hvis UI sier `E-postinnlogging er ikke konfigurert enda`, mangler en eller flere SMTP-env vars.
- Hvis magic link ikke mottas, sjekk spam/promotions, Resend/Brevo sending logs, domenestatus og at `EMAIL_FROM` bruker et verifisert domene.

## Kvalitetssjekk

```bash
npm run check:text
npm run lint
npm run build
```

Kildefiler skal lagres som UTF-8 uten BOM. Unngå å kopiere inn tekst som allerede er feil-dekodet/mojibake. Kjør `npm run check:text` før deploy hvis du har endret norsk UI-copy.

## Gmail-Importkvalitet

Gmail- og e-postimport bruker heuristisk scoring før brukeren får se forslagene. Hvert funn får:

- tillit: høy, middels eller lav
- forklaringer på hvorfor funnet ble foreslått
- varsler ved mistenkelige verdier, for eksempel manglende beløp eller høy månedlig pris
- normalisert leverandørnavn for å redusere duplikater

Brukeren må alltid bekrefte og kan redigere navn, beløp, kategori, intervall og neste trekk før noe lagres. Feil forslag kan ignoreres eller rapporteres som feil funn. Ignorerte kandidater lagres som et trygt fingerprint per bruker, slik at samme kandidat ikke dukker opp igjen. Rå Gmail-/e-postinnhold lagres ikke.

Adminportalen viser trygg importkvalitet: antall lagrede importfunn, ignorerte funn, feilrapporter og siste rapporterte importfeil. Den viser ikke tokens, hemmeligheter eller rå e-postinnhold.

## Vipps Payment Scaffolding

Vipps Login er separat fra Vipps betaling. Betalingscheckout er forberedt, men ikke aktivert. Koden skal ikke late som om betaling er gjennomført, og brukerplan skal ikke settes til `premium` før en ekte, verifisert betalingshendelse er mottatt.

Priser som vises på nettstedet:

- Gratis: 0 kr, opptil 10 manuelle abonnementer, månedlig/årlig oversikt og grunnleggende dashboard.
- Premium månedlig: 29 kr/mnd.
- Premium årlig beta-pris: 99 kr/år.
- Beta-brukere kan fortsatt gis tilgang manuelt av admin mens betaling rulles ut.

Filer og endepunkter:

- `src/lib/billing/plans.ts` inneholder prisplanene.
- `src/lib/billing/vipps.ts` sjekker om Vipps payment-miljøvariabler finnes.
- `POST /api/billing/checkout` krever innlogging og returnerer `PAYMENTS_NOT_CONFIGURED` når betaling ikke er aktivert.
- `POST /api/billing/vipps/webhook` er en trygg webhook-placeholder. Fremtidig implementasjon må verifisere Vipps webhook/signatur før plan oppgraderes.

Planlagte betalingsvariabler:

- `VIPPS_PAYMENT_CLIENT_ID`
- `VIPPS_PAYMENT_CLIENT_SECRET`
- `VIPPS_PAYMENT_SUBSCRIPTION_KEY`
- `VIPPS_PAYMENT_MERCHANT_SERIAL_NUMBER`
- `VIPPS_PAYMENT_BASE_URL`

Vipps payment approval checklist:

- Priser er synlige på `/pricing`.
- Salgsbetingelser finnes på `/terms/sales`.
- Personvern, vilkår og kontaktinfo finnes i footer.
- Selskap vises som Melby Solutions, org.nr. 925 919 020, med kontakt `kontakt@aboslutt.no`.
- Checkout/webhook-endepunkter finnes, men behandler ikke fake payments.
- Når betaling aktiveres, må checkout opprette ekte Vipps payment/recurring agreement og webhook må verifisere betalingen før `User.plan` settes til `premium`.

## TODO

- Bekrefte Vipps Login-konfigurasjon, well-known URL-er og scopes mot Vipps MobilePay før produksjon.
- Konfigurere produksjonsklar SMTP eller alternativ e-postleverandør.
- Håndtere Google refresh tokens robust ved utløpt access token.
- Fjerne lokal demo-bruker fallback helt når utviklingsflyten ikke trenger den lenger.
- Bygge Outlook OAuth senere.
- Bygge Open Banking og ekte oppsigelsesflyter senere.
