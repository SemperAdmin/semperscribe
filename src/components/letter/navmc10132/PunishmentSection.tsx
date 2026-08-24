'use client';

/**
 * NAVMC 10132 items 6 and 10, the punishment builder.
 *
 * On paper, item 6 is free text. This component replaces that with a
 * structured builder over the MCTFS punishment codes (N01 through N17,
 * navmc10132-punishments.ts). A structured entry is what lets the export
 * gate check a code's ceiling and its required authority grade without
 * parsing prose, and it is what lets the app measure the rendered result
 * against a field that clips silently at roughly 123 characters. A parser
 * over free text cannot do either reliably. See docs/NAVMC_10132_SPEC.md
 * section 11.3 for the full rationale.
 *
 * The list is variable length (zero or more punishments per booking), so
 * this is add and remove, not the collapse-and-add pattern used for the
 * form's fixed-row grids elsewhere in this app.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { IsoDatePicker } from '@/components/letter/navmc10132/IsoDatePicker';
import { FormData } from '@/types';
import {
  Gavel, Plus, Trash2, AlertTriangle, HelpCircle, Info,
} from 'lucide-react';

import {
  renderPunishment, Navmc10132PunishmentRenderError,
  fitsInField, overflowBy,
  resolvePunishment, authoritySatisfies,
  NAVMC_10132_RELEASE_ONE_PUNISHMENTS,
} from '@/lib/navmc10132-utils';

import {
  type Navmc10132PunishmentEntry,
} from '@/types/navmc';

type SectionCardProps = { icon: React.ReactNode; title: string; children: React.ReactNode };
interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<SectionCardProps>;
}

const FIELD_NAME = '6 PUNISHMENT IMPOSED';

function currentPunishments(formData: FormData): Navmc10132PunishmentEntry[] {
  return Array.isArray(formData.punishments)
    ? (formData.punishments as Navmc10132PunishmentEntry[])
    : [];
}

export function PunishmentSection({ formData, setFormData, SectionCard }: SectionProps) {
  const punishments = currentPunishments(formData);
  const [codeToAdd, setCodeToAdd] = React.useState('');

  // Concurrency describes how two or more punishments combine (MCM Part V
  // para 5.d), so it belongs to the set rather than to any single code. It
  // lives in formData, NOT in component state: the Phase 5 exporter reads
  // formData.punishmentsConcurrent, and a useState the exporter cannot see
  // would silently drop "to run concurrently" from the printed item 6.
  // It appears in no Navmc10132Definition section, so the DynamicForm
  // clobber rule still holds.
  //
  // The flag is DERIVED down to false below two punishments rather than
  // reset by an effect. Nothing concurrent exists with one punishment, and
  // deriving keeps a stale true out of the renderer without a write during
  // render.
  const concurrent = punishments.length >= 2 && Boolean(formData.punishmentsConcurrent);
  const setConcurrent = (next: boolean) =>
    setFormData((prev) => ({ ...prev, punishmentsConcurrent: next }));

  const updateEntries = React.useCallback(
    (updater: (list: Navmc10132PunishmentEntry[]) => Navmc10132PunishmentEntry[]) => {
      setFormData((prev) => ({
        ...prev,
        punishments: updater(currentPunishments(prev)),
      }));
    },
    [setFormData]
  );

  const addPunishment = () => {
    if (!codeToAdd) return;
    updateEntries((list) => [...list, { code: codeToAdd }]);
    setCodeToAdd('');
  };

  const removePunishment = (index: number) => {
    updateEntries((list) => list.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, patch: Partial<Navmc10132PunishmentEntry>) => {
    updateEntries((list) => list.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  // Rendered on every render, not memoised. The inputs are small strings
  // and renderPunishment is a pure string builder, so recomputing costs
  // nothing worth guarding against. A bad code or a missing required
  // parameter throws Navmc10132PunishmentRenderError, which is expected
  // input, not a bug, so it is caught here rather than left to an error
  // boundary.
  let previewText = '';
  let previewError: string | null = null;
  try {
    // renderPunishment returns { text, length }. The length is the measured
    // character count the caller needs for the item 6 capacity check.
    previewText = renderPunishment(punishments, { concurrent }).text;
  } catch (err) {
    if (err instanceof Navmc10132PunishmentRenderError) {
      previewError = err.message;
    } else {
      throw err;
    }
  }

  const fits = previewError ? true : fitsInField(FIELD_NAME, previewText);
  const overCount = !previewError && !fits ? overflowBy(FIELD_NAME, previewText) : 0;

  // Render-loop guard. This effect writes the derived preview into
  // formData.punishmentImposed, which is a field this component owns
  // exclusively (absent from the DynamicForm schema, see the clobber rule
  // in the house style notes). The dependency array is the two primitive
  // values, not formData or punishments, and the body compares against
  // the field's current value before writing. A render that recomputes
  // the same text is a no-op here, so the effect cannot retrigger itself.
  // Only an actual change in the rendered text or error state, which only
  // happens on a real edit, produces a write, and that write settles on
  // the next render because the comparison then finds nothing left to do.
  React.useEffect(() => {
    const nextImposed = previewError ? '' : previewText;
    if ((formData.punishmentImposed ?? '') !== nextImposed) {
      setFormData((prev) => ({ ...prev, punishmentImposed: nextImposed }));
    }
  }, [previewText, previewError, formData.punishmentImposed, setFormData]);

  // Same guard shape for the overflow flag. This only clears the flag
  // when the text has shrunk back under the field's capacity, it never
  // sets it, so it cannot fight with the user's own checkbox below.
  React.useEffect(() => {
    if (fits && formData.punishmentOverflowToItem21) {
      setFormData((prev) => ({ ...prev, punishmentOverflowToItem21: false }));
    }
  }, [fits, formData.punishmentOverflowToItem21, setFormData]);

  return (
    <SectionCard icon={<Gavel className="mr-2 h-5 w-5" />} title="Punishment (Items 6 and 10)">
      <div className="space-y-4">
        <div className="space-y-3">
          {punishments.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              No punishments added yet. Select a code below and add it.
            </p>
          )}
          {punishments.map((entry, index) => {
            const code = resolvePunishment(entry.code);
            return (
              <Card key={index} className="border-muted">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 py-3">
                  <div>
                    <CardTitle className="text-sm">
                      {entry.code}
                      {code ? ` - ${code.description}` : ' (unrecognised code)'}
                    </CardTitle>
                    {code && (
                      <p className="text-[11px] text-muted-foreground">{code.statute}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePunishment(index)}
                    aria-label={`Remove punishment ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                {code && (
                  <CardContent className="space-y-3 pt-0">
                    <ParameterInputs code={code} entry={entry} onChange={(patch) => updateEntry(index, patch)} />
                    <EntryWarnings code={code} entry={entry} authorityGrade={(formData.njpAuthorityPayGrade as string) ?? ''} />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
          <div className="min-w-[280px] flex-1 space-y-1">
            <Label className="text-xs">Add a punishment</Label>
            <Select value={codeToAdd} onValueChange={setCodeToAdd}>
              <SelectTrigger>
                <SelectValue placeholder="Select a punishment code" />
              </SelectTrigger>
              <SelectContent>
                {NAVMC_10132_RELEASE_ONE_PUNISHMENTS.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.code} - {p.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={addPunishment} disabled={!codeToAdd}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
        <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Officer punishments (N01, N02, N03) are out of scope for this release, which covers
          enlisted booking only. N05 is withheld pending confirmation against MCTFSPRIUM,
          it appears to duplicate N14 and N15 for a 60 day restriction, use one of those
          instead. Neither is hidden by accident, both are excluded on purpose.
        </p>

        {punishments.length >= 2 && (
          <div className="flex items-center gap-2 rounded-md border p-3">
            <Checkbox
              id="punishments-concurrent"
              checked={concurrent}
              onCheckedChange={(checked) => setConcurrent(checked === true)}
            />
            <Label htmlFor="punishments-concurrent" className="text-sm">
              Punishments run concurrently
            </Label>
            <p className="ml-2 text-[11px] text-muted-foreground">
              Governs how the set combines in the rendered text, per MCM Part V para 5.d.
            </p>
          </div>
        )}

        <div className="space-y-2 rounded-md border p-3">
          <Label className="text-xs">Item 6 preview, as it will print</Label>
          <div className="rounded border bg-muted/40 px-2 py-2 text-sm">
            {previewError ? (
              <span className="text-destructive">{previewError}</span>
            ) : previewText ? (
              previewText
            ) : (
              <span className="text-muted-foreground">Nothing to render yet.</span>
            )}
          </div>
          {!previewError && (
            <p className="text-[11px] text-muted-foreground">
              {previewText.length} of about 123 characters used.
              {!fits && ` Over by roughly ${overCount} characters.`}
            </p>
          )}
          {!previewError && !fits && (
            <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
              <p className="flex items-start gap-1 text-[11px]">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                This rendered punishment does not fit item 6. MCO 5800.16 Vol 14 para 011103
                prescribes the escape hatch, item 6 reads "See Supplemental Page" and the full
                text goes in item 21 instead.
              </p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="punishment-overflow"
                  checked={!!formData.punishmentOverflowToItem21}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, punishmentOverflowToItem21: checked === true }))
                  }
                />
                <Label htmlFor="punishment-overflow" className="text-xs">
                  Send full text to item 21, item 6 reads See Supplemental Page
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This is not rare. The MCO's own worked example for combined punishments renders
                to 160 characters against this 123 character field.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Item 6 punishment date</Label>
            <IsoDatePicker
              value={(formData.punishmentDate as string) ?? ''}
              onChange={(value: string) => setFormData((prev) => ({ ...prev, punishmentDate: value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Item 10 disposition notice date</Label>
            <IsoDatePicker
              value={(formData.dispositionNoticeDate as string) ?? ''}
              onChange={(value: string) =>
                setFormData((prev) => ({ ...prev, dispositionNoticeDate: value }))
              }
            />
            <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
              <HelpCircle className="mt-0.5 h-3 w-3 shrink-0" />
              Normally the same date as item 6, except where notice is given by mail.
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ParameterInputs({
  code,
  entry,
  onChange,
}: {
  code: ReturnType<typeof resolvePunishment>;
  entry: Navmc10132PunishmentEntry;
  onChange: (patch: Partial<Navmc10132PunishmentEntry>) => void;
}) {
  if (!code) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {code.parameters.map((param) => {
        switch (param) {
          case 'days':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">Days</Label>
                <Input
                  type="number"
                  value={entry.days ?? ''}
                  onChange={(e) => onChange({ days: e.target.value })}
                />
              </div>
            );
          case 'limits':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">Limits</Label>
                <Input
                  type="text"
                  value={entry.limits ?? ''}
                  onChange={(e) => onChange({ limits: e.target.value })}
                />
              </div>
            );
          case 'dollars':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">Forfeiture</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="text"
                    value={entry.dollars ?? ''}
                    onChange={(e) => onChange({ dollars: e.target.value })}
                  />
                </div>
              </div>
            );
          case 'dollarsPerMonth':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">Forfeiture per month</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="text"
                    value={entry.dollarsPerMonth ?? ''}
                    onChange={(e) => onChange({ dollarsPerMonth: e.target.value })}
                  />
                </div>
              </div>
            );
          case 'months':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">Months</Label>
                <Input
                  type="number"
                  value={entry.months ?? ''}
                  onChange={(e) => onChange({ months: e.target.value })}
                />
              </div>
            );
          case 'gradeReducedTo':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">Grade reduced to</Label>
                <Input
                  type="text"
                  value={entry.gradeReducedTo ?? ''}
                  onChange={(e) => onChange({ gradeReducedTo: e.target.value })}
                />
              </div>
            );
          case 'oralOrWritten':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">Delivered</Label>
                <Select
                  value={entry.oralOrWritten ?? ''}
                  onValueChange={(value) =>
                    onChange({ oralOrWritten: value as Navmc10132PunishmentEntry['oralOrWritten'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orally">orally</SelectItem>
                    <SelectItem value="in writing">in writing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          case 'suspendedFromDuty':
            return (
              <div key={param} className="flex items-center gap-2 pt-5">
                <Checkbox
                  id={`suspended-${code.code}`}
                  checked={!!entry.suspendedFromDuty}
                  onCheckedChange={(checked) => onChange({ suspendedFromDuty: checked === true })}
                />
                <Label htmlFor={`suspended-${code.code}`} className="text-xs">
                  with suspension from duty
                </Label>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function EntryWarnings({
  code,
  entry,
  authorityGrade,
}: {
  code: NonNullable<ReturnType<typeof resolvePunishment>>;
  entry: Navmc10132PunishmentEntry;
  authorityGrade: string;
}) {
  const warnings: string[] = [];

  if (code.maxDays !== undefined && entry.days) {
    const days = Number(entry.days);
    if (!Number.isNaN(days) && days > code.maxDays) {
      warnings.push(
        `${days} days exceeds the ${code.maxDays} day ceiling for ${code.code} (${code.statute}).`
      );
    }
  }
  if (code.maxMonths !== undefined && entry.months) {
    const months = Number(entry.months);
    if (!Number.isNaN(months) && months > code.maxMonths) {
      warnings.push(
        `${months} months exceeds the ${code.maxMonths} month ceiling for ${code.code} (${code.statute}).`
      );
    }
  }
  if (code.maxDaysPay !== undefined) {
    // The ceiling here is stated in days of pay, but the only value this
    // form collects is a dollar figure, and converting dollars to days
    // needs the member's daily rate of pay, which this app does not have.
    // So this cannot be a live threshold check like the two above, it is
    // shown every time the code declares maxDaysPay, as a standing
    // reminder carrying the citation rather than a conditional warning.
    warnings.push(
      `Ceiling for ${code.code} is ${code.maxDaysPay} days pay (${code.statute}). Confirm the ` +
        `dollar figure against the member's rate of pay, this app cannot convert dollars to days.`
    );
  }

  const authorityResult = authoritySatisfies(code.requiredAuthority, authorityGrade);
  let authorityWarning: string | null = null;
  if (authorityResult === false) {
    authorityWarning =
      `${code.code} needs a commanding officer of the grade of major or above ` +
      `(10 U.S.C. 815(b)(2)(H)).`;
  } else if (authorityResult === 'unknown') {
    authorityWarning =
      `Cannot check authority for ${code.code}. The pay grade in item 8A is unset, or this ` +
      `code turns on a billet (GCMCA) the app cannot infer from grade alone.`;
  }
  // authorityResult === true needs no message.

  if (warnings.length === 0 && !authorityWarning) return null;

  return (
    <div className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
      {warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-1 text-[11px]">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          {w}
        </p>
      ))}
      {authorityWarning && (
        <p className="flex items-start gap-1 text-[11px]">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          {authorityWarning}
        </p>
      )}
    </div>
  );
}
