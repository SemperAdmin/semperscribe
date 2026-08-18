'use client';

/**
 * Release dialog for NLDP packages (docs/POLICY_AS_DATA_HANDOFF.md §5).
 *
 * Release is distinct from the working export: it asserts "this package
 * corresponds to the document that was signed", evidenced by the signed
 * artifact's SHA-256 and an explicit human affirmation. Only a Release
 * package is eligible for ingest by the policy-as-data pipeline.
 *
 * Every gate failure is listed at once, by name — the button is never
 * silently disabled. The signed file is hashed with crypto.subtle in
 * this browser and discarded; it is never embedded or uploaded.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, FileCheck2, ShieldCheck } from 'lucide-react';
import type { NLDPLifecycle, NLDPSignedArtifact } from '@/lib/nldp-format';
import {
  RELEASE_AFFIRMATION,
  buildRelease,
  evaluateReleaseGates,
  hashSignedArtifact,
  type ReleaseGateInput,
} from '@/lib/release';
import { createNLDPFile, generateReleaseNLDPFilename } from '@/lib/nldp-utils';
import { generateCitation } from '@/lib/citation';
import { useToast } from '@/hooks/use-toast';

interface ReleaseNLDPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: any;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: any[];
}

export function ReleaseNLDPDialog({
  open, onOpenChange, formData, vias, references, enclosures, copyTos, paragraphs,
}: ReleaseNLDPDialogProps) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [lifecycle, setLifecycle] = useState<'signed' | 'promulgated' | ''>('');
  const [releasedBy, setReleasedBy] = useState('');
  const [artifact, setArtifact] = useState<NLDPSignedArtifact | null>(null);
  const [affirmed, setAffirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Designators exactly as the export will emit them (lib/citation.ts,
  // the numbering rule's single implementation).
  const designators = useMemo(
    () => paragraphs.map((p, i) => ({ designator: generateCitation(p, i, paragraphs).citation })),
    [paragraphs]
  );

  const gateInput: ReleaseGateInput = {
    status: (lifecycle || undefined) as NLDPLifecycle | undefined,
    signedArtifact: artifact,
    dateSigned: formData?.date_signed || undefined,
    sig: formData?.sig || undefined,
    paragraphs: designators,
    distributionStatementCode: formData?.distributionStatement?.code || undefined,
    affirmationAccepted: affirmed,
  };
  const failures = evaluateReleaseGates(gateInput);

  const handlePickArtifact = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try {
      setArtifact(await hashSignedArtifact(file));
    } catch (e) {
      setArtifact(null);
      setError(e instanceof Error ? e.message : 'Could not hash the file.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const reset = () => {
    setLifecycle(''); setReleasedBy(''); setArtifact(null);
    setAffirmed(false); setError(null);
  };

  const handleRelease = async () => {
    setError(null);
    if (!releasedBy.trim()) {
      setError('Enter the releasing role or billet (never a personal name).');
      return;
    }
    setBusy(true);
    try {
      const release = buildRelease(gateInput, releasedBy);
      const nldpFile = await createNLDPFile(
        formData, vias, references, enclosures, copyTos, paragraphs,
        {
          package: { title: formData?.subj || 'Untitled Package' },
          status: release.lifecycle,
        },
        release
      );
      const blob = new Blob([JSON.stringify(nldpFile, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateReleaseNLDPFilename(formData);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: 'Release package exported',
        description: 'Eligible for policy-as-data ingest after independent verification.',
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Release export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-4 h-4" /> Release Package
          </DialogTitle>
          <DialogDescription>
            A Release package asserts this document was signed and promulgated,
            evidenced by the signed file&apos;s hash. The working export
            (.nldp) is unchanged and needs none of this.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-3 native-scroll">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="release-lifecycle">Document lifecycle</Label>
              <Select value={lifecycle} onValueChange={(v) => setLifecycle(v as 'signed' | 'promulgated')}>
                <SelectTrigger id="release-lifecycle" className="w-full">
                  <SelectValue placeholder="Select — only a signed document can be released" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signed">Signed — signature applied</SelectItem>
                  <SelectItem value="promulgated">Promulgated — released to the fleet</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                &quot;Final&quot; drafting status is not enough: final means drafting is
                complete, not that a commander signed it.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="release-by">Released by (role or billet)</Label>
              <Input
                id="release-by"
                value={releasedBy}
                onChange={(e) => setReleasedBy(e.target.value)}
                placeholder="e.g. Adjutant, G-1, Director MCB Quantico"
              />
              <p className="text-xs text-muted-foreground">
                A role or billet, never a personal name — the release record may
                be published alongside the policy.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Signed document (PDF or DOCX)</Label>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => void handlePickArtifact(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                data-testid="release-pick-artifact"
              >
                <FileCheck2 className="w-4 h-4 mr-1.5" />
                {artifact ? 'Choose a different file' : 'Choose the signed file'}
              </Button>
              {artifact && (
                <p className="text-xs text-muted-foreground break-all">
                  {artifact.filename} — SHA-256 {artifact.sha256.slice(0, 16)}…
                  ({artifact.byteLength.toLocaleString()} bytes)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                The file is hashed in this browser and discarded. Only the hash
                travels in the package.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-sm text-foreground">{RELEASE_AFFIRMATION}</p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="release-affirm"
                  checked={affirmed}
                  onCheckedChange={(c) => setAffirmed(c === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="release-affirm" className="cursor-pointer text-sm">
                  I affirm the statement above.
                </Label>
              </div>
            </div>

            {failures.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-1" data-testid="release-gate-failures">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Not eligible for release yet:
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                  {failures.map(f => <li key={f.gate}>{f.reason}</li>)}
                </ul>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleRelease} disabled={busy || failures.length > 0} data-testid="release-export">
            {busy ? 'Working…' : 'Export Release Package'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
