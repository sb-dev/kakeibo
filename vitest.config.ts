import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const domainSource = fileURLToPath(new URL("./packages/domain/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@kakeibo/domain": domainSource,
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    environment: "node",
  },
});
