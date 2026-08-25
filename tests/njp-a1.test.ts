// Vitest suite for the JAGMAN Appendix A-1 fill engine and its two NJP
// callers: the pre-hearing rights notification (A-1-c / A-1-d) and the
// hearing script (A-1-f).
//
// fillAppendix itself is exercised against small synthetic fixtures, never
// against the real appendices, so a fixture change never risks masking a
// real anchor going stale. The two callers are exercised against the real,
// generated appendix text, since this is the only way to catch an anchor
// no longer matching after a re-extraction.

import { describe, it, expect } from 'vitest';
import type { JagmanAppendix } from '@/lib/jagman-appendix-a1';
import { APPENDIX_A_1_C, APPENDIX_A_1_D, APPENDIX_A_1_F } from '@/lib/jagman-appendix-a1';
import { fillAppendix, fillAppendixStrict, type A1Fill } from '@/lib/jagman-a1-fill';
import {
  selectRightsAppendix,
  renderNjpRights,
  rightsHandFillBlanks,
  captionName,
  MCM_CURRENT_EDITION,
  type NjpRightsCase,
} from '@/lib/njp-a1-rights';
import { renderNjpScript } from '@/lib/njp-a1-script';
import { appendixWidth, wrapHanging } from '@/lib/jagman-a1-wrap';

describe('fillAppendix, replaceNote mode', () => {
  const fixture: JagmanAppendix = {
    designator: 'TEST-1',
    title: 'TEST FIXTURE',
    description: 'Synthetic fixture for replaceNote.',
    text: [
      'Header line',
      '',
      '    (Note: This note spans two',
      'physical lines before it closes.)',
      '',
      'Trailer line',
    ],
  };

  it('replaces the whole note block, indented to the note own leading whitespace', () => {
    const fills: A1Fill[] = [
      {
        id: 'note-fill',
        anchor: '(Note: This note spans two',
        mode: 'replaceNote',
        value: ['First filled line.', 'Second filled line.'],
      },
    ];
    const { lines, report } = fillAppendix(fixture, fills);
    expect(report.applied).toEqual(['note-fill']);
    expect(lines).toEqual([
      'Header line',
      '',
      '    First filled line.',
      '    Second filled line.',
      '',
      'Trailer line',
    ]);
  });

  it('handles a single-line note the same way', () => {
    const oneLineFixture: JagmanAppendix = {
      ...fixture,
      text: ['Above', '  (Note: one line only.)', 'Below'],
    };
    const fills: A1Fill[] = [
      { id: 'note-fill', anchor: '(Note: one line only.)', mode: 'replaceNote', value: ['Filled.'] },
    ];
    const { lines, report } = fillAppendix(oneLineFixture, fills);
    expect(report.applied).toEqual(['note-fill']);
    expect(lines).toEqual(['Above', '  Filled.', 'Below']);
  });
});

describe('fillAppendix, fillRule mode', () => {
  const fixture: JagmanAppendix = {
    designator: 'TEST-2',
    title: 'TEST FIXTURE',
    description: 'Synthetic fixture for fillRule.',
    text: [
      'The amount is:',
      '    ________________________',
      '    ________________________',
      '    ________________________',
      '',
      'Trailer line',
    ],
  };

  it('fills each rule line in order, indented to the first rule line', () => {
    const fills: A1Fill[] = [
      { id: 'amount', anchor: 'The amount is:', mode: 'fillRule', value: ['One hundred dollars.'] },
    ];
    const { lines, report } = fillAppendix(fixture, fills);
    expect(report.applied).toEqual(['amount']);
    expect(lines[1]).toBe('    One hundred dollars.');
    expect(lines[2]).toBe('    ________________________');
    expect(lines[3]).toBe('    ________________________');
  });

  it('keeps remaining rules blank when value has fewer lines than the rule run', () => {
    const fills: A1Fill[] = [
      { id: 'amount', anchor: 'The amount is:', mode: 'fillRule', value: ['Line one.', 'Line two.'] },
    ];
    const { lines } = fillAppendix(fixture, fills);
    expect(lines[1]).toBe('    Line one.');
    expect(lines[2]).toBe('    Line two.');
    expect(lines[3]).toBe('    ________________________');
  });

  it('grows the form when value has more lines than the rule run', () => {
    const fills: A1Fill[] = [
      {
        id: 'amount',
        anchor: 'The amount is:',
        mode: 'fillRule',
        value: ['Line one.', 'Line two.', 'Line three.', 'Line four.'],
      },
    ];
    const { lines, report } = fillAppendix(fixture, fills);
    expect(report.applied).toEqual(['amount']);
    // Original 6 lines, one rule run of 3 grown by one extra value line.
    expect(lines.length).toBe(fixture.text.length + 1);
    expect(lines[1]).toBe('    Line one.');
    expect(lines[2]).toBe('    Line two.');
    expect(lines[3]).toBe('    Line three.');
    expect(lines[4]).toBe('    Line four.');
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe('Trailer line');
  });

  it('preserves a rule line own trailing period, which is appendix text', () => {
    const withPeriod: JagmanAppendix = {
      ...fixture,
      text: ['Punishment is:', '    ______________.', '', 'Trailer'],
    };
    const fills: A1Fill[] = [
      { id: 'p', anchor: 'Punishment is:', mode: 'fillRule', value: ['Extra duty for 14 days'] },
    ];
    const { lines } = fillAppendix(withPeriod, fills);
    expect(lines[1]).toBe('    Extra duty for 14 days.');
  });

  it('absorbs blank spacer lines interleaved with rule lines into one run', () => {
    const spaced: JagmanAppendix = {
      ...fixture,
      text: [
        'Violations:',
        '',
        '    ___________________',
        '',
        '    ___________________',
        '',
        'Not part of the run.',
      ],
    };
    const fills: A1Fill[] = [
      { id: 'v', anchor: 'Violations:', mode: 'fillRule', value: ['Article 92.'] },
    ];
    const { lines, report } = fillAppendix(spaced, fills);
    expect(report.applied).toEqual(['v']);
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('    Article 92.');
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('    ___________________');
    expect(lines[6]).toBe('Not part of the run.');
  });

  it('reports noTarget when the anchor is followed by no rule line at all', () => {
    const noRule: JagmanAppendix = {
      ...fixture,
      text: ['The amount is:', 'Prose immediately, no rule.', 'Trailer'],
    };
    const fills: A1Fill[] = [
      { id: 'amount', anchor: 'The amount is:', mode: 'fillRule', value: ['Filled.'] },
    ];
    const { lines, report } = fillAppendix(noRule, fills);
    expect(report.noTarget).toEqual([['amount', 'The amount is:']]);
    expect(lines).toEqual(noRule.text);
  });
});

