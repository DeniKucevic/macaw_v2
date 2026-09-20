import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={4} cols={5} />
    </div>
  );
}
