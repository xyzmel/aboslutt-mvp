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
      intro="Vi sjekker betalingsstatusen server-side. Premium aktiveres bare når Aboslutt har bekreftet betalingen hos Vipps."
      title="Betalingen behandles"
    >
      <PaymentStatusPoller returnContext="thanks" />
    </PublicPageShell>
  );
}
