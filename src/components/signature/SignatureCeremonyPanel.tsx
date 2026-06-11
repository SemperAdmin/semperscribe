'use client';

/**
 * S2 — guided signing ceremony (docs/SIGNATURE_COLLECTION_PLAN.md).
 *
 * Renders when a share link carries a routing slip. Walks the signer
 * through: save sign-ready PDF -> sign in Acrobat with CAC -> drop
 * the signed file back for a STRUCTURAL check -> return via the OS
 * share sheet (file attached) or e-mail. The CAC signing step itself
 * stays in Acrobat by hard constraint (plan K1): no browser reaches
 * the CAC private key. The drop-zone check is the S2 structural
 * probe, NOT cryptographic verification (S3) — labeled accordingly.
 */

import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SignatureRouting } from '@/lib/url-state';
import { probeSignatureBlob, SignatureProbeResult } from '@/lib/signature-probe';

interface Props {
  routing: SignatureRouting;
  fileName: string;
  generateSignReadyPdf: () => Promise<Blob>;
  onDismiss: () => void;
}

/** Save with the File System Access API when present, else download. */
async function saveBlob(blob: Blob, fileName: string): Promise<void> {
  const picker = (window as unknown as {
    showSaveFilePicker?: (o: object) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') throw e;
      // fall through to anchor download on any other picker failure
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SignatureCeremonyPanel({ routing, fileName, generateSignReadyPdf, onDismiss }: Props) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [probe, setProbe] = useState<SignatureProbeResult | null>(null);
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const signedName = fileName.replace(/\.pdf$/i, '') + '_SIGNED.pdf';

  const handleSave = async () => {
    setBusy(true); setError(null);
    try {
      const blob = await generateSignReadyPdf();
      await saveBlob(blob, fileName);
      setStep(2);
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') {
        setError('PDF generation or save failed. Check the console.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setBusy(true); setError(null);
    try {
      setSignedFile(f);
      setProbe(await probeSignatureBlob(f));
      setStep(4);
    } catch {
      setError('Could not read the file.');
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async () => {
    setError(null);
    if (signedFile && navigator.canShare?.({ files: [signedFile] })) {
      try {
        await navigator.share({
          files: [signedFile],
          title: 'Signed correspondence',
          text: `Signed document returned${routing.returnEmail ? ` for ${routing.returnEmail}` : ''}.`,
        });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
        // fall through to mailto
      }
    }
    if (routing.returnEmail) {
      const subject = encodeURIComponent(`SIGNED: ${signedName}`);
      const body = encodeURIComponent('Signed document attached. (Attach the signed PDF you saved before sending.)');
      window.location.href = `mailto:${routing.returnEmail}?subject=${subject}&body=${body}`;
    } else {
      // S2c: the request arrives by e-mail (ruling) — reply to it.
      setDone('Reply to the request e-mail with the signed file attached.');
    }
  };

  const goodShape = probe?.hasSignature && probe.subFilter === 'adbe.pkcs7.detached';

  return (
    <Card className="border-primary/40 shadow-md" data-testid="ceremony-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Signature requested{routing.requestedSigner ? ` — ${routing.requestedSigner}` : ''}</span>
          <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>
        </CardTitle>
        <div className="text-xs text-muted-foreground space-x-3">
          {routing.dueDate && <span>Due: {routing.dueDate}</span>}
          {routing.returnEmail && <span>Return to: {routing.returnEmail}</span>}
        </div>
        {routing.note && <p className="text-sm mt-1">{routing.note}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-3 text-sm">
          <li className={step === 1 ? '' : 'opacity-60'}>
            <span className="font-semibold">1. Save the sign-ready PDF.</span>{' '}
            <Button size="sm" disabled={busy || step !== 1} onClick={handleSave}>
              {busy && step === 1 ? 'Generating…' : 'Save PDF'}
            </Button>
          </li>
          <li className={step === 2 ? '' : 'opacity-60'}>
            <span className="font-semibold">2. Sign it in Adobe Acrobat with your CAC.</span>{' '}
            Open the saved file, click the dashed signature box, choose your certificate, save.
            {step === 2 && (
              <Button size="sm" variant="outline" className="ml-2" onClick={() => setStep(3)}>
                I signed it
              </Button>
            )}
          </li>
          <li className={step === 3 ? '' : 'opacity-60'}>
            <span className="font-semibold">3. Drop the signed file here to check it.</span>
            {step === 3 && (
              <div
                className="mt-2 border-2 border-dashed rounded-md p-4 text-center cursor-pointer"
                data-testid="ceremony-drop"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void handleFiles(e.dataTransfer.files); }}
              >
                Drag the signed PDF here, or click to browse.
                <input ref={fileInput} type="file" accept="application/pdf" className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)} />
              </div>
            )}
          </li>
          <li className={step === 4 ? '' : 'opacity-60'}>
            <span className="font-semibold">4. Return it.</span>{' '}
            {step === 4 && (
              <Button size="sm" disabled={!goodShape} onClick={handleReturn}>Return signed file</Button>
            )}
          </li>
        </ol>

        {probe && (
          <div className="rounded-md border p-3 text-sm space-y-1" data-testid="probe-card">
            <p className={goodShape ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-destructive font-semibold'}>
              {goodShape ? 'Signature structure detected' : 'No DoD-format signature found'}
            </p>
            {probe.signerHint && <p>Signer (unverified): {probe.signerHint}</p>}
            {probe.signTime && <p>Signed (unverified): {probe.signTime}</p>}
            {probe.caHints.length > 0 && <p>Certificate chain hints: {probe.caHints.join(', ')}</p>}
            {probe.bytesAfterSignedRange && (
              <p className="text-amber-700 dark:text-amber-400">File changed after signing (incremental update present).</p>
            )}
            <p className="text-xs text-muted-foreground">
              Structural check only — not cryptographic verification. Validate in Adobe Acrobat for authoritative status.
            </p>
          </div>
        )}
        {done && <p className="text-sm font-medium">{done}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
