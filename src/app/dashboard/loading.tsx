import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AuthenticatedPageSkeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader />
      <AuthenticatedPageSkeleton titleWidth="w-64" />
      <AppFooter compact />
    </main>
  );
}
