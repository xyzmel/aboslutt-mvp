import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === "production"),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0.005,
  replaysOnErrorSampleRate: 0.05,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
  beforeSend(event) {
    delete event.request?.cookies;
    delete event.request?.headers?.authorization;
    delete event.request?.headers?.cookie;
    delete event.user?.email;
    delete event.user?.username;
    delete event.user?.ip_address;
    scrubObject(event.extra);
    scrubObject(event.contexts);
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

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
