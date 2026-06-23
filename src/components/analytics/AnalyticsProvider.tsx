"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import * as Sentry from "@sentry/nextjs";
import {
  identifyAnalyticsUser,
  initializeAnalytics,
  resetAnalyticsIdentity,
  syncAnalyticsRoute,
} from "@/lib/analytics";
import { createClearedAttemptedProviderCookie } from "@/lib/auth-login-state.mjs";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const previousUserId = useRef<string | null>(null);
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    initializeAnalytics(pathname);
  }, [pathname]);

  useEffect(() => {
    syncAnalyticsRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (userId) {
      identifyAnalyticsUser(userId);
      Sentry.setUser({ id: userId });
      document.cookie = createClearedAttemptedProviderCookie({
        secure: window.location.protocol === "https:",
      });
      previousUserId.current = userId;
      return;
    }

    if (previousUserId.current) {
      resetAnalyticsIdentity();
      Sentry.setUser(null);
      previousUserId.current = null;
    }
  }, [status, userId]);

  return children;
}
