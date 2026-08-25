import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentTypeSection } from '@/components/letter/DocumentTypeSection';
import { FormData } from '@/types';

// D-43 regression: on a fresh document, `documentType` used to switch to
// 'navmc10132' without `stage` ever being seeded. navmc10132ExportGateStage
// defaults an ABSENT stage to 'complete' on purpose (an old document
// predating the field is likelier finished than freshly started), while
// navmc10132Stage defaults an absent stage to 1 for display. Those two
// defaults only agree on a brand new document if the switch itself seeds
// `stage`. This exercises the real onClick this component wires to the
// NAVMC 10132 card, the way a user actually reaches it, rather than
// re-stating the fix inline against a hand-built FormData object.
describe('DocumentTypeSection, switching to NAVMC 10132', () => {
  it('seeds stage to 1 on first switch, through the real onClick handler', () => {
    const setFormData = vi.fn();
    const formData = { documentType: 'basic' } as unknown as FormData;

    render(<DocumentTypeSection formData={formData} setFormData={setFormData} />);

    fireEvent.click(screen.getByText('NAVMC 10132'));

    expect(setFormData).toHaveBeenCalledTimes(1);
    const updater = setFormData.mock.calls[0][0] as (prev: FormData) => FormData;
    const result = updater(formData);

    expect(result.documentType).toBe('navmc10132');
    expect(result.stage).toBe(1);
  });

  it('preserves an existing stage rather than rewinding it when the card is clicked again', () => {
    const setFormData = vi.fn();
    const formData = { documentType: 'navmc10132', stage: 5 } as unknown as FormData;

    render(<DocumentTypeSection formData={formData} setFormData={setFormData} />);

    fireEvent.click(screen.getByText('NAVMC 10132'));

    const updater = setFormData.mock.calls[0][0] as (prev: FormData) => FormData;
    const result = updater(formData);

    expect(result.stage).toBe(5);
  });
});
