import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // Next aliases this marker during builds; tests execute server modules in isolation.
    alias: { "server-only": "next/dist/compiled/server-only/empty.js" },
  },
  test: {
    clearMocks: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        statements: 78,
        branches: 58,
        functions: 68,
        lines: 80,
      },
      include: ["app/**/*.{ts,tsx}", "proxy.ts"],
      exclude: [
        "app/**/*.test.{ts,tsx}",
        "app/**/*.spec.{ts,tsx}",
        "app/**/*.d.ts",
      ],
    },
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost",
      },
    },
    mockReset: true,
    restoreMocks: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
