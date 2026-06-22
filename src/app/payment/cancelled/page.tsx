import type { Metadata } from "next";
import { FunnelEvent } from "@/components/analytics/FunnelEvent";
import { PaymentStatusPoller } from "@/components/billing/PaymentStatusPoller";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export const metadata: Metadata = {
  title: "Betaling avbrutt",
  robots: { index: false, follow: false },
};

export default function PaymentCancelledPage() {
  return (
    <PublicPageShell
      intro="Ingen betaling er fullført før statusen er bekreftet. Du kan prøve igjen eller gå tilbake til oversikten."
      title="Betalingen ble avbrutt"
    >
      <FunnelEvent event="checkout_cancelled" />
      <PaymentStatusPoller returnContext="cancelled" />
    </PublicPageShell>
  );
}
