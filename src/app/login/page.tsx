import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MagicLinkAuthScreen } from "@/components/auth/MagicLinkAuthScreen";
import { authOptions } from "@/lib/auth";
import { getSafeAuthConfigStatus } from "@/lib/auth-config-status";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export const metadata: Metadata = {
  title: "Logg inn",
  description: "Logg inn på Aboslutt for å administrere abonnementene dine.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, params] = await Promise.all([getServerSession(authOptions), searchParams]);

  if (session?.user) {
    redirect(getSafeCallbackUrl(params.callbackUrl));
  }

  return <MagicLinkAuthScreen authConfig={getSafeAuthConfigStatus()} mode="login" />;
}

function getSafeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/dashboard";
  }

  return callbackUrl;
}
