import Link from "next/link";

export const ADMIN_PAGE_SIZE = 10;

export default function Pagination({
  basePath,
  currentPage,
  total,
  searchParams,
}: {
  basePath: string;
  currentPage: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  if (totalPages <= 1) return null;

  function hrefForPage(page: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {pages.map((page) => (
        <Link
          key={page}
          href={hrefForPage(page)}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
            page === currentPage
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "border border-zinc-200 text-zinc-700 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          }`}
        >
          {page}
        </Link>
      ))}
    </div>
  );
}
