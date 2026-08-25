'use client';

/**
 * Items 21 and 16, the structured remark composer plus free text plus the
 * final administrative action fields.
 *
 * Item 21 accepts only the ten formats prescribed by its own instruction.
 * Each row here picks one of those ten kinds and supplies the parameterised
 * part, composeRemarks() from the Phase 2 engine assembles the printed
 * string in the same order the rows are entered. The composed value is the
 * one the form actually prints, so this component derives it on every
 * render and writes it into formData.remarksComposed rather than letting
 * the user type it directly, matching the clobber rule for derived fields.
 *
 * Item 16 locks the form once signed, see the helper text below the two
 * final administrative action fields.
 *
 * THE ITEM 16 CONTROLS ARE STAGE-GATED, hidden before "Final action
 * recorded" (pass 7). Item 16 is the LAST thing entered on this form: its
 * signature carries the form's own FINAL ADMIN INIT lock, which closes every
 * remaining field in Adobe. A unit diary number typed at notification is a
 * number for an entry that has not been made, and it would export into a
 * document the clerk still has six passes of work left on. Item 21 above has
 * no such gate, remarks accrue throughout the case. See OffensesSection's
 * `stage` prop for the same pattern on item 5.
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { IsoDatePicker } from '@/components/letter/navmc10132/IsoDatePicker';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { FormData } from '@/types';
import {
  navmc10132StageAtLeast,
  type Navmc10132Remark,
  type Navmc10132RemarkKind,
  type Navmc10132Stage,
} from '@/types/navmc';
import { composeRemarks, fitsInField } from '@/lib/navmc10132-utils';

type SectionCardProps = { icon: React.ReactNode; title: string; children: React.ReactNode };

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<SectionCardProps>;
  /** See the stage-gating note above the item 16 controls below. */
  stage: Navmc10132Stage;
}

/**
 * The ten formats prescribed by the item 21 instruction, in the same
 * chronological order the instruction lists them. Labels describe the rule
 * being invoked, not the raw kind slug, so a user picking from the Select
 * reads what the remark DOES rather than an internal identifier.
 *
 * PARTIAL ON PURPOSE, and this is a deliberate hole rather than an
 * oversight. Navmc10132RemarkKind also carries 'item6-overflow' and
 * 'item7-overflow', which are written AUTOMATICALLY by PunishmentSection and
 * SuspensionSection when the punishment or suspension text will not fit its
 * printed field. Those two are not clerk-authored formats, and offering them
 * in this picker would let a clerk hand-write a second overflow entry that
 * the automatic writer would then fight over, printing the punishment twice
 * or not at all. The picker is driven by REMARK_KIND_ORDER below, which
 * lists only the authorable kinds, so a new kind added to the type without a
 * decision here simply does not appear rather than crashing.
 */
const REMARK_KIND_META: Partial<
  Record<Navmc10132RemarkKind, { label: string; helper: string; multiline: boolean }>
> = {
  'additional-offenses': {
    label: 'Item 1 additional offenses',
    helper: 'Lettered lines F onward, one offense per line. Do not add offenses after the accused signs.',
    multiline: true,
  },
  forwarded: {
    label: 'Item 2 forwarded for disposition',
    helper: 'Enter the recommendation, for example court martial, NJP, or a specific NJP punishment.',
    multiline: false,
  },
  'suspension-vacated-njp': {
    label: 'Item 7 suspension vacated',
    helper: 'Enter the punishment and the NJP date the suspension was imposed on.',
    multiline: false,
  },
  'appeal-stayed-restriction': {
    label: 'Item 13 appeal stays restriction',
    helper: 'Detail is only the submission date, in d Mmm yy form. The rest of the sentence is fixed text.',
    multiline: false,
  },
  'appeal-stayed-extra-duties': {
    label: 'Item 13 appeal stays extra duties',
    helper: 'Detail is only the submission date, in d Mmm yy form. The rest of the sentence is fixed text.',
    multiline: false,
  },
  'appeal-denied': {
    label: 'Item 14 appeal denied',
    helper: 'Enter the reason the appeal was denied.',
    multiline: false,
  },
  'appeal-granted': {
    label: 'Item 14 appeal granted',
    helper: 'Enter the relief given.',
    multiline: false,
  },
  'suspension-vacated-appeal': {
    label: 'Item 14 suspension vacated',
    helper: 'Enter the punishment and the appeal date the suspension was imposed on.',
    multiline: false,
  },
  'set-aside': {
    label: 'Item 14 punishment set aside',
    helper: 'Enter the punishment that is set aside. Rights, privileges and property affected are restored.',
    multiline: false,
  },
  'additional-victims': {
    label: 'Item 22 additional victims',
    helper: 'Lettered lines B onward, one victim per line. Do not add victims after the accused signs.',
    multiline: true,
  },
};

const REMARK_KIND_ORDER: Navmc10132RemarkKind[] = [
  'additional-offenses',
  'forwarded',
  'suspension-vacated-njp',
  'appeal-stayed-restriction',
  'appeal-stayed-extra-duties',
  'appeal-denied',
  'appeal-granted',
  'suspension-vacated-appeal',
  'set-aside',
  'additional-victims',
];

function emptyRemark(): Navmc10132Remark {
  return { date: '', kind: 'forwarded', detail: '' };
}

function remarksOf(formData: FormData): Navmc10132Remark[] {
  return Array.isArray(formData.remarks) ? (formData.remarks as Navmc10132Remark[]) : [];
}

