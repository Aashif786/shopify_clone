import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="route-loading" aria-busy="true" aria-label="Loading">
      <span className="route-loading-mark" aria-hidden="true">SC</span>
      <Skeleton className="h-7 w-[min(520px,84vw)]" />
      <Skeleton className="h-3 w-[min(280px,70vw)]" />
      <div className="grid w-full max-w-[980px] grid-cols-1 gap-4 md:grid-cols-3" aria-hidden="true">
        <Skeleton className="min-h-[190px] rounded-xl" />
        <Skeleton className="min-h-[190px] rounded-xl" />
        <Skeleton className="min-h-[190px] rounded-xl" />
      </div>
    </main>
  );
}
