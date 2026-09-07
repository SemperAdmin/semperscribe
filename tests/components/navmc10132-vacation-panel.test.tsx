import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VacationSection } from '@/components/letter/navmc10132/VacationSection';
import { Navmc10132FormSections } from '@/components/letter/Navmc10132Sections';
import { createEmptyNavmc10132Data, type Navmc10132Vacation, type Navmc10132Stage } from '@/types/navmc';
import { FormData } from '@/types';

/**
 * The vacation panel, the last piece of D-60 with no interface.
 *
 * D-60 shipped the record, the derivation and eight validators deliberately
 * headless. These tests cover the two things a UI over an existing data
 * model can get wrong that the model's own tests cannot see: WHEN it is
 * offered, and WHAT it writes into the array those validators read.
 *
 * The conditional fields matter more here than in most panels. `outcomeDate`
 * on a pending record would assert a decision date for a decision nobody has
 * made, and `vacatedDetail` on a full vacation describes a part of something
 * that was taken whole. Both are asserted below in both directions.
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

const TITLE = 'Vacation of Suspended Punishment';

function baseFormData(overrides: Partial<FormData> = {}): FormData {
  return {
    ...(createEmptyNavmc10132Data() as unknown as FormData),
    documentType: 'navmc10132',
    accusedName: 'Doe, John A',
    ...overrides,
  };
}

/** A form with one item 6 punishment and one item 7 suspension of it, which
 *  is the minimum state in which a vacation has anything to target. */
function withSuspension(overrides: Partial<FormData> = {}): FormData {
  return baseFormData({
    punishmentDate: '2026-02-10',
    punishments: [{ code: 'N05', days: '14' }],
    suspensions: [{ punishmentIndex: 0, months: '6' }],
    ...overrides,
  } as Partial<FormData>);
}

function renderPanel(formData: FormData, setFormData = vi.fn()) {
  render(
    <VacationSection formData={formData} setFormData={setFormData} SectionCard={StubSectionCard} />,
  );
  return setFormData;
}

/** Applies the updater a mocked setFormData was called with, the pattern
 *  tests/components/DocumentTypeSection.test.tsx uses. */
function applyLastUpdate(setFormData: ReturnType<typeof vi.fn>, prev: FormData): FormData {
  const updater = setFormData.mock.calls.at(-1)?.[0] as (p: FormData) => FormData;
  return updater(prev);
}

function vacationsOf(formData: FormData): Navmc10132Vacation[] {
  return (formData.vacations ?? []) as Navmc10132Vacation[];
}

