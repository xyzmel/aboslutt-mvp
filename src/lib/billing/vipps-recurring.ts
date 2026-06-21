import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
const requiredEnvKeys = [
  "VIPPS_RECURRING_CLIENT_ID",
  "VIPPS_RECURRING_CLIENT_SECRET",
  "VIPPS_RECURRING_SUBSCRIPTION_KEY",
  "VIPPS_RECURRING_MERCHANT_SERIAL_NUMBER",
  "VIPPS_RECURRING_BASE_URL",
  "VIPPS_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SITE_URL",
] as const;

const systemHeaders = {
  "Vipps-System-Name": "aboslutt",
  "Vipps-System-Version": "1.0.0",
  "Vipps-System-Plugin-Name": "aboslutt-nextjs",
  "Vipps-System-Plugin-Version": "1.0.0",
} as const;

type RequiredEnvKey = (typeof requiredEnvKeys)[number];

type VippsConfig = Record<RequiredEnvKey, string>;

type JsonRecord = Record<string, unknown>;

type VippsAccessTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  expires_on?: unknown;
  token_type?: unknown;
};

export type VippsRecurringErrorCode = "VIPPS_TOKEN_ERROR" | "VIPPS_AGREEMENT_ERROR";

export class VippsRecurringError extends Error {
  code: VippsRecurringErrorCode;
  status?: number;
  vippsCode?: string;
  vippsMessage?: string;

  constructor({
    code,
    message,
    status,
    vippsCode,
    vippsMessage,
  }: {
    code: VippsRecurringErrorCode;
    message: string;
    status?: number;
    vippsCode?: string;
    vippsMessage?: string;
  }) {
    super(message);
    this.name = "VippsRecurringError";
    this.code = code;
    this.status = status;
    this.vippsCode = vippsCode;
    this.vippsMessage = vippsMessage;
  }
}

export type VippsRecurringUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  phoneNumber?: string | null;
};

export type VippsRecurringAgreementPlan = {
  id: string;
  name: string;
  amountNok: number;
  interval: "month" | "year";
};

export type VippsCreateAgreementInput = {
  user: VippsRecurringUser;
  plan: VippsRecurringAgreementPlan;
  reference: string;
};

export type VippsCreateAgreementResponse = {
  agreementId: string;
  vippsConfirmationUrl: string;
  chargeId?: string;
  uuid?: string;
  raw: unknown;
};