describe('fillAppendix, replaceInline mode', () => {
  it('prefers an inline underscore run when present', () => {
    const fixture: JagmanAppendix = {
      designator: 'TEST-3',
      title: 'TEST FIXTURE',
      description: 'Synthetic fixture for replaceInline underscore run.',
      text: ['Name: __________ is here.'],
    };
    const fills: A1Fill[] = [
      { id: 'name', anchor: 'Name:', mode: 'replaceInline', value: ['Cpl Smith'] },
    ];
    const { lines, report } = fillAppendix(fixture, fills);
    expect(report.applied).toEqual(['name']);
    expect(lines[0]).toBe('Name: Cpl Smith is here.');
  });

  it('falls back to an inline parenthetical on the same line', () => {
    const fixture: JagmanAppendix = {
      designator: 'TEST-4',
      title: 'TEST FIXTURE',
      description: 'Synthetic fixture for replaceInline parenthetical.',
      text: ['Authority: (identify the authority) approved this.'],
    };
    const fills: A1Fill[] = [
      { id: 'authority', anchor: 'Authority:', mode: 'replaceInline', value: ['LtCol Jones'] },
    ];
    const { lines, report } = fillAppendix(fixture, fills);
    expect(report.applied).toEqual(['authority']);
    expect(lines[0]).toBe('Authority: LtCol Jones approved this.');
  });

  it('replaces a parenthetical opening on the anchor line and closing on the next', () => {
    const fixture: JagmanAppendix = {
      designator: 'TEST-5',
      title: 'TEST FIXTURE',
      description: 'Synthetic fixture for a two-line inline parenthetical.',
      text: [
        'You are advised to appeal to (identify the superior authority by name and',
        'organizational title). Your appeal must be timely.',
      ],
    };
    const fills: A1Fill[] = [
      {
        id: 'authority',
        anchor: '(identify the superior authority by name and',
        mode: 'replaceInline',
        value: ['LtCol Jones, Commanding Officer'],
      },
    ];
    const { lines, report } = fillAppendix(fixture, fills);
    expect(report.applied).toEqual(['authority']);
    // Defect 3. The suffix JOINS the value's line. It is never stranded on
    // its own physical line behind the original indent, which produced
    // "      . Your appeal must be timely." on the real appendix.
    // The joined result re-wraps to the fixture's measure, so the line
    // COUNT is not the invariant. What matters is the sentence reads
    // continuously and no line opens with a stranded stop.
    expect(lines.join(' ').replace(/\s+/g, ' ')).toContain(
      'appeal to LtCol Jones, Commanding Officer. Your appeal must be timely.',
    );
    expect(lines.some((l) => /^\s+[.?!]/.test(l))).toBe(false);
  });

  it('throws when value does not carry exactly one line', () => {
    const fixture: JagmanAppendix = {
      designator: 'TEST-6',
      title: 'TEST FIXTURE',
      description: 'Synthetic fixture for the replaceInline value-length guard.',
      text: ['Name: __________ is here.'],
    };
    const fills: A1Fill[] = [
      { id: 'name', anchor: 'Name:', mode: 'replaceInline', value: ['a', 'b'] },
    ];
    expect(() => fillAppendix(fixture, fills)).toThrow(/exactly one value line/);
  });
});

