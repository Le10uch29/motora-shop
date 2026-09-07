/** Placeholder shown in place of a photo for products that don't have one. */
export default function ProductVisual({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-orange-500 via-orange-600 to-zinc-900 text-white/90 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10 sm:h-12 sm:w-12"
      >
        <path d="M4 16V12l2-5h12l2 5v4M4 16h16M4 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M17 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M6 12h12" />
        <circle cx="8" cy="16" r="1.3" />
        <circle cx="16" cy="16" r="1.3" />
      </svg>
    </div>
  );
}
