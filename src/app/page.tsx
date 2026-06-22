import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { LandingScreen } from "@/components/landing/LandingScreen";
import { isAdminUser } from "@/lib/admin";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Få kontroll på abonnementene dine",
  description: "Oppdag hva du betaler for, kutt det du ikke trenger og hold abonnementene samlet i Aboslutt.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Få kontroll på abonnementene dine",
    description: "Samle abonnementer, se faste kostnader og få hjelp til å rydde opp.",
    url: "https://www.aboslutt.no",
  },
};

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <LandingScreen
      user={
        session?.user
          ? {
              name: session.user.name ?? null,
              email: session.user.email ?? null,
              isAdmin: isAdminUser({ email: session.user.email ?? null }),
            }
          : null
      }
    />
  );
}
