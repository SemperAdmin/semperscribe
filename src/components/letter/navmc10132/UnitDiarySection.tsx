'use client';

/**
 * NAVMC 10132 unit diary handoff panel.
 *
 * SemperScribe has no MCTFS connectivity, and this panel never implies one.
 * It renders the transcription aid built by unitDiaryBlock() (Phase 6, see
 * src/lib/navmc10132-unit-diary.ts) and gives the user a Copy button. A
 * human reads the block and types the entry into the unit diary themselves.
 *
 * This component writes nothing to formData, it only reads. There is no
 * clobber-rule concern here, unitDiaryBlock() is a pure read over the same
 * FormData every other section already owns.
 *
 * VISIBLE FROM THE ITEM 12 SIGNATURE, not from item 16 (Navmc10132Sections,
 * Stephen's 2026-08-26 ruling). That is early enough that the punishment can
 * still change on appeal, which is what the appealPending branch below warns
 * about. Nothing else about the panel moved.
 *
 * The alreadyReported branch renders first and is the most prominent thing
 * in the section, per unitDiaryBlock's own doc comment, item 16 IS the unit
 * diary entry, and a non-null alreadyReported means this NJP has already
 * been reported. Copying the block again risks a duplicate entry, the
 * highest-consequence mistake this panel can cause. The panel warns, it
 * does not block, the Copy button stays enabled throughout, a clerk
 * correcting a bad entry has a legitimate reason to copy it again.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardList, Copy, AlertTriangle, FileDown } from 'lucide-react';
import { FormData } from '@/types';
import { unitDiaryBlock } from '@/lib/navmc10132-unit-diary';
import { mctfsNjpStatements } from '@/lib/navmc10132-mctfs';
import { renderUnitDiaryWorksheetPdf } from '@/lib/navmc10132-unit-diary-worksheet';
import { copyToClipboard } from '@/lib/url-state';
import { useToast } from '@/hooks/use-toast';

type SectionCardProps = { icon: React.ReactNode; title: string; children: React.ReactNode };

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<SectionCardProps>;
}

export function UnitDiarySection({ formData, SectionCard }: SectionProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const block = React.useMemo(() => unitDiaryBlock(formData), [formData]);
  // The TTC statements are a separate read over the same data. The prose
  // block above remains the HIST: text PRIUM 70503 asks for, so the two are
  // complementary rather than alternatives.
  const mctfs = React.useMemo(() => mctfsNjpStatements(formData), [formData]);

  const handleCopy = async () => {
    const success = await copyToClipboard(block.text);
    if (success) {
      toast({
        title: 'Copied to Clipboard',
        description: 'Unit diary transcription aid copied. Paste it into the unit diary entry yourself.',
      });
    } else {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard. Please try again.',
        variant: 'destructive',
      });
    }
  };

  /**
   * The worksheet download.
   *
   * STEPHEN, 2026-08-26: the panel stays a preview and there is an export
   * "that will have the transactions completed with the proper data based on
   * the PRIUM". The sheet is built by navmc10132-unit-diary-worksheet.ts from
   * the same two derivations this panel renders, so the print and the screen
   * cannot disagree.
   *
   * NOT GATED ON BLOCKERS. A blocker means "do not enter what is below", and
   * the clerk has to be holding the sheet to read it. The panel already shows
   * them above; the sheet repeats them at the top of page one.
   */
  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const sheet = await renderUnitDiaryWorksheetPdf(formData);
      const url = window.URL.createObjectURL(
        new Blob([new Uint8Array(sheet.bytes)], { type: 'application/pdf' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = sheet.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'Could not build the unit diary worksheet.',
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SectionCard icon={<ClipboardList className="mr-2 h-5 w-5" />} title="Unit Diary Handoff">
      <div className="space-y-4">
        {block.alreadyReported && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm font-semibold text-destructive">
              This NJP has already been reported to the unit diary as UD {block.alreadyReported.ud}
              {block.alreadyReported.dtd === '' ? '' : `, dated ${block.alreadyReported.dtd}`}.
              Entering it again creates a duplicate unit diary entry.
            </p>
          </div>
        )}

        {block.appealPending && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              Item 12 records an intent to appeal and item 14 carries no decision yet. The
              reviewing authority can still set aside, mitigate, remit or suspend this
              punishment, so anything entered from the block below may have to be corrected
              once item 14 is signed.
            </p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          This block gathers what a unit diary entry needs from this NAVMC 10132.
          SemperScribe has no MCTFS connection, so copy the text below and type it into the
          unit diary yourself, MCTFSPRIUM governs the entry format.
        </p>

        {!block.reportable && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              No offense on this form carries a Guilty finding, so there is no unit diary
              entry to make. The text below explains why.
            </p>
          </div>
        )}

        {block.missing.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
            <p className="flex items-start gap-1 text-[11px] font-medium text-amber-800">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              This block is missing data the form does not yet carry.
            </p>
            <ul className="ml-5 list-disc space-y-0.5 text-[11px] text-amber-800">
              {block.missing.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <pre className="overflow-x-auto whitespace-pre-wrap rounded border bg-muted/40 px-2 py-2 font-mono text-sm">
          {block.text}
        </pre>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-1 h-4 w-4" />
            Copy unit diary text
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
          >
            <FileDown className="mr-1 h-4 w-4" />
            {downloading ? 'Building...' : 'Download worksheet'}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          The worksheet is this whole panel as a printable page: the HIST text, every
          transaction with its PRIUM citation and notes, a check box against each one, and a
          line at the foot for the UD number that goes back into item 16.
        </p>

        {downloadError && (
          <p className="flex items-start gap-1 text-[11px] text-destructive">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {downloadError}
          </p>
        )}

        {/*
          The MCTFS statements themselves. Kept BELOW the prose block on
          purpose: PRIUM 70503 wants a HIST statement on TTC 268 carrying the
          statistical information and all punishment awarded, and the prose
          block above is that text. The two are one handoff, not two.
        */}
        <div className="space-y-3 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">MCTFS unit diary statements</p>
            <p className="text-[11px] text-muted-foreground">
              Built from this form per MCTFSPRIUM 70502, 70503, 70504, 70507, and 70508. Read
              each one before entering it. SemperScribe has no MCTFS connection and cannot
              check anything against the master file.
            </p>
          </div>

          {mctfs.blockers.length > 0 && (
            <div className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-2">
              <p className="flex items-start gap-1 text-[11px] font-semibold text-destructive">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                Do not enter these statements yet.
              </p>
              <ul className="ml-5 list-disc space-y-0.5 text-[11px] text-destructive">
                {mctfs.blockers.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {mctfs.missing.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
              <p className="text-[11px] font-medium text-amber-800">
                Bracketed placeholders below stand in for data the form does not carry yet:
              </p>
              <ul className="ml-5 list-disc space-y-0.5 text-[11px] text-amber-800">
                {mctfs.missing.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {mctfs.statements.map((statement, i) => (
              <div key={i} className="space-y-1">
                <p className="text-[11px] font-medium">
                  {statement.ttc}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {statement.authority}
                  </span>
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
                  {statement.text}
                </pre>
                {statement.notes.length > 0 && (
                  <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-muted-foreground">
                    {statement.notes.map((note, j) => (
                      <li key={j}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {mctfs.reminders.length > 0 && (
            <div className="space-y-1 rounded-md border border-dashed p-2">
              <p className="text-[11px] font-medium">Follow-on entries this NJP requires</p>
              <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-muted-foreground">
                {mctfs.reminders.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