describe('fillAppendix, anchorMatch exact', () => {
  // Mirrors the real A-1-c/A-1-d shape first exposing the bug: a short
  // blank line whose entire content is a substring of a longer, unrelated
  // underscore-then-period line elsewhere in the same appendix. 'exact'
  // anchoring resolves the collision, and resolves it per-fill, so the two
  // fills below no longer share an anchor and no longer depend on being
  // applied in a particular order.
  const fixture: JagmanAppendix = {
    designator: 'TEST-8',
    title: 'TEST FIXTURE',
    description: 'Synthetic fixture mirroring the caption/unit-blank anchor collision.',
    text: [
      '__________________________________, assigned or attached to',
      '_______________________.',
      '',
      'Consulted with a lawyer on ______________________________.',
    ],
  };

  it('matches the short blank uniquely against its own trimmed line, not as a substring', () => {
    const fills: A1Fill[] = [
      {
        id: 'unit',
        anchor: '_______________________.',
        anchorMatch: 'exact',
        mode: 'replaceInline',
        value: ['3d Battalion, 5th Marines'],
      },
    ];
    const { lines, report } = fillAppendix(fixture, fills);
    expect(report.unmatched).toEqual([]);
    expect(lines[1]).toBe('3d Battalion, 5th Marines.');
    expect(lines[3]).toBe('Consulted with a lawyer on ______________________________.');
  });

  it('the same anchor as a plain substring match is ambiguous, confirming exact was needed', () => {
    const fills: A1Fill[] = [
      { id: 'unit', anchor: '_______________________.', mode: 'replaceInline', value: ['x'] },
    ];
    const { report } = fillAppendix(fixture, fills);
    expect(report.unmatched).toEqual([['unit', '_______________________.']]);
  });

  it('produces identical output regardless of fill array order', () => {
    const forward: A1Fill[] = [
      {
        id: 'unit',
        anchor: '_______________________.',
        anchorMatch: 'exact',
        mode: 'replaceInline',
        value: ['3d Battalion, 5th Marines'],
      },
      {
        id: 'name',
        anchor: '__________________________________, assigned or attached to',
        mode: 'replaceInline',
        value: ['LCpl John A. Doe'],
      },
    ];
    const reversed = [...forward].reverse();

    const forwardResult = fillAppendix(fixture, forward);
    const reversedResult = fillAppendix(fixture, reversed);

    expect(forwardResult.report.unmatched).toEqual([]);
    expect(forwardResult.report.noTarget).toEqual([]);
    expect(forwardResult.report.applied.length).toBe(2);
    expect(reversedResult.lines).toEqual(forwardResult.lines);
    expect(reversedResult.lines[0]).toBe('LCpl John A. Doe, assigned or attached to');
    expect(reversedResult.lines[1]).toBe('3d Battalion, 5th Marines.');
  });
});

describe('fillAppendix, anchor matching', () => {
  const fixture: JagmanAppendix = {
    designator: 'TEST-7',
    title: 'TEST FIXTURE',
    description: 'Synthetic fixture for anchor matching.',
    text: ['Line with TARGET once.', 'Unrelated line.', 'Another line with TARGET in it too.'],
  };

  it('an anchor matching zero lines lands in unmatched and the text is unchanged', () => {
    const fills: A1Fill[] = [
      { id: 'ghost', anchor: 'NOT PRESENT ANYWHERE', mode: 'replaceInline', value: ['x'] },
    ];
    const { lines, report } = fillAppendix(fixture, fills);
    expect(report.unmatched).toEqual([['ghost', 'NOT PRESENT ANYWHERE']]);
    expect(report.applied).toEqual([]);
    expect(lines).toEqual(fixture.text);
  });

  it('an anchor matching two lines lands in unmatched and the text is unchanged', () => {
    const fills: A1Fill[] = [
      { id: 'dupe', anchor: 'TARGET', mode: 'replaceInline', value: ['x'] },
    ];
    const { lines, report } = fillAppendix(fixture, fills);
    expect(report.unmatched).toEqual([['dupe', 'TARGET']]);
    expect(report.applied).toEqual([]);
    expect(lines).toEqual(fixture.text);
  });

  it('fillAppendixStrict throws when an anchor is unmatched', () => {
    const fills: A1Fill[] = [
      { id: 'ghost', anchor: 'NOT PRESENT ANYWHERE', mode: 'replaceInline', value: ['x'] },
    ];
    expect(() => fillAppendixStrict(fixture, fills)).toThrow(/unmatched "ghost"/);
  });

  it('fillAppendixStrict throws when a fill has no target', () => {
    const noRuleFixture: JagmanAppendix = {
      ...fixture,
      text: ['The amount is:', 'Prose immediately, no rule.'],
    };
    const fills: A1Fill[] = [
      { id: 'amount', anchor: 'The amount is:', mode: 'fillRule', value: ['Filled.'] },
    ];
    expect(() => fillAppendixStrict(noRuleFixture, fills)).toThrow(/no target "amount"/);
  });
});

