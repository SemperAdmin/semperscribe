/**
 * Handoff of 22 Oct 26, D-04: the grade dropdown was reported to register
 * the grade above the one clicked when the list opened above the field,
 * and the keyboard path was reported failing. The report notes the
 * automation tool contributed and asks for reproduction by hand at both
 * widths. This is that reproduction in Playwright: every grade from Pvt
 * through CWO2, by mouse and by keyboard, with the list opening above
 * and below the field, at desktop and phone widths. The stored value is
 * read back from the trigger, which renders the store's value.
 */
import { test, expect, type Page } from '@playwright/test';
import { enterApp, collectErrors } from './helpers';

const GRADES: Array<[value: string, label: string]> = [
  ['E-1', 'Pvt (E-1)'], ['E-2', 'PFC (E-2)'], ['E-3', 'LCpl (E-3)'], ['E-4', 'Cpl (E-4)'], ['E-5', 'Sgt (E-5)'],
  ['E-6', 'SSgt (E-6)'], ['E-7', 'GySgt (E-7)'], ['E-8', 'MSgt or 1stSgt (E-8)'], ['E-9', 'MGySgt or SgtMaj (E-9)'],
  ['W-1', 'WO (W-1)'], ['W-2', 'CWO2 (W-2)'],
];

const WIDTHS = [
  { name: 'desktop', viewport: { width: 1600, height: 1000 } },
  { name: 'phone', viewport: { width: 390, height: 844 } },
];

async function openCounseling(page: Page) {
  await enterApp(page);
  // Below the desktop breakpoint the sidebar is a sheet behind the menu button.
  const menu = page.getByRole('button', { name: 'Open document menu' });
  if (await menu.isVisible()) await menu.click();
  const group = page.getByRole('button', { name: 'Counseling Worksheets', exact: true }).first();
  if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click();
  await page.getByRole('button', { name: 'Counseling Worksheet', exact: true }).first().click();
  await expect(page.getByTestId('counseling-step-2')).toBeVisible();
}

/**
 * Radix moves focus to the selected option a moment after the list
 * opens. A key sent before that lands, then loses to the deferred focus
 * call, so the wait is for the selected option itself to hold focus.
 */
async function listReady(page: Page, side: 'top' | 'bottom') {
  const list = openList(page);
  await expect(list).toBeVisible();
  await expect(list).toHaveAttribute('data-side', side);
  await expect(page.locator('[role="option"][data-state="checked"]')).toBeFocused();
  await page.waitForTimeout(150);
}

/**
 * Put the trigger near the top of the viewport (the list has room below
 * and opens there) or near the bottom (it has none and opens above).
 * The editor scrolls inside a pane, so the pane's own scrollTop is set
 * from the trigger's position rather than relying on scrollIntoView.
 */
async function placeTrigger(page: Page, trigger: ReturnType<Page['getByRole']>, side: 'top' | 'bottom') {
  const block: ScrollLogicalPosition = side === 'bottom' ? 'start' : 'end';
  const innerHeight = page.viewportSize()!.height;
  const placed = (top: number) => (side === 'bottom' ? top < innerHeight / 3 : top > innerHeight * 0.6);
  let top = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await trigger.evaluate((el, b) => el.scrollIntoView({ block: b, behavior: 'instant' as ScrollBehavior }), block);
    await page.waitForTimeout(120);
    top = await trigger.evaluate((el) => el.getBoundingClientRect().top);
    if (placed(top)) break;
  }
  expect(placed(top), `trigger top ${top} of ${innerHeight} for a list ${side === 'bottom' ? 'below' : 'above'}`).toBe(true);
}

/** The open list's side as Radix placed it. */
function openList(page: Page) {
  return page.locator('[role="listbox"]').locator('xpath=ancestor-or-self::*[@data-side][1]');
}

for (const width of WIDTHS) {
  for (const side of ['bottom', 'top'] as const) {
    test(`${width.name}, list opening ${side === 'top' ? 'above' : 'below'}: every grade lands by mouse and by keyboard`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.setViewportSize(width.viewport);
      await openCounseling(page);
      const trigger = page.getByRole('combobox', { name: "Senior's grade" });

      // Mouse: click each option, read the value back from the trigger.
      for (const [, label] of GRADES) {
        await placeTrigger(page, trigger, side);
        await trigger.click();
        const list = openList(page);
        await expect(list).toBeVisible();
        await expect(list).toHaveAttribute('data-side', side);
        await page.getByRole('option', { name: label, exact: true }).click();
        await expect(trigger).toHaveText(label);
      }

      // Keyboard: from the top of the list, ArrowDown once per step and
      // Enter, so each grade from Pvt through CWO2 is reached in turn.
      await placeTrigger(page, trigger, side);
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      await listReady(page, side);
      await page.keyboard.press('Home');
      await page.keyboard.press('Enter');
      await expect(trigger).toHaveText(GRADES[0][1]);
      for (let i = 1; i < GRADES.length; i += 1) {
        await placeTrigger(page, trigger, side);
        await trigger.focus();
        await page.keyboard.press('ArrowDown');
        await listReady(page, side);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(trigger).toHaveText(GRADES[i][1]);
      }

      // Typeahead: the reported case by name.
      await placeTrigger(page, trigger, side);
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      await listReady(page, side);
      await page.keyboard.type('SSg', { delay: 40 });
      await expect(page.getByRole('option', { name: 'SSgt (E-6)', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(trigger).toHaveText('SSgt (E-6)');

      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}

/**
 * The reported keyboard failure, made deterministic. Radix Select moved
 * focus on an arrow key inside a zero-delay timer, so an Enter already
 * queued behind the ArrowDown was handled by the option that still had
 * focus and the grade above the chosen one was committed. A key queue
 * drained after a long frame delivers exactly that pair on a slow phone
 * or a loaded runner; here the two keydowns are dispatched in one task.
 * The select wrapper (src/components/ui/select.tsx) now moves focus in
 * the same task, so the next grade lands every time.
 */
test('keyboard: ArrowDown and Enter in one task land the next grade, not the previous one', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openCounseling(page);
  const trigger = page.getByRole('combobox', { name: "Senior's grade" });
  await trigger.click();
  await page.getByRole('option', { name: 'Pvt (E-1)' }).click();
  await expect(trigger).toHaveText('Pvt (E-1)');
  for (let i = 1; i < GRADES.length; i += 1) {
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await listReady(page, 'bottom');
    await page.evaluate(() => {
      const fire = (key: string) => (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      fire('ArrowDown');
      fire('Enter');
    });
    await expect(trigger).toHaveText(GRADES[i][1]);
  }
  // And back up the list the same way.
  for (let i = GRADES.length - 2; i >= 0; i -= 1) {
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await listReady(page, 'bottom');
    await page.evaluate(() => {
      const fire = (key: string) => (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      fire('ArrowUp');
      fire('Enter');
    });
    await expect(trigger).toHaveText(GRADES[i][1]);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});
