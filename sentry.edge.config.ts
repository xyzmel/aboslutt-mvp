import * as Sentry from "@sentry/nextjs";
import { redactSensitiveObject } from "./src/lib/sensitive-data-redaction.mjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean((process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) && process.env.NODE_ENV === "production"),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  tracesSampleRate: 0.02,
  beforeSend(event) {
    delete event.request?.cookies;
    delete event.request?.headers?.authorization;
    delete event.request?.headers?.cookie;
    delete event.user?.email;
    delete event.user?.username;
    delete event.user?.ip_address;
    redactSensitiveObject(event.extra);
    redactSensitiveObject(event.contexts);
    redactSensitiveObject(event.exception);
    return event;
  },
});
