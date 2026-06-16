import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoSubscriptions = [
  {
    name: "Netflix",
    category: "streaming",
    monthlyCost: 169,
    status: "active",
    billingInterval: "monthly",
    nextPayment: "15. jul",
  },
  {
    name: "Spotify",
    category: "streaming",
    monthlyCost: 129,
    status: "active",
    billingInterval: "monthly",
    nextPayment: "3. jul",
  },
  {
    name: "Adobe CC",
    category: "software",
    monthlyCost: 599,
    status: "active",
    billingInterval: "monthly",
    nextPayment: "28. jun",
  },
  {
    name: "Duolingo Plus",
    category: "software",
    monthlyCost: 79,
    status: "trial",
    billingInterval: "monthly",
    nextPayment: "18. jun",
    note: "prøveperiode",
  },
  {
    name: "Aftenposten",
    category: "news",
    monthlyCost: 199,
    status: "active",
    billingInterval: "monthly",
    nextPayment: "1. jul",
  },
  {
    name: "SATS",
    category: "health",
    monthlyCost: 399,
    status: "yearly",
    billingInterval: "yearly",
    nextPayment: "Jan 2027",
  },
  {
    name: "iCloud+",
    category: "software",
    monthlyCost: 29,
    status: "active",
    billingInterval: "monthly",
    nextPayment: "7. jul",
  },
  {
    name: "Disney+",
    category: "streaming",
    monthlyCost: 109,
    status: "trial",
    billingInterval: "monthly",
    nextPayment: "21. jun",
    note: "prøveperiode",
  },
];

async function main() {
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@aboslutt.local" },
    update: {},
    create: {
      email: "demo@aboslutt.local",
      name: "Demo-bruker",
    },
  });

  await prisma.subscription.deleteMany({
    where: { userId: demoUser.id },
  });

  await prisma.subscription.createMany({
    data: demoSubscriptions.map((subscription) => ({
      ...subscription,
      normalizedName: subscription.name.toLowerCase().replace(/[^a-z0-9æøå]+/gi, ""),
      source: "demo",
      userId: demoUser.id,
    })),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
