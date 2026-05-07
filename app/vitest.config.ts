import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  // Bypass the Next.js PostCSS / Tailwind v4 plugin chain — our tests are
  // pure TS, no CSS imports involved.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    reporters: "verbose",
  },
});
