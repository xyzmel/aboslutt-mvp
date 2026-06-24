import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { searchSubscriptionProviders, suggestSubscriptionCategory } from "@/lib/subscription-provider-catalog.mjs";

const maximumQueryLength = 100;

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const requestedLimit = Number(url.searchParams.get("limit") ?? 8);

  if (query.length > maximumQueryLength || !Number.isFinite(requestedLimit)) {
    return NextResponse.json({ ok: false, error: "INVALID_SEARCH" }, { status: 400 });
  }

  const providers = await prisma.subscriptionProvider.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      aliases: true,
      senderNames: true,
      emailDomains: true,
      logoPath: true,
      defaultBillingInterval: true,
      isActive: true,
    },
  });

  const results = searchSubscriptionProviders(providers, query, requestedLimit).map((provider: (typeof providers)[number]) => ({
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    category: provider.category,
    suggestedCategory: suggestSubscriptionCategory(provider.category),
    logoPath: provider.logoPath,
    defaultBillingInterval: provider.defaultBillingInterval,
  }));

  return NextResponse.json({ ok: true, results });
}
