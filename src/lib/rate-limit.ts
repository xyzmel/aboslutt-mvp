import { NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimit(request: Request, options: Omit<RateLimitOptions, "key"> & { keyPrefix: string }) {
  const key = `${options.keyPrefix}:${getClientIp(request)}`;
  return consumeRateLimit({ key, limit: options.limit, windowMs: options.windowMs });
}

export function consumeRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: Math.max(limit - 1, 0) };
  }

  if (current.count >= limit) {
    return { limited: true, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { limited: false, remaining: Math.max(limit - current.count, 0) };
}

export function rateLimitedResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "RATE_LIMITED",
      message: "For mange forsøk. Prøv igjen senere.",
    },
    { status: 429 },
  );
}

export function rateLimitResponseIfNeeded(
  request: Request,
  options: Omit<RateLimitOptions, "key"> & { keyPrefix: string },
) {
  const result = rateLimit(request, options);
  return result.limited ? rateLimitedResponse() : null;
}
