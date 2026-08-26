import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { createEmptyNavmc10132Data, type Navmc10132Offense } from '@/types/navmc';
import { resolveArticle } from '@/lib/navmc10132-utils';
import { mctfsNjpStatements } from '@/lib/navmc10132-mctfs';
import { unitDiaryBlock } from '@/lib/navmc10132-unit-diary';
import {
  WORKSHEET_WIDTH,
  fitProseLine,
  paginateBlocks,
  unitDiaryWorksheet,
  worksheetMetrics,
  renderUnitDiaryWorksheetPdf,
} from '@/lib/navmc10132-unit-diary-worksheet';
import { deriveBodySize } from '@/lib/monospace-pdf';

/**
 * The printed unit diary worksheet.
 *
 * WHAT THESE TESTS ARE FOR, given that the transactions themselves are
 * tested in navmc10132-mctfs.test.ts and the prose block in
 * navmc10132-unit-diary.test.ts. This module derives NOTHING. Its whole job
 * is that the page a clerk carries to the terminal says the same thing the
 * screen did, that nothing on it is cut, and that a transaction is not split
 * across a page break. So these assert the arrangement, not the content, and
 * the one content assertion below is deliberately a SAMENESS assertion
 * against the two source modules rather than a restatement of what they say.
 */

const AWOL =
  resolveArticle('Art. 86  Absence without leave')?.formLabel ?? 'Art. 86  Absence without leave';

function offenses(...rows: Partial<Navmc10132Offense>[]): Navmc10132Offense[] {
  const built: Navmc10132Offense[] = Array.from({ length: 5 }, () => ({
    articleLabel: '',
    summary: '',
    finding: '',
  }));
  rows.forEach((row, i) => {
    built[i] = { articleLabel: '', summary: '', finding: '', ...row };
  });
  return built;
}

/** A complete, ordinary case: one guilty offense, a forfeiture and extra duties. */
function complete(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    accusedName: 'Thompson, Jamal R',
    accusedRankGrade: 'Sgt/E-5',
    accusedEdipi: '1234567890',
    unit: 'HQSVCCo, 1st Bn, 3d Mar',
    punishmentDate: '2026-01-15',
    njpAuthorityEdipi: '9876543210',
    demand: 'I do not demand trial by court-martial.',
    counselOpportunity: 'I was afforded the opportunity to consult with counsel.',
    offenses: offenses({ articleLabel: AWOL, summary: 'UA 3 days', finding: 'Guilty' }),
    punishments: [
      { code: 'N04', dollarsPerMonth: '1500', months: '2' },
      { code: 'N09', days: '10' },
    ],
    punishmentsConcurrent: false,
    suspensions: [],
    ...overrides,
  } as unknown as FormData;
}

const { perPage } = worksheetMetrics();

