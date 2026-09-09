'use client';

/**
 * Length of service and special pay, and the forfeiture ceilings they price.
 *
 * A CARD OF ITS OWN, ruled by Stephen 2026-08-27: "when we upload for
 * proceedings we have the YOS and extra pay. Lets make these their own
 * section vice part of Rank and Pay Grade (Item 19). We should then show the
 * max forf based on the YOS and rank along with if reduced."
 *
 * WHY THE SPLIT IS RIGHT AND NOT MERELY TIDIER. Neither field is on the
 * NAVMC 10132. The blank form carries 74 AcroForm fields and items 17
 * through 20 are UNIT, ACCUSED FULL NAME, ACCUSED RANK/GRADE and ACCUSED
 * EDIPI. Nothing here prints, so no signature closes it and no upload should
 * ever hide it. While these two lived inside the item 19 card they inherited
 * that card's lifecycle, and on the 2026-08-25 demo a signed upload took
 * them off the screen with it. Stephen, live: "max forfeiture, not computed
 * because I did not add the ability to put the years." A card whose contents
 * never print must not be gated on a signature, and the surest way to
 * guarantee that is to stop it sharing a card with a field that does.
 *
 * WHY THE CEILINGS BELONG HERE TOO. These two numbers are the ONLY reason
 * the app asks for either field, and until now the result of typing them
 * appeared several cards further down. A clerk correcting a length of
 * service could not see what the correction bought without scrolling to the
 * punishment builder. The panel is the same component that builder renders,
 * fed by the same builder function, so the two can never disagree.
 */

import React, { useState } from 'react';
import { Coins } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormData } from '@/types';
import { formForfeitureLadder } from '@/lib/navmc10132-forfeiture-ladder';
import { ForfeitureLadderPanel } from '@/components/letter/navmc10132/ForfeitureLadderPanel';

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<{
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
  }>;
}

/** FormData carries an `any` index signature, so reads narrow explicitly. */
function str(formData: FormData, key: string): string {
  const value: unknown = formData[key];
  return typeof value === 'string' ? value : '';
}

/**
 * What each box accepts, as a shape the WHOLE entry must match after the
 * keystroke. Whole completed years, at most two digits. Dollars with at most
 * two decimal places, where a trailing point is allowed because the clerk is
 * mid-entry ("150." on the way to "150.00").
 *
 * REJECT THE KEYSTROKE, NEVER EDIT THE ENTRY. Until 2026-09 (P5-3) these
 * inputs stripped every non-digit from whatever was typed, so "150.00" was
 * stored as "15000" and "2.5" as "25": a sea pay a hundred times too large
 * and a length of service ten times too long, both silently, both feeding
 * the forfeiture ceiling. A keystroke that would take the entry outside its
 * shape is dropped and the previous value kept, and the box says why.
 */
const YEARS_SHAPE = /^\d{0,2}$/;
const DOLLARS_SHAPE = /^\d*(\.\d{0,2})?$/;

export function AccusedPayFactsSection({ formData, setFormData, SectionCard }: SectionProps) {
  const write = (patch: Record<string, string>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  const [yearsRejected, setYearsRejected] = useState<string | null>(null);
  const [payRejected, setPayRejected] = useState<string | null>(null);

  const ladder = formForfeitureLadder(formData as unknown as { [key: string]: unknown });

  return (
    <SectionCard
      icon={<Coins className="mr-2 h-5 w-5" />}
      title="Pay and Service Data (does not print)"
    >
      <div className="space-y-4">
        <p className="text-[11px] text-muted-foreground">
          Neither box below is on the NAVMC 10132 and neither reaches the exported PDF. The
          app holds them because a forfeiture is capped by the accused&apos;s rate of pay, and
          MCM Part V para 5.c(8) fixes that rate by pay grade <em>and length of service</em>.
          Item 19 supplies the grade. These supply the rest.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 rounded-md border border-dashed p-3">
            {/*
              "Completed years, round down" is not decoration. bracketIndex
              treats the entry as completed years, and a Marine at 1 year 10
              months entered as "2" jumps a bracket. One bracket is worth $42
              on a seven days' pay forfeiture at the E-3 "Over 2" boundary and
              $468 across two months at the E-7 "Over 26" boundary.
            */}
            <Label className="text-xs" htmlFor="accused-years-of-service">
              Completed years of service, round down
            </Label>
            <Input
              id="accused-years-of-service"
              inputMode="numeric"
              placeholder="4"
              aria-invalid={yearsRejected !== null || undefined}
              value={str(formData, 'accusedYearsOfService')}
              onChange={(e) => {
                const next = e.target.value;
                if (!YEARS_SHAPE.test(next)) {
                  setYearsRejected(next);
                  return;
                }
                setYearsRejected(null);
                write({ accusedYearsOfService: next });
              }}
            />
            {yearsRejected !== null && (
              <p className="text-[11px] font-medium text-destructive" role="alert">
                Whole years only, up to two digits. &quot;{yearsRejected}&quot; was not stored;
                the box still holds &quot;{str(formData, 'accusedYearsOfService')}&quot;.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Round DOWN. A Marine at 1 year 10 months is 1, not 2. The pay table is banded,
              so one band crossed in error moves the ceiling by real money.
            </p>
          </div>

          <div className="space-y-1 rounded-md border border-dashed p-3">
            <Label className="text-xs" htmlFor="accused-sea-hardship-pay">
              Sea or hardship duty pay, per month
            </Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                id="accused-sea-hardship-pay"
                inputMode="decimal"
                placeholder="0"
                aria-invalid={payRejected !== null || undefined}
                value={str(formData, 'accusedSeaHardshipDutyPay')}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!DOLLARS_SHAPE.test(next)) {
                    setPayRejected(next);
                    return;
                  }
                  setPayRejected(null);
                  write({ accusedSeaHardshipDutyPay: next });
                }}
              />
            </div>
            {payRejected !== null && (
              <p className="text-[11px] font-medium text-destructive" role="alert">
                Dollars and cents only, digits with at most two decimal places. &quot;
                {payRejected}&quot; was not stored; the box still holds &quot;
                {str(formData, 'accusedSeaHardshipDutyPay')}&quot;.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Blank for most Marines. JAGMAN 0111.i: pay subject to forfeiture is basic pay{' '}
              <em>plus sea duty or hardship duty pay</em>. Leaving it blank on a Marine who
              draws it computes a ceiling LOWER than the lawful one.
            </p>
          </div>
        </div>

        {/* THE POINT OF THE CARD. Same component and same builder the
            punishment card uses, so a figure shown here is the figure shown
            there. See ForfeitureLadderPanel and formForfeitureLadder. */}
        <ForfeitureLadderPanel ladder={ladder} />
      </div>
    </SectionCard>
  );
}
