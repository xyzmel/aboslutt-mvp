const sensitiveKeyPattern =
  /token|secret|password|authorization|cookie|database_url|access_token|refresh_token|id_token|client_secret|authorization_code|email|subject|receipt|mailbox|reference|agreement|charge|vipps/i;

export function isSensitiveLogKey(key) {
  return sensitiveKeyPattern.test(String(key));
}

export function redactSensitiveText(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(
      /((?:access_token|refresh_token|id_token|client_secret|authorization_code|cookie|authorization)["']?\s*[:=]\s*["']?)[^"',\s}&]+/gi,
      "$1[redacted]",
    )
    .replace(/([?&](?:code|token|id_token|access_token|refresh_token)=)[^&\s]+/gi, "$1[redacted]");
}

export function redactSensitiveObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveObject(item));
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      value[key] = isSensitiveLogKey(key) ? "[redacted]" : redactSensitiveObject(nestedValue);
    }
    return value;
  }

  return typeof value === "string" ? redactSensitiveText(value) : value;
}
