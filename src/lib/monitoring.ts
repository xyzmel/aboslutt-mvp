import * as Sentry from "@sentry/nextjs";
import { sanitizeMetadata } from "@/lib/logger";

type MonitoringContext = {
  route?: string;
  operation?: string;
  provider?: string;
  plan?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

export function captureError(error: unknown, context: MonitoringContext = {}) {
  try {
    Sentry.withScope((scope) => {
      setSafeContext(scope, context);
      Sentry.captureException(error instanceof Error ? error : new Error("Unknown error"));
    });
  } catch {
    // Monitoring must never break application flow.
  }
}

export function captureMessage(message: string, context: MonitoringContext = {}) {
  try {
    Sentry.withScope((scope) => {
      setSafeContext(scope, context);
      Sentry.captureMessage(message);
    });
  } catch {
    // Monitoring must never break application flow.
  }
}

function setSafeContext(scope: Sentry.Scope, context: MonitoringContext) {
  const environment = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";

  scope.setTag("deployment_environment", environment);

  if (context.route) {
    scope.setTag("route", context.route);
  }
  if (context.operation) {
    scope.setTag("operation", context.operation);
  }
  if (context.provider) {
    scope.setTag("provider", context.provider);
  }
  if (context.plan) {
    scope.setTag("plan", context.plan);
  }
  if (context.userId) {
    scope.setUser({ id: context.userId });
  }
  if (context.metadata) {
    scope.setContext("metadata", sanitizeMetadata(context.metadata));
  }
}
