/**
 * The hearing worksheet: the punishment menu and the forfeiture ceilings the
 * A-1-f script carries, and the same ceilings on screen.
 *
 * STEPHEN'S WORKFLOW, 2026-08-26, verbatim: "The script will be printed and
 * provided to the co. Once the event is done that take that and upload the
 * form where they will then add the punishments and suspensions." The script
 * is a WORKING DOCUMENT. Item 6 is empty when it prints, and the clerk
 * transcribes the marked paper afterwards.
 *
 * HIS TWO RULINGS the same day: print the app-computed ceilings on the paper
 * labeled as app output, and show the maximum at the current grade AND at
 * each reduced grade with the reduced one marked operative.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { punishmentMenu, menuLine, forfeitureCeilingBlock } from '@/lib/njp-hearing-worksheet';
import { SECTION_HOLDING_EXTRA_PAY } from '@/lib/navmc10132-basic-pay';
import { forfeitureLadder } from '@/lib/navmc10132-forfeiture-ladder';
import { buildScriptCase, scriptWorksheetGaps, scriptForfeitureLadder } from '@/lib/njp-package';
import { renderNjpScript, punishmentRuleBudget } from '@/lib/njp-a1-script';
import { APPENDIX_A_1_F } from '@/lib/jagman-appendix-a1';
import { appendixWidth } from '@/lib/jagman-a1-wrap';
import { resolvePunishment } from '@/lib/navmc10132-punishments';
import { PunishmentSection } from '@/components/letter/navmc10132/PunishmentSection';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import { FormData } from '@/types';

const DATE = '2026-08-20';
const OFFENSE = { articleLabel: 'Art. 91  Insubordinate conduct', summary: 'Disrespect.', finding: '' };

function doc(o: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    offenses: [OFFENSE],
    accusedName: 'THOMPSON, JAMAL R',
    accusedRankGrade: 'Cpl, E4',
    accusedPayGrade: 'E4',
    accusedYearsOfService: '4',
    punishmentDate: DATE,
    punishments: [],
    ...o,
  } as unknown as FormData;
}

// ---------------------------------------------------------------------------
// The menu
// ---------------------------------------------------------------------------

describe('the menu is derived from the punishment table, not hand-authored', () => {
  it('blanks every parameter of a code template', () => {
    const line = menuLine(resolvePunishment('N11')!);
    expect(line.label).toBe('[ ] N11  ');
    expect(line.body).toContain('Restr to the limits of ______ for ___ days');
    expect(line.body).not.toContain('{');
  });

  // The template writes money as `${dollars}`, so a blank carrying its own
  // sign printed "$$______" on the first render of this page.
  it('prints one dollar sign on a money blank, not two', () => {
    expect(menuLine(resolvePunishment('N07')!).body).toContain('$______');
    expect(menuLine(resolvePunishment('N07')!).body).not.toContain('$$');
    expect(menuLine(resolvePunishment('N04')!).body).not.toContain('$$');
  });

  // A choice between two fixed wordings is not a value, so the paper offers
  // both and the commanding officer rings one.
  it('offers the two suspension wordings rather than a blank', () => {
    expect(menuLine(resolvePunishment('N06')!).body).toContain('w/ or w/o susp fr du');
    expect(menuLine(resolvePunishment('N16')!).body).toContain('orally / in writing');
  });

  it('carries the code own statutory cap', () => {
    expect(menuLine(resolvePunishment('N09')!).body).toContain('max 14 d');
    expect(menuLine(resolvePunishment('N07')!).body).toContain("max 7 d pay");
    expect(menuLine(resolvePunishment('N04')!).body).toContain('see ceiling below');
  });
});

describe('the reduction line names the one lawful target', () => {
  /**
   * "There can only be a reduction of one rank", Stephen, 2026-08-26. A bare
   * blank invites a commanding officer to write a grade two down, and the
   * clerk is then holding a signed page the app will refuse to record.
   */
  /** One menu entry with its wrapped continuations, joined back together. */
  const entry = (menu: string[], code: string): string => {
    const at = menu.findIndex((line) => line.includes(code));
    if (at < 0) return '';
    const rest: string[] = [];
    for (let i = at + 1; i < menu.length && !menu[i].startsWith('[ ]'); i += 1) rest.push(menu[i].trim());
    return [menu[at], ...rest].join(' ');
  };

  it('names the next inferior grade and its rank beside N08', () => {
    const n08 = entry(punishmentMenu('O5', { payGrade: 'E4' }), 'N08');
    expect(n08).toContain('next inferior grade only');
    expect(n08).toContain('LCpl');
    expect(n08).toContain('E3');
  });

  it('leaves the target unnamed when item 19 carries no grade', () => {
    const n08 = entry(punishmentMenu('O5'), 'N08');
    expect(n08).not.toBe('');
    expect(n08).not.toContain('next inferior grade only');
  });

  // MCO 5800.16 Vol 14 para 010302.C: a Marine at E-6 or above may not be
  // reduced at all. A checkbox for a punishment nobody may impose on THIS
  // accused is the worst line the page could carry.
  it('drops the reduction line entirely for an accused who cannot be reduced', () => {
    const menu = punishmentMenu('O5', { payGrade: 'E6' }).join('\n');
    expect(menu).not.toContain('N08');
    expect(menu).toContain('N09');
  });

  it('keeps it for a Navy E-6, whose floor is one grade higher', () => {
    const menu = punishmentMenu('O5', { payGrade: 'E6', service: 'USN' }).join('\n');
    expect(menu).toContain('N08');
  });
});

