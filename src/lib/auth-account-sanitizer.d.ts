import type { Adapter, AdapterAccount } from "next-auth/adapters";

export function sanitizeAuthAccount(account: Record<string, unknown>): Partial<AdapterAccount>;
export function createSanitizedAuthAdapter(adapter: Adapter): Adapter;
export function getSupportedAccountFields(): string[];
