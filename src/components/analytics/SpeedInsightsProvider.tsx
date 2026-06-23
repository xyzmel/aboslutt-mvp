import { SpeedInsights } from "@vercel/speed-insights/next";

export function SpeedInsightsProvider() {
  if (!process.env.VERCEL && !process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return null;
  }

  return <SpeedInsights />;
}
