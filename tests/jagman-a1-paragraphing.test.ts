import { describe, it, expect } from 'vitest';
import { JAGMAN_A1 } from '@/lib/jagman-appendix-a1';

/**
 * Paragraph structure of the extracted JAGINST 5800.7G Appendix A-1 forms.
 *
 * WHY A TEST AND NOT A PROOFREAD. These arrays are line-for-line extractions
 * from a PDF whose page furniture was stripped by hand. Stripping a running
 * header leaves the blank line the header sat on, so a sentence spanning a
 * page break comes out cut in half. The reverse slip happens too: two
 * paragraphs abutting a stripped element come out fused with no blank
 * between them. Neither shows up in a word count, a diff against the source
 * text, or any assertion about content. Both are plainly visible on the
 * rendered PDF, which is where Stephen found the first pair on 2026-08-27,
 * reading A-1-c in Acrobat:
 *
 *   "we need to remove the hard space between '(3) ... will not be delayed
 *    to' and 'permit the presence of a spokesperson'"
 *   "We need to add a hard space between '(5) ... orally, in writing, or
 *    both;' and '(6) To have witnesses attend the proceeding'"
 *
 * Sweeping the corpus for those two shapes turned up five more he had not
 * seen, in A-1-c, A-1-g and A-1-h. The rules below are what he described,
 * written down so a future re-extraction cannot reintroduce either.
 *
 * THE DETECTORS ARE DELIBERATELY NARROW. A looser "blank after a line with
 * no terminal punctuation" rule fires on every centered heading, every
 * signature line and every row of underscores in these forms, 70 times
 * across the six appendices, which is a rule nobody would keep. Requiring
 * lowercase on BOTH sides of the blank fires on a sentence cut in half and
 * on nothing else: it found all four real ones and zero false positives.
 */

/** A line ending mid-word-stream. Headings and signature blocks do not. */
const ENDS_LOWERCASE = /[a-z]$/;
/** A line resuming mid-word-stream. A new paragraph starts with '(n)',
 *  a letter head, a capital, or an underscore rule. */
const STARTS_LOWERCASE = /^[a-z]/;
/** '        (6) To have witnesses ...' */
const ENUMERATOR = /^\s*\(\d+\)\s/;
/** '    f. If the punishment ...', indented two to six spaces as extracted. */
const LETTER_HEAD = /^\s{2,6}[a-z]\.\s/;

const APPENDICES = Object.entries(JAGMAN_A1);

describe('no blank line cuts a sentence in half', () => {
  it.each(APPENDICES)('%s', (_designator, appendix) => {
    const text = appendix.text;
    const cut: string[] = [];
    for (let i = 1; i < text.length - 1; i++) {
      if (
        text[i] === '' &&
        ENDS_LOWERCASE.test(text[i - 1].trim()) &&
        STARTS_LOWERCASE.test(text[i + 1].trim())
      ) {
        cut.push(`line ${i}: "...${text[i - 1].slice(-40)}" / "${text[i + 1].slice(0, 40)}..."`);
      }
    }
    expect(cut).toEqual([]);
  });
});

describe('every enumerated and lettered head opens a paragraph', () => {
  it.each(APPENDICES)('%s', (_designator, appendix) => {
    const text = appendix.text;
    const fused: string[] = [];
    for (let i = 1; i < text.length; i++) {
      if ((ENUMERATOR.test(text[i]) || LETTER_HEAD.test(text[i])) && text[i - 1] !== '') {
        fused.push(`line ${i}: "${text[i].trim().slice(0, 50)}" follows "${text[i - 1].trim().slice(-40)}"`);
      }
    }
    expect(fused).toEqual([]);
  });
});

// THE SEVEN SITES, named so a reviewer sees what changed rather than
// trusting the sweep. Each asserts the repaired shape at a spot the
// detectors above flagged before 2026-08-27.
describe('the repaired sites, by name', () => {
  /** Index of the first line whose text starts with `needle`. */
  function lineAt(designator: string, needle: string): number {
    const i = JAGMAN_A1[designator].text.findIndex((line) => line.trim().startsWith(needle));
    expect(i, `${designator}: "${needle}" not found`).toBeGreaterThan(-1);
    return i;
  }
  function follows(designator: string, needle: string): string {
    return JAGMAN_A1[designator].text[lineAt(designator, needle) + 1];
  }
  function precedes(designator: string, needle: string): string {
    return JAGMAN_A1[designator].text[lineAt(designator, needle) - 1];
  }

  it('A-1-c (3) runs on into "permit the presence of a spokesperson"', () => {
    expect(follows('A-1-c', 'similar expenses, and the proceedings will not be delayed to'))
      .toBe('permit the presence of a spokesperson. The spokesperson may');
  });

  it('A-1-c (6) opens a paragraph of its own after (5)', () => {
    expect(precedes('A-1-c', '(6) To have witnesses attend the proceeding')).toBe('');
  });

  it('A-1-c civilian lawyer election is one sentence', () => {
    expect(follows('A-1-c', '______ I wish to consult with a civilian lawyer before'))
      .toBe('completing the remainder of this form.');
  });

  it('A-1-c written matters election is one sentence', () => {
    expect(follows('A-1-c', '________ I desire to submit written matters for'))
      .toBe('consideration by the NJP authority.   Written matters');
  });

  it('A-1-g subparagraph f opens a paragraph of its own', () => {
    expect(precedes('A-1-g', 'f. If the punishment imposed included reduction')).toBe('');
  });

  it('A-1-h subparagraph c opens a paragraph and is one sentence', () => {
    expect(precedes('A-1-h', 'c.    Inform your commanding officer')).toBe('');
    expect(follows('A-1-h', 'c.    Inform your commanding officer'))
      .toBe('and speed change at about 6 minutes before the collision as');
  });
});
