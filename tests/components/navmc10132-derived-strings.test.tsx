import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SuspensionSection } from '@/components/letter/navmc10132/SuspensionSection';
import { PunishmentSection } from '@/components/letter/navmc10132/PunishmentSection';
import { renderSuspension } from '@/lib/navmc10132-suspension-render';
import { renderPunishment } from '@/lib/navmc10132-punishment-render';
import { suspensionTermsIssues } from '@/lib/navmc10132-validators-punishment';
import { FormData } from '@/types';
import type { Navmc10132PunishmentEntry, Navmc10132Suspension } from '@/types/navmc';

/**
 * Trivial stand-in for the SectionCard both sections require. Matches the
 * house pattern in tests/components/UnitInfoSection.test.tsx: a real
 * formData/setFormData pair goes through the actual component, only the
 * chrome around it is stubbed.
 */
function StubSectionCard({
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

/**
 * Folds every setFormData call recorded by a vi.fn() spy onto a base
 * FormData, in call order. Every call in these components passes a
 * functional updater ((prev) => ({...prev, field: next})), so folding
 * left-to-right reproduces exactly what React would have settled on had
 * these updates actually been applied to state.
 */
function applyUpdates(base: FormData, calls: unknown[][]): FormData {
  return calls.reduce<FormData>((acc, call) => {
    const updater = call[0];
    if (typeof updater === 'function') {
      return (updater as (prev: FormData) => FormData)(acc);
    }
    return { ...acc, ...(updater as Partial<FormData>) };
  }, base);
}

describe('SuspensionSection writes formData.suspension (item 7 value of record)', () => {
  const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];
  const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0, months: '6' }];
  const punishmentDate = '2026-01-15';

  it("SuspensionSection writes the derived `suspension` string: item 7's value of record, which V-05 blocks on when empty", () => {
    const setFormData = vi.fn();
    const formData: Partial<FormData> = {
      punishments,
      suspensions,
      punishmentDate,
    };

    render(
      <SuspensionSection
        formData={formData as FormData}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
      />,
    );

    // The same engine the component itself renders through, so this is the
    // rendered text, not a hand-typed guess at it.
    const expected = renderSuspension(suspensions, punishments, {
      impositionDate: punishmentDate,
    }).text;
    expect(expected).not.toBe('');
    expect(expected).not.toBe('NONE');

    const finalFormData = applyUpdates(formData as FormData, setFormData.mock.calls);
    expect(typeof finalFormData.suspension).toBe('string');
    expect(finalFormData.suspension).not.toBe('');
    expect(finalFormData.suspension).toBe(expected);
  });

  it("SuspensionSection writes the literal `NONE` when nothing is suspended: item 7's own instruction, and what makes V-05 pass rather than merely go quiet", () => {
    const setFormData = vi.fn();
    const formData: Partial<FormData> = {
      punishments,
      suspensions: [],
      punishmentDate,
    };

    render(
      <SuspensionSection
        formData={formData as FormData}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
      />,
    );

    const finalFormData = applyUpdates(formData as FormData, setFormData.mock.calls);
    expect(finalFormData.suspension).toBe('NONE');
  });

  it('closes the loop with V-05: the populated `suspension` string the component writes satisfies suspensionTermsIssues, no navmc10132-v05-suspension-empty', () => {
    const setFormData = vi.fn();
    const formData: Partial<FormData> = {
      punishments,
      suspensions,
      punishmentDate,
    };

    render(
      <SuspensionSection
        formData={formData as FormData}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
      />,
    );

    const finalFormData = applyUpdates(formData as FormData, setFormData.mock.calls);
    const issues = suspensionTermsIssues({
      ...finalFormData,
      suspension: finalFormData.suspension,
    } as FormData);
    expect(issues.find((i) => i.id === 'navmc10132-v05-suspension-empty')).toBeUndefined();
  });

  it('closes the loop with V-05: the NONE `suspension` string the component writes when nothing is suspended satisfies suspensionTermsIssues, no navmc10132-v05-suspension-empty', () => {
    const setFormData = vi.fn();
    const formData: Partial<FormData> = {
      punishments,
      suspensions: [],
      punishmentDate,
    };

    render(
      <SuspensionSection
        formData={formData as FormData}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
      />,
    );

    const finalFormData = applyUpdates(formData as FormData, setFormData.mock.calls);
    const issues = suspensionTermsIssues({
      ...finalFormData,
      suspension: finalFormData.suspension,
    } as FormData);
    expect(issues.find((i) => i.id === 'navmc10132-v05-suspension-empty')).toBeUndefined();
    // NONE is the literal case, so V-05 raises no issue of any kind, not
    // merely no block.
    expect(issues).toEqual([]);
  });

  it('SuspensionSection does not re-write `suspension` on a render that already carries the value it wrote (no render loop)', () => {
    const setFormData = vi.fn();
    const formData: Partial<FormData> = {
      punishments,
      suspensions,
      punishmentDate,
    };

    const { rerender } = render(
      <SuspensionSection
        formData={formData as FormData}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
      />,
    );

    const settled = applyUpdates(formData as FormData, setFormData.mock.calls);
    expect(settled.suspension).not.toBe('');

    setFormData.mockClear();

    rerender(
      <SuspensionSection
        formData={settled}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
      />,
    );

    // No call at all should touch `suspension` a second time: the effect's
    // guard compares against the current value before writing.
    const settledAgain = applyUpdates(settled, setFormData.mock.calls);
    expect(settledAgain.suspension).toBe(settled.suspension);
    for (const call of setFormData.mock.calls) {
      const updater = call[0] as (prev: FormData) => FormData;
      const result = updater(settled);
      expect(result.suspension).toBe(settled.suspension);
    }
  });
});

describe('PunishmentSection writes formData.punishmentImposed (item 6 value of record, the working sibling)', () => {
  const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];

  it('PunishmentSection writes the derived `punishmentImposed` string, guarding against the reverse regression', () => {
    const setFormData = vi.fn();
    const formData: Partial<FormData> = {
      punishments,
      punishmentDate: '2026-01-15',
    };

    render(
      <PunishmentSection
        formData={formData as FormData}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
      />,
    );

    const expected = renderPunishment(punishments, { concurrent: false }).text;
    expect(expected).not.toBe('');

    const finalFormData = applyUpdates(formData as FormData, setFormData.mock.calls);
    expect(typeof finalFormData.punishmentImposed).toBe('string');
    expect(finalFormData.punishmentImposed).not.toBe('');
    expect(finalFormData.punishmentImposed).toBe(expected);
  });

  it('PunishmentSection does not re-write `punishmentImposed` on a render that already carries the value it wrote (no render loop)', () => {
    const setFormData = vi.fn();
    const formData: Partial<FormData> = {
      punishments,
      punishmentDate: '2026-01-15',
    };

    const { rerender } = render(
      <PunishmentSection
        formData={formData as FormData}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
      />,
    );

    const settled = applyUpdates(formData as FormData, setFormData.mock.calls);
    expect(settled.punishmentImposed).not.toBe('');

    setFormData.mockClear();

    rerender(
      <PunishmentSection
        formData={settled}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
      />,
    );

    for (const call of setFormData.mock.calls) {
      const updater = call[0] as (prev: FormData) => FormData;
      const result = updater(settled);
      expect(result.punishmentImposed).toBe(settled.punishmentImposed);
    }
  });
});
