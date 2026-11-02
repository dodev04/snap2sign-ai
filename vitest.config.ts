import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit test thuần cho src/engine/ + src/stores/ — ngoại lệ no-mock duy nhất theo AGENTS.md
// (engine/store là client-state thuần: không dữ liệu, không network).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // Alias `@` → ./src mirror tsconfig paths — test ngoài engine/ (vd src/stores/)
    // import `@/engine/*`. Dùng node:url fileURLToPath — Windows-safe, không thêm dependency.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
