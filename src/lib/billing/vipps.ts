const vippsPaymentEnvKeys = [
  "VIPPS_PAYMENT_CLIENT_ID",
  "VIPPS_PAYMENT_CLIENT_SECRET",
  "VIPPS_PAYMENT_SUBSCRIPTION_KEY",
  "VIPPS_PAYMENT_MERCHANT_SERIAL_NUMBER",
  "VIPPS_PAYMENT_BASE_URL",
] as const;

export function isVippsPaymentConfigured() {
  return vippsPaymentEnvKeys.every((key) => Boolean(process.env[key]?.trim()));
}

export function getVippsPaymentConfigStatus() {
  return {
    configured: isVippsPaymentConfigured(),
    hasClientId: Boolean(process.env.VIPPS_PAYMENT_CLIENT_ID?.trim()),
    hasClientSecret: Boolean(process.env.VIPPS_PAYMENT_CLIENT_SECRET?.trim()),
    hasSubscriptionKey: Boolean(process.env.VIPPS_PAYMENT_SUBSCRIPTION_KEY?.trim()),
    hasMerchantSerialNumber: Boolean(process.env.VIPPS_PAYMENT_MERCHANT_SERIAL_NUMBER?.trim()),
    hasBaseUrl: Boolean(process.env.VIPPS_PAYMENT_BASE_URL?.trim()),
  };
}

export async function createVippsCheckoutPlaceholder() {
  // TODO: When Vipps payment/recurring credentials are approved, create a real
  // payment or recurring agreement here and return the Vipps redirect URL.
  // Never upgrade the user plan before a verified payment webhook confirms it.
  return null;
}
