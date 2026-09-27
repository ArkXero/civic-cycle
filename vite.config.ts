import { defineConfig } from 'vite-plus'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    exclude: ['**/node_modules/**', '**/.git/**', '.next/**', '.ariadne/**'],
  },
  lint: {
    ignorePatterns: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'components/ui/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: [
      '.github/**',
      'README.md',
      'app/**',
      'boarddocs-agenda-item-7.04.html',
      'components/**',
      'docker-compose.yml',
      'eslint.config.mjs',
      'general-translation-cost-report.html',
      'general-translation-cost-report.json',
      'lib/**',
      'next.config.ts',
      'postcss.config.mjs',
      'proxy.ts',
      'tests/**',
      'types/**',
    ],
    semi: false,
    singleQuote: true,
  },
})
