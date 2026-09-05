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
    // Playwright specs live under tests/e2e and run through
    // `npm run test:e2e` against the built export, never under vitest.
    exclude: ['tests/e2e/**', 'node_modules/**', 'out/**', '.next/**'],
    coverage: {
      provider: 'v8',
      // Write the report even when a test fails, so a local run with the
      // LibreOffice parity test red still measures coverage.
      reportOnFailure: true,
      // Whole-source thresholds, set just below the measured baseline so
      // a PR which drops coverage (a deleted test file, an untested new
      // module) fails the gate. Raise them in any PR which raises the
      // numbers. Measured 2026-09-05 with `npm run test:coverage`; the
      // figures are recorded in docs/HARDENING_PLAN_2026-09.md.
      // Baseline 2026-09-05 (data tables excluded, LibreOffice half of the
      // parity test not run): statements 45.48, branches 41.49,
      // functions 36.04, lines 46.42. Thresholds sit one point under.
      thresholds: {
        statements: 44.5,
        branches: 40.5,
        functions: 35,
        lines: 45.5,
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        // Pure data tables and generated assets: measuring them inflates
        // or deflates the percentage without saying anything about tests.
        'src/lib/dod-seal-data.ts',
        'src/lib/military-dictionary.ts',
        'src/lib/military-wordset.ts',
        'src/lib/units.ts',
        'src/lib/ssic.ts',
      ],
      reporter: ['text-summary', 'json-summary'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
