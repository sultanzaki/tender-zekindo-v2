import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-7 md:px-8" aria-busy="true">
      <Skeleton className="mb-6 h-9 w-56" />
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-none" />
        ))}
      </div>
    </div>
  );
}
