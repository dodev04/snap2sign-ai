import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Flat config trực tiếp (không qua FlatCompat) — pattern canonical của
// create-next-app 16.4.3: eslint-config-next đã export sẵn flat config array.
// FlatCompat (đường legacy) gãy "circular structure" dưới ESLint 10.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'out/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
