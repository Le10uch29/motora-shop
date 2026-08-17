import type { CategoryId } from "@/lib/products";

const GRADIENTS: Record<CategoryId, string> = {
  cars: "from-orange-500 via-orange-600 to-zinc-900",
  trucks: "from-amber-500 via-amber-600 to-zinc-900",
  vans: "from-sky-500 via-sky-600 to-zinc-900",
};

function CategoryIcon({ category }: { category: CategoryId }) {
  switch (category) {
    case "cars":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-10 w-10 sm:h-12 sm:w-12"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16V12l2-5h12l2 5v4M4 16h16M4 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M17 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M6 12h12"
          />
          <circle cx="8" cy="16" r="1.3" />
          <circle cx="16" cy="16" r="1.3" />
        </svg>
      );
    case "trucks":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-10 w-10 sm:h-12 sm:w-12"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6h10v9H3zM13 11h4l3 3v1h-7zM5.5 18.5a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM17 18.5a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z"
          />
        </svg>
      );
    case "vans":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-10 w-10 sm:h-12 sm:w-12"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 15V8a1 1 0 0 1 1-1h11l4 4v4h-2M3 15h13M3 15v-1M18 15v-1"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 7v4h6" />
          <circle cx="7" cy="16.5" r="1.6" />
          <circle cx="16" cy="16.5" r="1.6" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ProductVisual({
  category,
  className = "",
}: {
  category: CategoryId;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br text-white/90 ${GRADIENTS[category]} ${className}`}
    >
      <CategoryIcon category={category} />
    </div>
  );
}
