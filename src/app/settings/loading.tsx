import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader />
      <section className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        <SkeletonBlock className="h-4 w-20" />
        <SkeletonBlock className="mt-3 h-9 w-56" />
        <div className="mt-6 grid gap-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock className="h-44" key={index} />
          ))}
        </div>
      </section>
      <AppFooter compact />
    </main>
  );
}
