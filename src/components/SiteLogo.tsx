const SIZES = [512, 1024, 2048] as const;

function srcSet(variant: "" | "dark-"): string {
  return SIZES.map((w) => `/araz-motors-logo-${variant}${w}.png ${w}w`).join(", ");
}

/**
 * Логотип ARAZ-MOTORS 2026.
 *
 * Две картинки: обычная — для светлой темы, и светлая (чёрное перекрашено в
 * белое, красное как есть) — для тёмной; какую показать, решает класс .dark
 * на <html>, без JavaScript. Каждая в трёх размерах (512/1024/2048), и браузер
 * сам берёт нужный под экран: на обычном хватает 512, на ретине — 1024.
 *
 * `printable` — для инвойса: при печати всегда светлая версия, бумага белая.
 */
export default function SiteLogo({
  className = "h-10",
  sizes = "200px",
  printable = false,
  alt = "ARAZ-MOTORS 2026",
}: {
  /** Задаёт высоту; ширина подстраивается по пропорциям. */
  className?: string;
  /** Примерная ширина логотипа на странице — подсказка браузеру. */
  sizes?: string;
  printable?: boolean;
  alt?: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/araz-motors-logo-512.png"
        srcSet={srcSet("")}
        sizes={sizes}
        alt={alt}
        width={512}
        height={252}
        className={`w-auto dark:hidden ${printable ? "print:block!" : ""} ${className}`}
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/araz-motors-logo-dark-512.png"
        srcSet={srcSet("dark-")}
        sizes={sizes}
        alt={alt}
        width={512}
        height={252}
        className={`hidden w-auto dark:block ${printable ? "print:hidden!" : ""} ${className}`}
        decoding="async"
      />
    </>
  );
}
