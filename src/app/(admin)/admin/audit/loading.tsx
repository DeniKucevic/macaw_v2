import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton action={false} />
      <TableSkeleton rows={10} cols={5} />
    </div>
  );
}