describe('the menu is filtered by item 8A', () => {
  it('a field-grade authority is offered the field-grade codes', () => {
    const menu = punishmentMenu('O5').join('\n');
    expect(menu).toContain('N04');
    expect(menu).toContain('N12');
    expect(menu).toContain('N15');
  });

  /**
   * THE ONE-DIRECTION SAFETY RULE. A company-grade commander handed a
   * field-grade menu has been invited to impose beyond the authority. The
   * reverse, a field-grade commander seeing a shorter list, costs nothing.
   */
  it('a company-grade authority is offered none of the field-grade codes', () => {
    const menu = punishmentMenu('O3').join('\n');
    expect(menu).toContain('N06');
    expect(menu).toContain('N11');
    expect(menu).not.toContain('N04');
    expect(menu).not.toContain('N12');
    expect(menu).not.toContain('N13');
    expect(menu).not.toContain('N14');
    expect(menu).not.toContain('N15');
  });

  it('prints NO menu at all when item 8A is unset or unreadable', () => {
    expect(punishmentMenu('')).toEqual([]);
    expect(punishmentMenu('   ')).toEqual([]);
    expect(punishmentMenu('Colonel')).toEqual([]);
  });

  // The NAVMC 10132 is an enlisted record.
  it('never offers an officer-only code', () => {
    const menu = punishmentMenu('O5').join('\n');
    for (const code of ['N01', 'N02', 'N03']) expect(menu).not.toContain(code);
  });
});

