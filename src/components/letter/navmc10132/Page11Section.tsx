'use client';

/**
 * The two NAVMC 118(11) entries this NJP produces.
 *
 * STEPHEN, 2026-08-26: two Page 11 entries from the NJP data, the 6105
 * counseling on one side and the promotion restriction on the other,
 * "towards the end after the NJP proceedings and before an appeal". That is
 * where this card sits: after item 7, before the appeal block.
 *
 * WHY THERE AND NOT IN FORM ORDER. Both entries are made BECAUSE of the
 * punishment, so neither can be written before item 6 is. Both OPEN with the
 * item 10 disposition notice date, Stephen's ruling 2026-08-27 ("item 10 is
 * the date of NJP"), which is the day the Marine is stood in front of the
 * entry. Item 6 still drives the unit diary and every MCTFS DOA. The promotion
 * restriction states the period a suspension runs, which is item 7. And both
 * are acknowledged by the Marine before the appeal window matters, so a
 * clerk working top to bottom reaches them in the order the case happens.
 *
 * THE APP FILLS WHAT THE FORM KNOWS. The date, the deficiencies, the article,
 * the grade and the restriction period all come off the NJP. The corrective
 * action, the assistance available and the commander's separation intent do
 * not exist on a NAVMC 10132, so they are collected here. The entry
 * generates either way and names its own blanks, because a counseling entry
 * a clerk can see is incomplete beats one that silently is.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileText, AlertTriangle, Info } from 'lucide-react';
import { FormData } from '@/types';
import {
  njpPage11,
  renderNjpPage11,
  drugRestrictionApplies,
  type CounselingInput,
  type SeparationIntent,
} from '@/lib/navmc10132-page11';
import { IsoDatePicker } from '@/components/letter/navmc10132/IsoDatePicker';

type SectionCardProps = { icon: React.ReactNode; title: string; children: React.ReactNode };

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<SectionCardProps>;
}

function text(formData: FormData, key: string): string {
  const value: unknown = (formData as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

export function Page11Section({ formData, setFormData, SectionCard }: SectionProps) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const intent = text(formData, 'page11SeparationIntent') as SeparationIntent;
  const input: CounselingInput = {
    correctiveAction: text(formData, 'page11CorrectiveAction'),
    assistanceAvailable: text(formData, 'page11AssistanceAvailable'),
    intent,
    processingDetail: text(formData, 'page11ProcessingDetail'),
  };

  // Rendered on every render rather than memoised, the same way the
  // punishment preview is: these are pure string builders over small inputs.
  // The PREVIEW AND THE PDF READ ONE FUNCTION, so what is shown is what
  // generates.
  const page = njpPage11(formData, input);

  const set = (key: string) => (value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const document_ = await renderNjpPage11(formData, input);
      const url = window.URL.createObjectURL(document_.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = document_.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the Page 11.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      icon={<FileText className="mr-2 h-5 w-5" />}
      title="Page 11 entries (NAVMC 118(11))"
    >
      <div className="space-y-4">
        <p className="text-[11px] text-muted-foreground">
          One NAVMC 118(11) carrying both entries this NJP produces: the 6105 administrative
          separation counseling on the left (IRAM 4006.2r) and the promotion restriction on the
          right (IRAM 4006.3e as amended by PAA 09/11, 10/11 and 12/11). The deficiencies,
          article, grade and restriction period come off this form. Both entries open with the
          item 10 disposition notice date, which is the day the Marine is counseled on them.
        </p>

        <div className="space-y-1">
          <Label className="text-xs">Recommended corrective action</Label>
          <Textarea
            rows={2}
            placeholder="What the Marine is directed to do."
            value={input.correctiveAction}
            onChange={(e) => set('page11CorrectiveAction')(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Required by IRAM 4006.2r. Not on the NAVMC 10132, so the app cannot supply it.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Assistance available</Label>
          <Textarea
            rows={2}
            placeholder="What the unit offers: SACO, chaplain, MCCS counseling, mentorship."
            value={input.assistanceAvailable}
            onChange={(e) => set('page11AssistanceAvailable')(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Required by IRAM 4006.2r.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Separation or judicial processing</Label>
          <Select value={intent} onValueChange={set('page11SeparationIntent')}>
            <SelectTrigger><SelectValue placeholder="Select what the commander intends" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="not-processing">
                Not processing for separation over these deficiencies
              </SelectItem>
              <SelectItem value="processing">
                Processing for judicial or separation proceedings
              </SelectItem>
            </SelectContent>
          </Select>
          {/* 4006.2r requires ONE of two statements and the app cannot infer
              which. Not processing prints the paragraph's own sentence
              verbatim; processing needs the commander to say what for. */}
          <p className="text-[11px] text-muted-foreground">
            IRAM 4006.2r requires one of two statements in the entry, and only the commander
            knows which.
          </p>
        </div>

        {intent === 'processing' && (
          <div className="space-y-1">
            <Label className="text-xs">What the Marine is being processed for</Label>
            <Textarea
              rows={2}
              placeholder="e.g. administrative separation for a pattern of misconduct"
              value={input.processingDetail}
              onChange={(e) => set('page11ProcessingDetail')(e.target.value)}
            />
          </div>
        )}

        {/* SHOWN ONLY ON A DRUG NJP, because the date it collects starts a
            clock no other entry uses. MCO P1400.32D par 1204.4q runs 18
            months from the laboratory confirmation or the incident, and both
            fall BEFORE the NJP, so nothing on the NAVMC 10132 supplies it.
            Stephen, 2026-08-27: "q is before the NJP and would cover the
            period of the NJP so it would supersede the NJP but would be
            effective possibly before the NJP took place." */}
        {drugRestrictionApplies(formData) && (
          <div className="space-y-1 rounded-md border border-dashed p-3">
            <Label className="text-xs" htmlFor="drug-restriction-start">
              Date of positive laboratory confirmation, or of the drug incident
            </Label>
            <IsoDatePicker
              value={text(formData, 'drugRestrictionStartDate')}
              onChange={set('drugRestrictionStartDate')}
            />
            <p className="text-[11px] text-muted-foreground">
              Does not print on the NAVMC 10132. A guilty finding on a drug offense puts this
              Marine under MCO P1400.32D par 1204.4q, an 18-month restriction that takes
              precedence over the 3-month NJP restriction at par 1204.4j. The order starts the
              18 months at laboratory confirmation or at the incident, not at the NJP, so the
              period is already running when the punishment is imposed. Par 1204.6 permits no
              waiver of it.
            </p>
          </div>
        )}

        {page.missing.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
            <p className="flex items-start gap-1 text-[11px] font-medium text-amber-800">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              The entry below carries a named blank for each of these.
            </p>
            <ul className="ml-5 list-disc space-y-0.5 text-[11px] text-amber-800">
              {page.missing.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-[11px] font-medium">Left column, 6105 counseling (IRAM 4006.2r)</p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded border bg-muted/40 px-2 py-2 text-xs">
            {page.remarksLeft}
          </pre>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium">
            Right column, promotion restriction (IRAM 4006.3e)
          </p>
          {page.restrictionOmitted ? (
            // AN EMPTY RIGHT COLUMN IS USUALLY CORRECT. 4006.3e reaches
            // privates through corporals only, so a sergeant's form carries
            // the counseling entry alone, and saying why beats a blank box
            // that reads as a defect.
            <p className="flex items-start gap-1 rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {page.restrictionOmitted}
            </p>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded border bg-muted/40 px-2 py-2 text-xs">
              {page.remarksRight}
            </pre>
          )}
        </div>

        {/* WHAT THE BUTTON IS ABOUT TO PRODUCE, said next to the button.
            Stephen, 2026-08-26, looking at a generated form: "where is the
            right hand side Pg. 11 entry for promotion restriction". It was
            correctly absent, his accused being an E8, and the reason was on
            screen. It was two preview blocks further up, and the PRINTED
            form carries no explanation at all: a blank right column reads as
            a bug rather than as the paragraph not reaching that Marine. */}
        <p className="text-[11px] text-muted-foreground">
          {page.restrictionOmitted
            ? 'This will produce a form carrying the 6105 counseling entry only. The right column is empty on purpose, see above.'
            : 'This will produce a form carrying both entries, the 6105 on the left and the promotion restriction on the right.'}
        </p>

        <Button type="button" variant="outline" size="sm" onClick={generate} disabled={busy}>
          <FileText className="mr-1 h-4 w-4" />
          {busy ? 'Generating...' : 'Generate Page 11'}
        </Button>

        {error && (
          <p className="flex items-start gap-1 text-[11px] text-destructive">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
