/**
 * Counseling Worksheet: the guided session on screen. Seven steps, the
 * six area cards, one-click suggestions, and targets that read back as
 * one sentence (docs/COUNSELING_FORM_PLAN.md section 7).
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { CounselingSections } from '@/components/counseling/CounselingSections';
import type { FormData } from '@/types';

afterEach(cleanup);

function Harness({ initial = {} }: { initial?: Partial<FormData> }) {
  const [formData, setFormData] = useState<FormData>({
    documentType: 'counseling',
    date: '6 Sep 26',
    counselingOccasion: 'initial',
    counselingMarineGrade: 'E-5',
    counselingMarineComponent: 'active',
    ...initial,
  } as FormData);
  return (
    <>
      <CounselingSections formData={formData} setFormData={setFormData} />
      <output data-testid="form">{JSON.stringify(formData)}</output>
    </>
  );
}

const data = () => JSON.parse(screen.getByTestId('form').textContent ?? '{}');

describe('counseling sections', () => {
  it('renders the seven steps with their policy cites and the six area cards', () => {
    render(<Harness />);
    for (let n = 1; n <= 7; n += 1) expect(screen.getByTestId(`counseling-step-${n}`)).toBeInTheDocument();
    expect(screen.getByText(/Step 6\. Targets for the coming period/)).toBeInTheDocument();
    expect(screen.getAllByText('NAVMC 2795 para 4002').length).toBeGreaterThan(0);
    for (const area of ['fidelity', 'fighter', 'fitness', 'family', 'finances', 'future']) {
      expect(screen.getByTestId(`area-${area}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('counseling-handling').textContent).toContain('destroyed when the senior/junior relationship ends');
  });

  it('applies the next-session suggestion in one click', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Set 5 Dec 26' }));
    expect(data().counselingNextSessionDate).toBe('5 Dec 26');
    expect(screen.queryByRole('button', { name: 'Set 5 Dec 26' })).toBeNull();
  });

  it('dismisses a suggestion for the session', () => {
    render(<Harness />);
    const dismiss = screen.getByRole('button', { name: /Dismiss: Set a few important targets/ });
    fireEvent.click(dismiss);
    expect(data().counselingDismissed).toEqual(['target-count-low']);
    expect(screen.queryByRole('button', { name: /Dismiss: Set a few important targets/ })).toBeNull();
  });

  it('answers an area and keeps six entries', () => {
    render(<Harness />);
    const card = screen.getByTestId('area-fitness');
    fireEvent.click(within(card).getByRole('button', { name: 'Discussed' }));
    const areas = data().counselingAreas as { area: string; status: string }[];
    expect(areas).toHaveLength(6);
    expect(areas.find((a) => a.area === 'fitness')!.status).toBe('discussed');
    fireEvent.change(within(card).getByLabelText('Fitness notes'), { target: { value: 'PFT first class' } });
    expect((data().counselingAreas as { area: string; notes: string }[]).find((a) => a.area === 'fitness')!.notes).toBe('PFT first class');
  });

  it('marks every open area not this session from the step 4 suggestion', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark the open areas "not this session"' }));
    const areas = data().counselingAreas as { status: string }[];
    expect(areas.every((a) => a.status === 'not-this-session')).toBe(true);
  });

  it('builds a target that reads as one sentence', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a target' }).pop()!);
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'To pass' } });
    fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'the PFT' } });
    fireEvent.change(screen.getByLabelText('Standard'), { target: { value: 'first class' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '1 Dec 26' } });
    expect(screen.getByTestId('target-0-sentence').textContent).toBe('To pass the PFT, first class by 1 Dec 26.');
    fireEvent.click(screen.getByRole('button', { name: 'Quality' }));
    expect((data().counselingTargets as { standardKinds: string[] }[])[0].standardKinds).toEqual(['quality']);
  });

  it('shows the ICS checklist for an initial session and the prior-target review for a follow-on', () => {
    render(<Harness />);
    const objective = screen.getByLabelText("Make the senior's expectations clear.");
    fireEvent.click(objective);
    expect(data().counselingIcsObjectives).toEqual(['expectations']);
    cleanup();
    render(<Harness initial={{ counselingOccasion: 'follow-on' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a prior target' }));
    fireEvent.change(screen.getByLabelText('Prior target 1'), { target: { value: 'To pass the PFT' } });
    expect(data().counselingPriorTargets).toEqual([{ text: 'To pass the PFT', status: '' }]);
  });

  it("reveals the Marine's comments as an option", () => {
    render(<Harness />);
    expect(screen.queryByLabelText("Marine's comments")).toBeNull();
    fireEvent.click(screen.getByLabelText("Include the Marine's comments"));
    expect(screen.getByLabelText("Marine's comments")).toBeInTheDocument();
    expect(data().counselingIncludeMarineComments).toBe(true);
  });

  it('records a unit-specific life event', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Birth of a child'));
    fireEvent.change(screen.getByLabelText('Unit-specific event (optional)'), { target: { value: 'Deployment' } });
    expect(data().counselingLifeEvents).toEqual(['birth-of-child']);
    expect(data().counselingLifeEventsOther).toBe('Deployment');
    expect(screen.getAllByText(/Cover dependency paperwork/).length).toBeGreaterThan(0);
  });
});

describe('JEPES benchmark block (docs/COUNSELING_JEPES_BENCHMARK_PLAN.md)', () => {
  const read = () => JSON.parse(screen.getByTestId('form').textContent!) as Record<string, any>;

  it('is absent for a Sergeant and present for a Corporal', () => {
    render(<Harness initial={{ counselingMarineGrade: 'E-5' }} />);
    expect(screen.queryByTestId('counseling-benchmark')).toBeNull();
    cleanup();
    render(<Harness initial={{ counselingMarineGrade: 'E-4' }} />);
    expect(screen.getByTestId('counseling-benchmark')).toBeInTheDocument();
    expect(screen.getByText('JEPES benchmark (provisional)')).toBeInTheDocument();
  });

  it('starts blank and fills all three at 2.5 from the one button', () => {
    render(<Harness initial={{ counselingMarineGrade: 'E-4' }} />);
    expect(read().counselingBenchmark).toBeUndefined();
    fireEvent.click(screen.getByTestId('benchmark-baseline'));
    const b = read().counselingBenchmark;
    expect([b.character.mark, b.mos.mark, b.leadership.mark]).toEqual(['2.5', '2.5', '2.5']);
    expect(within(screen.getByTestId('benchmark-mos')).getByText('Meets Expectations')).toBeInTheDocument();
  });

  it('shows the commendatory check at 4.1 and not at 4.0, and the adverse reason at 0.0 only', () => {
    render(<Harness initial={{ counselingMarineGrade: 'E-4' }} />);
    const card = () => screen.getByTestId('benchmark-leadership');
    const input = () => within(card()).getByLabelText('Mark (0.0 to 5.0)');
    fireEvent.change(input(), { target: { value: '4.0' } });
    expect(within(card()).queryByLabelText(/Formal commendatory material/)).toBeNull();
    expect(within(card()).getByText('Exceeds Expectations')).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: '4.1' } });
    expect(within(card()).getByLabelText(/Formal commendatory material/)).toBeInTheDocument();
    expect(within(card()).getByText('Exceptional')).toBeInTheDocument();
    expect(within(card()).getByText('Justification (required in this band)')).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: '0.0' } });
    expect(within(card()).getByText(/Reason for 0.0/)).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: '0.1' } });
    expect(within(card()).queryByText(/Reason for 0.0/)).toBeNull();
  });

  it('rejects text which is not one decimal between 0.0 and 5.0', () => {
    render(<Harness initial={{ counselingMarineGrade: 'E-4' }} />);
    const card = screen.getByTestId('benchmark-character');
    fireEvent.change(within(card).getByLabelText('Mark (0.0 to 5.0)'), { target: { value: '6' } });
    expect(within(card).getByText('Enter one decimal between 0.0 and 5.0.')).toBeInTheDocument();
  });

  it('shows the prior mark and the delta once a prior is typed', () => {
    render(<Harness initial={{ counselingMarineGrade: 'E-4', counselingPriorBenchmark: { character: '2.5', mos: '2.5', leadership: '2.5', date: '8 Jun 26' } } as Partial<FormData>} />);
    const card = screen.getByTestId('benchmark-mos');
    fireEvent.change(within(card).getByLabelText('Mark (0.0 to 5.0)'), { target: { value: '3.2' } });
    expect(within(card).getByText('prior 2.5, +0.7')).toBeInTheDocument();
  });

  it('surfaces the step-5 suggestions for the benchmark', () => {
    render(<Harness initial={{ counselingMarineGrade: 'E-4' }} />);
    expect(screen.getAllByText(/Start each attribute at 2.5/).length).toBeGreaterThanOrEqual(1);
    const card = screen.getByTestId('benchmark-mos');
    fireEvent.change(within(card).getByLabelText('Mark (0.0 to 5.0)'), { target: { value: '4.5' } });
    expect(screen.getByText(/MOS Proficiency and\/or Mission Accomplishment: a mark in the Exceptional band requires a justification/)).toBeInTheDocument();
  });
});
