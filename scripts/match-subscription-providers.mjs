import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { subscriptionProviderSeed } from "../src/data/subscription-providers.mjs";
import { matchExistingSubscriptionProvider } from "../src/lib/subscription-provider-catalog.mjs";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const previewSeed = process.argv.includes("--preview-seed");
const reportArgument = process.argv.find((argument) => argument.startsWith("--report="));
const reportPath = reportArgument?.slice("--report=".length);

try {
  if (apply && previewSeed) {
    throw new Error("--preview-seed er kun for rapportering og kan ikke kombineres med --apply.");
  }

  const providers = previewSeed
    ? subscriptionProviderSeed.map((provider) => ({ ...provider, id: provider.slug }))
    : await prisma.subscriptionProvider.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, category: true, aliases: true, senderNames: true, emailDomains: true },
      });
  const subscriptions = previewSeed
    ? await prisma.subscription.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      })
    : await prisma.subscription.findMany({
        where: { providerId: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      });

  const report = { linked: [], unmatched: [], ambiguous: [] };
  for (const subscription of subscriptions) {
    const match = matchExistingSubscriptionProvider(subscription.name, providers);
    if (match.status === "linked" && match.provider) {
      report.linked.push({
        subscriptionId: subscription.id,
        subscriptionName: subscription.name,
        providerId: match.provider.id,
        providerName: match.provider.name,
      });
      if (apply) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { providerId: match.provider.id },
          select: { id: true },
        });
      }
    } else if (match.status === "ambiguous") {
      report.ambiguous.push({
        subscriptionId: subscription.id,
        subscriptionName: subscription.name,
        candidates: match.candidates.map((provider) => ({ id: provider.id, name: provider.name })),
      });
    } else {
      report.unmatched.push({ subscriptionId: subscription.id, subscriptionName: subscription.name });
    }
  }

  const summary = {
    mode: apply ? "applied" : previewSeed ? "preview-seed" : "report-only",
    linked: report.linked.length,
    unmatched: report.unmatched.length,
    ambiguous: report.ambiguous.length,
    report,
  };
  const output = JSON.stringify(summary, null, 2);
  if (reportPath) await writeFile(reportPath, output, "utf8");
  console.log(output);
} finally {
  await prisma.$disconnect();
}
