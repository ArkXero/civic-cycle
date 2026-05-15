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
      'components/**',
      'docker-compose.yml',
      'eslint.config.mjs',
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