describe('the menu fits the appendix measure', () => {
  it('every line is inside the rule budget', () => {
    for (const line of punishmentMenu('O5')) {
      expect(line.length).toBeLessThanOrEqual(punishmentRuleBudget());
    }
  });

  // A continuation wrapped flush at the margin reads as a second item with
  // no checkbox.
  it('hangs a wrapped continuation under its own text, not at the margin', () => {
    const wrapped = punishmentMenu('O5').filter((line) => !line.startsWith('[ ]'));
    expect(wrapped.length).toBeGreaterThan(0);
    for (const line of wrapped) expect(line).toMatch(/^ {9}\S/);
  });

  /**
   * THE SAME ASSERTION ON THE RENDERED PAGE, and the reason this file has
   * both. The version above passed while the printed page was flush at the
   * margin, because the indent survived punishmentMenu and was stripped
   * afterwards: fitToRule re-wrapped every line, and wrapHanging builds its
   * first line as `labelPrefix + tokens[0].word`, dropping that token's own
   * leading separator. A test of the producer cannot see what the consumer
   * undoes. Proven by deleting the pass-through in fitToRule and watching
   * THIS red while the one above stays green.
   */
  it('keeps the hang after the appendix filler has written the lines', () => {
    const { lines } = renderNjpScript(buildScriptCase(doc({ njpAuthorityPayGrade: 'O5' })));
    const at = lines.findIndex((line) => line.includes('Accordingly, I impose'));
    const block = lines.slice(at + 1, at + 40);
    const continuations = block.filter((line) => /^ {6} +\S/.test(line) && !line.includes('[ ]'));
    const hung = continuations.filter((line) => /^ {15}\S/.test(line));
    expect(hung.length).toBeGreaterThan(0);
    // Every menu continuation, not merely one: the appendix indent is 6 and
    // the checkbox label "[ ] Nxx  " is 9 wide.
    const menuContinuations = block.filter((line) => /^ {6}(w\/|fr du|forf |susp |d\)|\d+ d\))/.test(line));
    expect(menuContinuations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The ceilings
// ---------------------------------------------------------------------------

describe('the printed ceiling block', () => {
  const ladder = () => forfeitureLadder({ payGrade: 'E4', yearsOfService: '4', punishmentDate: DATE });

  // ONE GRADE DOWN. "There can only be a reduction of one rank", Stephen,
  // 2026-08-26, and MCO 5800.16 Vol 14 para 010302.C agrees.
  it('names the current grade and the one grade a reduction may reach', () => {
    const block = forfeitureCeilingBlock(ladder()).join('\n');
    expect(block).toContain('At E4 now');
    expect(block).toContain('If red to E3');
    expect(block).not.toContain('If red to E2');
    expect(block).not.toContain('If red to E1');
  });

  // Stephen ruled: print them, labeled as app-computed. A commanding officer
  // reading a dollar figure at a hearing is entitled to know it came from a
  // pay table this app holds rather than from the Manual.
  it('says on its face that it is app output and names the table', () => {
    const block = forfeitureCeilingBlock(ladder()).join('\n');
    expect(block).toContain('App output, not JAGMAN text');
    expect(block).toContain('DFAS basic pay table effective');
  });

  it('states the 5.c(8) rule the ladder exists to serve', () => {
    expect(forfeitureCeilingBlock(ladder()).join('\n')).toContain('MCM Part V para 5.c(8)');
  });

  // A worksheet with no ceiling and no reason reads as a worksheet with no
  // LIMIT, which is the most dangerous thing this page could say.
  //
  // THE FIXTURE CHANGED, THE RULE DID NOT. This used to withhold the date,
  // which no longer stops the figures computing after Stephen's 2026-08-27
  // ruling. An unset length of service is a real "cannot compute", because
  // basic pay is fixed by grade AND length of service and one of them is
  // genuinely missing.
  it('prints the reason rather than nothing when it cannot compute', () => {
    const none = forfeitureCeilingBlock(
      forfeitureLadder({ payGrade: 'E4', yearsOfService: '', punishmentDate: DATE }),
    ).join('\n');
    expect(none).toContain('not computed');
    expect(none).not.toContain('At E4 now');
  });

  /**
   * THE WHOLE REASON THIS COMMIT EXISTS. Every A-1-f script is generated
   * BEFORE the hearing, so item 6 carries no punishment date when one is
   * printed. Under the old rule that meant no script this app ever produced
   * showed a ceiling, which is what Stephen was looking at when he ruled:
   * "calculating the possibly max forf from the table based on the YOS and
   * the grade should not require anything but the two elements."
   */
  it('prints the figures on an undated worksheet, labelled as a planning figure', () => {
    const undated = forfeitureCeilingBlock(
      forfeitureLadder({ payGrade: 'E4', yearsOfService: '4', punishmentDate: '' }),
    ).join('\n');

    expect(undated).toContain('At E4 now');
    expect(undated).toContain('If red to E3');
    expect(undated).not.toContain('not computed');
    // Labelled, so nobody reads a planning maximum as a vouched ceiling.
    expect(undated).toContain('MAXIMUM FORFEITURE (PLANNING FIGURE)');
    expect(undated).toContain('planning maximum');

    // AND NOT CONTRADICTING ITSELF. payTableStatus's detail is spliced into
    // this caveat, and it used to read "it cannot be computed without it",
    // which then printed directly under the figures it said did not exist.
    // The line-wrapping makes this a whitespace-insensitive match.
    const flat = undated.replace(/\s+/g, ' ');
    expect(flat).not.toContain('cannot be computed without it');
    expect(flat).not.toContain('No ceiling is computed');
  });

  it('drops the planning label once the punishment date is set', () => {
    const dated = forfeitureCeilingBlock(ladder()).join('\n');
    expect(dated).toContain('MAXIMUM FORFEITURE');
    expect(dated).not.toContain('PLANNING FIGURE');
    expect(dated).not.toContain('planning maximum');
  });

  it('says a reduction is barred instead of citing 5.c(8) at a barred grade', () => {
    const barred = forfeitureCeilingBlock(
      forfeitureLadder({ payGrade: 'E7', yearsOfService: '14', punishmentDate: DATE }),
    ).join('\n');
    expect(barred).toContain('reduction is barred');
    expect(barred).not.toContain('5.c(8)');
  });
});

// ---------------------------------------------------------------------------
// The whole page
// ---------------------------------------------------------------------------

describe('the rendered A-1-f page', () => {
  const ready = () => doc({ njpAuthorityPayGrade: 'O5' });

  it('fills every anchor with the worksheet in place', () => {
    expect(renderNjpScript(buildScriptCase(ready())).report.unmatched).toEqual([]);
  });

  it('holds every line inside the appendix measure, ceilings included', () => {
    const { lines } = renderNjpScript(buildScriptCase(ready()));
    const width = appendixWidth(APPENDIX_A_1_F);
    expect(lines.filter((line) => line.length > width)).toEqual([]);
  });

  it('carries the menu and the ceilings under the punishment sentence', () => {
    const { lines } = renderNjpScript(buildScriptCase(ready()));
    const at = lines.findIndex((line) => line.includes('Accordingly, I impose'));
    const after = lines.slice(at).join('\n');
    expect(after).toContain('[ ] N11');
    expect(after).toContain('MAXIMUM FORFEITURE');
    expect(after).toContain('At E4 now');
  });

  /**
   * STEPHEN, 2026-08-27, closing the pay-and-service split: "ensure this is
   * shown on the NJP proceeding script (JAGMAN Appendix A-1-f)."
   *
   * The block printed here already. What was NOT asserted is that the page
   * carries BOTH rungs and the actual figures, rather than a heading and a
   * single row. A commanding officer choosing a reduction and a forfeiture
   * together needs the reduced grade's number on the paper in front of him,
   * because MCM Part V para 5.c(8) makes it the lawful basis and it is
   * always the smaller one.
   *
   * ASSERTED AGAINST THE LADDER, not against literals. Hard-coding $853 here
   * would make this test a second, staler copy of the pay table: a DFAS
   * republication would red it for the wrong reason, and the number it
   * defends would be the old one.
   */
  it('prints both rungs and the real figures on the page', () => {
    const { lines } = renderNjpScript(buildScriptCase(ready()));
    const page = lines.join('\n');
    const rungs = scriptForfeitureLadder(ready()).rungs;
    expect(rungs).toHaveLength(2);

    const money = (value: number) => `$${value.toLocaleString('en-US')}`;
    for (const rung of rungs) {
      expect(page).toContain(money(rung.ceiling.sevenDaysPay));
      expect(page).toContain(money(rung.ceiling.halfMonthPay));
    }
    expect(page).toContain(`If red to ${rungs[1].ceiling.payGrade}`);
    // The reduced rung is the smaller figure. Two rows printing the same
    // number would satisfy every assertion above.
    expect(rungs[1].ceiling.sevenDaysPay).toBeLessThan(rungs[0].ceiling.sevenDaysPay);
  });

  /**
   * THE PRINTED SENTENCE POINTS AT A CARD THAT EXISTS. This note used to
   * read "enter that pay beside item 19", which was true until the two
   * off-form inputs moved into their own card on 2026-08-27. A clerk at a
   * hearing, holding paper, cannot be sent to a box that is no longer there.
   * Pinned to the constant rather than to a literal so the two cannot drift.
   */
  it('names the card that holds sea and hardship duty pay', () => {
    const page = renderNjpScript(buildScriptCase(ready())).lines.join('\n');
    // Wrapped to the appendix measure, so match on the words, not the line.
    expect(page.replace(/\s+/g, ' ')).toContain(SECTION_HOLDING_EXTRA_PAY);
    expect(page).not.toContain('beside item 19');
  });

  /**
   * MUTUALLY EXCLUSIVE BY DESIGN. A record copy of a completed proceeding
   * states what was imposed. A menu of unchosen options printed under that
   * sentence would contradict it.
   */
  it('drops the menu entirely once a punishment is recorded', () => {
    const after = renderNjpScript(
      buildScriptCase(
        doc({ njpAuthorityPayGrade: 'O5', punishments: [{ code: 'N09', days: '10' }] }),
      ),
    ).lines.join('\n');
    expect(after).toContain('Extra du for 10 days');
    expect(after).not.toContain('[ ] N11');
    expect(after).not.toContain('MAXIMUM FORFEITURE');
  });

  // THE GUARD ITSELF, not only its effect. njp-a1-script.ts prefers
  // `punishmentImposed` whenever it is set, so removing this guard changes
  // no rendered page and no page-level test can see it. A case object
  // carrying a menu it will never print is still wrong: the next reader of
  // NjpScriptCase would reasonably print both.
  it('builds a case with no options and no ceilings once a punishment exists', () => {
    const built = buildScriptCase(
      doc({ njpAuthorityPayGrade: 'O5', punishments: [{ code: 'N09', days: '10' }] }),
    );
    expect(built.punishmentImposed).not.toBe('');
    expect(built.punishmentOptions).toEqual([]);
    expect(built.ceilingBlock).toEqual([]);
  });

  it('still renders with no menu and no ceilings, as the bare appendix', () => {
    const { report, lines } = renderNjpScript(buildScriptCase(doc({ njpAuthorityPayGrade: '' })));
    expect(report.unmatched).toEqual([]);
    expect(lines.join('\n')).not.toContain('[ ]');
  });
});

describe('scriptWorksheetGaps tells the clerk what to set', () => {
  it('is empty when the menu and the ceilings will both print', () => {
    expect(scriptWorksheetGaps(doc({ njpAuthorityPayGrade: 'O5' }))).toEqual([]);
  });

  it('names item 8A when the menu cannot be filtered', () => {
    expect(scriptWorksheetGaps(doc()).join(' ')).toContain('item 8A');
  });

  it('names the item 6 date when the pay table cannot be selected', () => {
    const gaps = scriptWorksheetGaps(doc({ njpAuthorityPayGrade: 'O5', punishmentDate: '' }));
    expect(gaps.join(' ')).toContain('item 6 punishment date');
  });

  // None of these stops the script printing. A-1-f without a menu is still
  // the appendix, and the commanding officer still needs the paper.
  it('never blocks generation, which readiness alone decides', () => {
    expect(scriptWorksheetGaps(doc()).length).toBeGreaterThan(0);
    expect(() => buildScriptCase(doc())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// The panel on screen
// ---------------------------------------------------------------------------

function StubSectionCard({ title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function show(formData: FormData) {
  return render(
    <PunishmentSection formData={formData} setFormData={vi.fn()} SectionCard={StubSectionCard} />,
  );
}

describe('the ladder on screen', () => {
  it('shows the accused grade and the one grade a reduction may reach', () => {
    show(doc());
    expect(screen.getByText('Maximum forfeiture by grade')).toBeInTheDocument();
    expect(screen.getByText('E4')).toBeInTheDocument();
    expect(screen.getByText('if reduced to E3')).toBeInTheDocument();
    expect(screen.getByText('$1,829')).toBeInTheDocument();
    expect(screen.getByText('$1,599')).toBeInTheDocument();
    // A row for E-2 or E-1 prices a reduction no Marine commander may
    // impose, MCO 5800.16 Vol 14 para 010302.C.
    expect(screen.queryByText('if reduced to E2')).not.toBeInTheDocument();
    expect(screen.queryByText('if reduced to E1')).not.toBeInTheDocument();
  });

  it('marks the accused own grade as the basis before a reduction is recorded', () => {
    show(doc());
    const row = screen.getByText('E4').closest('tr');
    expect(row?.textContent).toContain('this forfeiture');
  });

  it('moves the marking to the reduced grade once a reduction is recorded', () => {
    show(doc({ punishments: [{ code: 'N08', gradeReducedTo: 'LCpl' }] }));
    const reduced = screen.getByText('if reduced to E3').closest('tr');
    expect(reduced?.textContent).toContain('this forfeiture');
    expect(screen.getByText('E4').closest('tr')?.textContent).not.toContain('this forfeiture');
  });

  // Never render an absent ceiling as an absent LIMIT.
  it('says a limit still applies when it cannot compute one', () => {
    show(doc({ accusedPayGrade: '' }));
    expect(screen.getByText(/Maximum forfeiture: not computed/)).toBeInTheDocument();
    expect(screen.getByText(/A limit still applies/)).toBeInTheDocument();
  });
});
