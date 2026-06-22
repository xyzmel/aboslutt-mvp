import { AppFooter } from "@/components/navigation/AppFooter";
import { AppHeader } from "@/components/navigation/AppHeader";
import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function EmailImportLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F0F4F8] text-[#0D1B2A]">
      <AppHeader maxWidthClassName="max-w-4xl" />
      <section className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="mt-3 h-9 w-80 max-w-full" />
        <SkeletonBlock className="mt-4 h-4 w-full max-w-2xl" />
        <SkeletonBlock className="mt-6 h-44" />
        <SkeletonBlock className="mt-6 h-80" />
      </section>
      <AppFooter compact />
    </main>
  );
}
