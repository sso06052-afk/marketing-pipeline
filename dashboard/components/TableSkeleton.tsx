function SkeletonCell({ className }: { className?: string }) {
  return <div className={`h-3.5 rounded bg-gray-100 animate-pulse ${className}`} />;
}

export default function TableSkeleton({ rows = 8, showDateCol = false }: { rows?: number; showDateCol?: boolean }) {
  const headers = showDateCol
    ? ["가수명", "대표곡", "연락처", "신뢰도", "수집일", "액션"]
    : ["가수명", "대표곡", "연락처", "신뢰도", "액션"];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {headers.map((h) => (
              <th key={h} className="text-left text-xs font-medium text-gray-400 py-3 px-3 first:pl-4 last:pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-gray-100 h-12">
              <td className="py-0 pl-4 pr-3">
                <SkeletonCell className="w-20 mb-1.5" />
                <SkeletonCell className="w-14 h-2.5" />
              </td>
              <td className="py-0 px-3">
                <SkeletonCell className="w-28 mb-1.5" />
                <SkeletonCell className="w-16 h-2.5" />
              </td>
              <td className="py-0 px-3">
                <SkeletonCell className="w-32" />
              </td>
              <td className="py-0 px-3">
                <SkeletonCell className="w-16 h-2 rounded-full" />
              </td>
              {showDateCol && (
                <td className="py-0 px-3">
                  <SkeletonCell className="w-20" />
                </td>
              )}
              <td className="py-0 pl-3 pr-4">
                <SkeletonCell className="w-14 h-6 rounded-lg" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
