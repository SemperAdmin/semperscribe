'use client';

/**
 * NAVMC 10132 item 7, the suspension picker.
 *
 * On paper item 7 is free text, and free text lets a clerk suspend a
 * punishment nobody imposed. This component makes item 7 a SELECTION over
 * the punishments already entered in item 6, so the two stay 1:1. A
 * suspension stores the INDEX of the punishment it suspends, never a copy
 * of it, which is what keeps item 6 and item 7 from drifting when item 6
 * is edited afterwards.
 *
 * The form's page 3 ITEM 7 instruction requires three elements: "indicate
 * the specific punishment, the length of the suspension, and the terms for
 * automatic remission." The renderer supplies all three, so this component
 * collects only the two a clerk actually decides, which punishment and for
 * how long. MCO 5800.16 Vol 14 para 011105.G carried the same three-element
 * requirement before MARADMIN 427/23 deleted the paragraph and redirected
 * preparation to the form, so the requirement moved rather than lapsed.
 *
 * THE CLOBBER RULE. `suspensions` and `suspensionOverflowToItem21` appear in
 * no Navmc10132Definition section, so React Hook Form never seeds or
 * overwrites them.
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FormData } from '@/types';
import { Ban, AlertTriangle, Info } from 'lucide-react';

import {
  renderPunishment,
  renderSuspension,
  Navmc10132PunishmentRenderError,
  Navmc10132SuspensionRenderError,
  fitsInField,
  overflowBy,
} from '@/lib/navmc10132-utils';

import type {
  Navmc10132PunishmentEntry,
  Navmc10132Suspension,
} from '@/types/navmc';

const ITEM_7_FIELD = '7 SUSPENSION IF ANY';

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<{
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
  }>;
}

/** FormData carries an `any` index signature, so every read narrows through
 *  unknown rather than casting inline to a shaped object. */
function currentPunishments(formData: FormData): Navmc10132PunishmentEntry[] {
  const value: unknown = formData.punishments;
  return Array.isArray(value) ? (value as Navmc10132PunishmentEntry[]) : [];
}

function currentSuspensions(formData: FormData): Navmc10132Suspension[] {
  const value: unknown = formData.suspensions;
  return Array.isArray(value) ? (value as Navmc10132Suspension[]) : [];
}

/** One punishment's own text, rendered through the SAME engine item 6 uses so
 *  the row label and the printed form never disagree. An incomplete entry
 *  throws, which is ordinary mid-entry state, so it falls back to the code. */
function punishmentLabel(entry: Navmc10132PunishmentEntry): string {
  try {
    return renderPunishment([entry]).text;
  } catch (err) {
    if (err instanceof Navmc10132PunishmentRenderError) {
      return `${entry.code} (incomplete)`;
    }
    throw err;
  }
}

