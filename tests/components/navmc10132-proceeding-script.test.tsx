/**
 * JAGMAN Appendix A-1-f, the commanding officer's NJP proceeding script:
 * that it is reachable, what it announces, and what it deliberately leaves
 * blank.
 *
 * WHY THIS FILE EXISTS AT ALL. `src/lib/njp-a1-script.ts` was written,
 * tested and correct, and was imported by NO component - only by its own
 * tests. Every unit test passed and no user could ever produce the
 * document. Stephen found it by looking at the app, on 2026-08-26: "We
 * never added in the script." `njp-a1-rights.ts` had been in the identical
 * state before its own button landed, so this is the second instance of one
 * failure mode, not a one-off.
 *
 * The first describe block below is therefore a REACHABILITY GUARD, not a
 * behaviour test. A renderer no component calls is dead code with a green
 * suite over it, and a unit test of the renderer cannot see the difference.
 * The guard is proven against synthetic source, on the same principle as
 * tests/navmc10132-stage-seeding-guard.ts: a guard whose own coverage is
 * never measured is the next bug.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { render, screen } from '@testing-library/react';
import { PunishmentSection } from '@/components/letter/navmc10132/PunishmentSection';
import {
  njpScriptReadiness,
  announcedFindings,
  announcedPunishment,
  buildScriptCase,
  renderNjpProceedingScript,
  NjpPackageError,
} from '@/lib/njp-package';
import { renderNjpScript } from '@/lib/njp-a1-script';
import { APPENDIX_A_1_F } from '@/lib/jagman-appendix-a1';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import { FormData } from '@/types';

// ---------------------------------------------------------------------------
// Reachability
// ---------------------------------------------------------------------------

const SRC_DIR = join(__dirname, '..', '..', 'src');

/** Every .ts/.tsx file under `dir`, as [relative path, source] pairs. */
function sourceFiles(dir: string, base = dir): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full, base));
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      out.push([full.slice(base.length + 1).replace(/\\/g, '/'), readFileSync(full, 'utf8')]);
    }
  }
  return out;
}

/** Files under src/ naming `symbol`, excluding the file defining it. */
export function callersOf(
  files: ReadonlyArray<[string, string]>,
  symbol: string,
  definedIn: string,
): string[] {
  return files
    .filter(([path]) => path !== definedIn)
    .filter(([, src]) => new RegExp(`\\b${symbol}\\b`).test(src))
    .map(([path]) => path);
}

/** Whether any OTHER file under src/ imports the module at `path`. */
export function importedElsewhere(
  files: ReadonlyArray<[string, string]>,
  path: string,
): boolean {
  const specifier = `@/${path.replace(/\.tsx?$/, '')}`;
  return files.some(([other, src]) => other !== path && src.includes(specifier));
}

/**
 * Components naming `symbol` that are THEMSELVES imported by another file.
 *
 * The weaker check - "some file under components/ names it" - is satisfied
 * by an orphan button file sitting in the components tree calling a
 * renderer nobody calls, which is a longer version of the same bug. Proven
 * below by deleting the mount and watching this red.
 */
export function mountedCallersOf(
  files: ReadonlyArray<[string, string]>,
  symbol: string,
  definedIn: string,
): string[] {
  return callersOf(files, symbol, definedIn)
    .filter((path) => path.startsWith('components/'))
    .filter((path) => importedElsewhere(files, path));
}

describe('the A-1-f renderer is reachable from the UI', () => {
  const files = sourceFiles(SRC_DIR);

  // The exact failure Stephen reported. renderNjpProceedingScript can be
  // fully correct and fully unreachable at the same time.
  it('a mounted component imports renderNjpProceedingScript, not only a test', () => {
    expect(mountedCallersOf(files, 'renderNjpProceedingScript', 'lib/njp-package.ts'))
      .not.toHaveLength(0);
  });

  it('the button is mounted by a section, not left as an orphan file', () => {
    const callers = callersOf(
      files,
      'ProceedingScriptButton',
      'components/letter/navmc10132/ProceedingScriptButton.tsx',
    );
    expect(callers).toContain('components/letter/navmc10132/PunishmentSection.tsx');
  });

  // The rights advisement was in this same state once. Asserting it beside
  // the script is what makes this a rule about A-1 generators rather than a
  // note about one of them.
  it('the same holds for the rights advisement, the first instance of this bug', () => {
    expect(mountedCallersOf(files, 'renderRightsElection', 'lib/njp-package.ts'))
      .not.toHaveLength(0);
  });

  // Proving the tightened rule catches the shape the loose one missed: a
  // button file under components/ that calls the renderer and is imported
  // by nothing is exactly the state the script shipped in.
  it('an orphan component calling the renderer does NOT count as reachable', () => {
    const orphaned: Array<[string, string]> = [
      ['components/Orphan.tsx', 'import { renderNjpProceedingScript } from "@/lib/njp-package";'],
      ['components/Other.tsx', 'const x = 1;'],
    ];
    expect(callersOf(orphaned, 'renderNjpProceedingScript', 'lib/njp-package.ts'))
      .toEqual(['components/Orphan.tsx']);
    expect(mountedCallersOf(orphaned, 'renderNjpProceedingScript', 'lib/njp-package.ts'))
      .toEqual([]);
  });

  // Proving the scanner: a symbol no source names must come back empty, or
  // the two assertions above pass on any input and guard nothing.
  it('the scanner returns nothing for a symbol that appears nowhere', () => {
    expect(callersOf(files, 'renderNjpProceedingScriptXYZZY', 'lib/njp-package.ts')).toEqual([]);
  });

  it('the scanner matches whole words, so a prefix does not count as a caller', () => {
    const synthetic: Array<[string, string]> = [
      ['components/A.tsx', 'renderNjpProceedingScriptLater();'],
      ['components/B.tsx', 'import { renderNjpProceedingScript } from "@/lib/njp-package";'],
    ];
    expect(callersOf(synthetic, 'renderNjpProceedingScript', 'lib/njp-package.ts'))
      .toEqual(['components/B.tsx']);
  });
});

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

