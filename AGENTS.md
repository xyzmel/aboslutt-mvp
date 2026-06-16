Polish Aboslutt landing page, dashboard, and login/register UX for beta launch.

Current status:
- App is live on https://www.aboslutt.no.
- Neon Postgres works.
- Email magic-link login works.
- Google OAuth/Gmail works.
- Vipps Login is ordered/pending credentials.
- Dashboard works, but the UI still feels unfinished.
- We want the app to feel like a real beta SaaS.

Goal:
Make the public landing page, login/register flow, and subscription dashboard more polished and beta-ready.

Important:
- Keep existing functionality working.
- Do not break Google login, email magic link, Gmail import, dashboard CRUD, settings, onboarding or health route.
- Do not hardcode secrets.
- Do not commit .env or .env.local.
- Keep Norwegian UI copy.
- Use Aboslutt consistently, not Avoslutt.
- Use the existing brand style:
  - dark navy header/background
  - red accent
  - clean white cards
  - rounded corners
  - modern SaaS look

Product positioning:
- Everyone can manually add and track their existing subscriptions.
- Automatic subscription scanning from Gmail/email is a SaaS feature.
- For beta, automatic scanning may be available for selected users/testers.
- Do not make it sound like users must connect Gmail to use the app.
- Make it clear that manual overview works without Gmail.

Part 1 — Landing page polish:

Improve the public landing page `/`.

Make it feel like a real beta product.

Sections:
1. Hero:
   - Headline: “Få kontroll på abonnementene dine”
   - Subtext explaining that Aboslutt helps users track, organize and manage subscriptions.
   - Mention that users can add subscriptions manually, and that automatic scanning is available as a smarter SaaS feature.
   - Primary CTA: “Start gratis beta”
   - Secondary CTA: “Logg inn”
   - Mention: “Legg inn abonnementer manuelt — eller bruk automatisk skanning når det er tilgjengelig.”

2. How it works:
   - “Legg til abonnementer manuelt”
   - “Få oversikt over månedlige kostnader”
   - “Skann kvitteringer automatisk”
   - “Bekreft funn før de lagres”
   - Explain that automatic scanning is optional and that users confirm candidates before saving.

3. Feature section:
   Include two clear tracks:
   - Manuell oversikt:
     - available for all users
     - add existing subscriptions
     - track price, category, status and next billing date
   - Automatisk skanning:
     - SaaS feature
     - scans Gmail/email receipts with read-only access
     - suggests possible subscriptions
     - user confirms before saving

4. Trust/privacy section:
   - Manual use does not require Gmail.
   - Gmail scanning uses read-only access.
   - Raw email content is not stored.
   - User confirms what gets saved.
   - User can delete subscriptions/account data in settings.

5. Beta/pricing section:
   - “Gratis i beta”
   - Manual tracking available in beta.
   - Automatic scanning is a SaaS feature and may be limited during beta.
   - Future pricing coming later.

6. Company footer:
   - Melby Solutions
   - Org.nr. 925 919 020
   - contact email
   - links to privacy, terms, contact

Part 2 — Login/register polish:

Improve `/login` and `/register`.

Goal:
Clear auth options:
- Continue with Google
- Continue with Vipps
- Continue with email

Use Norwegian button text:
- “Fortsett med Google”
- “Fortsett med Vipps”
- “Fortsett med e-post”

Google:
- Add a small Google “G” icon/logo in the button.
- Use a simple inline SVG or local asset.
- Do not use a random external image URL.

Vipps:
- Add a Vipps-styled button.
- If real Vipps provider is not configured, show the button disabled or with text:
  “Vipps Login kommer snart”
- If Vipps provider is configured, button should call signIn("vipps").
- Add a small Vipps-like label/icon if no official asset exists.
- Do not hardcode Vipps credentials.

Email:
- Keep email magic-link form.
- Use clear text:
  “Vi sender deg en sikker innloggingslenke. Ingen passord trengs.”
- On success:
  “Sjekk e-posten din for innloggingslenken.”
