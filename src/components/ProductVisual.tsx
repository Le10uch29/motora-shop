import type { CategoryId } from "@/lib/products";

const GRADIENTS: Record<CategoryId, string> = {
  motorcycles: "from-orange-500 via-orange-600 to-zinc-900",
  scooters: "from-sky-500 via-sky-600 to-zinc-900",
  gear: "from-zinc-700 via-zinc-800 to-zinc-950",
  parts: "from-amber-500 via-amber-600 to-zinc-900",
};

function CategoryIcon({ category }: { category: CategoryId }) {
  switch (category) {
    case "motorcycles":
    case "scooters":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-10 w-10 sm:h-12 sm:w-12"
        >
          <circle cx="5.5" cy="17.5" r="2.5" />
          <circle cx="18.5" cy="17.5" r="2.5" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.5 17.5 9 10h4l1.5 3M18.5 17.5 15 10.5M9 10 7 7h3l2.5 3"
          />
        </svg>
      );
    case "gear":
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
            d="M12 3a7 7 0 0 1 7 7v4H5v-4a7 7 0 0 1 7-7Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 14v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
          <path strokeLinecap="round" d="M9 14v2M15 14v2" />
        </svg>
      );
    case "parts":
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
            d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 1 5.4-5.4l-2.4 2.4-2-2 2.4-2.4Z"
          />
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
