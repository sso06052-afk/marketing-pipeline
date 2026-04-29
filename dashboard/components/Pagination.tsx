"use client";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
};

export default function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  function getPages(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "...", totalPages];
    if (page >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  }

  const pages = getPages();

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="h-8 px-2.5 rounded-md border border-gray-200 text-sm text-gray-500 disabled:opacity-30 hover:bg-gray-50 transition-colors"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="h-8 w-8 flex items-center justify-center text-sm text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`h-8 w-8 rounded-md text-sm font-medium transition-colors ${
              p === page
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="h-8 px-2.5 rounded-md border border-gray-200 text-sm text-gray-500 disabled:opacity-30 hover:bg-gray-50 transition-colors"
      >
        ›
      </button>
    </div>
  );
}
