/**
 * S2 — ceremony panel + request card render/flow (Gate S2 acceptance:
 * routing banner fields render; probe card labels the structural-only
 * check; request card states the OPSEC rule).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignatureCeremonyPanel } from '@/components/signature/SignatureCeremonyPanel';
import { RequestSignatureCard } from '@/components/signature/RequestSignatureCard';

const routing = {
  requestedSigner: 'I. M. MARINE',
  dueDate: '2026-06-20',
  returnEmail: 'drafter@usmc.mil',
  note: 'CO signs before COB Friday.',
};

const toHex = (s: string) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
function syntheticSignedFile(): File {
  const cms = 'DOE.JANE.QUINN.1234567890\x00DOD EMAIL CA-70\x00';
  let body = '%PDF-1.7\n<< /Type /Sig /SubFilter /adbe.pkcs7.detached /M (D:20260610161234Z)\n/ByteRange [0 100 300 50] /Contents <' + toHex(cms) + '> >>\n';
  while (body.length < 350) body += '%pad\n';
  return new File([body.slice(0, 350)], 'signed.pdf', { type: 'application/pdf' });
}

describe('SignatureCeremonyPanel', () => {
  it('renders the routing banner and stepper', () => {
    render(
      <SignatureCeremonyPanel
        routing={routing}
        fileName="letter.pdf"
        generateSignReadyPdf={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/Signature requested — I. M. MARINE/)).toBeTruthy();
    expect(screen.getByText(/Due: 2026-06-20/)).toBeTruthy();
    expect(screen.getByText(/Return to: drafter@usmc.mil/)).toBeTruthy();
    expect(screen.getByText('CO signs before COB Friday.')).toBeTruthy();
    expect(screen.getByText('Save PDF')).toBeTruthy();
  });

  it('walks save -> signed -> probe card with the advisory label', async () => {
    const blob = new Blob(['%PDF-1.7 base'], { type: 'application/pdf' });
    const gen = vi.fn().mockResolvedValue(blob);
    // jsdom lacks URL.createObjectURL
    const u = URL as unknown as Record<string, unknown>;
    u.createObjectURL = vi.fn(() => 'blob:x');
    u.revokeObjectURL = vi.fn();

    render(
      <SignatureCeremonyPanel routing={routing} fileName="letter.pdf" generateSignReadyPdf={gen} onDismiss={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Save PDF'));
    await waitFor(() => expect(screen.getByText('I signed it')).toBeTruthy());
    expect(gen).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByText('I signed it'));
    const drop = await screen.findByTestId('ceremony-drop');
    const input = drop.querySelector('input[type=file]') as HTMLInputElement;
    await waitFor(() => fireEvent.change(input, { target: { files: [syntheticSignedFile()] } }));

    const card = await screen.findByTestId('probe-card');
    expect(card.textContent).toContain('Signature structure detected');
    expect(card.textContent).toContain('DOE.JANE.QUINN.1234567890');
    expect(card.textContent).toContain('Structural check only');
    expect(screen.getByText('Return signed file')).toBeTruthy();
  });
});

describe('RequestSignatureCard', () => {
  it('opens and states the OPSEC rule', () => {
    render(<RequestSignatureCard buildState={() => ({ formData: {} as never })} defaultSigner="I. M. MARINE" />);
    fireEvent.click(screen.getByTestId('request-signature-open'));
    expect(screen.getByTestId('request-signature-card')).toBeTruthy();
    expect(screen.getByText(/The link embeds the full letter text/)).toBeTruthy();
    expect(screen.getByTestId('request-signature-copy')).toBeTruthy();
  });
});
