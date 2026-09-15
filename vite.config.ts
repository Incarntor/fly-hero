import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 5173 — nginx проекта rbc, 5280 — fly-game, 5290 — fly-plays
  server: { port: 5300, strictPort: true },
  preview: { port: 5301, strictPort: true },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
