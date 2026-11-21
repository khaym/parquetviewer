import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.tsx", "src/**/__tests__/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["src/__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "..", "shared"),
    },
  },
});
