"use client";

import { useEffect } from "react";
import { trackFunnelEvent } from "@/lib/analytics";

type FunnelEventProps = {
  event: Parameters<typeof trackFunnelEvent>[0];
  properties?: Parameters<typeof trackFunnelEvent>[1];
};

export function FunnelEvent({ event, properties }: FunnelEventProps) {
  useEffect(() => {
    trackFunnelEvent(event, properties);
  }, [event, properties]);

  return null;
}
