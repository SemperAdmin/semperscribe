// Vitest suite for src/lib/njp-vacation-post-action.ts, the MCO 5800.16
// Vol 14 para 011202 post-action chain. Decision row D-55.
//
// THE PARAGRAPH IS NOW IN HAND, quoted verbatim in the module header and
// read from two editions of the order that agree word for word. So unlike
// the first draft of this suite, these tests CAN assert against the words,
// and several of them do: the actor named in each sentence, the fact that
// step 3 moves copies rather than originals, and that the chain has six
// steps rather than the five a summary of it recorded.
//
// WHAT THE FIRST DRAFT GOT WRONG, and why one test below exists purely to
// keep it wrong-proof: decision row D-55 resolved the phrase "vacated
// punishment information" to the unit diary number and date. The paragraph
// sources that information from the commander's letter and introduces the
// Unit Diary number one sentence later, after unit diary reporting. Step 2
// and step 4 are different sentences about different things, and a future
// edit that collapses them reintroduces the original error.

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { createEmptyNavmc10132Data, type Navmc10132Vacation } from '@/types/navmc';

import { vacationPostActions } from '@/lib/njp-vacation-post-action';

function baseForm(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  } as FormData;
}

function vacation(overrides: Partial<Navmc10132Vacation> = {}): Navmc10132Vacation {
  return {
    suspensionIndex: 0,
    noticeServedDate: '2026-03-02',
    status: 'vacated-full',
    outcomeDate: '2026-03-16',
    ...overrides,
  };
}

function stepOf(pkg: { items: { step: number }[] }, step: number) {
  const item = pkg.items.find((i) => i.step === step);
  if (!item) throw new Error(`no item for step ${step}`);
  return item as { id: string; step: number; state: string; detail: string; requirement: string };
}

function onePackage(overrides: Record<string, unknown> = {}) {
  const packages = vacationPostActions(baseForm({ vacations: [vacation()], ...overrides }));
  expect(packages).toHaveLength(1);
  return packages[0];
}

