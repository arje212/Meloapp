import { defineConfig } from 'vitest/config';
import path from 'path';

// Kept separate from vite.config.js so tests don't load the Base44 plugin.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
