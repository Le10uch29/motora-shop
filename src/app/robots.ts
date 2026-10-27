import type { MetadataRoute } from "next";

/** Магазин закрытый: каталог доступен только после входа, а страница входа
 * в поиске не нужна. Поэтому обход запрещён для всего сайта; то же самое
 * дублирует noindex в metadata корневого layout — на случай поисковика,
 * который robots.txt не читает. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