function doc(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    accusedName: 'THOMPSON, JAMAL R',
    accusedRankGrade: 'Cpl, E4',
    unit: 'H&S BN, MCB QUANTICO',
    offenses: [],
    punishments: [],
    ...overrides,
  } as unknown as FormData;
}

const AWOL = { articleLabel: 'Art. 86  Absence without leave', summary: 'UA 14 Aug 26.' };
const DISRESPECT = { articleLabel: 'Art. 91  Insubordinate conduct', summary: 'Disrespect to a SNCO.' };

describe('readiness: the script needs the charge and nothing else', () => {
  it('is ready on one charged offense alone', () => {
    expect(njpScriptReadiness(doc({ offenses: [AWOL] }))).toEqual({ ready: true, missing: [] });
  });

  it('is not ready with no charged offense, and names item 1', () => {
    const r = njpScriptReadiness(doc());
    expect(r.ready).toBe(false);
    expect(r.missing.join(' ')).toContain('item 1');
  });

  it('a row with prose but no article is mid-entry, not a charge', () => {
    expect(njpScriptReadiness(doc({ offenses: [{ articleLabel: '', summary: 'Something.' }] })).ready)
      .toBe(false);
  });

  // The deliberate difference from the rights advisement. The commanding
  // officer reads A-1-f IN ORDER TO reach the finding and the punishment, so
  // requiring either would make the script producible only after the hearing
  // it exists to conduct.
  it('does NOT require a finding or a punishment', () => {
    expect(njpScriptReadiness(doc({ offenses: [AWOL], punishments: [] })).ready).toBe(true);
  });

  // The advisement identifies the Marine it is served ON; the script is read
  // TO a Marine already standing there.
  it('does NOT require the accused name, rank or unit, unlike A-1-c/A-1-d', () => {
    const bare = doc({ offenses: [AWOL], accusedName: '', accusedRankGrade: '', unit: '' });
    expect(njpScriptReadiness(bare)).toEqual({ ready: true, missing: [] });
  });
});

// ---------------------------------------------------------------------------
// What is announced
// ---------------------------------------------------------------------------