export function RemarksSection({ formData, setFormData, SectionCard, stage }: SectionProps) {
  const remarks = remarksOf(formData);
  const freeText = (formData.remarksFreeText as string) ?? '';

  const composed = React.useMemo(
    () => composeRemarks(remarks, freeText),
    [remarks, freeText],
  );

  // Derived field, written here rather than typed, so the printed value and
  // the preview can never disagree. Guarded so it only writes on change.
  React.useEffect(() => {
    if (formData.remarksComposed !== composed) {
      setFormData((prev) => ({ ...prev, remarksComposed: composed }));
    }
  }, [composed, formData.remarksComposed, setFormData]);

  const fits = fitsInField('21 REMARKS', composed);

  const updateRemark = (index: number, patch: Partial<Navmc10132Remark>) => {
    setFormData((prev) => {
      const next = remarksOf(prev).slice();
      next[index] = { ...next[index], ...patch };
      return { ...prev, remarks: next };
    });
  };

  const addRemark = () => {
    setFormData((prev) => ({ ...prev, remarks: [...remarksOf(prev), emptyRemark()] }));
  };

  const removeRemark = (index: number) => {
    setFormData((prev) => {
      const next = remarksOf(prev).slice();
      next.splice(index, 1);
      return { ...prev, remarks: next };
    });
  };

  return (
    <SectionCard icon={<FileText className="mr-2 h-5 w-5" />} title="Items 21 and 16, Remarks">
      <div className="space-y-4">
        {remarks.map((remark, index) => {
          // Falls back rather than indexing into nothing. REMARK_KIND_META is
          // Partial because the two overflow kinds are synthesised at EXPORT
          // time by navmc10132-acroform.ts and never stored in remarks[], so
          // this branch is unreachable for anything this section created. It
          // stays defensive because an imported draft is not this section's
          // own output, and a missing label must not take the page down.
          const meta = REMARK_KIND_META[remark.kind] ?? {
            label: remark.kind,
            helper: 'This remark is written automatically at export and is not edited here.',
            multiline: false,
          };
          const isStayKind = remark.kind === 'appeal-stayed-restriction'
            || remark.kind === 'appeal-stayed-extra-duties';
          return (
            <div key={index} className="rounded-md border p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                <div className="sm:w-40">
                  <Label className="text-xs">Date</Label>
                  <IsoDatePicker
                    value={remark.date}
                    onChange={(value: string) => updateRemark(index, { date: value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Kind</Label>
                  <Select
                    value={remark.kind}
                    onValueChange={(value) => updateRemark(index, { kind: value as Navmc10132RemarkKind })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a rule" />
                    </SelectTrigger>
                    <SelectContent>
                      {REMARK_KIND_ORDER.map((kind) => (
                        <SelectItem key={kind} value={kind}>{REMARK_KIND_META[kind]?.label ?? kind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start justify-end sm:pt-5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRemark(index)}
                    aria-label="Remove remark"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-2">
                <Label className="text-xs">
                  {isStayKind ? 'Submission date (d Mmm yy)' : 'Detail'}
                </Label>
                {meta.multiline ? (
                  <Textarea
                    value={remark.detail}
                    onChange={(e) => updateRemark(index, { detail: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <Input
                    value={remark.detail}
                    onChange={(e) => updateRemark(index, { detail: e.target.value })}
                    placeholder={isStayKind ? 'e.g. 4 Mar 26' : undefined}
                  />
                )}
                <p className="text-[11px] text-muted-foreground mt-1">{meta.helper}</p>
              </div>
            </div>
          );
        })}

        <Button type="button" variant="outline" size="sm" onClick={addRemark}>
          <Plus className="mr-1 h-4 w-4" />
          Add remark
        </Button>
      </div>

      <div className="mt-6">
        <Label className="text-xs">Free text</Label>
        <Textarea
          value={freeText}
          onChange={(e) => setFormData((prev) => ({ ...prev, remarksFreeText: e.target.value }))}
          rows={3}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Free text appends after the structured block above. It must not
          contain victim personally identifying information.
        </p>
      </div>

      <div className="mt-4">
        <Label className="text-xs">Item 21 preview, as it will print</Label>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border bg-muted p-2 font-mono text-xs">
          {composed || ' '}
        </pre>
        {!fits && (
          <p className="text-[11px] text-destructive mt-1">
            At least one line of this block is wider than item 21 can hold.
            The block's total length may still be fine, it is a single line
            that needs to be shortened.
          </p>
        )}
      </div>

      {navmc10132StageAtLeast(stage, 7) ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Item 16, unit diary (UD)</Label>
              <Input
                value={(formData.finalAdminUd as string) ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, finalAdminUd: e.target.value }))}
                className="w-40"
                maxLength={20}
              />
            </div>
            <div>
              <Label className="text-xs">Item 16, date (DTD)</Label>
              <Input
                value={(formData.finalAdminDtd as string) ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, finalAdminDtd: e.target.value }))}
                className="w-40"
                maxLength={20}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Signing item 16 locks the entire form in Adobe. The unit diary entry
            that follows must comply with MCTFSPRIUM.
          </p>
        </>
      ) : (
        <div className="mt-6">
          <Label className="text-xs">Item 16, final administrative action</Label>
          <p className="text-[11px] text-muted-foreground mt-1">
            Not yet. Item 16 records the unit diary entry made after the case is
            closed, and signing it locks the entire form in Adobe, so it opens at
            the Final action recorded stage.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
