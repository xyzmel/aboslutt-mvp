type LogMetadata = Record<string, unknown>;

const sensitiveKeyPattern = /token|secret|password|authorization|cookie|database_url|access_token|refresh_token|id_token/i;

export const logger = {
  info(message: string, metadata: LogMetadata = {}) {
    console.info(message, sanitizeMetadata(metadata));
  },
  warn(message: string, metadata: LogMetadata = {}) {
    console.warn(message, sanitizeMetadata(metadata));
  },
  error(message: string, metadata: LogMetadata = {}) {
    console.error(message, sanitizeMetadata(metadata));
  },
};

export function sanitizeMetadata(metadata: LogMetadata): LogMetadata {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[redacted]" : sanitizeValue(value),
    ]),
  );
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    return sanitizeMetadata(value as LogMetadata);
  }

  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 500)}...`;
  }

  return value;
}
