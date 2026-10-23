import type { MetadataRoute } from "next";

/** Иконки для телефона: «Добавить на главный экран» на Android берёт их
 * отсюда (iPhone — из apple-icon.png). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ARAZ-MOTORS 2026",
    short_name: "ARAZ-MOTORS",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      { src: "/icons/araz-motors-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/araz-motors-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/araz-motors-icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
  };
}
