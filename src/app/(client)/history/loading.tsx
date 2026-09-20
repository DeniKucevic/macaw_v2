import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <TableSkeleton rows={6} cols={3} />
      </div>
    </div>
  );
}
