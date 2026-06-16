const smtpEnvKeys = [
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",
] as const;

export function isSmtpConfigured() {
  return smtpEnvKeys.every((key) => Boolean(process.env[key]?.trim()));
}