describe('the sheet fits the page it is printed on', () => {
  // THE ASSERTION THAT MATTERS MOST HERE, and the one a substring check
  // cannot make. The renderer sizes type from the longest line and throws
  // below 7pt. A single over-measure line would take the whole download
  // down, and the line most likely to be over-measure is a TTC 212 carrying
  // three articles and four punishments, which runs past 110 characters
  // before it is wrapped.
  it('never emits a line past the measure, even on a full TTC 212', () => {
    const full = complete({
      offenses: offenses(
        { articleLabel: AWOL, summary: 'UA', finding: 'Guilty' },
        {
          articleLabel:
            resolveArticle('Art. 92  Failure to obey order or regulation')?.formLabel ?? '',
          summary: 'Order',
          finding: 'Guilty',
        },
        {
          articleLabel: resolveArticle('Art. 91  Insubordinate conduct')?.formLabel ?? '',
          summary: 'Insub',
          finding: 'Guilty',
        },
      ),
      punishments: [
        { code: 'N04', dollarsPerMonth: '1500', months: '2' },
        { code: 'N09', days: '10' },
        { code: 'N12', days: '30' },
        { code: 'N16', oralOrWritten: 'written' },
      ],
    });
    const sheet = unitDiaryWorksheet(full, perPage);
    const over = sheet.lines.filter((line) => line.length > WORKSHEET_WIDTH);
    expect(over).toEqual([]);
  });

  /**
   * FOUND ON A PRINTED SAMPLE, not by the assertion above it.
   *
   * The transcription aid block is built for the clipboard, where nothing
   * bounds a line, and was copied onto this sheet verbatim. An N11
   * restriction whose limits a commander wrote out in full printed to
   * column 96 on the very first sample page. Far enough past the measure and
   * the renderer throws instead of shrinking, which takes the download down
   * rather than producing an ugly page.
   *
   * The fixture below uses a limits string long enough to be unambiguous.
   * Commanders do write these out.
   */
  it('brings a long HIST line inside the measure instead of letting it run', () => {
    const wordy = complete({
      punishments: [
        {
          code: 'N11',
          limits: 'the barracks, the place of duty, the chow hall and the base gymnasium',
          days: '14',
        },
      ],
    });
    const sheet = unitDiaryWorksheet(wordy, perPage);
    expect(sheet.lines.filter((l) => l.length > WORKSHEET_WIDTH)).toEqual([]);
    // Wrapped, not truncated: the tail of the limits is still on the page.
    expect(sheet.lines.join('\n')).toContain('base gymnasium');
  });

  it('wraps a labelled aid line under its own label column, not back to zero', () => {
    const line = '  N11        ' + 'word '.repeat(30).trim();
    const out = fitProseLine(line);
    expect(out.length).toBeGreaterThan(1);
    expect(out[0].startsWith('  N11        ')).toBe(true);
    // Continuation sits under the value, not under the code.
    expect(out[1].startsWith(' '.repeat(13))).toBe(true);
    expect(out.every((l) => l.length <= WORKSHEET_WIDTH)).toBe(true);
  });

  it('leaves a line already inside the measure exactly as it stands', () => {
    expect(fitProseLine('MARINE      Doe, John A')).toEqual(['MARINE      Doe, John A']);
  });

  it('renders at a size the measure allows, so the renderer cannot throw on it', () => {
    const { bodySize } = worksheetMetrics();
    expect(bodySize).toBeGreaterThanOrEqual(7);
    // Derived from the MEASURE, not from any one case's content, so two
    // Marines' sheets are the same document.
    expect(bodySize).toBe(deriveBodySize(['x'.repeat(WORKSHEET_WIDTH)]));
  });
});

