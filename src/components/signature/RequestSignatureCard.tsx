'use client';

/**
 * S2 — drafter side: build a request-for-signature link (share state
 * v2 + routing slip) and copy it. OPSEC: the link embeds the full
 * letter text (plan hard rule) — the card says so. The URL carries
 * the REQUEST only; the signed artifact returns as a file (K3).
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShareableState, SignatureRouting, generateShareableUrl, copyToClipboard } from '@/lib/url-state';
import { useToast } from '@/hooks/use-toast';

interface Props {
  buildState: () => Omit<ShareableState, 'routing' | 'version'>;
  defaultSigner?: string;
}

export function RequestSignatureCard({ buildState, defaultSigner }: Props) {
  const [open, setOpen] = useState(false);
  const [signer, setSigner] = useState(defaultSigner ?? '');
  const [dueDate, setDueDate] = useState('');
  const [returnEmail, setReturnEmail] = useState('');
  const [note, setNote] = useState('');
  const { toast } = useToast();

  const handleCopyLink = async () => {
    const routing: SignatureRouting = {
      requestedSigner: signer || defaultSigner || '',
      dueDate: dueDate || undefined,
      returnEmail: returnEmail || undefined,
      note: note || undefined,
    };
    const { url, isLong, error } = generateShareableUrl({ ...buildState(), routing, version: 2 });
    if (error && !url) {
      toast({ title: 'Failed to build link', description: error, variant: 'destructive' });
      return;
    }
    const ok = await copyToClipboard(url);
    toast(ok
      ? {
          title: 'Signature request link copied',
          description: (isLong ? 'Link is very long and may not work everywhere. ' : '') +
            'The link contains the full letter text — send it only through channels appropriate for the content.',
        }
      : { title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
  };

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="request-signature-open">
          Request signature…
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/30" data-testid="request-signature-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Request signature</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Signer (typed name)</Label>
            <Input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="I. M. MARINE" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Needed by</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Return signed file to</Label>
            <Input type="email" value={returnEmail} onChange={(e) => setReturnEmail(e.target.value)} placeholder="you@usmc.mil" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note to signer</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            The link embeds the full letter text. The signed file returns by e-mail or share sheet, never by link.
          </p>
          <Button size="sm" onClick={handleCopyLink} data-testid="request-signature-copy">Copy request link</Button>
        </div>
      </CardContent>
    </Card>
  );
}
