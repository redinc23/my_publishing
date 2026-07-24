// PERF-PHASE2-1
import { Skeleton } from '@/components/ui/skeleton';

export function BooksSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-2 aspect-[2/3] w-full" />
          <Skeleton className="mb-1 h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
