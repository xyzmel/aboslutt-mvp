import { getServerSession } from "next-auth";
import { LandingScreen } from "@/components/landing/LandingScreen";
import { isAdminUser } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { getSafeAuthConfigStatus } from "@/lib/auth-config-status";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <LandingScreen
      authConfig={getSafeAuthConfigStatus()}
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
