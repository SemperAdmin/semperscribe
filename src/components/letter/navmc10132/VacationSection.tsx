'use client';

/**
 * Vacation of suspended punishment. Decision rows D-54 through D-56 and D-60.
 *
 * WHY THIS IS THE LAST PIECE OF D-60 AND WAS BUILT SEPARATELY. D-60 shipped
 * the record, the derivation and eight validators with NO interface, on
 * purpose: the owner was away from the machine and this codebase browser-
 * tests every UI phase before trusting it. Everything below writes
 * `formData.vacations`, which those rules already read.
 *
 * WHY IT OPENS ONLY WHEN THE CASE IS CLOSED OUT, and this is grounded in the
 * order rather than in symmetry with the unit diary aid beside it. MCO
 * 5800.16 Vol 14 para 011202 has the unit administrators update block 16 on
 * the ORIGINAL UPB after a vacation, and block 16 is pass 7. So a vacation
 * is by construction something that happens to a UPB already closed out.
 * A suspension also has to EXIST before anything can vacate it, so this
 * shows nothing until item 7 carries at least one. Both conditions are one
 * expression in Navmc10132Sections and are easy to relax if a unit turns
 * out to vacate before final action.
 *
 * THE CLOBBER RULE. `vacations` appears in no Navmc10132Definition section,
 * and schemas.ts carries a note saying why, so React Hook Form never seeds
 * or overwrites it. Every write here goes through `setFormData` directly.
 *
 * TARGETS A SUSPENSION BY `suspensionIndex`, NEVER `punishmentIndex`. The
 * picker below stores the position in `suspensions`, matching
 * `SuspensionPeriod.suspensionIndex` and what `vacationHandoff` expects. Two
 * suspensions can name the same punishment in flight, before V-31's export
 * gate ever runs, so a punishment index cannot identify one suspension.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO:
 *
 *   - It does not write the item 21 remark. `vacationRemarks` derives that
 *     from this record in navmc10132-acroform.ts, per D-60, so a remark can
 *     never drift from the record it describes.
 *   - It does not offer a FULL / PART choice on the Figure 14-1 letter.
 *     That is the letter's own blank and the commander's decision. `status`
 *     here records what was DECIDED, after the fact.
 *   - It does not compute whether the vacation was lawful. V-29, V-30 and
 *     their W-21 and W-22 companions do that, and they run on export like
 *     every other rule.
 *
 * FOUR STATUSES, NOT A CHECKBOX, per D-60. Most suspensions are never
 * vacated: they run out and remit under MCM Part V para 6.a(3). "Noticed and
 * still pending", "noticed and the commander declined", and "never noticed"
 * are three different facts, and 011201 requires an opportunity to respond
 * BEFORE vacating, so pending is a real state rather than a placeholder.
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { IsoDatePicker } from '@/components/letter/navmc10132/IsoDatePicker';
import { FormData } from '@/types';
import { CalendarClock, Plus, Trash2, ShieldAlert } from 'lucide-react';
import type { Navmc10132Vacation, Navmc10132VacationStatus } from '@/types/navmc';
import { suspensionPeriods, vacationDeadlines } from '@/lib/njp-suspension-period';

type SectionCardProps = { icon: React.ReactNode; title: string; children: React.ReactNode };

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<SectionCardProps>;
}

/**
 * The four statuses, worded as the EVENT each one records rather than as its
 * slug, matching how StageSelector names passes by what happened rather than
 * by a number. A clerk picking from this list reads what occurred.
 */
const STATUS_LABELS: Record<Navmc10132VacationStatus, string> = {
  pending: 'Notice served, awaiting the accused response and the decision',
  'vacated-full': 'Vacated in full',
  'vacated-part': 'Vacated in part',
  'not-vacated': 'Considered, and the commander did not vacate',
};

const STATUS_ORDER: readonly Navmc10132VacationStatus[] = [
  'pending',
  'vacated-full',
  'vacated-part',
  'not-vacated',
];

/** FormData carries an `any` index signature, so every read narrows through
 *  unknown rather than casting inline, matching SuspensionSection. */
function currentVacations(formData: FormData): Navmc10132Vacation[] {
  const value: unknown = formData.vacations;
  return Array.isArray(value) ? (value as Navmc10132Vacation[]) : [];
}