describe('when the vacation panel is offered at all', () => {
  function renderSections(formData: FormData) {
    return render(
      <Navmc10132FormSections
        formData={formData}
        setFormData={vi.fn()}
        onDynamicSync={vi.fn()}
        formKey="test"
      />,
    );
  }

  // A vacation happens to a UPB that is already closed out: MCO 5800.16
  // Vol 14 para 011202 has block 16 updated on the ORIGINAL UPB after one,
  // and block 16 is pass 7.
  it.each([1, 3, 6, 7] as Navmc10132Stage[])('is hidden at pass %s, before close-out', (stage) => {
    const { unmount } = renderSections(withSuspension({ stage } as Partial<FormData>));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    unmount();
  });

  it('appears once the case is closed out and item 7 carries a suspension', () => {
    renderSections(withSuspension({ stage: 'complete' } as Partial<FormData>));
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  // Nothing to target. Offering the panel here would let a clerk record a
  // vacation of a suspension that does not exist, which the record cannot
  // express: it stores a suspensionIndex, not a description.
  it('stays hidden when closed out with no suspension to vacate', () => {
    renderSections(baseFormData({ stage: 'complete' } as Partial<FormData>));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });
});

describe('the empty state', () => {
  it('says an empty list is ordinary rather than incomplete', () => {
    renderPanel(withSuspension());

    // Most suspensions are never vacated, they remit under MCM Part V
    // para 6.a(3). A panel that read as an unfilled requirement would push a
    // clerk to record something.
    expect(screen.getByText(/Most suspensions are never vacated/)).toBeInTheDocument();
  });

  it('adds a pending record targeting the first suspension', () => {
    const prev = withSuspension();
    const setFormData = renderPanel(prev);

    fireEvent.click(screen.getByText('Record a vacation'));

    const next = applyLastUpdate(setFormData, prev);
    expect(vacationsOf(next)).toEqual([
      { suspensionIndex: 0, noticeServedDate: '', status: 'pending' },
    ]);
  });
});

describe('what the panel shows for a record it already holds', () => {
  const pending: Navmc10132Vacation = {
    suspensionIndex: 0,
    noticeServedDate: '2026-03-02',
    status: 'pending',
  };

  it('hides the decision date while the outcome is pending', () => {
    renderPanel(withSuspension({ vacations: [pending] } as Partial<FormData>));

    expect(screen.queryByText('Date the commander decided')).not.toBeInTheDocument();
  });

  it('shows the decision date once an outcome is recorded', () => {
    renderPanel(
      withSuspension({
        vacations: [{ ...pending, status: 'vacated-full', outcomeDate: '2026-03-16' }],
      } as Partial<FormData>),
    );

    expect(screen.getByText('Date the commander decided')).toBeInTheDocument();
  });

  // vacatedDetail is meaningless on a full vacation: suspensionIndex already
  // names the whole thing that was taken.
  it('asks what was vacated only on a partial vacation', () => {
    const { unmount } = render(
      <VacationSection
        formData={withSuspension({
          vacations: [{ ...pending, status: 'vacated-full', outcomeDate: '2026-03-16' }],
        } as Partial<FormData>)}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
      />,
    );
    expect(screen.queryByText('What was vacated')).not.toBeInTheDocument();
    unmount();

    renderPanel(
      withSuspension({
        vacations: [{ ...pending, status: 'vacated-part', outcomeDate: '2026-03-16' }],
      } as Partial<FormData>),
    );
    expect(screen.getByText('What was vacated')).toBeInTheDocument();
  });

  // The remission date is the fact a clerk most needs and the form never
  // prints, and it is never shown as a bare date: three conditions move it
  // and two of them move it earlier.
  it('shows the remission date with the caveat that moves it', () => {
    renderPanel(withSuspension({ vacations: [pending] } as Partial<FormData>));

    expect(screen.getByText(/Remits 2026-08-10/)).toBeInTheDocument();
    // The caveat has to carry the EARLIER direction, not only a bare date.
    // Two of the three conditions shorten the period, so a clerk reading
    // only the date would plan against a deadline that may already have
    // passed.
    expect(screen.getByText(/EARLIER than this one/)).toBeInTheDocument();
    // And the consequence, which is the whole reason the date is shown here.
    expect(screen.getByText(/nothing left to vacate after that date/)).toBeInTheDocument();
  });

  // A suspension deleted from item 7 after a vacation was recorded leaves the
  // record pointing at nothing. Silently rendering an empty picker would hide
  // that the record now describes nothing at all.
  it('says so when the record points at a suspension item 7 no longer carries', () => {
    renderPanel(
      withSuspension({ vacations: [{ ...pending, suspensionIndex: 7 }] } as Partial<FormData>),
    );

    expect(screen.getByText(/no longer carries/)).toBeInTheDocument();
  });
});

describe('what the panel writes', () => {
  it('clears the outcome date when a record is moved back to pending', () => {
    const prev = withSuspension({
      vacations: [
        {
          suspensionIndex: 0,
          noticeServedDate: '2026-03-02',
          status: 'vacated-full',
          outcomeDate: '2026-03-16',
        },
      ],
    } as Partial<FormData>);
    const setFormData = renderPanel(prev);

    // Reach the outcome Select through its rendered trigger text.
    fireEvent.click(screen.getByText('Vacated in full'));
    fireEvent.click(
      screen.getByText('Notice served, awaiting the accused response and the decision'),
    );

    const next = applyLastUpdate(setFormData, prev);
    expect(vacationsOf(next)[0].status).toBe('pending');
    // A decision date left behind would assert a decision that has been
    // withdrawn.
    expect(vacationsOf(next)[0].outcomeDate).toBe('');
  });

  it('removes a record without disturbing the others', () => {
    const prev = withSuspension({
      vacations: [
        { suspensionIndex: 0, noticeServedDate: '2026-03-02', status: 'pending' },
        { suspensionIndex: 0, noticeServedDate: '2026-05-01', status: 'not-vacated' },
      ],
    } as Partial<FormData>);
    const setFormData = renderPanel(prev);

    fireEvent.click(screen.getByLabelText('Remove vacation record 1'));

    const next = applyLastUpdate(setFormData, prev);
    expect(vacationsOf(next)).toHaveLength(1);
    expect(vacationsOf(next)[0].noticeServedDate).toBe('2026-05-01');
  });

  it('writes the vacating authority grade to the record, not to item 8A', () => {
    const prev = withSuspension({
      vacations: [{ suspensionIndex: 0, noticeServedDate: '2026-03-02', status: 'pending' }],
    } as Partial<FormData>);
    const setFormData = renderPanel(prev);

    fireEvent.change(screen.getByPlaceholderText('e.g. O5'), { target: { value: 'O5' } });

    const next = applyLastUpdate(setFormData, prev);
    expect(vacationsOf(next)[0].vacatingAuthorityGrade).toBe('O5');
    // The imposing commander is a different officer and a different field.
    // Reading item 8A in its place is what D-56 exists to prevent.
    expect(next.njpAuthorityGrade).toBe(prev.njpAuthorityGrade);
  });
});
