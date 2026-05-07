import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@core": resolve(__dirname, "core"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    reporters: "verbose",
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["core/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/types.ts"],
    },
  },
});
