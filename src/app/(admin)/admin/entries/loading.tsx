import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton action={false} />
      {/* Filter controls (search / period / method) */}
      <Card className="flex flex-wrap gap-3 p-4">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </Card>
      <TableSkeleton rows={10} cols={4} />
    </div>
  );
}
