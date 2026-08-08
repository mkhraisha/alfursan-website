import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Component render tests (.test.tsx) opt into jsdom individually via a
    // `/** @vitest-environment jsdom */` docblock at the top of the file;
    // everything else (API routes, lib helpers) stays on the lighter/native
    // "node" environment, which the ~60 existing .test.ts files rely on for
    // native fetch/Request/Response support.
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/pages/api/**"],
    },
  },
});
