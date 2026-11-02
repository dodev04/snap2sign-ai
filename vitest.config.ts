import { defineConfig } from 'vitest/config'

// Unit test thuần cho src/engine/ — ngoại lệ no-mock duy nhất theo AGENTS.md
// (engine không chứa dữ liệu, không network).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
