export default function BrandLogo({
  logoUrl,
  name,
  className = "",
}: {
  logoUrl?: string | null;
  name: string;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={`h-14 w-auto max-w-[55%] object-contain drop-shadow-sm ${className}`}
      />
    );
  }

  return (
    <span
      className={`rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-900 shadow ${className}`}
    >
      {name}
    </span>
  );
}
