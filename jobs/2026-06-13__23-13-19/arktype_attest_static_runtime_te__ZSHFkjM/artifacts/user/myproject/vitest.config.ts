import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globalSetup: ["setupVitest.ts"],
    include: ["tests/**/*.test.ts"]
  }
})
