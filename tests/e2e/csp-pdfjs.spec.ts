/**
 * CSP guard for the pdfjs consumers, against the BUILT static export
 * served under the production response headers.
 *
 * 2026-09-08 shipped a Content-Security-Policy to cloud.gov with no
 * `blob:` on `connect-src`. It passed every existing gate - including
 * tests/e2e/smoke.spec.ts and tests/e2e/axe.spec.ts - because
 * scripts/serve-out.mjs sent no response headers at all, so none of
 * those specs ever ran under the policy they were meant to guard. The
 * deployed app broke instead: the signature-field preview
 * (SignaturePlacementModal) and the position-paper page count
 * (PageCountIndicator) both use pdfjs (via react-pdf's <Document>) and
 * both showed "Failed to load PDF file.", because pdfjs was loading a
 * `URL.createObjectURL` string, which is a `blob:` fetch that
 * connect-src governs. The fix (2026-09-09) passes the Blob object
 * itself to <Document file={...}>, which react-pdf reads through
 * FileReader with no fetch, so connect-src needs no blob: - see
 * CHANGELOG.md "Fixed, 2026-09-09" and the comment above
 * connect-src in public/nginx/conf/includes/security-headers.conf.
 *
 * scripts/serve-out.mjs now mirrors those production headers on every
 * response (SERVE_OUT_NO_HEADERS=1 opts out, for a differential run),
 * so this spec is the guard that a passing result here actually means
 * something: it drives both pdfjs consumers under the real policy.
 */
import { test, expect, type Page } from '@playwright/test';
import { enterApp, collectErrors } from './helpers';

type CspViolation = { directive: string; blocked: string };

declare global {
  interface Window {
    __cspViolations?: CspViolation[];
  }
}

/** Registers the securitypolicyviolation listener before any navigation. */
async function trackCspViolations(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations ??= [];
      window.__cspViolations.push({ directive: e.violatedDirective, blocked: e.blockedURI });
    });
  });
}

async function getCspViolations(page: Page): Promise<CspViolation[]> {
  return page.evaluate(() => window.__cspViolations ?? []);
}

test.describe('CSP: pdfjs consumers under the production headers', () => {
  test('production CSP is present on the served page', async ({ page }) => {
    test.skip(
      process.env.SERVE_OUT_NO_HEADERS === '1',
      'server started with SERVE_OUT_NO_HEADERS=1: no production CSP to check',
    );

    const response = await page.goto('.');
    expect(response, 'the initial navigation must produce a response').toBeTruthy();
    const csp = response!.headers()['content-security-policy'];
    expect(csp, 'Content-Security-Policy header must be present').toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    // The tight shape this suite exists to guard: connect-src carries no
    // blob:, so a regression back to a blob: URL fetch (rather than the
    // Blob object react-pdf reads through FileReader) fails here first.
    const connectSrc = /connect-src ([^;]+)/.exec(csp ?? '')?.[1] ?? '';
    expect(connectSrc).not.toContain('blob:');
  });

  test('signature placement modal renders the PDF under the CSP', async ({ page }) => {
    await trackCspViolations(page);
    const errors = collectErrors(page);
    await enterApp(page);

    await page.getByRole('button', { name: 'Start from a filled example' }).click();
    await expect(page.getByRole('heading', { name: 'Header Information' })).toBeVisible();

    const configureButton = page.getByTestId('sig-configure');
    await configureButton.scrollIntoViewIfNeeded();
    await configureButton.click();

    const dialog = page.getByRole('dialog', { name: 'Configure Signature Fields' });
    await expect(dialog).toBeVisible();

    const canvas = page.locator('.react-pdf__Page canvas').first();
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('width', '612');

    await expect(page.getByText('Failed to load PDF file.')).toHaveCount(0);

    const violations = await getCspViolations(page);
    expect(
      violations.filter((v) => v.blocked === 'blob'),
      `CSP violations: ${JSON.stringify(violations)}`,
    ).toEqual([]);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('position paper page count badge renders under the CSP', async ({ page }) => {
    await trackCspViolations(page);
    const errors = collectErrors(page);
    await enterApp(page);

    const staffingPapersTrigger = page.getByRole('button', { name: 'Staffing Papers', exact: true }).first();
    if ((await staffingPapersTrigger.getAttribute('aria-expanded')) !== 'true') {
      await staffingPapersTrigger.click();
    }
    await page.getByRole('button', { name: 'Position Paper', exact: true }).first().click();

    await expect(page.getByText(/\d+ Pages? \((Preferred|Allowed|Over Limit)\)/)).toBeVisible();

    const violations = await getCspViolations(page);
    expect(
      violations.filter((v) => v.blocked === 'blob'),
      `CSP violations: ${JSON.stringify(violations)}`,
    ).toEqual([]);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
