'use client';

/**
 * What loading a signed UPB found, shown to the clerk.
 *
 * WHY THIS IS A PANEL AND NOT A TOAST. A toast says a load happened and
 * then leaves. The things worth saying here outlive that moment: which
 * fields a signature closed and can no longer be edited, where the file and
 * the app disagreed, and which parts of the file this app carries as text
 * rather than as data. A clerk picks the case up next week and needs all
 * three still on the screen.
 *
 * THE REPORT LIVES ON DOCUMENT STATE, alongside `vesselException` and
 * `stage`, which are app-only in the same way. That is deliberate: it
 * survives a save and a reload, so a flag raised on Tuesday is still there
 * on Friday. The acroform writer only writes field names it knows, so the
 * report never reaches the PDF.
 *
 * THE CONFLICT LIST IS THE POINT. Stephen's ruling was that the uploaded
 * form is the truth "but if wrong for any reason can be flagged". A locked
 * conflict is the case he was describing: the file says something the app
 * disagrees with, inside a section a signature has closed, so nothing in
 * this app can change it. Saying so IS the remedy, which is why locked
 * conflicts are separated out and named rather than mixed in.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileCheck2, AlertTriangle, Lock, FileText, X } from 'lucide-react';
import { FormData } from '@/types';
import { NAVMC_10132_STAGE_INFO, type Navmc10132Stage } from '@/types/navmc';

interface LoadReportConflict {
  label: string;
  fromFile: string;
  fromForm: string;
  locked: boolean;
}

interface LoadReport {
  fileName: string;
  stage: Navmc10132Stage;
  signedSignatures: string[];
  lockedFieldCount: number;
  conflicts: LoadReportConflict[];
  carriedFromFile: { label: string; value: string }[];
  notes: string[];
}

/** Narrowed through unknown rather than cast off the `any` index signature,
 *  matching every other reader of document state. */
function readReport(formData: FormData): LoadReport | null {
  const value: unknown = formData.navmc10132LoadReport;
  if (!value || typeof value !== 'object') return null;
  const report = value as Partial<LoadReport>;
  if (typeof report.fileName !== 'string') return null;
  return {
    fileName: report.fileName,
    stage: (report.stage ?? 1) as Navmc10132Stage,
    signedSignatures: report.signedSignatures ?? [],
    lockedFieldCount: report.lockedFieldCount ?? 0,
    conflicts: report.conflicts ?? [],
    carriedFromFile: report.carriedFromFile ?? [],
    notes: report.notes ?? [],
  };
}

function ValuePair({ conflict }: { conflict: LoadReportConflict }) {
  return (
    <div className="text-[11px]">
      <span className="font-medium">{conflict.label}</span>
      <div className="mt-0.5 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">File: </span>
          <span className="font-mono">{conflict.fromFile || '(blank)'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">App: </span>
          <span className="font-mono">{conflict.fromForm || '(blank)'}</span>
        </div>
      </div>
    </div>
  );
}

export function LoadReportPanel({
  formData,
  setFormData,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const report = readReport(formData);
  if (!report) return null;

  const locked = report.conflicts.filter((c) => c.locked);
  const open = report.conflicts.filter((c) => !c.locked);
  const stageLabel = NAVMC_10132_STAGE_INFO[report.stage]?.label ?? String(report.stage);

  return (
    <div className="mb-6 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Loaded from {report.fileName}</p>
            <p className="text-[11px] text-muted-foreground">
              {report.signedSignatures.length} signature
              {report.signedSignatures.length === 1 ? '' : 's'} found, closing{' '}
              {report.lockedFieldCount} field{report.lockedFieldCount === 1 ? '' : 's'}. The stage
              was set to {stageLabel} from the file rather than by hand.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Dismiss the load report"
          onClick={() => setFormData((prev) => ({ ...prev, navmc10132LoadReport: undefined }))}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {report.signedSignatures.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {report.signedSignatures.map((name) => (
            <Badge key={name} variant="outline" className="text-[10px]">
              <Lock className="mr-1 h-3 w-3" />
              {name}
            </Badge>
          ))}
        </div>
      )}

      {/* LOCKED FIRST, because it is the one the clerk cannot act on in this
          app and therefore the one most likely to be missed. */}
      {locked.length > 0 && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {locked.length} difference{locked.length === 1 ? '' : 's'} inside a signed section
          </div>
          <p className="text-[11px] text-destructive/90">
            The file wins on these, and nothing in this app can change them: a signature has
            closed the field. If the file is wrong, it has to be corrected outside the app,
            which means a new signature.
          </p>
          {locked.map((c) => (
            <ValuePair key={c.label} conflict={c} />
          ))}
        </div>
      )}

      {open.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            {open.length} difference{open.length === 1 ? '' : 's'} you can still edit
          </div>
          <p className="text-[11px] text-amber-800">
            Where the file carried a value it won. Where the file was blank the app kept what
            you had entered, because a blank field on the file is work that has not been done
            on paper yet, not an instruction to erase yours.
          </p>
          {open.map((c) => (
            <ValuePair key={c.label} conflict={c} />
          ))}
        </div>
      )}

      {report.carriedFromFile.length > 0 && (
        <div className="mt-3 rounded-md border p-2 space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <FileText className="h-3.5 w-3.5" />
            Carried from the file as text
          </div>
          <p className="text-[11px] text-muted-foreground">
            These print exactly as they are and stay in the file. This app cannot rebuild them
            into editable rows, so it does not re-check them.
          </p>
          {report.carriedFromFile.map((c) => (
            <div key={c.label} className="text-[11px]">
              <span className="font-medium">{c.label}: </span>
              <span className="font-mono">{c.value}</span>
            </div>
          ))}
        </div>
      )}

      {report.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {report.notes.map((note, i) => (
            <li key={i} className="text-[11px] text-muted-foreground">
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