export function SuspensionSection({ formData, setFormData, SectionCard }: SectionProps) {
  const punishments = currentPunishments(formData);
  const suspensions = currentSuspensions(formData);

  const update = React.useCallback(
    (updater: (list: Navmc10132Suspension[]) => Navmc10132Suspension[]) => {
      setFormData((prev) => ({ ...prev, suspensions: updater(currentSuspensions(prev)) }));
    },
    [setFormData],
  );

  const suspensionFor = (index: number) =>
    suspensions.find((s) => s.punishmentIndex === index);

  const toggle = (index: number, on: boolean) => {
    update((list) =>
      on
        ? [...list, { punishmentIndex: index, months: '' }]
        : list.filter((s) => s.punishmentIndex !== index),
    );
  };

  const setPeriod = (index: number, patch: Partial<Navmc10132Suspension>) => {
    update((list) =>
      list.map((s) => (s.punishmentIndex === index ? { ...s, ...patch } : s)),
    );
  };

  // Rendered on every render, not memoised. The inputs are small strings and
  // renderSuspension is a pure string builder, so recomputing costs nothing
  // worth guarding. A dangling index or a missing period throws, which is
  // expected input rather than a bug, so it is caught here.
  let previewText = '';
  let previewError: string | null = null;
  try {
    previewText = renderSuspension(suspensions, punishments, {
      impositionDate: typeof formData.punishmentDate === 'string' ? formData.punishmentDate : undefined,
    }).text;
  } catch (err) {
    if (err instanceof Navmc10132SuspensionRenderError) {
      previewError = err.message;
    } else {
      throw err;
    }
  }

  const fits = previewError ? true : fitsInField(ITEM_7_FIELD, previewText);
  const overCount = !previewError && !fits ? overflowBy(ITEM_7_FIELD, previewText) : 0;
  const carried = Boolean(formData.suspensionOverflowToItem21);

  // THE DERIVED STRING. `suspension` is item 7's value of record, exactly as
  // `punishmentImposed` is item 6's, and this effect is what writes it.
  //
  // IT WAS MISSING UNTIL 2026-08-25. Item 7's free-text input was removed
  // when this section became a selection over item 6, and schemas.ts recorded
  // that `suspension` "survives as the DERIVED string, written by
  // renderSuspension exactly as `punishmentImposed` is written by
  // renderPunishment". That writer was documented and never built, so
  // `suspension` stayed at its '' default forever. Validator V-05 reads it
  // and blocks on empty, which meant EVERY NAVMC 10132 was export-blocked on
  // "Item 7 suspension is empty" no matter what item 7 actually held. The
  // exported PDF was never wrong, because navmc10132-acroform.ts recomputes
  // item 7 from suspensions[] rather than reading this field, which is
  // precisely why the gap survived: the visible output looked correct.
  //
  // renderSuspension returns the literal NONE for an empty list, which is
  // what item 7's own instruction requires, so this satisfies V-05 in the
  // nothing-suspended case rather than merely silencing it.
  //
  // Render-loop guard, the same shape the item 6 effect uses: primitive
  // dependencies, and the body compares against the current value before
  // writing, so a render that recomputes the same text is a no-op.
  React.useEffect(() => {
    const next = previewError ? '' : previewText;
    if ((formData.suspension ?? '') !== next) {
      setFormData((prev) => ({ ...prev, suspension: next }));
    }
  }, [previewText, previewError, formData.suspension, setFormData]);

  // AUTOMATIC, in both directions. Overflow is a fact about a single-line
  // field, not a preference: item 7 physically cannot hold the text, and the
  // only lawful alternative is carrying it to item 21, which the form's page
  // 3 ITEM 21 instruction prescribes. Leaving it to a checkbox meant an
  // untouched box printed a clipped legal record.
  //
  // Render-loop guard, the same shape the item 6 effects use. The dependency
  // array is primitives, and the body compares against the current value
  // before writing, so a render that recomputes the same state is a no-op.
  React.useEffect(() => {
    if (previewError) return;
    if (!fits && !carried) {
      setFormData((prev) => ({ ...prev, suspensionOverflowToItem21: true }));
    } else if (fits && carried) {
      setFormData((prev) => ({ ...prev, suspensionOverflowToItem21: false }));
    }
  }, [fits, carried, previewError, setFormData]);

  return (
    <SectionCard icon={<Ban className="mr-2 h-5 w-5" />} title="Suspension of Punishment (Item 7)">
      <div className="space-y-4">
        <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Item 7 suspends punishments already imposed in item 6. A punishment never imposed
          cannot be suspended, so this list offers only what item 6 carries. Suspend nothing
          and item 7 prints NONE, which the form&apos;s page 3 instruction requires.
        </p>

        {punishments.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No punishment is entered in item 6 yet, so there is nothing to suspend. Item 7
            will print NONE.
          </div>
        ) : (
          <div className="space-y-2">
            {punishments.map((entry, index) => {
              const suspension = suspensionFor(index);
              const on = suspension !== undefined;
              return (
                <div key={index} className="rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={`suspend-${index}`}
                      checked={on}
                      onCheckedChange={(checked) => toggle(index, checked === true)}
                    />
                    <Label htmlFor={`suspend-${index}`} className="text-sm leading-snug">
                      {punishmentLabel(entry)}
                    </Label>
                  </div>
                  {on && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Suspended for (months)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={suspension?.months ?? ''}
                          onChange={(e) =>
                            setPeriod(index, { months: e.target.value, days: '' })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">or days</Label>
                        <Input
                          type="number"
                          min={1}
                          value={suspension?.days ?? ''}
                          onChange={(e) =>
                            setPeriod(index, { days: e.target.value, months: '' })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2 rounded-md border p-3">
          <Label className="text-xs">
            {!previewError && !fits ? 'Item 7 text, carried into item 21' : 'Item 7 preview, as it will print'}
          </Label>
          <div className="rounded border bg-muted/40 px-2 py-2 text-sm">
            {previewError ? (
              <span className="text-destructive">{previewError}</span>
            ) : (
              previewText
            )}
          </div>
          {!previewError && !fits && (
            <p className="text-[11px] text-muted-foreground">
              Item 7 itself prints: <span className="font-medium">See Supplemental Page</span>
            </p>
          )}
          {!previewError && (
            <p className="text-[11px] text-muted-foreground">
              {previewText.length} characters.
              {!fits && ` Over the field by roughly ${overCount} points.`}
            </p>
          )}
          {!previewError && !fits && (
            <div className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
              <p className="flex items-start gap-1 text-[11px] font-medium text-amber-800">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                Carried into item 21 automatically.
              </p>
              <p className="text-[11px] text-amber-800">
                Item 7 is a single-line field and clips rather than wrapping, so the tail
                would be lost with nothing on the page to show it. Item 7 now prints
                &quot;See Supplemental Page&quot; and the full text above is written into
                item 21 as a dated entry, the route the page 3 instruction prescribes.
                Shorten what is suspended and this reverses itself.
              </p>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
