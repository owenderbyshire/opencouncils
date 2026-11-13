import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "pipeline/**/*.test.ts", "data/**/*.test.ts", "src/lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@data": path.resolve(import.meta.dirname, "data"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
