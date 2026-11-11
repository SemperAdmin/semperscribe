/**
 * Owner request 2026-11-11: Page 11 offered "Insert template" on the
 * right column only, so an entry could not be dropped into the left
 * column, where the first entry of a page goes. Each column now carries
 * its own Insert template (while empty) and Clear column (while filled),
 * and the picker writes the entry text into the column that opened it.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { Page11RemarksSection } from '@/components/letter/Page11RemarksSection';
import type { FormData } from '@/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ENTRY_TEXT = 'SAMPLE ENTRY TEXT FOR THE TEST.';
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (String(url).endsWith('index.json')
      ? [{ id: 't1', title: 'Sample entry', documentType: 'page11', url: '/templates/global/t1.nldp' }]
      : { data: { formData: { remarksLeft: ENTRY_TEXT } } }),
  })));
});

function Harness({ initial }: { initial: Partial<FormData> }) {
  const [formData, setFormData] = React.useState({ documentType: 'page11', ...initial } as FormData);
  return (
    <>
      <Page11RemarksSection formData={formData} setFormData={setFormData} />
      <output data-testid="left">{String(formData.remarksLeft ?? '')}</output>
      <output data-testid="right">{String(formData.remarksRight ?? '')}</output>
    </>
  );
}

describe('Page 11 remarks insert', () => {
  it('offers Insert template on both empty columns', () => {
    render(<Harness initial={{}} />);
    expect(screen.getAllByRole('button', { name: /Insert template/ })).toHaveLength(2);
  });

  it('inserts the entry into the left column from the left button', async () => {
    render(<Harness initial={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /Insert template into the left column/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Sample entry/ }));
    await waitFor(() => expect(screen.getByTestId('left').textContent).toBe(ENTRY_TEXT));
    expect(screen.getByTestId('right').textContent).toBe('');
  });

  it('still inserts into the right column from the right button', async () => {
    render(<Harness initial={{ remarksLeft: 'FIRST ENTRY.' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Insert template into the right column/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Sample entry/ }));
    await waitFor(() => expect(screen.getByTestId('right').textContent).toBe(ENTRY_TEXT));
    expect(screen.getByTestId('left').textContent).toBe('FIRST ENTRY.');
  });

  it('clears a filled left column', () => {
    render(<Harness initial={{ remarksLeft: 'FIRST ENTRY.' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Clear the left column/ }));
    expect(screen.getByTestId('left').textContent).toBe('');
  });
});
