'use client';

/**
 * The commanding officer's NJP proceeding script, JAGMAN Appendix A-1-f.
 *
 * WIRING THAT WAS MISSING, NOT A NEW MODULE. `njp-a1-script.ts` has been
 * complete and tested since an earlier session and was imported by no
 * component, only by its own tests. Stephen, 2026-08-26: "We never added in
 * the script." Exactly the state the rights advisement was in before its
 * button landed, and the same fix.
 *
 * WHY IT HAS ITS OWN SECTION, and no longer sits inside the punishment
 * card. Stephen, 2026-08-26: it "should be in the Offenses and findings
 * (items 1 and 5) or in its own section and not in the Punishment (Items 6
 * and 10) as the results of the form will be added to the Punishment (Items
 * 6 and 10) section."
 *
 * He is right and the original placement had the causation backwards. The
 * script is the INPUT to the hearing: the commanding officer carries it in,
 * reads it, and what comes out is written into items 5 and 6 afterwards.
 * Filing it inside the card holding those results put the cause inside the
 * effect. Its own card, between the offenses it reads out and the punishment
 * it produces, is the order the proceeding actually runs in.
 *
 * IT GENERATES BEFORE THE HEARING, ON PURPOSE. The commanding officer reads
 * the script IN ORDER TO reach the findings and the punishment, so
 * requiring either first would mean the document could only be produced
 * after the proceeding it exists to conduct. Both print blank when unset,
 * exactly as the paper appendix does, and the panel says which ones will be
 * blank rather than letting the CO discover it at the hearing.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, AlertTriangle } from 'lucide-react';
import { FormData } from '@/types';
import {
  njpScriptReadiness,
  renderNjpProceedingScript,
  announcedFindings,
  chargedOffenses,
  scriptWorksheetGaps,
} from '@/lib/njp-package';

export function ProceedingScriptButton({
  formData,
  SectionCard,
}: {
  formData: FormData;
  /** Optional, so the bare panel still renders for any caller without one. */
  SectionCard?: React.ComponentType<{
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
  }>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const readiness = njpScriptReadiness(formData);

  const offenses = chargedOffenses(formData);
  // The same function the PDF is built from, not a second count beside it.
  // An independent re-derivation here is how the panel ends up promising a
  // different document from the one the button produces.
  const guilty = announcedFindings(formData).length;
  const punishments = Array.isArray(formData.punishments) ? formData.punishments.length : 0;
  // ADVICE, NOT A GATE. Neither the menu nor the ceilings stop the script
  // printing, so these sit apart from `readiness.missing`, which does.
  const gaps = scriptWorksheetGaps(formData);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const doc = await renderNjpProceedingScript(formData);
      const url = window.URL.createObjectURL(
        new Blob([new Uint8Array(doc.bytes)], { type: 'application/pdf' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the script.');
    } finally {
      setBusy(false);
    }
  };

  const panel = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">
            What the commanding officer reads aloud at the hearing. The violations are filled
            from item 1; the findings and the punishment are filled from items 5 and 6 if they
            are already recorded.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={generate} disabled={busy || !readiness.ready}>
          <FileText className="mr-1 h-4 w-4" />
          {busy ? 'Generating...' : 'Generate'}
        </Button>
      </div>

      {!readiness.ready && (
        <p className="text-[11px] text-muted-foreground">
          Still needed: {readiness.missing.join(', ')}.
        </p>
      )}

      {readiness.ready && punishments === 0 && (
        <p className="text-[11px] text-muted-foreground">
          {gaps.length === 0
            ? 'The punishment menu and the forfeiture ceilings will print under item 6 for the commanding officer to mark at the hearing.'
            : `Before printing: ${gaps.join('; ')}.`}
        </p>
      )}

      {readiness.ready && (
        <p className="text-[11px] text-muted-foreground">
          {offenses.length} violation{offenses.length === 1 ? '' : 's'} will be read out.{' '}
          {guilty === 0
            ? 'No guilty finding is recorded yet, so the findings rule prints blank for the hearing.'
            : `${guilty} guilty finding${guilty === 1 ? '' : 's'} will be announced.`}{' '}
          {punishments === 0
            ? 'No punishment is recorded yet, so the script prints as a worksheet for the hearing.'
            : 'The punishment will be announced as item 6 renders it, and no menu prints.'}
        </p>
      )}

      {/* Every ACC: and WIT: line stays blank by design. Those are the
          accused's and the witnesses' own words, written at the hearing. */}
      <p className="text-[11px] text-muted-foreground">
        Every response line is left blank for hand completion at the hearing, along with the
        appeal authority and advisor, which the NAVMC 10132 does not carry.
      </p>

      {error && (
        <p className="flex items-start gap-1 text-[11px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );

  // NO SECTION CARD, NO CARD. The button still renders bare where a caller
  // has no SectionCard to give it, so nothing has to change twice.
  if (!SectionCard) return <div className="mt-4 rounded-md border border-dashed p-3">{panel}</div>;

  return (
    <SectionCard
      icon={<FileText className="mr-2 h-5 w-5" />}
      title="NJP proceeding script (JAGMAN Appendix A-1-f)"
    >
      {panel}
    </SectionCard>
  );
}