describe('selectRightsAppendix', () => {
  // Get this backwards and a Marine is wrongly told refusal is barred,
  // so this asserts on the printed title text, never on a designator
  // string alone.
  it('true selects the appendix whose title says the vessel exception DOES apply', () => {
    const appendix = selectRightsAppendix(true);
    expect(appendix.title).toContain('VESSEL EXCEPTION DOES APPLY');
    expect(appendix.title).not.toContain('DOES NOT APPLY');
  });

  it('false selects the appendix whose title says the vessel exception does NOT apply', () => {
    const appendix = selectRightsAppendix(false);
    expect(appendix.title).toContain('VESSEL EXCEPTION DOES NOT APPLY');
  });
});

describe('renderNjpRights', () => {
  const twoOffenses = [
    { articleLabel: 'Article 92', summary: 'Failure to obey a lawful order.' },
    { articleLabel: 'Article 86', summary: 'Unauthorized absence.' },
  ];

  // Every required field, once, so each test only overrides what it cares
  // about. accusedRank/authorityPayGrade/accusedPayGrade are the four
  // fields NjpRightsCase gained; a call site that forgets one is a type
  // error, which is the point.
  const base: Omit<NjpRightsCase, 'offenses' | 'vesselException'> = {
    accusedRank: 'LCpl',
    accusedName: 'John A. Doe',
    unit: '3d Battalion, 5th Marines',
    authorityPayGrade: '',
    accusedPayGrade: '',
  };

  it('fills the caption with rank before name, and the unit', () => {
    const { lines } = renderNjpRights({
      ...base,
      offenses: twoOffenses,
      vesselException: true,
    });
    expect(lines.some((l) => l.includes('LCpl John A. Doe, assigned or attached to'))).toBe(true);
    expect(lines.some((l) => l.includes('3d Battalion, 5th Marines.'))).toBe(true);
  });

  it('captionName puts rank before name, and falls back to the bare name with no rank', () => {
    expect(captionName('LCpl', 'RIVERA, DIEGO M')).toBe('LCpl RIVERA, DIEGO M');
    expect(captionName('', 'RIVERA, DIEGO M')).toBe('RIVERA, DIEGO M');
  });

  it('fills the MCM edition into the bracketed instruction', () => {
    const { lines } = renderNjpRights({
      ...base,
      offenses: twoOffenses,
      vesselException: true,
    });
    expect(lines).toContain(`V, MCM, ${MCM_CURRENT_EDITION}, you are hereby notified that`);
    expect(lines.some((l) => l.includes('[insert current edition]'))).toBe(false);
  });

  it('letters the offenses A, B, ... into paragraph 1, carrying ONLY the article label', () => {
    const { lines } = renderNjpRights({
      ...base,
      offenses: twoOffenses,
      vesselException: true,
    });
    expect(lines.filter((l) => l.trim() === 'A. Article 92.').length).toBe(1);
    expect(lines.filter((l) => l.trim() === 'B. Article 86.').length).toBe(1);
  });

  it('paragraph 2 carries the SAME letters over the summaries, and no summary ever leaks into paragraph 1', () => {
    const { lines } = renderNjpRights({
      ...base,
      offenses: twoOffenses,
      vesselException: true,
    });

    // Paragraph 1: article label only, under letter A.
    const para1A = lines.find((l) => l.trim() === 'A. Article 92.');
    expect(para1A).toBeDefined();

    // Paragraph 2: the matching summary, under the SAME letter A.
    const para2A = lines.find((l) => l.trim() === 'A. Failure to obey a lawful order.');
    expect(para2A).toBeDefined();
    const para2B = lines.find((l) => l.trim() === 'B. Unauthorized absence.');
    expect(para2B).toBeDefined();

    // The split is real: a summary string never appears on the same line
    // as its article label, and the article label line never carries the
    // summary text.
    expect(lines.some((l) => l.includes('Article 92') && l.includes('Failure to obey'))).toBe(false);
    expect(lines.some((l) => l.includes('Article 86') && l.includes('Unauthorized absence'))).toBe(
      false,
    );

    // Paragraph 2's printed note is replaced (at least one offense has a
    // summary), so the instructional note text is gone.
    expect(lines.some((l) => l.includes('Here provide a brief summary of that information.'))).toBe(
      false,
    );
  });

  it('leaves paragraph 2 printed for hand completion when no offense carries a summary', () => {
    const noSummaries = twoOffenses.map((o) => ({ articleLabel: o.articleLabel, summary: '' }));
    const { lines, report } = renderNjpRights({
      ...base,
      offenses: noSummaries,
      vesselException: true,
    });
    expect(lines.some((l) => l.includes('Here provide a brief summary of that information.'))).toBe(
      true,
    );
    expect(report.applied).not.toContain('basis-notice');
    // Paragraph 1 still gets its article labels.
    expect(lines.filter((l) => l.trim() === 'A. Article 92.').length).toBe(1);
  });

  it('every fill applies cleanly, no unmatched or no-target anchors', () => {
    const { report } = renderNjpRights({
      ...base,
      offenses: twoOffenses,
      vesselException: false,
    });
    expect(report.unmatched).toEqual([]);
    expect(report.noTarget).toEqual([]);
    // mcm-edition, caption-name, caption-unit, offenses-notice, basis-notice.
    // No maximum-punishment fill: authorityPayGrade is '' in `base`.
    expect(report.applied.length).toBe(5);
  });

  it('with a readable officer authorityPayGrade, the maximum-punishment fill also applies', () => {
    const { report } = renderNjpRights({
      ...base,
      offenses: twoOffenses,
      vesselException: false,
      authorityPayGrade: 'O5',
    });
    expect(report.unmatched).toEqual([]);
    expect(report.noTarget).toEqual([]);
    expect(report.applied.length).toBe(6);
    expect(report.applied).toContain('maximum-punishment');
  });

  it('A-1-d with authorityPayGrade unset: the four rules stay pure underscores, no ceiling text anywhere', () => {
    const { lines, designator } = renderNjpRights({
      ...base,
      offenses: twoOffenses,
      vesselException: false,
      authorityPayGrade: '',
    });
    expect(designator).toBe('A-1-d');

    const sourceIdx = APPENDIX_A_1_D.text.findIndex((l) => l.includes('accept NJP is:'));
    expect(sourceIdx).toBeGreaterThan(-1);
    // The source has 4 consecutive pure-underscore rule lines right after
    // the "accept NJP is:" line. Confirm the fixture assumption still holds,
    // then confirm renderNjpRights left every one of them untouched.
    for (let i = sourceIdx + 1; i <= sourceIdx + 4; i++) {
      expect(APPENDIX_A_1_D.text[i]).toMatch(/^_+$/);
    }

    const renderedIdx = lines.findIndex((l) => l.includes('accept NJP is:'));
    expect(renderedIdx).toBeGreaterThan(-1);
    for (let i = renderedIdx + 1; i <= renderedIdx + 4; i++) {
      expect(lines[i]).toMatch(/^_+$/);
    }
    expect(lines.join('\n')).not.toMatch(/extra dut|forfeiture|reduction|correctional custody/i);
  });

  it('A-1-d with authorityPayGrade O5: the four rules are replaced with the field-grade ceiling', () => {
    const { lines, designator } = renderNjpRights({
      ...base,
      offenses: twoOffenses,
      vesselException: false,
      authorityPayGrade: 'O5',
    });
    expect(designator).toBe('A-1-d');

    const renderedIdx = lines.findIndex((l) => l.includes('accept NJP is:'));
    expect(renderedIdx).toBeGreaterThan(-1);
    // The rule immediately after the anchor is no longer a pure-underscore
    // line: it carries the ceiling's lead sentence instead.
    expect(lines[renderedIdx + 1]).not.toMatch(/^_+$/);

    // Flowed rather than joined on '\n': the fill wraps to the appendix
    // measure, so a sentence can legitimately break across a line boundary.
    const text = lines.join(' ').replace(/\s+/g, ' ');
    expect(text).toContain('Correctional custody for not more than 30 consecutive days.');
    expect(text).toContain('for not more than 45 consecutive days.'); // extra duties
    expect(text).toContain('for not more than 60 consecutive days.'); // restriction
  });

  it('the A-1-d ceiling is stated as a maximum, never an imposed punishment: NjpRightsCase carries no finding', () => {
    // renderNjpRights has no access to item 5 (finding) or item 6 (imposed
    // punishment) - NjpRightsCase does not carry those fields at all, so
    // there is nothing for this function to leak. What IS observable is
    // that the ceiling text uses "not more than" / maximum-ceiling framing,
    // and that it is completely indifferent to anything about the offenses
    // beyond their presence: two cases differing ONLY in their offense list
    // produce byte-identical ceiling text, because the ceiling is a
    // function of authorityPayGrade/accusedPayGrade/accusedService alone.
    const caseA = renderNjpRights({
      ...base,
      offenses: [{ articleLabel: 'Article 92', summary: 'Failure to obey a lawful order.' }],
      vesselException: false,
      authorityPayGrade: 'O5',
    });
    const caseB = renderNjpRights({
      ...base,
      offenses: [
        { articleLabel: 'Article 128', summary: 'Assault.' },
        { articleLabel: 'Article 90', summary: 'Assaulting a superior commissioned officer.' },
      ],
      vesselException: false,
      authorityPayGrade: 'O5',
    });

    const ceilingOf = (lines: string[]) => {
      const start = lines.findIndex((l) => l.includes('accept NJP is:'));
      const end = lines.findIndex((l, i) => i > start && l.includes('4. Personal Appearance.'));
      return lines.slice(start + 1, end).join('\n');
    };

    const ceilingA = ceilingOf(caseA.lines);
    const ceilingB = ceilingOf(caseB.lines);
    expect(ceilingA).toBe(ceilingB);
    expect(ceilingA).toMatch(/not more than/);
    expect(ceilingA.toLowerCase()).not.toMatch(/guilty|not guilty|finding/);
  });

  it('every rendered A-1-d and A-1-c line stays within the appendix own printed width', () => {
    for (const vessel of [true, false]) {
      const appendix = selectRightsAppendix(vessel);
      const width = appendixWidth(appendix);
      const { lines } = renderNjpRights({
        ...base,
        offenses: twoOffenses,
        vesselException: vessel,
        authorityPayGrade: 'O5',
      });
      const over = lines.filter((l) => l.length > width);
      expect(over).toEqual([]);
    }
  });

  it('six or more offenses continues the lettering past E, F, G, ... following the UPB overflow convention', () => {
    const sevenOffenses = Array.from({ length: 7 }, (_, i) => ({
      articleLabel: `Article ${90 + i}`,
      summary: `Offense number ${i + 1}.`,
    }));
    const { lines, report } = renderNjpRights({
      ...base,
      offenses: sevenOffenses,
      vesselException: true,
    });
    expect(report.unmatched).toEqual([]);
    expect(report.noTarget).toEqual([]);
    expect(lines.some((l) => l.trim() === 'E. Article 94.')).toBe(true);
    expect(lines.some((l) => l.trim() === 'F. Article 95.')).toBe(true);
    expect(lines.some((l) => l.trim() === 'G. Article 96.')).toBe(true);
    expect(lines.some((l) => l.trim() === 'E. Offense number 5.')).toBe(true);
    expect(lines.some((l) => l.trim() === 'F. Offense number 6.')).toBe(true);
    expect(lines.some((l) => l.trim() === 'G. Offense number 7.')).toBe(true);
  });

  it('zero offenses does not throw, and leaves paragraph 1 note untouched, reported through the normal report path', () => {
    const { lines, report } = renderNjpRights({
      ...base,
      offenses: [],
      vesselException: true,
    });
    expect(report.unmatched).toEqual([]);
    expect(report.applied).not.toContain('offenses-notice');
    expect(lines.some((l) => l.includes('Here describe the offenses, including the UCMJ'))).toBe(true);
  });

  it('untouched lines outside the fill targets are byte-identical to the source appendix', () => {
    const { lines } = renderNjpRights({
      ...base,
      offenses: twoOffenses,
      vesselException: true,
    });
    const untouchedFromSource = [
      '                       ELECTION OF RIGHTS',
      '   a.   Lawyer.   (Check one or more, as applicable)',
      '(Signature of witness)                  (Signature of Accused)',
      '   b.   Personal appearance. (Check one)',
    ];
    for (const sourceLine of untouchedFromSource) {
      expect(APPENDIX_A_1_C.text).toContain(sourceLine);
      expect(lines).toContain(sourceLine);
    }
  });
});

