// Vitest suite for src/lib/njp-vacation-post-action.ts, the MCO 5800.16
// Vol 14 para 011202 post-action chain. Decision row D-55.
//
// THE ASSERTIONS THIS FILE DELIBERATELY DOES NOT MAKE. It does not check
// the wording of any `requirement` string against the order, because the
// verbatim text of 011202 is not in this codebase, see the module header.
// A test asserting a paraphrase matches a paragraph nobody can read is a
// test that manufactures confidence. What IS tested here is everything that
// does not depend on the paragraph's exact words: which records produce a
// package at all, the block 16 date derivation, the counts, and that the
// lock collision is reported unconditionally.

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

describe('which records produce a chain at all', () => {
  it('produces nothing on a UPB with no vacations', () => {
    expect(vacationPostActions(baseForm())).toEqual([]);
  });

  it('produces nothing when the vacations field is not an array', () => {
    expect(vacationPostActions(baseForm({ vacations: 'not an array' }))).toEqual([]);
  });

  // Most suspensions are never vacated: they run out and remit under MCM
  // Part V para 6.a(3). A record that noticed a vacation and got no further
  // has no routing chain, because nothing was routed.
  it('produces nothing for a pending record, where the commander has not decided', () => {
    const form = baseForm({ vacations: [vacation({ status: 'pending', outcomeDate: undefined })] });
    expect(vacationPostActions(form)).toEqual([]);
  });

  it('produces nothing for a not-vacated record, where nothing was vacated', () => {
    const form = baseForm({ vacations: [vacation({ status: 'not-vacated' })] });
    expect(vacationPostActions(form)).toEqual([]);
  });

  it('produces a chain for a full vacation', () => {
    const packages = vacationPostActions(baseForm({ vacations: [vacation()] }));
    expect(packages).toHaveLength(1);
    expect(packages[0].status).toBe('vacated-full');
    expect(packages[0].items).toHaveLength(5);
  });

  it('produces a chain for a partial vacation, which routes identically', () => {
    const form = baseForm({
      vacations: [vacation({ status: 'vacated-part', vacatedDetail: '7 days restriction' })],
    });
    const packages = vacationPostActions(form);
    expect(packages).toHaveLength(1);
    expect(packages[0].status).toBe('vacated-part');
    expect(packages[0].items).toHaveLength(5);
  });

  // D-60 allows more than one vacation record per UPB, each against its own
  // suspension. Each carries its own 011202 chain, and the indices have to
  // survive the filter that drops the non-executed ones.
  it('indexes each package by its position in vacations, not by its position among the executed ones', () => {
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

describe('step 1, the block 16 date derivation', () => {
  it('is unsatisfied when block 16 is empty', () => {
    const form = baseForm({ vacations: [vacation()], finalAdminUd: '', finalAdminDtd: '' });
    const step = stepOf(vacationPostActions(form)[0], 1);

    expect(step.state).toBe('unsatisfied');
    expect(step.detail).toMatch(/no unit diary number and no date/);
  });

  // The load-bearing derivation. A vacation post-dates the NJP it vacates,
  // so a block 16 entry dated before the vacation was decided cannot be an
  // entry for that vacation. This is provable, not inferred.
  it('is unsatisfied when block 16 predates the vacation, because that entry belongs to an earlier action', () => {
    const form = baseForm({
      vacations: [vacation({ outcomeDate: '2026-03-16' })],
      finalAdminUd: '2025-1201-0042',
      finalAdminDtd: '2025-12-01',
    });
    const step = stepOf(vacationPostActions(form)[0], 1);

    expect(step.state).toBe('unsatisfied');
    expect(step.detail).toMatch(/belongs to an earlier action/);
  });

  it('is satisfied when block 16 is dated after the vacation was decided', () => {
    const form = baseForm({
      vacations: [vacation({ outcomeDate: '2026-03-16' })],
      finalAdminUd: '2026-0320-0117',
      finalAdminDtd: '2026-03-20',
    });
    const step = stepOf(vacationPostActions(form)[0], 1);

    expect(step.state).toBe('satisfied');
    expect(step.detail).toMatch(/2026-0320-0117/);
  });

  // Same-day is on the correct side of the line: the unit can record the
  // entry the day the commander acts.
  it('is satisfied when block 16 is dated the same day the vacation was decided', () => {
    const form = baseForm({
      vacations: [vacation({ outcomeDate: '2026-03-16' })],
      finalAdminUd: '2026-0316-0009',
      finalAdminDtd: '2026-03-16',
    });

    expect(stepOf(vacationPostActions(form)[0], 1).state).toBe('satisfied');
  });

  it('is unverifiable when the vacation carries no outcome date to compare against', () => {
    const form = baseForm({
      vacations: [vacation({ outcomeDate: undefined })],
      finalAdminUd: '2026-0320-0117',
      finalAdminDtd: '2026-03-20',
    });
    const step = stepOf(vacationPostActions(form)[0], 1);

    expect(step.state).toBe('unverifiable');
    expect(step.detail).toMatch(/no outcome date/);
  });

  it('is unverifiable when block 16 carries a number but no readable date', () => {
    const form = baseForm({
      vacations: [vacation()],
      finalAdminUd: 'UD PENDING',
      finalAdminDtd: '',
    });
    const step = stepOf(vacationPostActions(form)[0], 1);

    expect(step.state).toBe('unverifiable');
    expect(step.detail).toMatch(/no date/);
  });
});

describe('the four steps the app cannot see', () => {
  it('reports steps 2 through 5 as unverifiable on every package', () => {
    const packages = vacationPostActions(baseForm({ vacations: [vacation()] }));
    for (const step of [2, 3, 4, 5]) {
      expect(stepOf(packages[0], step).state).toBe('unverifiable');
    }
  });

  // Step 3 must not claim to observe something step 1 already observed.
  // Both write finalAdminUd and finalAdminDtd, so the app sees one final
  // state and never the sequence, and the detail has to say so.
  it('step 3 says outright that it is not separately observable from step 1', () => {
    const packages = vacationPostActions(baseForm({ vacations: [vacation()] }));
    expect(stepOf(packages[0], 3).detail).toMatch(/[Nn]ot separately observable/);
  });

  it('step 5 is described as a verification duty, not a filing step', () => {
    const packages = vacationPostActions(baseForm({ vacations: [vacation()] }));
    expect(stepOf(packages[0], 5).detail).toMatch(/verification duty, not a filing step/);
  });
});

describe('counts, and the lock collision', () => {
  it('counts unverifiable and unsatisfied separately, never merging them', () => {
    const form = baseForm({ vacations: [vacation()], finalAdminUd: '', finalAdminDtd: '' });
    const pkg = vacationPostActions(form)[0];

    expect(pkg.unsatisfiedCount).toBe(1);
    expect(pkg.unverifiableCount).toBe(4);
  });

  it('drops the unsatisfied count to zero once block 16 is current', () => {
    const form = baseForm({
      vacations: [vacation({ outcomeDate: '2026-03-16' })],
      finalAdminUd: '2026-0320-0117',
      finalAdminDtd: '2026-03-20',
    });
    const pkg = vacationPostActions(form)[0];

    expect(pkg.unsatisfiedCount).toBe(0);
    expect(pkg.unverifiableCount).toBe(4);
  });

  // The collision is structural: it follows from the form's own
  // 16 FINAL ADMIN INIT /Action /All lock, not from the state of any one
  // record. It must appear whether block 16 is done or not.
  it('reports the block 16 lock collision on every package, in both block 16 states', () => {
    const undone = vacationPostActions(
      baseForm({ vacations: [vacation()], finalAdminUd: '', finalAdminDtd: '' }),
    )[0];
    const done = vacationPostActions(
      baseForm({
        vacations: [vacation({ outcomeDate: '2026-03-16' })],
        finalAdminUd: '2026-0320-0117',
        finalAdminDtd: '2026-03-20',
      }),
    )[0];

    for (const pkg of [undone, done]) {
      expect(pkg.blockSixteenLockCollision).toMatch(/16 FINAL ADMIN INIT/);
      expect(pkg.blockSixteenLockCollision).toMatch(/Action \/All/);
      expect(pkg.blockSixteenLockCollision).toMatch(/invalidate the signature/);
    }
  });

  // The collision names two lawful routes and tells the clerk to ask rather
  // than improvise. An earlier draft of this module offered only one route,
  // which read as instruction rather than as the local question it is.
  it('names both lawful routes through the lock and tells the clerk to ask first', () => {
    const pkg = vacationPostActions(baseForm({ vacations: [vacation()] }))[0];

    expect(pkg.blockSixteenLockCollision).toMatch(/continuation or corrected copy/);
    expect(pkg.blockSixteenLockCollision).toMatch(/ask IPAC/);
    expect(pkg.blockSixteenLockCollision).toMatch(/Ask before improvising/);
  });
});
