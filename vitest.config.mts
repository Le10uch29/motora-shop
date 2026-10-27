import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Чистые модули (разбор Excel-импорта, совместимость с машинами) тестируются
// в Node, без браузера и без Supabase. Алиас "@/" — тот же, что в tsconfig.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
