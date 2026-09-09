/**
 * Shared Playwright e2e helpers.
 *
 * `enterApp` and `collectErrors` used to be file-local to
 * tests/e2e/smoke.spec.ts. They moved here so tests/e2e/csp-pdfjs.spec.ts
 * (2026-09-09) can drive the same entry point and error-collection logic
 * without a copy. Behaviour is unchanged from the smoke.spec.ts
 * originals.
 *
 * tests/e2e/same-page-endorsement.spec.ts imports these too.
 * tests/e2e/axe.spec.ts keeps its own enterApp (it takes a theme
 * argument) and collects no console errors.
 */
import { expect, type Page } from '@playwright/test';

/**
 * A 4xx/5xx is only a defect when it comes from the app's own origin.
 * Locally that origin is the static server on 127.0.0.1; in
 * deployed-URL mode (E2E_BASE_URL, see playwright.config.ts) it is the
 * deployment's own origin.
 */
const ORIGIN = new URL(process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173/').origin;

/** Console noise the app is known to emit and which is not a defect. */
export const IGNORED_CONSOLE = [
  /Download the React DevTools/,
  /TT: undefined function/,
  /TT: ENDF bad stack/,
  /FormatError: Could not fix indexToLocFormat/,
  /Warning: .*fontkit/,
  // yoga-layout 3.2.1 (react-pdf's WASM layout engine) fetches its own
  // binary from a data: URL. The production CSP's connect-src blocks
  // it, but yoga's Emscripten glue falls back to an inline base64
  // decode when the fetch fails, so the app works and this console
  // error is noise. Measured 2026-09-09 under the production CSP.
  // Matches only this specific data: URL (AGFzbQ is the base64 of the
  // WASM magic bytes) - any OTHER CSP console error must still fail the
  // test. Chromium phrases the report three ways, measured 2026-09-09:
  // "Refused to connect to 'data:...'" (Chrome DevTools),
  // "Fetch API cannot load data:... Refused to connect" (Linux headless
  // shell) and "Connecting to 'data:...' violates the following Content
  // Security Policy directive" (Windows headless shell). Anchor on the
  // URL, not the wording.
  /Content Security Policy.*data:application\/octet-stream;base64,AGFzbQ|data:application\/octet-stream;base64,AGFzbQ.*Content Security Policy/,
];

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  // A 4xx or 5xx on our own origin is a missing or mis-prefixed asset.
  page.on('response', res => {
    if (res.status() >= 400 && res.url().startsWith(ORIGIN)) {
      errors.push(`http ${res.status()}: ${res.url()}`);
    }
  });
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some(re => re.test(text))) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/** Load the app and clear the first-visit disclaimer. */
export async function enterApp(page: Page) {
  await page.goto('.');
  await page.getByRole('button', { name: 'I Understand' }).click();
  await expect(page.getByRole('button', { name: /Standard Naval Letter/ })).toBeVisible();
}
