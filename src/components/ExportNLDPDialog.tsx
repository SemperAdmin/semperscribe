'use client';

/**
 * Lifecycle picker for the working NLDP export.
 *
 * Replaces the Release dialog retired on 2026-08-20 (see
 * docs/POLICY_AS_DATA_HANDOFF.md section 5, "Reversal"). The signed
 * artifact never reaches the policy-as-data side, so its hash was an
 * unverifiable string and the gates around it were duplicated ingest
 * validation. What did NOT survive elsewhere is the route to the
 * signed and promulgated lifecycle values: this dialog is that route.
 *
 * The value is an assertion by the drafter, nothing more. Verification
 * against the issuing authority's copy happens in policy-as-data, which
 * is the only place holding an authoritative copy to compare against.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import type { NLDPLifecycle } from '@/lib/nldp-format';

/** Every lifecycle value, with the wording shown to the drafter. */
export const LIFECYCLE_CHOICES: ReadonlyArray<{
  value: NLDPLifecycle;
  label: string;
  hint: string;
}> = [
  { value: 'draft', label: 'Draft', hint: 'Being written.' },
  { value: 'review', label: 'Review', hint: 'In staffing.' },
  { value: 'final', label: 'Final', hint: 'Drafting complete. NOT signed.' },
  { value: 'signed', label: 'Signed', hint: 'Signature applied.' },
  { value: 'promulgated', label: 'Promulgated', hint: 'Released to the fleet.' },
  { value: 'cancelled', label: 'Cancelled', hint: 'No longer in force.' },
];

interface ExportNLDPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs the export with the lifecycle the drafter chose. */
  onExport: (status: NLDPLifecycle) => void | Promise<void>;
}

export function ExportNLDPDialog({ open, onOpenChange, onExport }: ExportNLDPDialogProps) {
  const [status, setStatus] = useState<NLDPLifecycle>('draft');
  const [busy, setBusy] = useState(false);

  const chosen = LIFECYCLE_CHOICES.find(c => c.value === status);

  const handleExport = async () => {
    setBusy(true);
    try {
      await onExport(status);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Save className="w-4 h-4" /> Export Data Package
          </DialogTitle>
          <DialogDescription>
            State where this document stands. The value travels in the file as
            directiveMetadata.status and tells a receiving system whether it is
            reading a draft or a signed order.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-3 native-scroll">
          <div className="space-y-1.5">
            <Label htmlFor="export-lifecycle">Document lifecycle</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as NLDPLifecycle)}>
              <SelectTrigger id="export-lifecycle" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIFECYCLE_CHOICES.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label} - {c.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chosen && (
              <p className="text-xs text-muted-foreground">{chosen.hint}</p>
            )}
            <p className="text-xs text-muted-foreground">
              &quot;Final&quot; means drafting is complete, not that a commander
              signed it. Choose Signed or Promulgated only when one did.
            </p>
            <p className="text-xs text-muted-foreground">
              This is your assertion. A receiving policy system verifies it
              against the issuing authority&apos;s copy before publishing.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleExport()} disabled={busy}>
            {busy ? 'Exporting...' : 'Export .nldp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