export type VippsWebhookEvent = {
  eventType: string;
  providerEventId?: string;
  providerAgreementId?: string;
  providerChargeId?: string;
  reference?: string;
  payload: unknown;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function isVippsRecurringConfigured() {
  return requiredEnvKeys.every((key) => Boolean(process.env[key]?.trim()));
}

export function validateVippsRecurringConfig() {
  const missing = requiredEnvKeys.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Vipps Recurring is missing required environment variables: ${missing.join(", ")}`);
  }

  return getConfig();
}

export async function getAccessToken() {
  const now = Date.now();

  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }

  const config = validateVippsRecurringConfig();
  const response = await fetch(vippsUrl("/accesstoken/get", config), {
    method: "POST",
    headers: {
      client_id: config.VIPPS_RECURRING_CLIENT_ID,
      client_secret: config.VIPPS_RECURRING_CLIENT_SECRET,
      "Ocp-Apim-Subscription-Key": config.VIPPS_RECURRING_SUBSCRIPTION_KEY,
      "Merchant-Serial-Number": config.VIPPS_RECURRING_MERCHANT_SERIAL_NUMBER,
      ...systemHeaders,
    },
    cache: "no-store",
  });

  const body = (await readJsonResponse(response)) as VippsAccessTokenResponse;

  if (!response.ok || typeof body.access_token !== "string") {
    throw new VippsRecurringError({
      code: "VIPPS_TOKEN_ERROR",
      message: "Vipps access token request failed.",
      status: response.status,
      vippsCode: getVippsResponseCode(body),
      vippsMessage: getVippsResponseMessage(body),
    });
  }

  const expiresInSeconds =
    typeof body.expires_in === "string" ? Number.parseInt(body.expires_in, 10) : Number(body.expires_in ?? 3600);

  cachedAccessToken = {
    token: body.access_token,
    expiresAt: now + Math.max(60, Number.isFinite(expiresInSeconds) ? expiresInSeconds : 3600) * 1000,
  };

  return cachedAccessToken.token;
}

export async function createAgreement({ user, plan, reference }: VippsCreateAgreementInput) {
  const amountOre = plan.amountNok * 100;
  const intervalUnit = plan.interval === "year" ? "YEAR" : "MONTH";
  const siteUrl = getSiteUrl();
  const payload: JsonRecord = {
    pricing: {
      type: "LEGACY",
      amount: amountOre,
      currency: "NOK",
    },
    interval: {
      unit: intervalUnit,
      count: 1,
    },
    merchantRedirectUrl: `${siteUrl}/payment/thanks`,
    merchantAgreementUrl: `${siteUrl}/settings`,
    productName: plan.name,
    productDescription: "Aboslutt Premium",
    externalId: reference,
  };

  const phoneNumber = normalizePhoneNumber(user.phoneNumber);

  if (phoneNumber) {
    payload.phoneNumber = phoneNumber;
  }

  const result = await vippsRequest("/recurring/v3/agreements", {
    method: "POST",
    idempotencyKey: reference,
    body: payload,
  });

  if (!isJsonRecord(result) || typeof result.agreementId !== "string" || typeof result.vippsConfirmationUrl !== "string") {
    throw new VippsRecurringError({
      code: "VIPPS_AGREEMENT_ERROR",
      message: "Vipps agreement response did not include agreementId and vippsConfirmationUrl.",
      vippsCode: getVippsResponseCode(result),
      vippsMessage: getVippsResponseMessage(result),
    });
  }

  return {
    agreementId: result.agreementId,
    vippsConfirmationUrl: result.vippsConfirmationUrl,
    chargeId: typeof result.chargeId === "string" ? result.chargeId : undefined,
    uuid: typeof result.uuid === "string" ? result.uuid : undefined,
    raw: result,
  } satisfies VippsCreateAgreementResponse;
}

export async function getAgreement(providerAgreementId: string) {
  return vippsRequest(`/recurring/v3/agreements/${encodeURIComponent(providerAgreementId)}`, {
    method: "GET",
  });
}

export async function cancelAgreement(providerAgreementId: string) {
  return vippsRequest(`/recurring/v3/agreements/${encodeURIComponent(providerAgreementId)}`, {
    method: "PATCH",
    idempotencyKey: `stop-${providerAgreementId}`,
    body: { status: "STOPPED" },
    allowEmptyResponse: true,
  });
}

export function parseVippsWebhookEvent(rawBody: string | Buffer) {
  const payload = JSON.parse(rawBody.toString("utf8")) as unknown;

  if (!isJsonRecord(payload)) {
    throw new Error("Vipps webhook payload must be a JSON object.");
  }

  return {
    eventType: firstString(payload, ["eventType", "eventName", "type", "name"]) ?? "unknown",
    providerEventId: firstString(payload, ["id", "eventId", "eventIdempotencyKey"]) ?? nestedString(payload, ["data", "id"]),
    providerAgreementId:
      firstString(payload, ["agreementId", "providerAgreementId"]) ??
      nestedString(payload, ["agreement", "id"]) ??
      nestedString(payload, ["data", "agreementId"]) ??
      nestedString(payload, ["data", "agreement", "id"]),
    providerChargeId:
      firstString(payload, ["chargeId", "providerChargeId", "paymentId"]) ??
      nestedString(payload, ["charge", "id"]) ??
      nestedString(payload, ["data", "chargeId"]) ??
      nestedString(payload, ["data", "paymentId"]) ??
      nestedString(payload, ["data", "charge", "id"]),
    reference:
      firstString(payload, ["reference", "externalId", "orderId", "merchantReference"]) ??
      nestedString(payload, ["agreement", "externalId"]) ??
      nestedString(payload, ["charge", "externalId"]) ??
      nestedString(payload, ["data", "reference"]) ??
      nestedString(payload, ["data", "externalId"]) ??
      nestedString(payload, ["data", "orderId"]) ??
      nestedString(payload, ["data", "agreement", "externalId"]) ??
      nestedString(payload, ["data", "charge", "externalId"]),
    payload,
  } satisfies VippsWebhookEvent;
}

export function verifyWebhookSignature(request: Request, rawBody: string | Buffer) {
  const config = validateVippsRecurringConfig();
  const content = rawBody.toString("utf8");
  const contentHash = createHash("sha256").update(content).digest("base64");
  const providedContentHash = request.headers.get("x-ms-content-sha256") ?? "";

  if (!safeEqual(contentHash, providedContentHash)) {
    return false;
  }

  const date = request.headers.get("x-ms-date");
  const host = request.headers.get("host");
  const authorization = request.headers.get("authorization") ?? "";
  const signature = getWebhookSignature(authorization);

  if (!date || !host || !signature) {
    return false;
  }

  const url = new URL(request.url);
  const pathAndQuery = `${url.pathname}${url.search}`;
  const signedString = `${request.method.toUpperCase()}\n${pathAndQuery}\n${date};${host};${contentHash}`;
  const expectedSignature = createHmac("sha256", config.VIPPS_WEBHOOK_SECRET).update(signedString).digest("base64");

  return safeEqual(expectedSignature, signature);
}

export function sanitizeVippsPayloadForStorage(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeVippsPayloadForStorage(item));
  }

  if (!isJsonRecord(payload)) {
    return payload;
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        return [key, "[redacted]"];
      }

      return [key, sanitizeVippsPayloadForStorage(value)];
    }),
  );
}

function getConfig(): VippsConfig {
  return Object.fromEntries(requiredEnvKeys.map((key) => [key, process.env[key]?.trim() ?? ""])) as VippsConfig;
}

async function vippsRequest(
  path: string,
  options: {
    method: "GET" | "POST" | "PATCH";
    body?: JsonRecord;
    idempotencyKey?: string;
    allowEmptyResponse?: boolean;
  },
) {
  const config = validateVippsRecurringConfig();
  const accessToken = await getAccessToken();
  const response = await fetch(vippsUrl(path, config), {
    method: options.method,
    headers: vippsApiHeaders(config, accessToken, options.idempotencyKey),
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (options.allowEmptyResponse && (response.status === 202 || response.status === 204)) {
    return null;
  }

  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new VippsRecurringError({
      code: "VIPPS_AGREEMENT_ERROR",
      message: "Vipps Recurring request failed.",
      status: response.status,
      vippsCode: getVippsResponseCode(body),
      vippsMessage: getVippsResponseMessage(body),
    });
  }

  return body;
}

function vippsApiHeaders(config: VippsConfig, accessToken: string, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": config.VIPPS_RECURRING_SUBSCRIPTION_KEY,
    "Merchant-Serial-Number": config.VIPPS_RECURRING_MERCHANT_SERIAL_NUMBER,
    ...systemHeaders,
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = toVippsIdempotencyKey(idempotencyKey);
  }

  return headers;
}

function vippsUrl(path: string, config: VippsConfig) {
  return `${config.VIPPS_RECURRING_BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Vipps returned a non-JSON response with status ${response.status}.`);
  }
}

function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for Vipps Recurring.");
  }

  return siteUrl.replace(/\/+$/, "");
}

function normalizePhoneNumber(phoneNumber: string | null | undefined) {
  const digits = phoneNumber?.replace(/\D/g, "") ?? "";

  if (digits.length === 8) {
    return `47${digits}`;
  }

  if (digits.length === 10 && digits.startsWith("47")) {
    return digits;
  }

  return null;
}

function getVippsResponseCode(payload: unknown) {
  if (!isJsonRecord(payload)) {
    return undefined;
  }

  const value = payload.code ?? payload.errorCode ?? payload.error ?? payload.type;
  return typeof value === "string" ? value : undefined;
}

function getVippsResponseMessage(payload: unknown) {
  if (!isJsonRecord(payload)) {
    return undefined;
  }

  const value = payload.message ?? payload.errorMessage ?? payload.error_description ?? payload.detail;
  return typeof value === "string" ? value : undefined;
}

function toVippsIdempotencyKey(value: string) {
  const sanitized = value.replace(/[\\/?#]/g, "-");

  if (sanitized.length <= 40) {
    return sanitized;
  }

  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}

function getWebhookSignature(authorization: string) {
  const match = authorization.match(/(?:^|&)Signature=([^&\s]+)/);

  return match?.[1];
}

function safeEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function firstString(payload: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function nestedString(payload: JsonRecord, path: string[]) {
  let current: unknown = payload;

  for (const key of path) {
    if (!isJsonRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return typeof current === "string" && current.trim() ? current : undefined;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();

  return (
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("authorization") ||
    normalized.includes("subscriptionkey") ||
    normalized.includes("subscription-key") ||
    normalized.includes("ocp-apim-subscription-key")
  );
}