export function VacationSection({ formData, setFormData, SectionCard }: SectionProps) {
  const vacations = currentVacations(formData);
  const periods = suspensionPeriods(formData);
  const deadlines = vacationDeadlines(formData);

  const update = React.useCallback(
    (updater: (list: Navmc10132Vacation[]) => Navmc10132Vacation[]) => {
      setFormData((prev) => ({ ...prev, vacations: updater(currentVacations(prev)) }));
    },
    [setFormData],
  );

  const add = () =>
    update((list) => [
      ...list,
      {
        // Defaults to the first suspension because that is the only one on
        // most forms. It is a Select, not a fixed value, so a second
        // suspension is a choice rather than a surprise.
        suspensionIndex: periods[0]?.suspensionIndex ?? 0,
        noticeServedDate: '',
        status: 'pending',
      },
    ]);

  const patch = (index: number, changes: Partial<Navmc10132Vacation>) =>
    update((list) => list.map((v, i) => (i === index ? { ...v, ...changes } : v)));

  const remove = (index: number) => update((list) => list.filter((_, i) => i !== index));

  return (
    <SectionCard icon={<CalendarClock className="mr-2 h-5 w-5" />} title="Vacation of Suspended Punishment">
      <p className="text-[11px] text-muted-foreground">
        Recorded here after the fact. The item 21 remark is written from this record on
        export, so do not also add it by hand in Remarks. Serve Figure 14-1 from the
        suspension before recording an outcome: MCO 5800.16 Vol 14 para 011201 requires
        the accused be given an opportunity to respond before a suspension may be vacated.
      </p>

      {vacations.length === 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Nothing recorded. Most suspensions are never vacated, they run out and remit
          automatically under MCM Part V para 6.a(3), so an empty list is the ordinary
          state and needs no action.
        </p>
      )}

      <div className="mt-4 space-y-4">
        {vacations.map((vacation, index) => {
          const target = periods.find((p) => p.suspensionIndex === vacation.suspensionIndex);
          const deadline = deadlines.find((d) => d.suspensionIndex === vacation.suspensionIndex);
          const executed = vacation.status === 'vacated-full' || vacation.status === 'vacated-part';

          return (
            <div key={index} className="rounded-md border p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-[260px] flex-1 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Which item 7 suspension this vacates
                  </Label>
                  <Select
                    value={String(vacation.suspensionIndex)}
                    onValueChange={(value) => patch(index, { suspensionIndex: Number(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select the suspension" />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.map((period) => (
                        <SelectItem key={period.suspensionIndex} value={String(period.suspensionIndex)}>
                          {period.code || 'Punishment'} suspended {period.stated || '(period not stated)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove vacation record ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* The remission date is the thing a clerk most needs and the
                  form never prints. Shown with the caveat the derivation
                  already carries, never as a bare date: three separate
                  conditions move it, and two of them move it EARLIER. */}
              {deadline && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                  <Badge variant="outline" className="border-amber-500 text-amber-700 mb-1">
                    <ShieldAlert className="mr-1 h-3 w-3" />
                    Remits {deadline.endsOnIfUninterrupted}
                  </Badge>
                  <p className="text-[11px] text-amber-800">{deadline.caveat}</p>
                </div>
              )}
              {!target && (
                <p className="text-[11px] text-destructive">
                  This record points at a suspension item 7 no longer carries. Repoint it
                  or remove it, or the vacation describes nothing.
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Date Figure 14-1 was served on the accused
                  </Label>
                  <IsoDatePicker
                    value={vacation.noticeServedDate}
                    onChange={(iso) => patch(index, { noticeServedDate: iso })}
                    placeholder="Pick a date"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Date the triggering offense or violation was committed
                  </Label>
                  <IsoDatePicker
                    value={vacation.offenceDate}
                    onChange={(iso) => patch(index, { offenceDate: iso })}
                    placeholder="Pick a date"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must fall inside the suspension period. Ordinarily well before the
                    notice date above, which records what the commander did rather than
                    what the accused did.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Date Article 31 rights were read for this vacation
                  </Label>
                  <IsoDatePicker
                    value={vacation.article31RightsReadDate}
                    onChange={(iso) => patch(index, { article31RightsReadDate: iso })}
                    placeholder="Pick a date"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    JAGMAN 0118.d requires the reading BEFORE the accused is asked whether
                    they wish to make a statement, and Figure 14-1 is that ask. Not a field
                    on the form or the figure, so it is recorded here.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Pay grade of the vacating commander
                  </Label>
                  <Input
                    value={vacation.vacatingAuthorityGrade ?? ''}
                    onChange={(e) => patch(index, { vacatingAuthorityGrade: e.target.value })}
                    placeholder="e.g. O5"
                    className="w-32"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Not necessarily the officer in item 8A. A suspended NJP may be vacated
                    by any commander authorized to impose punishment of the kind and amount
                    being vacated, MCO 011201.
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Outcome</Label>
                <Select
                  value={vacation.status}
                  onValueChange={(value) =>
                    patch(index, {
                      status: value as Navmc10132VacationStatus,
                      // Leaving an outcome date on a record moved back to
                      // pending would assert a decision date for a decision
                      // that has been withdrawn.
                      ...(value === 'pending' ? { outcomeDate: '' } : {}),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select the outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {vacation.status !== 'pending' && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Date the commander decided
                  </Label>
                  <IsoDatePicker
                    value={vacation.outcomeDate}
                    onChange={(iso) => patch(index, { outcomeDate: iso })}
                    placeholder="Pick a date"
                  />
                  {executed && (
                    <p className="text-[11px] text-muted-foreground">
                      The item 21 remark is dated from here, not from the notice date.
                    </p>
                  )}
                </div>
              )}

              {vacation.status === 'vacated-part' && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    What was vacated
                  </Label>
                  <Input
                    value={vacation.vacatedDetail ?? ''}
                    onChange={(e) => patch(index, { vacatedDetail: e.target.value })}
                    placeholder="e.g. 7 of the 14 days of restriction"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required. A partial vacation naming nothing is an incomplete record and
                    blocks export. This app will not read it as a legal figure, so the
                    authority check runs on full vacations only.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={add}>
        <Plus className="mr-1 h-4 w-4" />
        Record a vacation
      </Button>
    </SectionCard>
  );
}
