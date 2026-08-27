import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@penny/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
