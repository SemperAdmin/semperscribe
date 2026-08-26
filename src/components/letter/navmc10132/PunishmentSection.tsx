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
import { LockedBadge, ReadOnlyValue } from '@/components/letter/navmc10132/OffensesSection';
import {
  isNavmc10132KeyLocked,
  isNavmc10132SectionLocked,
} from '@/lib/navmc10132-locks';
import {
  forfeitureLadder,
  type ForfeitureLadder,
} from '@/lib/navmc10132-forfeiture-ladder';
import {
  Gavel, Plus, Trash2, AlertTriangle, HelpCircle, Info,
} from 'lucide-react';

import { reducibleGrades, ranksAtGrade, reducedPayGrade } from '@/lib/navmc10132-ranks';
import {
  renderPunishment, Navmc10132PunishmentRenderError,
  fitsInField, overflowBy,
  resolvePunishment, authoritySatisfies,
} from '@/lib/navmc10132-utils';
import {
  NJP_AUTHORITY_LEVEL_LABEL,
  releaseOnePunishmentsFor,
  resolveAuthorityLevel,
} from '@/lib/navmc10132-punishments';
import {
  forfeitureCeiling,
  payTableStatus,
  type ForfeitureCeiling,
} from '@/lib/navmc10132-basic-pay';

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

  /**
   * D-45, defect 3.9. The form's own lock list for `9 NJP AUTHORITY
   * SIGNATURE` names fields under names the form no longer uses, so once the
   * imposing officer signs, Acrobat closes nothing and every field of this
   * section stays writable over a signature. The app closes them instead,
   * per Stephen's ruling of 2026-08-26: at the item 9 signature, not before.
   *
   * ONE QUESTION PER CONTROL, because the three do not move together. Item 6
   * is rendered from structure, so its lock closes the whole builder; the two
   * dates are ordinary fields with their own locks; and a blank field on the
   * signed file is never locked at all, so a clerk who has still to record
   * the item 10 notice date can.
   */
  const buildLocked = isNavmc10132SectionLocked(formData, 'punishments');
  const item6DateLocked = isNavmc10132KeyLocked(formData, 'punishmentDate');
  const item10Locked = isNavmc10132KeyLocked(formData, 'dispositionNoticeDate');

  // The picker's contents follow item 8A. MCM Part V para 5.b(2) splits the
  // enlisted ceiling on the GRADE of the imposing officer, so a company-grade
  // authority is offered a strictly smaller list than a field-grade one.
  // Derived on every render from a pure function of one string, so there is
  // nothing to memoise and nothing to keep in sync.
  const authorityGrade = (formData.njpAuthorityPayGrade as string) ?? '';
  const options = releaseOnePunishmentsFor(authorityGrade, {
    payGrade: typeof formData.accusedPayGrade === 'string' ? formData.accusedPayGrade : '',
    service: formData.accusedService === 'USN' ? 'USN' : 'USMC',
  });

  // Forfeiture ceilings. Computed on the BASIS grade, which V-18 has already
  // forced to the reduction target whenever a reduction is imposed, falling
  // back to item 19 only when none is. Null whenever the app cannot stand
  // behind a figure: a superseded pay table, an unset length of service, a
  // blank cell. Null renders as an explanation, never as a missing ceiling
  // the clerk might read as "no limit".
  const payTable = payTableStatus(
    typeof formData.punishmentDate === 'string' ? formData.punishmentDate : '',
  );
  const basisGrade =
    (typeof formData.forfeitureBasisGrade === 'string' && formData.forfeitureBasisGrade.trim()) ||
    (typeof formData.accusedPayGrade === 'string' ? formData.accusedPayGrade : '');
  // The status is passed in rather than checked here. forfeitureCeiling now
  // requires it and returns a reason when it declines, so the "nothing
  // computes on a superseded table" rule is enforced by the module rather
  // than by this component remembering to ask first.
  const ceilingResult = forfeitureCeiling({
    status: payTable,
    payGrade: basisGrade,
    yearsOfService:
      typeof formData.accusedYearsOfService === 'string' ? formData.accusedYearsOfService : '',
    seaHardshipDutyPay:
      typeof formData.accusedSeaHardshipDutyPay === 'string'
        ? formData.accusedSeaHardshipDutyPay
        : '',
  });
  const ceiling = ceilingResult.kind === 'ceiling' ? ceilingResult.ceiling : null;
  const ceilingDetail =
    ceilingResult.kind === 'ceiling' ? payTable.detail : ceilingResult.detail;

  /**
   * The same ceiling at every grade a reduction could reach, so the clerk
   * sees what the reduction costs rather than one number in isolation.
   *
   * STEPHEN, 2026-08-26: show the max at the current rank and years of
   * service, and if reduced. MCM Part V para 5.c(8) makes the reduced grade
   * the LAWFUL basis whenever a reduction is imposed, and it is always the
   * smaller figure, so a clerk working from the current grade alone errs
   * toward an unlawful forfeiture every time.
   *
   * READ FROM ITEM 19, not from the basis grade the inputs above use. The
   * point of the panel is the comparison, and pricing the top rung on the
   * basis grade would collapse both rows onto the same number.
   */
  const ladder = forfeitureLadder({
    payGrade: typeof formData.accusedPayGrade === 'string' ? formData.accusedPayGrade : '',
    yearsOfService:
      typeof formData.accusedYearsOfService === 'string' ? formData.accusedYearsOfService : '',
    seaHardshipDutyPay:
      typeof formData.accusedSeaHardshipDutyPay === 'string'
        ? formData.accusedSeaHardshipDutyPay
        : '',
    punishmentDate: typeof formData.punishmentDate === 'string' ? formData.punishmentDate : '',
    gradeReducedTo:
      punishments.find(
        (entry) => typeof entry.gradeReducedTo === 'string' && entry.gradeReducedTo.trim() !== '',
      )?.gradeReducedTo ?? '',
  });

  // A code selected before item 8A was set can become unavailable once it is.
  // DERIVED, not cleared by an effect: the pending selection is read through
  // this rather than written back to state, so there is no cascading render
  // and no moment where the Select shows a code the Add button will refuse.
  const pendingUnavailable =
    codeToAdd !== '' &&
    options.some((o) => o.punishment.code === codeToAdd && !o.available);

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
    // Second line of defence behind the disabled SelectItem. The picker can
    // go stale between a selection and a click if item 8A changes in between,
    // and adding a punishment this commander may not impose is worse than a
    // click that does nothing.
    if (options.some((o) => o.punishment.code === codeToAdd && !o.available)) return;
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
  // AUTOMATIC in both directions, matching item 7. Overflow is a fact about
  // a single-line field rather than a preference: item 6 physically cannot
  // hold the text, and the only lawful alternative is carrying it to item 21,
  // which the form's page 3 ITEM 21 instruction prescribes. This used to set
  // only on a checkbox, so an untouched box printed a clipped legal record.
  React.useEffect(() => {
    if (previewError) return;
    const carried = Boolean(formData.punishmentOverflowToItem21);
    if (!fits && !carried) {
      setFormData((prev) => ({ ...prev, punishmentOverflowToItem21: true }));
    } else if (fits && carried) {
      setFormData((prev) => ({ ...prev, punishmentOverflowToItem21: false }));
    }
  }, [fits, previewError, formData.punishmentOverflowToItem21, setFormData]);

  return (
    <SectionCard icon={<Gavel className="mr-2 h-5 w-5" />} title="Punishment (Items 6 and 10)">
      <div className="space-y-4">
        {buildLocked && (
          <p className="text-[11px] text-muted-foreground">
            Item 6 was signed by the imposing officer (item 9). The punishment below is shown as
            it stands on the signed file and is no longer editable
            <LockedBadge />
          </p>
        )}
        {/* The whole builder, closed as one. Item 6 prints from structure, so
            there is no single input a lock could sit on: the codes, their
            parameters, the add control and the remove buttons all feed the
            one signed string, and closing any less would offer an edit the
            export refuses to write. */}
        <fieldset disabled={buildLocked} className="space-y-4">
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
                    <ParameterInputs
                      code={code}
                      entry={entry}
                      onChange={(patch) => updateEntry(index, patch)}
                      accusedPayGrade={
                        typeof formData.accusedPayGrade === 'string' ? formData.accusedPayGrade : ''
                      }
                      ceiling={ceiling}
                      ceilingDetail={ceilingDetail}
                    />
                    <EntryWarnings
                      code={code}
                      entry={entry}
                      authorityGrade={(formData.njpAuthorityPayGrade as string) ?? ''}
                      ceiling={ceiling}
                      ceilingDetail={ceilingDetail}
                    />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <div className="space-y-2 rounded-md border border-dashed p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[280px] flex-1 space-y-1">
              <Label className="text-xs">Add a punishment</Label>
              <Select value={codeToAdd} onValueChange={setCodeToAdd}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a punishment code" />
                </SelectTrigger>
                <SelectContent>
                  {options.map(({ punishment, available, reason }) => (
                    <SelectItem
                      key={punishment.code}
                      value={punishment.code}
                      disabled={!available}
                      className={available ? undefined : 'opacity-60'}
                    >
                      <span className="block">
                        {punishment.code} - {punishment.description}
                      </span>
                      {!available && (
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {reason}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={addPunishment}
              disabled={!codeToAdd || pendingUnavailable}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>

          <AuthorityLevelNote authorityGrade={authorityGrade} options={options} />
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
            <div className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
              <p className="flex items-start gap-1 text-[11px] font-medium text-amber-800">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                Carried into item 21 automatically.
              </p>
              <p className="text-[11px] text-amber-800">
                This rendered punishment does not fit item 6, which clips rather than
                wrapping. Item 6 now prints &quot;See Supplemental Page&quot; and the full
                text above is written into item 21 as a dated entry. Shorten the punishment
                and this reverses itself.
              </p>
              <p className="text-[11px] text-muted-foreground">
                This is not rare. The MCO&apos;s own worked example for combined punishments
                renders to 160 characters against this 123 character field.
              </p>
            </div>
          )}
        </div>

        </fieldset>

        <ForfeitureLadderPanel ladder={ladder} />

        <ForfeitureBasisGrade
          formData={formData}
          setFormData={setFormData}
          punishments={punishments}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">
              Item 6 punishment date
              {item6DateLocked && <LockedBadge />}
            </Label>
            {item6DateLocked ? (
              <ReadOnlyValue value={(formData.punishmentDate as string) ?? ''} />
            ) : (
              <IsoDatePicker
                value={(formData.punishmentDate as string) ?? ''}
                onChange={(value: string) => setFormData((prev) => ({ ...prev, punishmentDate: value }))}
              />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Item 10 disposition notice date
              {item10Locked && <LockedBadge />}
            </Label>
            {item10Locked ? (
              <ReadOnlyValue value={(formData.dispositionNoticeDate as string) ?? ''} />
            ) : (
              <IsoDatePicker
                value={(formData.dispositionNoticeDate as string) ?? ''}
                onChange={(value: string) =>
                  setFormData((prev) => ({ ...prev, dispositionNoticeDate: value }))
                }
              />
            )}
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

/**
 * Caps a typed or pasted duration at the code's own statutory ceiling.
 *
 * Exceeding the MCM Part V 5.b ceiling is unlawful, not merely unusual, so
 * the field refuses the value rather than accepting it and flagging it after
 * the fact. V-06 blocks the export as a second line of defence for data
 * arriving by import rather than by typing.
 *
 * Anything not yet a plain non-negative integer passes through untouched, so
 * an empty field, a lone minus, or a half-typed number stays editable. A
 * code carrying no ceiling for this parameter clamps nothing.
 */
function clampToCeiling(raw: string, ceiling: number | undefined): string {
  if (ceiling === undefined) return raw;
  if (!/^\d+$/.test(raw)) return raw;
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  return value > ceiling ? String(ceiling) : raw;
}

function ParameterInputs({
  code,
  entry,
  onChange,
  accusedPayGrade,
  ceiling,
  ceilingDetail,
}: {
  code: ReturnType<typeof resolvePunishment>;
  entry: Navmc10132PunishmentEntry;
  onChange: (patch: Partial<Navmc10132PunishmentEntry>) => void;
  /** Item 19's pay grade. The lawful reduction target derives from it, so
   *  the reduction input needs it rather than asking the clerk twice. */
  accusedPayGrade: string;
  /** Null when the app will not state a ceiling. Never treat null as "no limit". */
  ceiling: ForfeitureCeiling | null;
  /** Why there is or is not a ceiling. Shown either way. */
  ceilingDetail: string;
}) {
  if (!code) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {code.parameters.map((param) => {
        switch (param) {
          case 'days':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">
                  Days{code.maxDays !== undefined ? ` (max ${code.maxDays})` : ''}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={code.maxDays}
                  value={entry.days ?? ''}
                  onChange={(e) => onChange({ days: clampToCeiling(e.target.value, code.maxDays) })}
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
                <Label className="text-xs">
                  Forfeiture{ceiling ? ` (max $${ceiling.sevenDaysPay})` : ''}
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="text"
                    value={entry.dollars ?? ''}
                    onChange={(e) => onChange({ dollars: e.target.value })}
                  />
                </div>
                <CeilingNote
                  ceiling={ceiling}
                  detail={ceilingDetail}
                  max={ceiling?.sevenDaysPay}
                  basis="seven days' pay"
                  entered={entry.dollars}
                />
              </div>
            );
          case 'dollarsPerMonth':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">
                  Forfeiture per month{ceiling ? ` (max $${ceiling.halfMonthPay})` : ''}
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="text"
                    value={entry.dollarsPerMonth ?? ''}
                    onChange={(e) => onChange({ dollarsPerMonth: e.target.value })}
                  />
                </div>
                <CeilingNote
                  ceiling={ceiling}
                  detail={ceilingDetail}
                  max={ceiling?.halfMonthPay}
                  basis="one-half of one month's pay"
                  entered={entry.dollarsPerMonth}
                />
              </div>
            );
          case 'months':
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">
                  Months{code.maxMonths !== undefined ? ` (max ${code.maxMonths})` : ''}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={code.maxMonths}
                  value={entry.months ?? ''}
                  onChange={(e) => onChange({ months: clampToCeiling(e.target.value, code.maxMonths) })}
                />
              </div>
            );
          case 'gradeReducedTo': {
            // N08 is reduction to the NEXT inferior grade, 10 U.S.C.
            // 815(b)(2)(D), so the list carries exactly one option. Reaching a
            // lower grade sits at (b)(2)(H)(iv), for which the MCTFS table has
            // no code, see defect report finding 12.
            //
            // MCO 5800.16 Vol 14 para 010302.C bars reduction of Marines at E6
            // and above, so the list comes back empty there and the section
            // says why rather than offering an unlawful target.
            const targets = reducibleGrades(accusedPayGrade, { nextInferiorOnly: true });
            return (
              <div key={param} className="space-y-1">
                <Label className="text-xs">Grade reduced to</Label>
                {accusedPayGrade === '' ? (
                  <p className="text-[11px] text-muted-foreground">
                    Set the accused&apos;s pay grade in item 19 first. The lawful target is
                    derived from it.
                  </p>
                ) : targets.length === 0 ? (
                  <p className="text-[11px] text-amber-800">
                    A Marine in the grade of {accusedPayGrade} cannot be reduced in paygrade
                    (MCO 5800.16 Vol 14 para 010302.C).
                  </p>
                ) : (
                  <Select
                    value={entry.gradeReducedTo ?? ''}
                    onValueChange={(value) => onChange({ gradeReducedTo: value })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select the target" /></SelectTrigger>
                    <SelectContent>
                      {targets.flatMap((grade) => {
                        const ranks = ranksAtGrade(grade);
                        return ranks.length > 0
                          ? ranks.map((rank) => (
                              <SelectItem key={rank.abbreviation} value={rank.abbreviation}>
                                {rank.abbreviation} ({grade})
                              </SelectItem>
                            ))
                          : [
                              <SelectItem key={grade} value={grade}>
                                {grade}
                              </SelectItem>,
                            ];
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          }
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
  ceiling,
  ceilingDetail,
}: {
  code: NonNullable<ReturnType<typeof resolvePunishment>>;
  entry: Navmc10132PunishmentEntry;
  authorityGrade: string;
  /** The computed forfeiture ceiling, or null when nothing could be priced. */
  ceiling: ForfeitureCeiling | null;
  /** Why, when it is null. The pay table's own line when it is not. */
  ceilingDetail: string;
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
    // THIS MESSAGE USED TO END "this app cannot convert dollars to days",
    // which stopped being true when the DFAS basic pay table went in. It
    // does convert: forfeitureCeiling prices the ceiling from item 19's pay
    // grade and the length of service, the amount box carries it as a max,
    // and validator V-19 blocks an export above it. Telling a clerk the app
    // cannot do a thing it does, two lines under the figure it just did it
    // with, invites them to disregard the figure.
    //
    // WHAT IS STILL TRUE, and is what the message now says: the figure is
    // computed from a published TABLE, not from the member's own leave and
    // earnings statement, and sea or hardship duty pay raises the lawful
    // base (JAGMAN 0111.i) while the four-month E-1 rate lowers it. The
    // confirmation this asks for is against the member's rate of pay, which
    // was always the point.
    if (ceiling === null) {
      warnings.push(
        `Ceiling for ${code.code} is ${code.maxDaysPay} days pay (${code.statute}), and this ` +
          `document does not price it: ${ceilingDetail} Work the dollar figure from the ` +
          `member's rate of pay before imposing.`,
      );
    } else {
      warnings.push(
        `Ceiling for ${code.code} is ${code.maxDaysPay} days pay (${code.statute}), which at ` +
          `${ceiling.payGrade} is $${ceiling.sevenDaysPay}. That comes from the published pay ` +
          `table, not from the member's LES, so confirm it against their actual rate of pay.`,
      );
    }
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


/**
 * MCM Part V para 5.c(8): "If the punishment includes both reduction, whether
 * or not suspended, and forfeiture of pay, the forfeiture must be based on the
 * grade to which reduced."
 *
 * WHY THIS CONTROL EXISTS AT ALL. The printed item 6 shows a dollar figure and
 * nothing else. The grade that figure was computed on is invisible on the
 * form, which makes the single most common NJP pay error unauditable after the
 * fact. Recording the basis turns it into something validator V-18 can gate on.
 *
 * IT APPEARS ONLY when item 6 carries BOTH a reduction and a forfeiture,
 * because that is the only case the rule governs. It defaults to the reduction
 * target and is deliberately still a choice rather than a locked value: a
 * clerk who believes the pre-reduction grade is correct should have to say so
 * and then read the block explaining why it is not, rather than never seeing
 * the rule.
 *
 * "WHETHER OR NOT SUSPENDED" is the trap. A suspended reduction reads to most
 * people as a reduction that did not happen, so the forfeiture gets computed
 * at the old, higher grade and the Marine is overcollected. The copy below
 * says so in as many words. Do not shorten it.
 */
function ForfeitureBasisGrade({
  formData,
  setFormData,
  punishments,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  punishments: Navmc10132PunishmentEntry[];
}) {
  const reduction = punishments.find((entry) => {
    const code = resolvePunishment(entry.code);
    return !!code && code.parameters.includes('gradeReducedTo');
  });
  const hasForfeiture = punishments.some((entry) => {
    const code = resolvePunishment(entry.code);
    if (!code) return false;
    return code.parameters.includes('dollars') || code.parameters.includes('dollarsPerMonth');
  });

  const currentGrade = ((formData.accusedPayGrade as string) ?? '').trim();
  const target = reducedPayGrade(reduction?.gradeReducedTo ?? '');
  const recorded = ((formData.forfeitureBasisGrade as string) ?? '').trim();

  // Seed the basis to the lawful answer as soon as both punishments exist and
  // the target is known. A pure function of the target, so re-running it after
  // its own write is a no-op and the effect settles.
  React.useEffect(() => {
    if (!reduction || !hasForfeiture || target === '' || recorded !== '') return;
    setFormData((prev) =>
      ((prev.forfeitureBasisGrade as string) ?? '') === '' 
        ? { ...prev, forfeitureBasisGrade: target }
        : prev,
    );
  }, [reduction, hasForfeiture, target, recorded, setFormData]);

  if (!reduction || !hasForfeiture) return null;

  const wrong = target !== '' && recorded !== '' && recorded !== target;

  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50/60 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <p className="text-xs font-medium">Forfeiture basis grade</p>
          <p className="text-[11px] text-muted-foreground">
            A reduction and a forfeiture are both imposed. The forfeiture must be based on the
            grade to which reduced, <strong>even if the reduction is suspended</strong> (MCM Part V
            para 5.c(8)). Computing it on the pre-reduction grade overcollects from the Marine.
          </p>
        </div>
      </div>

      {target === '' ? (
        <p className="text-[11px] text-amber-800">
          Select the grade reduced to above. Until the reduction names a target, the lawful
          basis cannot be derived and export stays blocked.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Computed on pay grade</Label>
            <Select
              value={recorded}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, forfeitureBasisGrade: value }))
              }
            >
              <SelectTrigger><SelectValue placeholder="Select the basis" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={target}>{target} (reduced grade)</SelectItem>
                {currentGrade !== '' && currentGrade !== target && (
                  <SelectItem value={currentGrade}>{currentGrade} (current grade)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <p className="self-end text-[11px] text-muted-foreground">
            The app records the basis you choose. It holds no pay table, so it does not check
            the dollar figure itself.
          </p>
        </div>
      )}

      {wrong && (
        <p className="text-[11px] font-medium text-destructive">
          {recorded} is the pre-reduction grade. The reduction targets {target}, so the
          forfeiture must be computed on {target} pay. Export is blocked until this is {target}.
        </p>
      )}
    </div>
  );
}

/**
 * Says which NJP level the picker is currently offering, and what that costs.
 *
 * WHY IT NAMES THE GRADE RATHER THAN THE ECHELON. "Company level" and
 * "battalion level" are fleet shorthand for the wrong axis: 10 U.S.C.
 * 815(b)(2) and MCM Part V para 5.b(2) key on the GRADE of the officer
 * imposing, not on the unit he commands. A company commanded by a major
 * imposes field-grade punishments and a battalion under an O-3 cannot, so
 * this copy points at item 8A and never at the unit.
 */
function AuthorityLevelNote({
  authorityGrade,
  options,
}: {
  authorityGrade: string;
  options: ReturnType<typeof releaseOnePunishmentsFor>;
}) {
  const level = resolveAuthorityLevel(authorityGrade);
  const withheld = options.filter((o) => !o.available).map((o) => o.punishment.code);

  if (level === null) {
    return (
      <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        {authorityGrade.trim() === ''
          ? 'Every code is offered because item 8A carries no pay grade yet. Set it and this ' +
            'list narrows to what that commander may actually impose (MCM Part V para 5.b(2)).'
          : `"${authorityGrade.trim()}" is not a readable officer pay grade, so no authority ` +
            'check has run. Enter item 8A as O1 through O10, no dash.'}
      </p>
    );
  }

  return (
    <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
      <Info className="mt-0.5 h-3 w-3 shrink-0" />
      {NJP_AUTHORITY_LEVEL_LABEL[level]} NJP, from item 8A pay grade {authorityGrade.trim()}.
      {withheld.length > 0
        ? ` ${withheld.join(', ')} need a commanding officer of the grade of major or above and are disabled here. Route the case to a field-grade authority or correct item 8A.`
        : ' Every release-one code is available at this grade.'}
    </p>
  );
}


/**
 * The forfeiture ceiling, or an honest account of why there is not one.
 *
 * THE DOLLAR FIELD IS NOT CLAMPED, unlike the day and month fields. A day
 * ceiling comes off the statute and cannot be wrong. A dollar ceiling comes
 * off a pay table this app transcribed, and silently truncating a clerk's
 * figure to a number the app might have gotten wrong would hide the error
 * instead of surfacing it. Validator V-20 blocks the export, and only when the
 * table in force actually applies, so the clerk sees the number, the source,
 * and the reason.
 */
function CeilingNote({
  ceiling,
  detail,
  max,
  basis,
  entered,
}: {
  ceiling: ForfeitureCeiling | null;
  detail: string;
  max?: number;
  basis: string;
  entered?: string;
}) {
  if (ceiling === null || max === undefined) {
    return (
      <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        No ceiling computed. {detail} Set the years of service beside item 19 if it is blank.
      </p>
    );
  }

  const amount = Number((entered ?? '').trim());
  const over = Number.isFinite(amount) && entered?.trim() !== '' && amount > max;

  return (
    <div className="space-y-1">
      {over && (
        <p className="text-[11px] font-medium text-destructive">
          ${amount} exceeds the ${max} ceiling at {ceiling.payGrade}. Export is blocked.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {basis} at {ceiling.payGrade} is ${max}, from $
        {ceiling.monthlySubjectToForfeiture.toFixed(2)} monthly pay subject to forfeiture.
      </p>
      {ceiling.notes.map((note) => (
        <p key={note} className="text-[11px] text-amber-800">
          {note}
        </p>
      ))}
    </div>
  );
}

/**
 * The forfeiture ceiling at the accused's grade and at each reduction target.
 *
 * WHY BOTH ROWS AND NOT ONE. A commanding officer choosing a reduction and a
 * forfeiture together is choosing them against different ceilings, because
 * MCM Part V para 5.c(8) prices the forfeiture on the grade REDUCED TO. One
 * figure on screen answers only half the question, and it answers it with
 * the larger number.
 *
 * THE OPERATIVE ROW IS MARKED, never merely listed first. Before a reduction
 * is recorded the top row governs, and the rows below are what would happen.
 * Once one is recorded the marking moves, and the top row stays visible as
 * the comparison the clerk needs.
 *
 * NOTHING HERE IS A BLOCKER. V-20 blocks an over-ceiling forfeiture at
 * export with the same arithmetic; this panel exists so the clerk sees the
 * limit while typing rather than after being refused.
 */
function ForfeitureLadderPanel({ ladder }: { ladder: ForfeitureLadder }) {
  const money = (value: number) => `$${value.toLocaleString('en-US')}`;

  if (ladder.rungs.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">
        <p className="font-medium">Maximum forfeiture: not computed.</p>
        <p>{ladder.unavailable?.detail ?? 'The app holds no figure for this accused.'}</p>
        {/* Never render an absent ceiling as an absent LIMIT. */}
        <p>A limit still applies. It has to be read from the pay table by hand.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium">Maximum forfeiture by grade</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 text-left font-normal">Grade</th>
              <th className="py-1 pr-3 text-right font-normal">One-half month, per month</th>
              <th className="py-1 pr-3 text-right font-normal">Seven days</th>
              <th className="py-1 text-left font-normal">Basis</th>
            </tr>
          </thead>
          <tbody>
            {ladder.rungs.map((rung) => (
              <tr key={rung.ceiling.payGrade} className={rung.operative ? 'font-medium' : ''}>
                <td className="py-1 pr-3">
                  {rung.reduced ? `if reduced to ${rung.ceiling.payGrade}` : rung.ceiling.payGrade}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">{money(rung.ceiling.halfMonthPay)}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{money(rung.ceiling.sevenDaysPay)}</td>
                <td className="py-1 text-left text-muted-foreground">
                  {rung.operative ? 'this forfeiture' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {ladder.reductionBarred
          ? 'A reduction is barred at this grade, so the row above is the only lawful basis (MCO 5800.16 Vol 14).'
          : 'A forfeiture imposed with a reduction must be computed on the grade reduced to (MCM Part V para 5.c(8)).'}
      </p>
      <p className="text-[11px] text-muted-foreground">{ladder.payTable.detail}</p>
      {ladder.notes.map((note) => (
        <p key={note} className="mt-1 text-[11px] text-muted-foreground">
          {note}
        </p>
      ))}
    </div>
  );
}
