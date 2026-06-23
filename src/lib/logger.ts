import * as Sentry from "@sentry/nextjs";
import {
  isSensitiveLogKey,
  redactSensitiveText,
} from "@/lib/sensitive-data-redaction.mjs";

type LogMetadata = Record<string, unknown>;

export const logger = {
  info(message: string, metadata: LogMetadata = {}) {
    console.info(message, sanitizeMetadata(metadata));
  },
  warn(message: string, metadata: LogMetadata = {}) {
    console.warn(message, sanitizeMetadata(metadata));
  },
  error(message: string, metadata: LogMetadata = {}) {
    const sanitized = sanitizeMetadata(metadata);
    console.error(message, sanitized);
    captureLogError(message, sanitized);
  },
};

export function sanitizeMetadata(metadata: LogMetadata): LogMetadata {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      isSensitiveLogKey(key) ? "[redacted]" : sanitizeValue(value),
    ]),
  );
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: redactSensitiveText(value.message) };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    return sanitizeMetadata(value as LogMetadata);
  }

  if (typeof value === "string" && value.length > 500) {
    return `${redactSensitiveText(value.slice(0, 500))}...`;
  }

  return typeof value === "string" ? redactSensitiveText(value) : value;
}

function captureLogError(message: string, metadata: LogMetadata) {
  try {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(metadata)) {
        if (["route", "operation", "provider", "plan"].includes(key) && typeof value === "string") {
          scope.setTag(key, value);
        }
      }
      scope.setContext("metadata", metadata);
      const error = metadata.error instanceof Error ? metadata.error : new Error(message);
      Sentry.captureException(error);
    });
  } catch {
    // Error monitoring must never break application flow.
  }
}
