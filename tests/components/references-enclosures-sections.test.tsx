/**
 * Phase 0.4 (HARDENING_PLAN_2026-09): behaviour pins for ReferencesSection
 * and EnclosuresSection. Both mirror "any item has content" into a show
 * flag through an effect, and both let the radio drive the list (Yes
 * seeds an empty item, No clears). Phase A.1 replaces the effects; these
 * tests are the contract they must keep.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReferencesSection } from '@/components/letter/ReferencesSection';
import { EnclosuresSection } from '@/components/letter/EnclosuresSection';
import type { FormData } from '@/types';
import type { EnclosureRow, EnclosureAttachment } from '@/lib/enclosure-attachments';

afterEach(cleanup);

const radio = (name: 'Yes' | 'No') => screen.getByRole('radio', { name });
const basic = { documentType: 'basic', startingReferenceLevel: 'a', startingEnclosureNumber: '1' } as unknown as FormData;

describe('ReferencesSection', () => {
  it('collapses when every reference is blank', () => {
    render(<ReferencesSection references={['']} setReferences={vi.fn()} formData={basic} setFormData={vi.fn()} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('textbox', { name: /^Reference \(/ })).toBeNull();
  });

  it('expands when a reference has text', () => {
    render(<ReferencesSection references={['MCO 5216.20B']} setReferences={vi.fn()} formData={basic} setFormData={vi.fn()} />);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('textbox', { name: 'Reference (a)' })).toHaveValue('MCO 5216.20B');
  });

  it('follows a parent change from populated to cleared', () => {
    const { rerender } = render(
      <ReferencesSection references={['MCO 5216.20B']} setReferences={vi.fn()} formData={basic} setFormData={vi.fn()} />,
    );
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    rerender(<ReferencesSection references={['']} setReferences={vi.fn()} formData={basic} setFormData={vi.fn()} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
  });

  it('Yes seeds an empty item when the list is empty, No clears the list', () => {
    const setReferences = vi.fn();
    render(<ReferencesSection references={[]} setReferences={setReferences} formData={basic} setFormData={vi.fn()} />);
    fireEvent.click(radio('Yes'));
    expect(setReferences).toHaveBeenLastCalledWith(['']);
    fireEvent.click(radio('No'));
    expect(setReferences).toHaveBeenLastCalledWith(['']);
  });

  it('adds through the parent callback', () => {
    const setReferences = vi.fn();
    render(<ReferencesSection references={['MCO 5216.20B']} setReferences={setReferences} formData={basic} setFormData={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Reference' }));
    expect(setReferences).toHaveBeenLastCalledWith(['MCO 5216.20B', '']);
  });
});

describe('EnclosuresSection', () => {
  const noFiles: ReadonlyMap<string, EnclosureAttachment> = new Map();

  function renderEncl(rows: EnclosureRow[], overrides: Partial<React.ComponentProps<typeof EnclosuresSection>> = {}) {
    const props: React.ComponentProps<typeof EnclosuresSection> = {
      rows,
      onAddRow: vi.fn(),
      onRemoveRow: vi.fn(),
      onUpdateTitle: vi.fn(),
      onMoveRow: vi.fn(),
      onClearRows: vi.fn(),
      files: noFiles,
      onBindFile: vi.fn(),
      onUnbindFile: vi.fn(),
      coverPages: false,
      onCoverPagesChange: vi.fn(),
      formData: basic,
      setFormData: vi.fn(),
      ...overrides,
    } as React.ComponentProps<typeof EnclosuresSection>;
    return { ...render(<EnclosuresSection {...props} />), props };
  }

  it('collapses when every row is blank and unbound', () => {
    renderEncl([{ key: 'r1', title: '' }]);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('textbox', { name: /^Enclosure \(/ })).toBeNull();
  });

  it('expands when a row has a title', () => {
    renderEncl([{ key: 'r1', title: 'Training schedule' }]);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('textbox', { name: 'Enclosure (1)' })).toHaveValue('Training schedule');
  });

  it('expands when a row is bound to a file even with no title', () => {
    renderEncl([{ key: 'r1', title: '', fileId: 'f1' }]);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
  });

  it('Yes adds a row when the list is empty, No clears every row', () => {
    const { props } = renderEncl([]);
    fireEvent.click(radio('Yes'));
    expect(props.onAddRow).toHaveBeenCalledTimes(1);
    fireEvent.click(radio('No'));
    expect(props.onClearRows).toHaveBeenCalledTimes(1);
  });

  it('adds and edits through the parent callbacks', () => {
    const { props } = renderEncl([{ key: 'r1', title: 'Training schedule' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Add Enclosure' }));
    expect(props.onAddRow).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('textbox', { name: 'Enclosure (1)' }), { target: { value: 'Range request' } });
    expect(props.onUpdateTitle).toHaveBeenLastCalledWith('r1', 'Range request');
  });
});
