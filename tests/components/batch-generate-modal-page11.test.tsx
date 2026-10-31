/**
 * Batch Generate dialog on a Page 11: the drafter's entry (a library
 * template or their own text) is fixed, so the dialog opens with NAME
 * and EDIPI selected, and the preview lists every roster row whose
 * EDIPI is not a 10-digit DoD ID before anything is generated.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { BatchGenerateModal } from '@/components/BatchGenerateModal';
import type { FormData } from '@/types';

afterEach(cleanup);

const PAGE11 = {
  documentType: 'page11',
  name: '',
  edipi: '',
  remarksLeft: 'Counseled this date concerning the following deficiencies.',
  remarksRight: '',
} as FormData;

function renderModal(formData: FormData) {
  return render(
    <BatchGenerateModal
      open
      onOpenChange={() => {}}
      formData={formData}
      paragraphs={[]}
      vias={[]}
      references={[]}
      enclosures={[]}
      copyTos={[]}
      distList={[]}
    />,
  );
}

const checkboxFor = (label: string) =>
  screen.getByText(label, { selector: 'span' }).closest('label')!.querySelector('[role="checkbox"]')!;

describe('Batch Generate dialog on a Page 11', () => {
  it('opens with NAME and EDIPI selected and DATE off', () => {
    renderModal(PAGE11);
    expect(checkboxFor('NAME').getAttribute('aria-checked')).toBe('true');
    expect(checkboxFor('EDIPI').getAttribute('aria-checked')).toBe('true');
    expect(checkboxFor('DATE').getAttribute('aria-checked')).toBe('false');
  });

  it('opens with nothing selected on a standard letter', () => {
    renderModal({ documentType: 'basic', subj: 'TEST' } as FormData);
    expect(checkboxFor('TO').getAttribute('aria-checked')).toBe('false');
  });

  it('lists a mangled EDIPI row in the preview and generates only the good rows', async () => {
    renderModal(PAGE11);
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    const csv = 'NAME,EDIPI\n"DOE, JOHN M.",1234567890\n"ROE, RICHARD",9.87654E+08\n"SMITH, JANE A.",0987654321\n';
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([csv], 'roster.csv', { type: 'text/csv' })] } });

    await waitFor(() => expect(screen.getByText(/3 rows loaded/)).toBeTruthy());
    expect(
      screen.getByText(/Row 3 \(ROE, RICHARD\): EDIPI "9\.87654E\+08" is not a 10-digit DoD ID.*This row will be skipped\./),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Generate 2 PDFs/ })).toBeTruthy();
  });
});