describe('only a guilty finding is announced', () => {
  it('announces a Guilty row', () => {
    const lines = announcedFindings(doc({ offenses: [{ ...AWOL, finding: 'Guilty' }] }));
    expect(lines).toEqual(['Art. 86  Absence without leave. UA 14 Aug 26.']);
  });

  // The anchor sentence is "I find that you have committed the following
  // offenses". A Not Guilty row printed under it announces the opposite of
  // the finding recorded in item 5.
  it('drops a Not Guilty row rather than listing it under the guilty sentence', () => {
    const lines = announcedFindings(
      doc({ offenses: [{ ...AWOL, finding: 'Guilty' }, { ...DISRESPECT, finding: 'Not Guilty' }] }),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Art. 86');
  });

  it('announces nothing before item 5 is filled in, leaving the rule blank', () => {
    expect(announcedFindings(doc({ offenses: [AWOL, DISRESPECT] }))).toEqual([]);
  });

  /**
   * THE INDEX BUG, caught here before it shipped. The first version walked
   * chargedOffenses() and read `finding` out of formData.offenses at the
   * FILTERED index. With a blank row in the middle, every finding shifts up
   * one and the commander announces guilt on the wrong charge.
   */
  it('reads each finding off its own row, with a blank row sitting between two charges', () => {
    const lines = announcedFindings(
      doc({
        offenses: [
          { ...AWOL, finding: 'Not Guilty' },
          { articleLabel: '', summary: '', finding: '' },
          { ...DISRESPECT, finding: 'Guilty' },
        ],
      }),
    );
    expect(lines).toEqual(['Art. 91  Insubordinate conduct. Disrespect to a SNCO.']);
  });
});

describe('the punishment rule prints what item 6 prints, or blank', () => {
  it('is blank with no punishment recorded', () => {
    expect(announcedPunishment(doc({ offenses: [AWOL] }))).toBe('');
  });

  it('carries the rendered item 6 text when the entries are complete', () => {
    const text = announcedPunishment(
      doc({ offenses: [AWOL], punishments: [{ code: 'N06', days: '7', suspendedFromDuty: true }] }),
    );
    expect(text).not.toBe('');
    expect(text).toContain('7');
  });

  // A half-filled punishment row is normal mid-entry state, not a bug. The
  // script still has to generate, with that rule blank.
  it('is blank rather than throwing on an incomplete punishment row', () => {
    expect(() => announcedPunishment(doc({ offenses: [AWOL], punishments: [{ code: 'N06' }] })))
      .not.toThrow();
    expect(announcedPunishment(doc({ offenses: [AWOL], punishments: [{ code: 'N06' }] }))).toBe('');
  });
});

describe('buildScriptCase', () => {
  it('refuses to build with no charge, naming what is missing', () => {
    expect(() => buildScriptCase(doc())).toThrow(NjpPackageError);
    expect(() => buildScriptCase(doc())).toThrow(/item 1/);
  });

  it('carries every charged offense, in row order', () => {
    const built = buildScriptCase(doc({ offenses: [AWOL, DISRESPECT] }));
    expect(built.offenses.map((o) => o.articleLabel)).toEqual([AWOL.articleLabel, DISRESPECT.articleLabel]);
  });

  /**
   * NEITHER IS A FIELD ON THE NAVMC 10132. Naming a superior authority the
   * form does not carry would be the app inventing an appeal route. The
   * printed appendix already carries a rule for hand completion.
   */
  it('leaves the appeal authority and the appeal advisor blank on purpose', () => {
    const built = buildScriptCase(doc({ offenses: [AWOL] }));
    expect(built.appealAuthority).toBe('');
    expect(built.appealAdvisor).toBe('');
  });
});

describe('the filled appendix', () => {
  it('every anchor matches, so no fill silently lands nowhere', () => {
    const { report } = renderNjpScript(
      buildScriptCase(
        doc({
          offenses: [{ ...AWOL, finding: 'Guilty' }],
          punishments: [{ code: 'N06', days: '7', suspendedFromDuty: true }],
        }),
      ),
    );
    expect(report.unmatched).toEqual([]);
  });

  it('every anchor still matches with the findings and the punishment unset', () => {
    const { report } = renderNjpScript(buildScriptCase(doc({ offenses: [AWOL] })));
    expect(report.unmatched).toEqual([]);
  });

  // Those are the accused's and the witnesses' own words, written by hand at
  // the hearing. The app never fills them.
  it('leaves the ACC: and WIT: response lines untouched', () => {
    const { lines } = renderNjpScript(buildScriptCase(doc({ offenses: [AWOL] })));
    const original = APPENDIX_A_1_F.text.filter((l) => /^\s*(ACC|WIT):/.test(l));
    const rendered = lines.filter((l) => /^\s*(ACC|WIT):/.test(l));
    expect(rendered).toEqual(original);
  });

  it('renders a PDF whose filename carries the designator and the rank', async () => {
    const out = await renderNjpProceedingScript(doc({ offenses: [AWOL] }));
    expect(out.designator).toBe(APPENDIX_A_1_F.designator);
    expect(out.filename).toContain('A-1-f');
    expect(out.filename).toContain('cpl');
    expect(out.bytes.byteLength).toBeGreaterThan(1000);
  });
});

// ---------------------------------------------------------------------------
// The panel, where Stephen looks
// ---------------------------------------------------------------------------

function StubSectionCard({ title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function renderPunishmentSection(formData: FormData) {
  return render(
    <PunishmentSection formData={formData} setFormData={vi.fn()} SectionCard={StubSectionCard} />,
  );
}

describe('the panel in the punishment section', () => {
  it('is on screen where findings and punishment are recorded', () => {
    renderPunishmentSection(doc({ offenses: [AWOL] }));
    expect(screen.getByText(/JAGMAN Appendix A-1-f/)).toBeInTheDocument();
  });

  it('the Generate button is disabled until an offense is charged', () => {
    renderPunishmentSection(doc());
    expect(screen.getByRole('button', { name: /Generate/ })).toBeDisabled();
    expect(screen.getByText(/Still needed/)).toBeInTheDocument();
  });

  it('the Generate button is live on one charged offense, with nothing else set', () => {
    renderPunishmentSection(doc({ offenses: [AWOL] }));
    expect(screen.getByRole('button', { name: /Generate/ })).toBeEnabled();
  });

  // Saying so up front is the difference between a CO who knows the rule is
  // blank and a CO who finds out at the hearing.
  it('says the findings rule will print blank when no guilty finding is recorded', () => {
    renderPunishmentSection(doc({ offenses: [AWOL] }));
    expect(screen.getByText(/No guilty finding is recorded yet/)).toBeInTheDocument();
  });

  it('counts the guilty findings it will announce, not the offenses', () => {
    renderPunishmentSection(
      doc({ offenses: [{ ...AWOL, finding: 'Guilty' }, { ...DISRESPECT, finding: 'Not Guilty' }] }),
    );
    expect(screen.getByText(/1 guilty finding will be announced/)).toBeInTheDocument();
    expect(screen.getByText(/2 violations will be read out/)).toBeInTheDocument();
  });
});
