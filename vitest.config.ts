import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', 'tests/**', 'scripts/**', '**/*.d.ts', 'src/db/seed.ts'],
    },
  },
});
