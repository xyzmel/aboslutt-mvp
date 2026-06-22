import type { Metadata } from "next";
import { PaymentStatusPoller } from "@/components/billing/PaymentStatusPoller";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export const metadata: Metadata = {
  title: "Betaling behandles",
  robots: { index: false, follow: false },
};

export default function PaymentThanksPage() {
  return (
    <PublicPageShell
      intro="Vi sjekker betalingsstatusen før Premium aktiveres. Tilgangen åpnes bare når betalingen er bekreftet."
      title="Betalingen behandles"
    >
      <PaymentStatusPoller returnContext="thanks" />
    </PublicPageShell>
  );
}
