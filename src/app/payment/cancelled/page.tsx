import type { Metadata } from "next";
import { PaymentStatusPoller } from "@/components/billing/PaymentStatusPoller";
import { FunnelEvent } from "@/components/analytics/FunnelEvent";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export const metadata: Metadata = {
  title: "Betaling avbrutt",
  robots: { index: false, follow: false },
};

export default function PaymentCancelledPage() {
  return (
    <PublicPageShell
      intro="Vi sjekker den verifiserte betalingsstatusen før vi viser resultatet. Premium aktiveres aldri fra retursiden alene."
      title="Betalingsstatus"
    >
      <FunnelEvent event="checkout_cancelled" />
      <PaymentStatusPoller returnContext="cancelled" />
    </PublicPageShell>
  );
}
