import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Font OFL thật (Be Vietnam Pro / Montserrat ExtraBold / Anton) gắn qua
        // next/font/local trong M2.5 (docs/ROADMAP.md). Scaffold M1.1 chỉ khai báo
        // token + fallback stack hệ thống — tham chiếu: docs/ARCHITECTURE.md §3.
        body: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'Arial', 'sans-serif'],
        price: ['Anton', 'Impact', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
