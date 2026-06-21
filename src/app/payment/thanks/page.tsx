import type { Metadata } from "next";
import { PaymentStatusPoller } from "@/components/billing/PaymentStatusPoller";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export const metadata: Metadata = {
  title: "Betaling behandles | Aboslutt",
  robots: { index: false, follow: false },
};

export default function PaymentThanksPage() {
  return (
    <PublicPageShell
      intro="Vi bekrefter betalingsstatusen hos Vipps. Premium aktiveres ikke fra denne siden, men først når Aboslutt har verifisert betalingen server-side."
      title="Betalingen behandles"
    >
      <PaymentStatusPoller />
    </PublicPageShell>
  );
}
