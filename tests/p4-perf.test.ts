/**
 * P4 (remediation 2026-09) - algorithmic-complexity regressions.
 *
 * Each case feeds a pathological input that made the old code
 * quadratic and asserts a wall-clock ceiling well above the fixed
 * cost and far below the old one (measured before the fix: 30 000
 * spaces 1.5 s, 10 000 tokens 0.7 s, 15 000 "<u>a" 0.4 s - all
 * growing with the square of the size).
 */
import { describe, it, expect } from 'vitest';
import { validateRevisionSuffix, validateSecnavSchema } from '@/lib/letter-validators';
import { validateAcronyms } from '@/lib/acronym-validators';
import { parseFormattedText } from '@/lib/pdf-text-parser';
import { scanForSensitiveData } from '@/lib/security-utils';

function timed(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe('P4-1 SSIC "w/ ch" strip is linear', () => {
  const spaces = ' '.repeat(200_000);

  it('validateRevisionSuffix: 200 000 spaces under 50 ms', () => {
    const ms = timed(() => validateRevisionSuffix({ documentType: 'mco', ssic: spaces } as never));
    expect(ms).toBeLessThan(50);
  });

  it('validateSecnavSchema: 200 000 spaces under 50 ms', () => {
    const ms = timed(() =>
      validateSecnavSchema({ documentType: 'secnav-notice', ssic: spaces } as never, []),
    );
    expect(ms).toBeLessThan(50);
  });

  it('still fires on a real point number after a long tail', () => {
    const ssic = `5215.1K w/ ch 1${' '.repeat(100_000)}`;
    expect(validateRevisionSuffix({ documentType: 'mco', ssic } as never)).toHaveLength(0);
    const notice = validateSecnavSchema({ documentType: 'secnav-notice', ssic: '5215.1 w/ ch 1' } as never, []);
    expect(notice.map((i) => i.id)).toContain('secnav-notice-no-point-number');
  });
});

describe('P4-2 acronym definition lookup is one pass', () => {
  it('40 000 distinct four-letter tokens under 500 ms', () => {
    const tokens: string[] = [];
    for (let i = 0; i < 40_000; i++) {
      tokens.push(
        String.fromCharCode(
          65 + (i % 26),
          65 + (Math.floor(i / 26) % 26),
          65 + (Math.floor(i / 676) % 26),
          65 + (Math.floor(i / 17576) % 26),
        ),
      );
    }
    const paragraphs = [{ id: 1, level: 1, content: tokens.join(' ') }];
    let count = 0;
    const ms = timed(() => {
      count = validateAcronyms(paragraphs).length;
    });
    expect(ms).toBeLessThan(500);
    expect(count).toBeGreaterThan(39_000);
  });
});

describe('P4-3 pdf inline-markup tokenizer is linear', () => {
  // Wall-clock ceilings depend on the host. A slower machine, or a
  // vitest worker sharing the CPU with the rest of the suite, blew a
  // 150 ms budget by 6x on an unchanged algorithm. Assert the growth
  // instead: eight times the input, well under eight-squared times the
  // time. The old tokenizer measured 16x at 4x input on the unclosed
  // "<u>" case (65x at 8x). The fixed one measures 4x to 6x at 4x.
  const GROWTH = 8;
  const QUADRATIC_WOULD_BE = GROWTH * GROWTH;
  const CEILING = 24;

  function growth(build: (n: number) => string, n: number): number {
    const small = build(n);
    const large = build(n * GROWTH);
    parseFormattedText(small);
    parseFormattedText(large);
    const best = (input: string) =>
      Math.min(...[0, 1, 2].map(() => timed(() => parseFormattedText(input))));
    return best(large) / best(small);
  }

  it("'<u>a' with no closing tag: 8x input under 24x time", () => {
    const input = '<u>a'.repeat(40_000);
    // No closing tag anywhere: the whole thing is one plain leaf.
    expect(parseFormattedText(input)).toEqual([input]);
    const ratio = growth((n) => '<u>a'.repeat(n), 5_000);
    expect(ratio).toBeLessThan(CEILING);
    expect(ratio).toBeLessThan(QUADRATIC_WOULD_BE);
  });

  it('short italic/bold tokens: 8x input under 24x time (~1 element per token)', () => {
    const ratio = growth((n) => '*a'.repeat(n * 3) + '**b'.repeat(n), 1_250);
    expect(ratio).toBeLessThan(CEILING);
  });
});