describe('which records produce a chain at all', () => {
  it('produces nothing on a UPB with no vacations', () => {
    expect(vacationPostActions(baseForm())).toEqual([]);
  });

  it('produces nothing when the vacations field is not an array', () => {
    expect(vacationPostActions(baseForm({ vacations: 'not an array' }))).toEqual([]);
  });

  // Most suspensions are never vacated: they run out and remit under MCM
  // Part V para 6.a(3). 011202 opens with the commander generating the
  // letter, so a record where no decision was made has not reached the
  // paragraph's first sentence.
  it('produces nothing for a pending record, where the commander has not decided', () => {
    const form = baseForm({ vacations: [vacation({ status: 'pending', outcomeDate: undefined })] });
    expect(vacationPostActions(form)).toEqual([]);
  });

  it('produces nothing for a not-vacated record, where nothing was vacated', () => {
    const form = baseForm({ vacations: [vacation({ status: 'not-vacated' })] });
    expect(vacationPostActions(form)).toEqual([]);
  });

  it('produces a six-step chain for a full vacation', () => {
    const pkg = onePackage();
    expect(pkg.status).toBe('vacated-full');
    expect(pkg.items.map((i) => i.step)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('produces a six-step chain for a partial vacation, which routes identically', () => {
    const form = baseForm({
      vacations: [vacation({ status: 'vacated-part', vacatedDetail: '7 days restriction' })],
    });
    const packages = vacationPostActions(form);
    expect(packages).toHaveLength(1);
    expect(packages[0].status).toBe('vacated-part');
    expect(packages[0].items.map((i) => i.step)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // D-60 allows more than one vacation record per UPB, each against its own
  // suspension. Each carries its own 011202 chain, and the indices have to
  // survive the filter that drops the non-executed ones.
  it('indexes each package by its position in vacations, not among the executed ones', () => {
    const form = baseForm({
      vacations: [
        vacation({ suspensionIndex: 0, status: 'not-vacated' }),
        vacation({ suspensionIndex: 1, status: 'vacated-full' }),
        vacation({ suspensionIndex: 2, status: 'pending', outcomeDate: undefined }),
        vacation({ suspensionIndex: 3, status: 'vacated-part', vacatedDetail: 'half the fine' }),
      ],
    });
    const packages = vacationPostActions(form);

    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.vacationIndex)).toEqual([1, 3]);
    expect(packages.map((p) => p.suspensionIndex)).toEqual([1, 3]);
  });
});

// These assert against the words of the paragraph, which is now quoted in
// the module header. Each sentence names an actor, and the first draft of
// this module got two of them wrong.
describe('each step matches the sentence of 011202 it comes from', () => {
  it('step 1 puts the letter on the unit commander', () => {
    expect(stepOf(onePackage(), 1).requirement).toMatch(/unit commander generates the vacation letter/);
  });

  it('step 2 puts the block 16 update on the unit administrators, and on the ORIGINAL UPB', () => {
    const requirement = stepOf(onePackage(), 2).requirement;
    expect(requirement).toMatch(/unit administrators update block 16/);
    expect(requirement).toMatch(/ORIGINAL UPB/);
  });

  // "forward a copy of the vacation letter and a copy of the updated UPB".
  // Copies, not originals: the original stays in the binder, which is the
  // thing step 6 validates the ESR/OMPF scan against.
  it('step 3 forwards COPIES, and names the IPAC/Administration Section', () => {
    const requirement = stepOf(onePackage(), 3).requirement;
    expect(requirement).toMatch(/COPY of the vacation letter and a COPY of the updated UPB/);
    expect(requirement).toMatch(/IPAC\/Administration Section/);
  });

  // The first draft credited this to IPAC. The paragraph credits the unit
  // administrators, and conditions it on the reporting being complete.
  it('step 4 puts the completed UPB on the unit administrators, after the reporting', () => {
    const requirement = stepOf(onePackage(), 4).requirement;
    expect(requirement).toMatch(/[Uu]pon completion of the unit diary reporting/);
    expect(requirement).toMatch(/unit administrators provide/);
    expect(requirement).toMatch(/Unit Diary number/);
  });

  it('step 5 puts the ESR/OMPF scan on the IPAC/Administration Section', () => {
    const requirement = stepOf(onePackage(), 5).requirement;
    expect(requirement).toMatch(/IPAC\/Administration Section scans/);
    expect(requirement).toMatch(/ESR\/OMPF/);
  });

  it('step 6 puts the validation on the unit, against the binder original', () => {
    const requirement = stepOf(onePackage(), 6).requirement;
    expect(requirement).toMatch(/unit MUST validate/);
    expect(requirement).toMatch(/original UPB on file in the UPB binder/);
  });

  // The correction that prompted rewriting this module. Step 2's source is
  // the commander's letter; step 4's source is the unit diary reporting.
  // Collapsing them reintroduces D-55's reversed reading.
  it('keeps step 2 sourced from the letter and step 4 from the unit diary reporting', () => {
    const pkg = onePackage();
    expect(stepOf(pkg, 2).requirement).toMatch(/from the commander's letter/);
    expect(stepOf(pkg, 2).requirement).not.toMatch(/Unit Diary number/);
    expect(stepOf(pkg, 4).requirement).not.toMatch(/commander's letter/);
  });
});

describe('step 4, the only step the app can see', () => {
  it('is unsatisfied when block 16 is empty', () => {
    const step = stepOf(onePackage({ finalAdminUd: '', finalAdminDtd: '' }), 4);

    expect(step.state).toBe('unsatisfied');
    expect(step.detail).toMatch(/no unit diary number and no date/);
  });

  // The load-bearing derivation. A vacation post-dates the NJP it vacates,
  // so a block 16 entry dated before the vacation was decided cannot be an
  // entry for that vacation. Provable, not inferred.
  it('is unsatisfied when block 16 predates the vacation, because that entry is an earlier action', () => {
    const step = stepOf(
      onePackage({ finalAdminUd: '2025-1201-0042', finalAdminDtd: '2025-12-01' }),
      4,
    );

    expect(step.state).toBe('unsatisfied');
    expect(step.detail).toMatch(/belongs to an earlier action/);
  });

  it('is satisfied when block 16 is dated after the vacation was decided', () => {
    const step = stepOf(
      onePackage({ finalAdminUd: '2026-0320-0117', finalAdminDtd: '2026-03-20' }),
      4,
    );

    expect(step.state).toBe('satisfied');
    expect(step.detail).toMatch(/2026-0320-0117/);
  });

  // Same-day is on the correct side of the line: the reporting can come
  // back the day the commander acts.
  it('is satisfied when block 16 is dated the same day the vacation was decided', () => {
    const step = stepOf(
      onePackage({ finalAdminUd: '2026-0316-0009', finalAdminDtd: '2026-03-16' }),
      4,
    );

    expect(step.state).toBe('satisfied');
  });

  it('is unverifiable when the vacation carries no outcome date to compare against', () => {
    const packages = vacationPostActions(
      baseForm({
        vacations: [vacation({ outcomeDate: undefined })],
        finalAdminUd: '2026-0320-0117',
        finalAdminDtd: '2026-03-20',
      }),
    );
    const step = stepOf(packages[0], 4);

    expect(step.state).toBe('unverifiable');
    expect(step.detail).toMatch(/no outcome date/);
  });

  it('is unverifiable when block 16 carries a number but no readable date', () => {
    const step = stepOf(onePackage({ finalAdminUd: 'UD PENDING', finalAdminDtd: '' }), 4);

    expect(step.state).toBe('unverifiable');
    expect(step.detail).toMatch(/no date/);
  });
});

describe('the five steps the app cannot see', () => {
  it('reports steps 1, 2, 3, 5 and 6 as unverifiable on every package', () => {
    const pkg = onePackage();
    for (const step of [1, 2, 3, 5, 6]) {
      expect(stepOf(pkg, step).state).toBe('unverifiable');
    }
  });

  // Step 2 is unverifiable for a specific reason that is worth stating: the
  // form cannot hold what the order asks for. A future edit that marks it
  // satisfied off block 16 being populated would be reading step 4's
  // evidence for step 2's requirement.
  it('step 2 says why it is unverifiable, naming block 16 as unable to hold it', () => {
    const detail = stepOf(onePackage(), 2).detail;
    expect(detail).toMatch(/block 16 is a unit diary number and a date/);
    expect(detail).toMatch(/item 21 remark/);
  });

  it('step 3 notes that the original stays in the binder', () => {
    expect(stepOf(onePackage(), 3).detail).toMatch(/original UPB stays in the binder/);
  });

  it('step 6 is described as a verification duty, not a filing step', () => {
    expect(stepOf(onePackage(), 6).detail).toMatch(/verification duty, not a filing step/);
  });

  // Both statuses reach step 1's detail, which reads the record back to the
  // clerk in the paragraph's own "in whole or in part" terms.
  it('step 1 reports whether this record vacated in whole or in part', () => {
    expect(stepOf(onePackage(), 1).detail).toMatch(/vacated in whole/);

    const partial = vacationPostActions(
      baseForm({ vacations: [vacation({ status: 'vacated-part', vacatedDetail: 'the fine' })] }),
    )[0];
    expect(stepOf(partial, 1).detail).toMatch(/vacated in part/);
  });
});

describe('counts, and the two structural findings', () => {
  it('counts unverifiable and unsatisfied separately, never merging them', () => {
    const pkg = onePackage({ finalAdminUd: '', finalAdminDtd: '' });

    expect(pkg.unsatisfiedCount).toBe(1);
    expect(pkg.unverifiableCount).toBe(5);
  });

  it('drops the unsatisfied count to zero once block 16 is current', () => {
    const pkg = onePackage({ finalAdminUd: '2026-0320-0117', finalAdminDtd: '2026-03-20' });

    expect(pkg.unsatisfiedCount).toBe(0);
    expect(pkg.unverifiableCount).toBe(5);
  });

  // Both findings are structural: they follow from the form's own design,
  // not from the state of any one record, so they appear whether block 16
  // is done or not.
  it('reports the lock collision on every package, in both block 16 states', () => {
    const undone = onePackage({ finalAdminUd: '', finalAdminDtd: '' });
    const done = onePackage({ finalAdminUd: '2026-0320-0117', finalAdminDtd: '2026-03-20' });

    for (const pkg of [undone, done]) {
      expect(pkg.blockSixteenLockCollision).toMatch(/16 FINAL ADMIN INIT/);
      expect(pkg.blockSixteenLockCollision).toMatch(/Action \/All/);
      expect(pkg.blockSixteenLockCollision).toMatch(/invalidate the signature/);
      // It bites on both writes to the original, not only the first.
      expect(pkg.blockSixteenLockCollision).toMatch(/STEPS 2 AND 4/);
    }
  });

  it('names both lawful routes through the lock and tells the clerk to ask first', () => {
    const pkg = onePackage();

    expect(pkg.blockSixteenLockCollision).toMatch(/continuation or corrected copy/);
    expect(pkg.blockSixteenLockCollision).toMatch(/ask the IPAC\/Administration Section/);
    expect(pkg.blockSixteenLockCollision).toMatch(/Ask before improvising/);
  });

  it('reports that block 16 cannot hold what step 2 directs into it, and where it goes instead', () => {
    const undone = onePackage({ finalAdminUd: '', finalAdminDtd: '' });
    const done = onePackage({ finalAdminUd: '2026-0320-0117', finalAdminDtd: '2026-03-20' });

    for (const pkg of [undone, done]) {
      expect(pkg.blockSixteenCannotHoldIt).toMatch(/COMMANDER'S LETTER/);
      expect(pkg.blockSixteenCannotHoldIt).toMatch(/exactly two fields/);
      expect(pkg.blockSixteenCannotHoldIt).toMatch(/does not exist yet/);
      expect(pkg.blockSixteenCannotHoldIt).toMatch(/item 21/);
    }
  });
});
