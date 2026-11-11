/**
 * Owner requests 2026-11-11, after #162 and #163.
 *
 * 1. Change Transmittal hid the Distribution and Reports sections while
 *    both emitters printed them, so the drafter could not edit what the
 *    transmittal printed. The type now shows both, as MCO and MCBul do.
 * 2. The I-Type pick lists accepted only listed values. The lists now
 *    suggest their values and accept any typed value.
 * 3. Order and SECNAV export filenames dropped the point from the SSIC
 *    ("MCO 521510K"), and SECNAV directives fell through to the letter
 *    name ("Letter 52151F"). They now carry the designation the page
 *    prints, point included.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { ITypeDefinition } from '@/lib/i-type/definition';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { getExportFilename } from '@/lib/naval-format-utils';
import type { FormData } from '@/types';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('change transmittal sections', () => {
  it('shows Distribution and Reports like the other Marine Corps directives', () => {
    const f = DOCUMENT_TYPES['change-transmittal'].features;
    expect(f.showDistribution).toBe(true);
    expect(f.showReports).toBe(true);
  });
});

describe('I-Type pick lists take typed values', () => {
  const FIELDS = ['entity', 'address', 'category', 'signingAuthority', 'controllingOffice', 'distributionControl'];
  const fieldDefs = ITypeDefinition.sections.flatMap((s) => s.fields);

  it.each(FIELDS)('%s allows a value outside its list', (name) => {
    expect(fieldDefs.find((f) => f.name === name)?.allowCustom).toBe(true);
  });

  it('commits a typed entity and offers the listed ones as suggestions', () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    const { container } = render(
      <DynamicForm documentType={ITypeDefinition} onSubmit={onSubmit} defaultValues={{ documentType: 'i-type' }} />,
    );
    const input = container.querySelector<HTMLInputElement>('[data-field="entity"] input')!;
    expect(input).toBeTruthy();
    const list = container.querySelector(`datalist#${CSS.escape(input.getAttribute('list') ?? '')}`);
    expect(list?.querySelectorAll('option').length).toBeGreaterThan(1);
    fireEvent.change(input, { target: { value: 'Program Executive Officer Test Systems' } });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ entity: 'Program Executive Officer Test Systems' }));
  });
});

describe('directive export filenames keep the point', () => {
  const fd = (o: Record<string, unknown>) => ({ subj: 'CORRESPONDENCE MANUAL', ...o }) as unknown as FormData;
  it('orders', () => {
    expect(getExportFilename(fd({ documentType: 'mco', ssic: '5215.1K' }), 'pdf')).toBe('MCO 5215.1K - CORRESPONDENCE MANUAL.pdf');
  });
  it('bulletins keep their SSIC as entered', () => {
    expect(getExportFilename(fd({ documentType: 'bulletin', ssic: '1500' }), 'pdf')).toBe('MCBul 1500 - CORRESPONDENCE MANUAL.pdf');
  });
  it('SECNAV instructions', () => {
    expect(getExportFilename(fd({ documentType: 'secnav-instruction', ssic: '5216.5F' }), 'docx')).toBe('SECNAVINST 5216.5F - CORRESPONDENCE MANUAL.docx');
  });
  it('SECNAV notices', () => {
    expect(getExportFilename(fd({ documentType: 'secnav-notice', ssic: '5215' }), 'pdf')).toBe('SECNAVNOTE 5215 - CORRESPONDENCE MANUAL.pdf');
  });
  it('letters are unchanged', () => {
    expect(getExportFilename(fd({ documentType: 'basic', ssic: '1000' }), 'pdf')).toBe('Letter 1000 - CORRESPONDENCE MANUAL.pdf');
  });
});

/**
 * Turning on the directive Distribution section for Change Transmittal
 * left the letter-style Distribution and Copy To in the closing block as
 * well, because ClosingBlockSection hid them only for 'mco' and
 * 'bulletin'. Both emitters skip those letter fields for every directive,
 * so on a transmittal or a SECNAV directive they took input that never
 * printed. The closing block now reads isDirective from the registry.
 */
describe('closing block on directives', () => {
  it.each(['change-transmittal', 'secnav-instruction', 'secnav-notice', 'mco'])(
    'offers no letter-style Copy To on %s',
    async (documentType) => {
      const { ClosingBlockSection } = await import('@/components/letter/ClosingBlockSection');
      const { queryByText } = render(
        <ClosingBlockSection
          formData={{ documentType }}
          setFormData={vi.fn()}
          copyTos={['']}
          setCopyTos={vi.fn()}
          distList={['']}
          setDistList={vi.fn()}
        />,
      );
      expect(queryByText(/^Copy To$/)).toBeNull();
    },
  );

  it('keeps Copy To on a basic letter', async () => {
    const { ClosingBlockSection } = await import('@/components/letter/ClosingBlockSection');
    const { queryByText } = render(
      <ClosingBlockSection formData={{ documentType: 'basic' }} setFormData={vi.fn()} copyTos={['']} setCopyTos={vi.fn()} distList={['']} setDistList={vi.fn()} />,
    );
    expect(queryByText(/^Copy To$/)).not.toBeNull();
  });
});
