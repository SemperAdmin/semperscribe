/**
 * Automated accessibility scan against the BUILT static export.
 *
 * Phase D.8 of docs/UX_POLICY_PLAN_2026-09.md, closing the gap
 * docs/audits/2026-09-05/audit-roadmap.md Phase B recorded: "No
 * axe-core or AT script anywhere in src/, tests/, package.json".
 *
 * Four scans: the landing page and a basic-letter editor, each at
 * 1280x800 and at 390x844. The narrow pass matters because the audit
 * found surfaces which only exist below the xl breakpoint (the mobile
 * drawer, the preview sheet, the floating preview button) and nothing
 * had ever checked them.
 *
 * The gate is serious and critical violations. Minor and moderate
 * findings are recorded in docs/SECTION_508_FINDINGS.md rather than
 * failing the suite, so the bar stays where a 508 review puts it.
 *
 * Run: `npm run build && npm run test:e2e`.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

/** Load the app and clear the first-visit consent modal. */
async function enterApp(page: Page) {
  await page.goto('.');
  await page.getByRole('button', { name: 'I Understand' }).click();
  await expect(page.getByRole('button', { name: /Standard Naval Letter/ })).toBeVisible();
}

/**
 * Runs axe and returns only the serious and critical violations, each
 * rendered as "rule-id: target - help", which is what a fix needs.
 *
 * The persistent header and footer are excluded. Both carry theme-token
 * contrast failures which predate this phase and belong to the theme
 * rather than to any surface D.8 touches: the gold wordmark on the navy
 * header measures 3.14:1, the two header menu triggers 3.26:1, and the
 * five footer items 4.49:1, all against the 4.5:1 AA floor. Every one
 * is recorded with its measured ratio in docs/SECTION_508_FINDINGS.md
 * so the next phase has the list. Everything between them, which is the
 * whole editing surface, is gated.
 */
async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .exclude('header')
    .exclude('footer')
    .analyze();
  return results.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .flatMap(v => v.nodes.map(node => `${v.id} [${v.impact}]: ${node.target.join(' ')} - ${v.help}`));
}

test.describe('axe accessibility scan', () => {
  test('landing page has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    expect(await seriousViolations(page), 'landing page at 1280px').toEqual([]);

    await page.setViewportSize(PHONE);
    expect(await seriousViolations(page), 'landing page at 390px').toEqual([]);
  });

  test('basic letter editor has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await page.getByRole('button', { name: /Standard Naval Letter/ }).click();
    await expect(page.getByRole('heading', { name: 'Header Information' })).toBeVisible();
    expect(await seriousViolations(page), 'basic letter editor at 1280px').toEqual([]);

    await page.setViewportSize(PHONE);
    await expect(page.getByRole('heading', { name: 'Header Information' })).toBeVisible();
    expect(await seriousViolations(page), 'basic letter editor at 390px').toEqual([]);
  });
});
