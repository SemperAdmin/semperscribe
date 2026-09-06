/**
 * E.5: the endorsement half of a same-page endorsement written from
 * scratch. Its From and To follow the letter (9-2.2) until edited, a
 * reset re-derives them, and the fit line reports where it landed.
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { SamePageEndorsementSection } from '@/components/document/SamePageEndorsementSection';
import { emptySamePagePart } from '@/lib/same-page-composite';
import type { FormData } from '@/types';
import type { SamePageStatus } from '@/lib/same-page-host';

afterEach(cleanup);

function Harness({ initial, vias = [], status = null }: { initial: Partial<FormData>; vias?: string[]; status?: SamePageStatus | null }) {
  const [formData, setFormData] = useState<FormData>({
    documentType: 'endorsement',
    endorsementPlacement: 'same-page',
    endorsementLevel: 'FIRST',
    from: 'Sergeant Sample',
    to: 'Commanding Officer, 1st Battalion, 6th Marines',
    ssic: '1000', originatorCode: 'S-1', date: '6 Sep 26',
    samePageEndorsement: emptySamePagePart(),
    ...initial,
  });
  return (
    <>
      <SamePageEndorsementSection formData={formData} setFormData={setFormData} vias={vias} references={[]} enclosures={[]} samePageStatus={status} />
      <output data-testid="part">{JSON.stringify(formData.samePageEndorsement)}</output>
    </>
  );
}

const part = () => JSON.parse(screen.getByTestId('part').textContent ?? '{}');

describe('same-page endorsement half', () => {
  it('reverses From and To when the letter has no Via', async () => {
    render(<Harness initial={{}} />);
    await waitFor(() => expect(part().from).toBe('Commanding Officer, 1st Battalion, 6th Marines'));
    expect(part().to).toBe('Sergeant Sample');
    expect((screen.getByLabelText('From (endorser)') as HTMLInputElement).value).toBe('Commanding Officer, 1st Battalion, 6th Marines');
  });

  it('lets the first Via endorse to the addressee and carries the rest (9-2.2)', async () => {
    render(<Harness initial={{ to: 'Commanding General, 2d Marine Division' }} vias={['Commanding Officer, 1st Battalion, 6th Marines', 'Commanding Officer, 6th Marines']} />);
    await waitFor(() => expect(part().from).toBe('Commanding Officer, 1st Battalion, 6th Marines'));
    expect(part().to).toBe('Commanding General, 2d Marine Division');
    expect(part().vias).toEqual(['Commanding Officer, 6th Marines']);
  });

  it('stops deriving once edited, and derives again on request', async () => {
    render(<Harness initial={{}} />);
    await waitFor(() => expect(part().from).toBe('Commanding Officer, 1st Battalion, 6th Marines'));
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'Commanding General, 2d Marine Division' } });
    expect(part().to).toBe('Commanding General, 2d Marine Division');
    expect(part().addressingEdited).toBe(true);
    fireEvent.click(screen.getByText('Derive from the letter again'));
    await waitFor(() => expect(part().to).toBe('Sergeant Sample'));
    expect(part().addressingEdited).toBe(false);
  });

  it('shows the endorsement line without the "on" clause and reports the fit', () => {
    render(<Harness initial={{}} status={{ status: 'fits', page: 1, pages: 1 }} />);
    expect(screen.getByTestId('same-page-endorsement-line').textContent).toBe('FIRST ENDORSEMENT');
    expect(screen.getByTestId('same-page-composite-status').textContent).toContain('Fits on the signature page');
  });

  it('writes the second signer and the Ser line into the part', () => {
    render(<Harness initial={{}} />);
    fireEvent.change(screen.getByLabelText('Signature name (endorser, signer 2)'), { target: { value: 'r. l. gabel' } });
    fireEvent.change(screen.getByLabelText("Ser line (endorser's)"), { target: { value: 'Ser 019/870' } });
    expect(part().sig).toBe('R. L. GABEL');
    expect(part().originatorCode).toBe('Ser 019/870');
  });
});
