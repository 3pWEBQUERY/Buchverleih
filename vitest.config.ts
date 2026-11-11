import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/leihregal_test",
      APP_URL: "http://localhost:3000",
      TZ: "Europe/Zurich",
    },
    fileParallelism: false,
    testTimeout: 20000,
  },
});