describe('the sheet says what the panel says', () => {
  it('carries every transaction the panel shows, in the same order', () => {
    const formData = complete();
    const statements = mctfsNjpStatements(formData).statements;
    const sheet = unitDiaryWorksheet(formData, perPage);
    const joined = sheet.lines.join('\n');

    expect(sheet.statementCount).toBe(statements.length);
    let cursor = -1;
    for (const statement of statements) {
      const at = joined.indexOf(statement.ttc, cursor + 1);
      expect(at, `${statement.ttc} missing or out of order`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  // MCTFSPRIUM 70503 wants the statistical information and all punishment
  // awarded on the TTC 268 history statement, and the prose block is that
  // text. A sheet without it is half a handoff.
  it('carries the HIST prose block verbatim', () => {
    const formData = complete();
    const joined = unitDiaryWorksheet(formData, perPage).lines.join('\n');
    for (const line of unitDiaryBlock(formData).text.split('\n')) {
      if (line.trim() === '') continue;
      expect(joined, `HIST line missing: ${line}`).toContain(line);
    }
  });

  it('carries each statement\'s PRIUM notes', () => {
    const formData = complete();
    const joined = unitDiaryWorksheet(formData, perPage).lines.join('\n').replace(/\s+/g, ' ');
    for (const statement of mctfsNjpStatements(formData).statements) {
      for (const note of statement.notes) {
        expect(joined, `note missing: ${note}`).toContain(note.replace(/\s+/g, ' '));
      }
    }
  });

  it('carries the follow-on reminders', () => {
    const formData = complete();
    const joined = unitDiaryWorksheet(formData, perPage).lines.join('\n').replace(/\s+/g, ' ');
    for (const reminder of mctfsNjpStatements(formData).reminders) {
      expect(joined).toContain(reminder.replace(/\s+/g, ' '));
    }
  });

  it('gives every transaction a check box and a number', () => {
    const sheet = unitDiaryWorksheet(complete(), perPage);
    const boxes = sheet.lines.filter((l) => /^\[ \] \d+\./.test(l));
    expect(boxes.length).toBe(sheet.statementCount);
  });

  /**
   * THE TRANSACTION NUMBER BELONGS TO THE STATEMENT LINE, NOT THE HEADER.
   *
   * Stephen, 2026-08-26: the app was showing a body that began at the date,
   * with the transaction number carried beside it, which is not a line
   * anybody can key. MCTFSPRIUM 70507.4 writes the template as one line
   * starting "TTC 056 000". Now that the text carries it, the header must
   * not repeat it, or the page prints it twice.
   */
  it('prints the transaction number once, on the line a clerk keys', () => {
    const formData = complete();
    const sheet = unitDiaryWorksheet(formData, perPage);
    for (const statement of mctfsNjpStatements(formData).statements) {
      const hits = sheet.lines.filter((l) => l.trim().startsWith(statement.ttc));
      expect(hits.length, `${statement.ttc} appears ${hits.length} times as a line head`).toBe(1);
    }
    // And the header carries the check box and the number only.
    expect(sheet.lines.some((l) => /^\[ \] 1\.\s+MCTFSPRIUM/.test(l))).toBe(true);
  });

  // Item 16 IS the unit diary entry, so the UD number this sheet produces
  // goes back onto the form. Asking for it on the page is what closes that
  // loop rather than leaving it to memory.
  it('asks for the UD number back, naming item 16', () => {
    const joined = unitDiaryWorksheet(complete(), perPage).lines.join('\n');
    expect(joined).toContain('UD number');
    expect(joined).toContain('item 16');
  });
});

describe('warnings reach the page, they do not stop it', () => {
  it('prints a blocker at the top and still produces a sheet', () => {
    // No guilty finding: mctfsNjpStatements blocks on it.
    const formData = complete({
      offenses: offenses({ articleLabel: AWOL, summary: 'UA', finding: 'Not Guilty' }),
    });
    const sheet = unitDiaryWorksheet(formData, perPage);
    expect(sheet.blockers.length).toBeGreaterThan(0);
    expect(sheet.lines.join('\n')).toContain('DO NOT ENTER THE TRANSACTIONS BELOW');
    // Still a sheet. A blocker the clerk cannot read because the download
    // refused is a blocker that does not work.
    expect(sheet.lines.length).toBeGreaterThan(20);
  });

  it('repeats the pending appeal caution', () => {
    const sheet = unitDiaryWorksheet(complete({ intendAppeal: 'I do intend to appeal.' }), perPage);
    expect(sheet.lines.join('\n')).toContain('PENDING APPEAL');
  });

  it('repeats the already reported warning with its UD number', () => {
    const sheet = unitDiaryWorksheet(
      complete({ finalAdminUd: '2026-014', finalAdminDtd: '2026-01-20' }),
      perPage,
    );
    const joined = sheet.lines.join('\n');
    expect(joined).toContain('ALREADY REPORTED');
    expect(joined).toContain('2026-014');
  });

  it('lists the data the form is missing, rather than only bracketing it', () => {
    const sheet = unitDiaryWorksheet(complete({ njpAuthorityEdipi: '' }), perPage);
    expect(sheet.missing.some((m) => m.includes('EDIPI'))).toBe(true);
    expect(sheet.lines.join('\n').replace(/\s+/g, ' ')).toContain('EDIPI');
  });
});

describe('paginateBlocks keeps a block whole', () => {
  it('pushes a block that would straddle a break onto the next page', () => {
    const blocks = [{ lines: ['a', 'b', 'c'] }, { lines: ['d', 'e', 'f'] }];
    // Page holds 4. The first block uses 3, the second needs 3, so 2 of it
    // would fall past the break.
    const out = paginateBlocks(blocks, 4);
    expect(out).toEqual(['a', 'b', 'c', '', 'd', 'e', 'f']);
  });

  it('does not pad when the block fits where it stands', () => {
    const out = paginateBlocks([{ lines: ['a'] }, { lines: ['b'] }], 4);
    expect(out).toEqual(['a', 'b']);
  });

  // Padding a block taller than a page would push a full sheet of blank
  // paper ahead of it and still split it.
  it('emits an over-page block as it stands', () => {
    const tall = { lines: ['a', 'b', 'c', 'd', 'e'] };
    expect(paginateBlocks([{ lines: ['x'] }, tall], 4)).toEqual(['x', 'a', 'b', 'c', 'd', 'e']);
  });

  /**
   * A sheet long enough that the padding has to fire.
   *
   * THE ONE-PAGE FIXTURE ABOVE CANNOT PROVE THIS. Its transactions happen to
   * fall clear of the breaks, so an assertion over it passes whether the
   * padding runs or not, which the differential caught: removing the padding
   * left that version of this test green. Five victims produce five TTC 212
   * 001 statements on top of everything else, which runs the sheet past
   * three pages and puts a block on a boundary.
   */
  function long(): FormData {
    return complete({
      victims: [
        { status: 'Military', sex: 'M', race: 'W', ethnicity: 'N' },
        { status: 'Civilian', sex: 'F', race: 'B', ethnicity: 'H' },
        { status: 'Military', sex: 'M', race: 'A', ethnicity: 'N' },
        { status: 'Civilian', sex: 'F', race: 'W', ethnicity: 'N' },
        { status: 'Military', sex: 'M', race: 'I', ethnicity: 'H' },
      ],
      punishments: [
        { code: 'N04', dollarsPerMonth: '1500', months: '2' },
        { code: 'N09', days: '10' },
        { code: 'N11', limits: 'the barracks', days: '14' },
        { code: 'N16', oralOrWritten: 'written' },
      ],
    });
  }

  /**
   * RUN AT A SHORT PAGE ON PURPOSE, and this is the second attempt at this
   * test. The first ran a real sheet at the real page height and asserted no
   * transaction straddled a break. It passed with the padding removed, which
   * its differential caught: at 59 lines a page these transactions happen to
   * fall clear of every break, so the assertion never had anything to catch.
   * Adding five victims to lengthen the sheet did not fix it either.
   *
   * `unitDiaryWorksheet` takes the page height as an argument, so the honest
   * fix is to hand it one short enough that breaks land inside the
   * transactions. Twenty lines puts a break inside almost every block, which
   * is what makes this an integration test of the padding rather than a
   * restatement of the fixture's luck.
   */
  const SHORT_PAGE = 20;

  it('never splits a transaction across a page, at a page height that forces breaks', () => {
    const sheet = unitDiaryWorksheet(long(), SHORT_PAGE);
    let checked = 0;
    sheet.lines.forEach((line, i) => {
      if (!/^\[ \] \d+\./.test(line)) return;
      checked += 1;
      // The label, a blank, and the statement itself. All three on one page.
      expect(Math.floor(i / SHORT_PAGE), `statement ${line} straddles a page`).toBe(
        Math.floor((i + 2) / SHORT_PAGE),
      );
    });
    // The assertion above is a no-op if nothing matched.
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it('pads rather than reflows, so no transaction text is lost to the padding', () => {
    const statements = mctfsNjpStatements(long()).statements;
    const joined = unitDiaryWorksheet(long(), SHORT_PAGE).lines.join('\n');
    for (const statement of statements) {
      expect(joined).toContain(statement.ttc);
    }
  });

  it('keeps a section heading on the same page as what it heads', () => {
    const sheet = unitDiaryWorksheet(complete(), perPage);
    const at = sheet.lines.findIndex((l) => l.startsWith('3. TRANSACTIONS'));
    expect(at).toBeGreaterThan(-1);
    const firstBox = sheet.lines.findIndex((l) => /^\[ \] 1\./.test(l));
    expect(firstBox).toBeGreaterThan(at);
    expect(Math.floor(at / perPage)).toBe(Math.floor(firstBox / perPage));
  });
});

describe('the rendered PDF', () => {
  it('produces a real document named for the Marine', async () => {
    const sheet = await renderUnitDiaryWorksheetPdf(complete());
    expect(sheet.bytes.length).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(sheet.bytes.slice(0, 5))).toBe('%PDF-');
    expect(sheet.pageCount).toBeGreaterThanOrEqual(1);
    expect(sheet.filename).toBe('unit-diary-worksheet-thompson-jamal-r.pdf');
  }, 60000);

  it('falls back to a neutral name when the form carries no name', async () => {
    const sheet = await renderUnitDiaryWorksheetPdf(complete({ accusedName: '' }));
    expect(sheet.filename).toBe('unit-diary-worksheet-njp.pdf');
  }, 60000);

  // Every substitution the sanitizer makes is reported. A normal sheet needs
  // none, and one that does means a character reached the page that Courier
  // cannot draw.
  it('needs no character substitutions on an ordinary case', async () => {
    const sheet = await renderUnitDiaryWorksheetPdf(complete());
    expect(sheet.replaced).toEqual([]);
  }, 60000);
});