describe('rightsHandFillBlanks', () => {
  const base: Omit<NjpRightsCase, 'offenses' | 'vesselException' | 'authorityPayGrade'> = {
    accusedRank: 'LCpl',
    accusedName: 'John A. Doe',
    unit: '3d Battalion, 5th Marines',
    accusedPayGrade: '',
  };
  const offensesWithSummary = [
    { articleLabel: 'Article 92', summary: 'Failure to obey a lawful order.' },
  ];

  it('includes the maximum-punishment blank for A-1-d when item 8A has no readable grade', () => {
    const blanks = rightsHandFillBlanks({
      ...base,
      offenses: offensesWithSummary,
      vesselException: false,
      authorityPayGrade: '',
    });
    const punishmentBlank = blanks.find((b) => b.item.includes('maximum punishment'));
    expect(punishmentBlank).toBeDefined();
    expect(punishmentBlank!.why).toContain('MCM Part V para 5.b');
  });

  it('omits the maximum-punishment blank for A-1-d once item 8A resolves to a level', () => {
    const blanks = rightsHandFillBlanks({
      ...base,
      offenses: offensesWithSummary,
      vesselException: false,
      authorityPayGrade: 'O5',
    });
    expect(blanks.some((b) => b.item.includes('maximum punishment'))).toBe(false);
  });

  it('does not include a maximum-punishment blank for A-1-c, regardless of item 8A', () => {
    const blanks = rightsHandFillBlanks({
      ...base,
      offenses: offensesWithSummary,
      vesselException: true,
      authorityPayGrade: '',
    });
    expect(blanks.some((b) => b.item.includes('maximum punishment'))).toBe(false);
  });

  it('includes election checkboxes and signature blocks for both variants', () => {
    for (const vesselException of [true, false]) {
      const blanks = rightsHandFillBlanks({
        ...base,
        offenses: offensesWithSummary,
        vesselException,
        authorityPayGrade: '',
      });
      expect(blanks.some((b) => b.item.toLowerCase().includes('checkbox'))).toBe(true);
      expect(blanks.some((b) => b.item.toLowerCase().includes('signature'))).toBe(true);
    }
  });

  it('includes paragraph 2, the evidentiary-basis note, citing MCM Part V para 4, when no offense has a summary', () => {
    const noSummaries = [{ articleLabel: 'Article 92', summary: '' }];
    for (const vesselException of [true, false]) {
      const blanks = rightsHandFillBlanks({
        ...base,
        offenses: noSummaries,
        vesselException,
        authorityPayGrade: '',
      });
      const paragraph2 = blanks.find((b) => b.item.includes('Paragraph 2'));
      expect(paragraph2).toBeDefined();
      expect(paragraph2!.why).toContain('MCM Part V para 4');
    }
  });

  it('omits the paragraph 2 blank once at least one offense carries a summary', () => {
    const blanks = rightsHandFillBlanks({
      ...base,
      offenses: offensesWithSummary,
      vesselException: true,
      authorityPayGrade: '',
    });
    expect(blanks.some((b) => b.item.includes('Paragraph 2'))).toBe(false);
  });
});

