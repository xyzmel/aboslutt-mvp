import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MagicLinkAuthScreen } from "@/components/auth/MagicLinkAuthScreen";
import { authOptions } from "@/lib/auth";
import { getSafeAuthConfigStatus } from "@/lib/auth-config-status";

type RegisterPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const [session, params] = await Promise.all([getServerSession(authOptions), searchParams]);

  if (session?.user) {
    redirect(getSafeCallbackUrl(params.callbackUrl));
  }

  return <MagicLinkAuthScreen authConfig={getSafeAuthConfigStatus()} mode="register" />;
}

function getSafeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/dashboard";
  }

  return callbackUrl;
}