- On SMTP missing:
  “E-postinnlogging er ikke konfigurert enda.”

Register:
- `/register` should look like a proper signup page.
- Use same auth options.
- Text should say “Opprett konto”.
- Explain that account is created automatically when the user logs in through email/Google/Vipps.
- Explain that users can start by adding subscriptions manually without connecting Gmail.
- Link between `/login` and `/register`.

Part 3 — Dashboard polish:

Improve dashboard visual polish and subscription overview.

Keep current add/delete/cancel functionality.

Improvements:
1. Header:
   - Better spacing and active nav.
   - Add links:
     - Oversikt
     - Importer e-post
     - Innstillinger
   - Show user name/avatar initials.
   - Logout visible but not too prominent.

2. Summary cards:
   - “Totalt per måned”
   - “Aktive abonnementer”
   - “Avsluttede”
   - “Mulige funn” if useful
   - Make cards more polished and consistent.

3. Subscription cards:
   - Make amount, status, source and next billing date clearer.
   - Source badge:
     - Gmail
     - Manuell
     - Vipps later
   - Status badge:
     - Aktiv
     - Avsluttet
     - Prøveperiode
   - If amount confidence is low or imported from Gmail, optionally show:
     “Bekreftet av bruker” or “Importert fra Gmail”
   - Keep delete button less visually dominant.
   - Keep cancel/selected flow.

4. Fix current awkward data display:
   - “Importert fra gmail_import” should display as “Importert fra Gmail”.
   - Avoid showing raw source values to users.
   - If next billing date is unknown, show “Ukjent” cleanly.
   - If amount looks suspicious, do not auto-highlight it as perfect. Keep UI honest.

5. Empty state:
   - If no subscriptions:
     - “Du har ingen abonnementer enda”
     - CTA: “Legg til manuelt”
     - CTA: “Skann Gmail”
     - CTA: “Se hvordan det fungerer”
   - Make manual adding the first/default option.
   - Mention automatic scanning as optional.

Part 4 — Onboarding polish:

Update `/onboarding`.

Make it clear:
- Manual tracking is the fastest way to get started.
- Gmail scanning is optional and works as an automatic SaaS feature.
- User can add subscriptions manually first, then connect Gmail later.

Onboarding CTAs:
- Primary: “Legg til abonnement manuelt”
- Secondary: “Skann Gmail”
- Tertiary: “Gå til oversikt”

Part 5 — App copy consistency:

Search for inconsistent product names:
- Avoslutt
- Aboslutt
- avoslutt
- aboslutt

Use “Aboslutt” everywhere visible in the UI and README unless it is a URL/package name.

Part 6 — Logos/assets:

Add local reusable icon components or assets:
- GoogleIcon
- VippsIconPlaceholder or VippsLogo if an existing local asset is provided

Do not use remote image URLs.
Do not add large asset packages.

Part 7 — README update:

Update README with:
- beta status
- manual subscription tracking available for all users
- automatic Gmail/email scanning as a SaaS feature
- auth options
- Google/Gmail read-only
- Vipps pending
- email magic-link
- production deploy command
- how to test login/register/dashboard

Part 8 — Checks:

Run:
npm run lint
npm run build

Acceptance criteria:
- Landing page looks beta-ready.
- Landing page clearly says manual subscription tracking is available without Gmail.
- Landing page positions automatic Gmail/email scanning as optional SaaS feature.
- /login has polished auth options with Google, Vipps and email.
- /register exists and looks polished.
- Vipps button handles both configured and not-configured states.
- Dashboard cards look more production-ready.
- Manual add is clearly available to every user.
- Raw source values like gmail_import are not shown to users.
- Product name is consistently Aboslutt in visible UI.
- Google/Gmail flow still works.
- Email magic-link still works.
- Dashboard CRUD still works.
- Settings/onboarding still work.
- npm run lint passes.
- npm run build passes.

Final summary:
- files changed
- commands run
- what to test on production
- remaining TODOs