describe('renderNjpScript', () => {
  const baseCase = {
    offenses: [
      { articleLabel: 'Article 92', summary: 'Failure to obey a lawful order.' },
      { articleLabel: 'Article 86', summary: 'Unauthorized absence.' },
    ],
    findings: ['Article 92 and Article 86, both as alleged.'],
    punishmentImposed: 'Extra duty for 14 days and restriction for 14 days.',
    appealAuthority: 'Col R. Adams, Commanding Officer',
    appealAdvisor: 'the Legal Officer',
  };

  it('contains the offenses, the findings, the punishment, the appeal authority, and the advisor', () => {
    const { lines } = renderNjpScript(baseCase);
    const text = lines.join('\n');
    expect(text).toContain('Article 92. Failure to obey a lawful order.');
    expect(text).toContain('Article 86. Unauthorized absence.');
    expect(text).toContain('Article 92 and Article 86, both as alleged.');
    expect(text).toContain('Extra duty for 14 days and restriction for 14 days.');
    expect(text).toContain('Col R. Adams, Commanding Officer');
    expect(text).toContain('the Legal Officer');
  });

  it('every fill applies cleanly, no unmatched or no-target anchors', () => {
    const { report } = renderNjpScript(baseCase);
    expect(report.unmatched).toEqual([]);
    expect(report.noTarget).toEqual([]);
    expect(report.applied.length).toBe(5);
  });

  it('leaves every ACC and WIT rule blank: the count of blank-only ACC/WIT lines is unchanged', () => {
    const isBlankResponseLine = (l: string) =>
      (l.startsWith('ACC:') || l.startsWith('WIT:')) && /^(ACC|WIT): [_. ]*$/.test(l);

    const before = APPENDIX_A_1_F.text.filter(isBlankResponseLine);
    const { lines } = renderNjpScript(baseCase);
    const after = lines.filter(isBlankResponseLine);

    expect(after.length).toBe(before.length);
    expect(after).toEqual(before);
  });

  it('empty findings and empty punishment leave those rules blank', () => {
    const { lines, report } = renderNjpScript({
      ...baseCase,
      findings: [],
      punishmentImposed: '',
    });
    expect(report.applied).not.toContain('findings');
    expect(report.applied).not.toContain('punishment');

    const findingsSourceIdx = APPENDIX_A_1_F.text.findIndex((l) =>
      l.includes('I find that you have committed the following offenses:'),
    );
    const punishmentSourceIdx = APPENDIX_A_1_F.text.findIndex((l) =>
      l.includes('Accordingly, I impose the following punishment:'),
    );
    expect(APPENDIX_A_1_F.text[findingsSourceIdx + 2]).toMatch(/^_+$/);
    expect(APPENDIX_A_1_F.text[punishmentSourceIdx + 2]).toMatch(/^\s*_+\.$/);

    const findingsIdx = lines.findIndex((l) =>
      l.includes('I find that you have committed the following offenses:'),
    );
    const punishmentIdx = lines.findIndex((l) =>
      l.includes('Accordingly, I impose the following punishment:'),
    );
    expect(lines[findingsIdx + 2]).toMatch(/^_+$/);
    expect(lines[punishmentIdx + 2]).toMatch(/^\s*_+\.$/);
  });

  it('anti-reflow: every untouched source line survives verbatim and in order', () => {
    const { lines } = renderNjpScript(baseCase);

    // The invariant is NOT a fixed line count. A wrapped value legitimately
    // grows the document, which fillRule documents, and a cross-line
    // replaceInline span legitimately shrinks it. Asserting the count stayed
    // equal only held while fillRule mapped value lines one-to-one onto rule
    // slots, and that mapping was itself the defect: it split a wrapped
    // offense across the blank spacer between two rules.
    //
    // What must hold is that no line the fills did not touch was reworded,
    // re-indented, or reordered. So: untouched source lines appear verbatim
    // in the output, in the same relative order, as a subsequence.
    const touchedSubstrings = [
      'of the Uniform Code of Military Justice:',
      'I find that you have committed the following offenses:',
      'Accordingly, I impose the following punishment:',
      '(identify the superior authority by name and',
      'organizational title). Your appeal must be made within a',
      'will advise you more fully of',
    ];
    const untouched = APPENDIX_A_1_F.text.filter(
      (l) => !touchedSubstrings.some((sub) => l.includes(sub)) && !l.includes('_'),
    );

    let cursor = 0;
    const missing: string[] = [];
    for (const sourceLine of untouched) {
      const at = lines.indexOf(sourceLine, cursor);
      if (at === -1) missing.push(sourceLine);
      else cursor = at + 1;
    }
    expect(missing).toEqual([]);
  });
});

