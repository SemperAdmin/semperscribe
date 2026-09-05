/**
 * Phase A.1 (HARDENING_PLAN_2026-09): stateful pins for the show/hide flag
 * of the list sections. The static tests in list-sections.test.tsx render
 * with fixed props; these wrap the sections in a parent holding real
 * state, the way page.tsx does, so the interplay between the radio
 * handler (which mutates the list) and the list-driven flag is recorded.
 *
 * Every case here passed on the effect-based implementation before the
 * refactor and must still pass after it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ViaSection } from '@/components/letter/ViaSection';
import { ReferencesSection } from '@/components/letter/ReferencesSection';
import type { FormData } from '@/types';

afterEach(cleanup);

const radio = (name: 'Yes' | 'No') => screen.getByRole('radio', { name });

function ViaHarness({ initial }: { initial: string[] }) {
  const [vias, setVias] = useState<string[]>(initial);
  return (
    <>
      <ViaSection vias={vias} setVias={setVias} />
      <button type="button" onClick={() => setVias(['Commanding General, II MEF'])}>load template</button>
      <button type="button" onClick={() => setVias([''])}>clear form</button>
    </>
  );
}

describe('ViaSection in a stateful parent', () => {
  it('starts collapsed on the page default of one blank entry', () => {
    render(<ViaHarness initial={['']} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
  });

  it('starts expanded when the initial list has text, with no flash to No', () => {
    render(<ViaHarness initial={['Commanding Officer']} />);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
  });

  it('Yes on the page default opens the section with one empty input', () => {
    render(<ViaHarness initial={['']} />);
    fireEvent.click(radio('Yes'));
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByPlaceholderText(/Enter via information/)).toHaveLength(1);
  });

  it('typing keeps it open and clearing the only entry collapses it', () => {
    render(<ViaHarness initial={['']} />);
    fireEvent.click(radio('Yes'));
    const input = screen.getByPlaceholderText(/Enter via information/);
    fireEvent.change(input, { target: { value: 'CG' } });
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(screen.getByDisplayValue('CG'), { target: { value: '' } });
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
  });

  it('No clears the list and collapses', () => {
    render(<ViaHarness initial={['A', 'B']} />);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(radio('No'));
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByDisplayValue('A')).toBeNull();
  });

  it('a template load opens it and a form clear closes it, even after a manual Yes', () => {
    render(<ViaHarness initial={['']} />);
    fireEvent.click(screen.getByText('load template'));
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByText('clear form'));
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(radio('Yes'));
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByText('clear form'));
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
  });
});

function ReferencesHarness({ initial }: { initial: string[] }) {
  const [references, setReferences] = useState<string[]>(initial);
  const [formData, setFormData] = useState<FormData>(
    { documentType: 'basic', startingReferenceLevel: 'a' } as unknown as FormData,
  );
  return (
    <>
      <ReferencesSection references={references} setReferences={setReferences} formData={formData} setFormData={setFormData} />
      <button type="button" onClick={() => setReferences([''])}>clear form</button>
    </>
  );
}

describe('ReferencesSection in a stateful parent', () => {
  it('Yes on the page default opens with one empty reference input', () => {
    render(<ReferencesHarness initial={['']} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(radio('Yes'));
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('textbox', { name: 'Reference (a)' })).toHaveValue('');
  });

  it('a form clear collapses an open section', () => {
    render(<ReferencesHarness initial={['MCO 5216.20B']} />);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByText('clear form'));
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
  });
});
