'use client';

/**
 * S2c (ruling 2026-06-10): the ORIGINATOR configures signature fields
 * here, then either downloads the sign-ready PDF or copies a
 * signature request link. The who/when/where of the request lives in
 * the requesting e-mail, not in the link (ruling: no routing form).
 * CAC PKI only (ruling): the signer's Acrobat step is the floor —
 * no browser reaches the CAC private key (plan constraint K1).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSignature, Download, Link2 } from 'lucide-react';

interface SignatureFieldSectionProps {
  onOpenSignaturePlacement: () => void;
  onDownloadSignReady: () => void;
  onCopySignatureRequest: () => void;
  signatureFields: { signerName?: string }[];
}

export function SignatureFieldSection({
  onOpenSignaturePlacement,
  onDownloadSignReady,
  onCopySignatureRequest,
  signatureFields,
}: SignatureFieldSectionProps) {
  return (
    <Card className="shadow-sm border-border mb-6 border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold font-headline tracking-wide">
          <FileSignature className="mr-2 h-5 w-5 text-primary-foreground" />
          Configure Signature Fields
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Place CAC/PKI signature fields on the PDF, then download it or send a signature request link.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpenSignaturePlacement} data-testid="sig-configure">
            <FileSignature className="mr-2 h-4 w-4" />
            {signatureFields.length > 0 ? 'Edit Signature Fields' : 'Place Signature Fields'}
          </Button>
          <Button type="button" size="sm" onClick={onDownloadSignReady} data-testid="sig-download">
            <Download className="mr-2 h-4 w-4" />
            Download Sign-Ready PDF
          </Button>
          <Button type="button" size="sm" onClick={onCopySignatureRequest} data-testid="sig-request">
            <Link2 className="mr-2 h-4 w-4" />
            Copy Signature Request Link
          </Button>
        </div>

        {signatureFields.length > 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="sig-summary">
            {signatureFields.length} field{signatureFields.length === 1 ? '' : 's'} configured
            {signatureFields.some((f) => f.signerName)
              ? `: ${signatureFields.map((f, i) => f.signerName || `Field ${i + 1}`).join(', ')}`
              : ''}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No fields configured yet — the PDF gets one field auto-anchored above the typed signature name.
          </p>
        )}
        <p className="text-xs text-muted-foreground italic">
          Paste the request link into your e-mail. The signer signs in Adobe Acrobat with their CAC and returns the signed file — the link carries the request, never the signature.
        </p>
      </CardContent>
    </Card>
  );
}
