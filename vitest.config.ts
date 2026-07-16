import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react'; // I'll assume this is available

export default defineConfig({
  plugins: [react()],
  test: {
    // PDF layout tests render real documents through @react-pdf under
    // jsdom - 1.5-2.0s each in isolation (node-timed 2026-07-15), and
    // parallel workers push them past the 5s default on slower runs.
    testTimeout: 30000,
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
