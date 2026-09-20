import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TableSkeleton } from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header: back button, name + handle, role badge */}
      <div className="flex items-start gap-2">
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
      </div>

      {/* Aktivna članarina */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Napomena o članu */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full max-w-md" />
        </CardContent>
      </Card>

      {/* Nedavni ulasci */}
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}
