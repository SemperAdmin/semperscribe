/**
 * S2 — ceremony panel + request card render/flow (Gate S2 acceptance:
 * routing banner fields render; probe card labels the structural-only
 * check; request card states the OPSEC rule).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignatureCeremonyPanel } from '@/components/signature/SignatureCeremonyPanel';
import { SignatureFieldSection } from '@/components/document/SignatureFieldSection';

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

describe('SignatureCeremonyPanel — held-handle check (no drag-back)', () => {
  it('re-reads the saved file via the picker handle on one click', async () => {
    const signedFile = syntheticSignedFile();
    const handle = {
      getFile: vi.fn().mockResolvedValue(signedFile),
      createWritable: vi.fn().mockResolvedValue({ write: vi.fn(), close: vi.fn() }),
    };
    (window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn().mockResolvedValue(handle);

    render(
      <SignatureCeremonyPanel
        routing={{ requestedSigner: 'I. M. MARINE' }}
        fileName="letter.pdf"
        generateSignReadyPdf={vi.fn().mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Save PDF'));
    await waitFor(() => expect(screen.getByText('I signed it')).toBeTruthy());
    fireEvent.click(screen.getByText('I signed it'));

    const check = await screen.findByTestId('ceremony-check');
    fireEvent.click(check);
    const card = await screen.findByTestId('probe-card');
    expect(card.textContent).toContain('Signature structure detected');
    expect(handle.getFile).toHaveBeenCalledOnce();
    expect(screen.getByText('Return signed file')).toBeTruthy();
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
  });
});

describe('SignatureFieldSection (S2c)', () => {
  const handlers = {
    onOpenSignaturePlacement: vi.fn(),
    onDownloadSignReady: vi.fn(),
    onCopySignatureRequest: vi.fn(),
  };

  it('offers configure, download, and request actions with the no-fields fallback note', () => {
    render(<SignatureFieldSection {...handlers} signatureFields={[]} />);
    expect(screen.getByTestId('sig-configure').textContent).toContain('Place Signature Fields');
    expect(screen.getByTestId('sig-download')).toBeTruthy();
    expect(screen.getByTestId('sig-request')).toBeTruthy();
    expect(screen.getByText(/auto-anchored above the typed signature name/)).toBeTruthy();
  });

  it('summarizes configured fields by signer name', () => {
    render(
      <SignatureFieldSection {...handlers}
        signatureFields={[{ signerName: 'I. M. MARINE' }, {}]} />,
    );
    expect(screen.getByTestId('sig-configure').textContent).toContain('Edit Signature Fields');
    const summary = screen.getByTestId('sig-summary').textContent!;
    expect(summary).toContain('2 fields configured');
    expect(summary).toContain('I. M. MARINE');
    expect(summary).toContain('Field 2');
  });
});
