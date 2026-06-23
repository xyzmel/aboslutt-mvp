import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean((process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) && process.env.NODE_ENV === "production"),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  tracesSampleRate: 0.05,
  beforeSend(event) {
    return sanitizeSentryEvent(event);
  },
});

function sanitizeSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  delete event.request?.cookies;
  delete event.request?.headers?.authorization;
  delete event.request?.headers?.cookie;
  delete event.user?.email;
  delete event.user?.username;
  delete event.user?.ip_address;
  scrubObject(event.extra);
  scrubObject(event.contexts);
  return event;
}

function scrubObject(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (/token|secret|authorization|cookie|password|email|subject|receipt|mailbox|reference|agreement|charge|vipps/i.test(key)) {
      (value as Record<string, unknown>)[key] = "[redacted]";
      continue;
    }
    scrubObject((value as Record<string, unknown>)[key]);
  }

  return value;
}