/**
 * Layout regressions, all three found by RENDERING both documents and reading
 * them rather than by asserting on substrings. Every one of these passed a
 * "the punishment text appears in the output" style assertion while the page
 * was visibly broken, which is why they get their own block.
 */
describe('fixed-width layout', () => {
  const twoOffenses = [
    {
      articleLabel: 'Art. 86  Absence without leave',
      summary: 'UA from 0730 to 1500, 14 Aug 26, H&S Bn, MCB Quantico.',
    },
    {
      articleLabel: 'Art. 92  Failure to obey general order or regulation',
      summary: 'ASO 5510.15E unreg weapon on base, 12 Aug 26.',
    },
  ];

  // Defect 1. The measure comes from the appendix at test time, never from a
  // literal, so a regenerated appendix keeps this test honest.
  it('keeps every rendered rights line inside the appendix measure', () => {
    for (const vessel of [true, false]) {
      const appendix = selectRightsAppendix(vessel);
      const width = appendixWidth(appendix);
      const { lines } = renderNjpRights({
        accusedRank: 'LCpl',
        accusedName: 'SNUFFY, JOHN A',
        unit: 'H&S BN, MCB QUANTICO',
        offenses: twoOffenses,
        vesselException: vessel,
        authorityPayGrade: 'O5',
        accusedPayGrade: 'E3',
      });
      const over = lines.filter((l) => l.length > width);
      expect(over).toEqual([]);
    }
  });

  it('keeps every rendered script line inside the appendix measure', () => {
    const width = appendixWidth(APPENDIX_A_1_F);
    const { lines } = renderNjpScript({
      offenses: twoOffenses,
      findings: ['A. Art. 86  Absence without leave. Guilty.'],
      punishmentImposed:
        'Extra du for 14 days, and restr to the limits of MCB Quantico for 14 days, w/o susp fr du, to run concurrently.',
      appealAuthority: 'Commanding Officer, Headquarters Battalion, Marine Corps Base Quantico',
      appealAdvisor: 'the Battalion Sergeant Major',
    });
    expect(lines.filter((l) => l.length > width)).toEqual([]);
  });

  // Defect 2. renderPunishment returns a string already ending in a period,
  // and the appendix rule carries its own. Both behaviours are right alone.
  it('never doubles a terminal period on the punishment line', () => {
    const withStop = renderNjpScript({
      offenses: twoOffenses,
      findings: [],
      punishmentImposed: 'Extra du for 14 days.',
      appealAuthority: 'CO, H&S Bn',
      appealAdvisor: 'the SgtMaj',
    });
    expect(withStop.lines.some((l) => l.includes('..'))).toBe(false);

    const withoutStop = renderNjpScript({
      offenses: twoOffenses,
      findings: [],
      punishmentImposed: 'Extra du for 14 days',
      appealAuthority: 'CO, H&S Bn',
      appealAdvisor: 'the SgtMaj',
    });
    expect(
      withoutStop.lines.some((l) => l.trim().endsWith('Extra du for 14 days.')),
    ).toBe(true);
  });

  // Defect 3, on the real appendix rather than a fixture.
  it('strands no sentence-ending period at the head of a line', () => {
    const { lines } = renderNjpScript({
      offenses: twoOffenses,
      findings: [],
      punishmentImposed: 'Extra du for 14 days.',
      appealAuthority: 'Commanding Officer, Headquarters Battalion, Marine Corps Base Quantico',
      appealAdvisor: 'the Battalion Sergeant Major',
    });
    expect(lines.filter((l) => /^\s+[.?!]/.test(l))).toEqual([]);
    // Assert on continuous text, never on a particular line break: the
    // authority fill re-wraps the sentence around it by design.
    const flowed = lines.join(' ').replace(/\s+/g, ' ');
    expect(flowed).toContain(
      'Marine Corps Base Quantico. Your appeal must be made within a reasonable time, which is normally 5 days.',
    );
  });
});

describe('wrapHanging preserves the text it wraps', () => {
  // Article labels carry a double space. Collapsing it rewrites a string
  // this module exists to reproduce exactly, and every content assertion
  // still passes while it happens.
  it('keeps an internal double space intact', () => {
    const out = wrapHanging('Art. 86  Absence without leave', 80);
    expect(out).toEqual(['Art. 86  Absence without leave']);
  });

  it('keeps the double space when the line wraps after it', () => {
    const out = wrapHanging('Art. 86  Absence without leave and more words here', 30);
    expect(out.join('\n')).toContain('Art. 86  Absence');
    expect(out.every((l) => l.length <= 30 || !l.includes(' '))).toBe(true);
  });

  it('renders the article label unaltered through the rights form', () => {
    const { lines } = renderNjpRights({
      accusedRank: 'LCpl',
      accusedName: 'SNUFFY, JOHN A',
      unit: 'H&S BN',
      offenses: [{ articleLabel: 'Art. 86  Absence without leave', summary: 'Short.' }],
      vesselException: true,
      authorityPayGrade: '',
      accusedPayGrade: '',
    });
    expect(lines.join('\n')).toContain('Art. 86  Absence without leave');
  });
});
