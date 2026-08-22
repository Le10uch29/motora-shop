import { getBrandBySlug, type BrandSlug } from "@/lib/brands";

export default function BrandLogo({
  brand,
  className = "",
}: {
  brand: BrandSlug;
  className?: string;
}) {
  const info = getBrandBySlug(brand);
  if (!info) return null;

  if (info.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={info.logo} alt={info.name} className={className} />;
  }

  return (
    <span
      className={`rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-900 shadow ${className}`}
    >
      {info.name}
    </span>
  );
}
