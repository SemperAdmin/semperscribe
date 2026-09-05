/**
 * D.4: the proofread panel stops asserting what it does not check.
 *
 * Four items in the SECNAV M-5216.5 2-19.b framework list were
 * hardcoded to `status: 'pass'` with no measurement behind them, and
 * the margin item asserted "1\" all sides" while the generator's top
 * margin is 44 pt. Each of them now either measures something the
 * module reads or says it is not checked automatically.
 */
import { describe, it, expect } from 'vitest';
import { runProofreadChecks } from '@/lib/proofread-checks';
import { PDF_MARGINS } from '@/lib/pdf-settings';
import type { FormData, ParagraphData } from '@/types';

const p = (id: number, level: number, content: string): ParagraphData => ({ id, level, content });

const BODY = [p(1, 1, 'The unit requests range time for the period stated.')];

function fd(extra: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'basic',
    ssic: '1500',
    from: 'Commanding Officer, Unit',
    to: 'Commandant of the Marine Corps',
    subj: 'REQUEST FOR RANGE TIME',
    date: '5 Sep 26',
    sig: 'J. A. SMITH',
    ...extra,
  } as FormData;
}

function check(id: string, formData: FormData = fd(), paragraphs: ParagraphData[] = BODY) {
  const found = runProofreadChecks(formData, paragraphs, [], [], []).find((c) => c.id === id);
  expect(found, `check ${id} is missing`).toBeDefined();
  return found!;
}

describe('b.(2) margins', () => {
  it('reports the generator\'s real figures rather than "1 inch all sides"', () => {
    const margins = check('margins');
    expect(margins.status).not.toBe('pass');
    expect(margins.detail).toContain(`${PDF_MARGINS.top} pt`);
    expect(margins.detail).toContain('0.61 inches');
    expect(margins.detail).not.toContain('1" all sides');
    expect(margins.detail).toContain('2026-06-10');
  });

  it('reports the 2 inch sides Short Letter mode sets', () => {
    const short = check('margins', fd({ isShortLetter: true }));
    expect(short.detail).toContain('2 inches (144 pt)');
    expect(check('margins').detail).toContain('1 inch (72 pt)');
  });
});

describe('b.(3) page numbers, b.(5) alignment, b.(11) footer margin', () => {
  it.each(['page-numbers', 'paragraph-alignment', 'footer-margin'])(
    '%s says it is not checked automatically and says what to look at',
    (id) => {
      const item = check(id);
      expect(item.status).toBe('manual');
      expect(item.isAutomatic).toBe(false);
      expect(item.detail).toContain('Not checked automatically');
    },
  );
});

describe('b.(6) paragraph numbering', () => {
  it('measures the level ladder and passes a sound one', () => {
    const item = check('paragraph-numbering', fd(), [
      p(1, 1, 'First.'),
      p(2, 2, 'A subparagraph.'),
      p(3, 2, 'Its pair.'),
      p(4, 1, 'Second.'),
    ]);
    expect(item.status).toBe('pass');
    expect(item.isAutomatic).toBe(true);
    expect(item.detail).toContain('unbroken ladder');
  });

  it('warns when a level is skipped', () => {
    const item = check('paragraph-numbering', fd(), [
      p(1, 1, 'First.'),
      p(2, 3, 'Two levels down with no parent between.'),
    ]);
    expect(item.status).toBe('warn');
    expect(item.detail).toContain('level 1 to level 3');
  });

  it('warns when the document opens below level 1', () => {
    const item = check('paragraph-numbering', fd(), [p(1, 2, 'Opens at a subparagraph.')]);
    expect(item.status).toBe('warn');
    expect(item.detail).toContain('level 2');
  });
});

describe('b.(10) header margin', () => {
  it('reports the measured top margin instead of a bare pass', () => {
    const item = check('header-margin');
    expect(item.status).not.toBe('pass');
    expect(item.detail).toContain(`${PDF_MARGINS.top} pt`);
    expect(item.detail).toContain('7-2.1');
  });
});

describe('vias reach the validators the panel runs', () => {
  // The panel passed [] for vias, so a window-envelope letter with a
  // Via addressee proofread clean and was then refused at the export
  // gate, which does receive them.
  const WINDOW = fd({
    isWindowEnvelope: true,
    to: 'Commanding Officer\nUnit 1\nFPO AP 96000',
  });

  it('reports the window-envelope Via rule when a Via is present', () => {
    const ids = runProofreadChecks(WINDOW, BODY, [], [], ['Commander, Group']).map((c) => c.id);
    expect(ids).toContain('window-via');
  });

  it('and stays quiet when no Via is listed', () => {
    const ids = runProofreadChecks(WINDOW, BODY, [], [], []).map((c) => c.id);
    expect(ids).not.toContain('window-via');
  });
});
