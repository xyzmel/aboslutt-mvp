import type { Prisma } from "@prisma/client";

export function toPrismaJson(payload: unknown): Prisma.InputJsonValue {
  return normalizeJson(payload) as Prisma.InputJsonValue;
}

function normalizeJson(payload: unknown): Prisma.JsonValue {
  if (payload === null) {
    return null;
  }

  if (typeof payload === "string" || typeof payload === "number" || typeof payload === "boolean") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeJson(item));
  }

  if (typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload as Record<string, unknown>).map(([key, value]) => [key, normalizeJson(value)]),
    );
  }

  return null;
}
