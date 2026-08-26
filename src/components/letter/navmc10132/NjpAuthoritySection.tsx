'use client';

/**
 * NAVMC 10132 items 8, 8A and 8B, the officer imposing the punishment.
 *
 * WHY THIS REPLACED A DYNAMICFORM SECTION. Stephen, 2026-08-26: "We shoudl
 * have the dropdown for Service, Rank, and generate the grade for the NJP
 * Authority (Items 8, 8A, 8B) like we do the Rank and Pay Grade (Item 19)."
 *
 * The old section carried TWO free-text grade fields that nothing tied
 * together: `njpAuthorityGrade`, which prints in item 8A, and
 * `njpAuthorityPayGrade`, an app-side field described as "Not printed". A
 * clerk could type "Capt, O3" in the first and "O5" in the second, and every
 * consequence would split down the middle: the exported form would say
 * company grade while the punishment picker offered field-grade codes, the
 * A-1-d maximum-punishment paragraph stated the field-grade ceiling, and
 * V-20 priced its arithmetic on the wrong authority. Nothing checked. One
 * picker feeding both closes that class outright, which is the real reason
 * for this change rather than the convenience.
 *
 * THE LIST IS CLOSED FOR MARINES, from the form's own page 3 RANK/GRADE
 * note: "WO, CWO2, CWO3, CWO4, CWO5, 2ndLt, 1stLt, Capt, Maj, LtCol, Col,
 * BGen, MajGen, LtGen, Gen". Any other service is deliberately NOT a list.
 * The same note says only "For other services, use the correct and
 * appropriate rank abbreviation", so the app offers a text box there rather
 * than inventing a closed list the note never gave it.
 *
 * PAY GRADE STAYS EDITABLE after the rank seeds it, for the same reason
 * item 19's does. The note ends "Pay attention to cases in which rank and
 * pay grade do not correspond", and for officers the ordinary case is the
 * prior-enlisted rate: a Capt is paid O3E and wears Capt.
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Gavel, Info, AlertTriangle } from 'lucide-react';
import { FormData } from '@/types';
import { isNavmc10132KeyLocked } from '@/lib/navmc10132-locks';
import { LockedBadge, ReadOnlyValue } from '@/components/letter/navmc10132/OffensesSection';
import {
  NAVMC_10132_OFFICER_PAY_GRADES,
  NAVMC_10132_USMC_OFFICER_RANKS,
  formatRankGrade,
  officerPayGradeOf,
  officerRankGradeDiverges,
} from '@/lib/navmc10132-ranks';
import {
  NJP_AUTHORITY_LEVEL_LABEL,
  resolveAuthorityLevel,
} from '@/lib/navmc10132-punishments';

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<{
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
  }>;
}

function str(formData: FormData, key: string): string {
  const value: unknown = formData[key];
  return typeof value === 'string' ? value : '';
}

export function NjpAuthoritySection({ formData, setFormData, SectionCard }: SectionProps) {
  const service = str(formData, 'njpAuthorityService') || 'USMC';
  const payGrade = str(formData, 'njpAuthorityPayGrade');
  const rankGrade = str(formData, 'njpAuthorityGrade');

  // The rank half of item 8A, recovered from the composed string so the
  // picker shows what was chosen without storing it twice. Same trick as
  // AccusedRankSection uses on item 19.
  const rankAbbrev = rankGrade.includes(',') ? rankGrade.split(',')[0].trim() : rankGrade.trim();

  const write = (patch: Record<string, string>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  /**
   * ONE CHOICE WRITES BOTH FIELDS. `njpAuthorityGrade` is what item 8A
   * prints; `njpAuthorityPayGrade` is what the punishment picker, the A-1-d
   * ceiling and V-20 all read. They can no longer disagree.
   */
  const pickRank = (abbrev: string) => {
    const seeded = officerPayGradeOf(abbrev);
    write({
      njpAuthorityGrade: formatRankGrade(abbrev, seeded ?? payGrade),
      ...(seeded ? { njpAuthorityPayGrade: seeded } : {}),
    });
  };

  const pickPayGrade = (grade: string) => {
    write({ njpAuthorityPayGrade: grade, njpAuthorityGrade: formatRankGrade(rankAbbrev, grade) });
  };

  const setService = (next: string) =>
    write({ njpAuthorityService: next, njpAuthorityGrade: '', njpAuthorityPayGrade: '' });

  /** A non-Marine authority types the abbreviation the note calls for. */
  const setFreeRank = (abbrev: string) =>
    write({ njpAuthorityGrade: formatRankGrade(abbrev.trim(), payGrade) });

  const level = resolveAuthorityLevel(payGrade);
  const warrant = /^W\d$/i.test(payGrade.trim());
  const diverges = service === 'USMC' && officerRankGradeDiverges(rankAbbrev, payGrade);

  // Item 8 has AcroForm fields, so a signature can close it. Measured on
  // Stephen's file: the form's own lock list does NOT name them, which is
  // defect 3.9, and D-45 closes them at the item 9 signature instead.
  const nameLocked = isNavmc10132KeyLocked(formData, 'njpAuthorityName');
  const gradeLocked = isNavmc10132KeyLocked(formData, 'njpAuthorityGrade');
  const edipiLocked = isNavmc10132KeyLocked(formData, 'njpAuthorityEdipi');

  return (
    <SectionCard icon={<Gavel className="mr-2 h-5 w-5" />} title="NJP Authority (Items 8, 8A, 8B)">
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">
            Item 8 - name, title, service branch if other than USMC
            {nameLocked && <LockedBadge />}
          </Label>
          {nameLocked ? (
            <ReadOnlyValue value={str(formData, 'njpAuthorityName')} />
          ) : (
            <Input
              value={str(formData, 'njpAuthorityName')}
              onChange={(e) => write({ njpAuthorityName: e.target.value })}
            />
          )}
        </div>

        {gradeLocked ? (
          <div className="space-y-1">
            <Label className="text-xs">
              Item 8A - rank and pay grade
              <LockedBadge />
            </Label>
            <ReadOnlyValue value={rankGrade} />
            <p className="text-[11px] text-muted-foreground">
              Service, rank and pay grade compose this one field, and a signature has closed
              it. Nothing here can be re-picked.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Service</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USMC">Marine Corps</SelectItem>
                  <SelectItem value="OTHER">Other service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Rank</Label>
              {service === 'USMC' ? (
                <Select value={rankAbbrev} onValueChange={pickRank}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {NAVMC_10132_USMC_OFFICER_RANKS.map((rank) => (
                      <SelectItem key={rank.abbreviation} value={rank.abbreviation}>
                        {rank.abbreviation} - {rank.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={rankAbbrev}
                  placeholder="LCDR"
                  onChange={(e) => setFreeRank(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Pay grade</Label>
              <Select value={payGrade} onValueChange={pickPayGrade}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {NAVMC_10132_OFFICER_PAY_GRADES.map((grade) => (
                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!gradeLocked && service !== 'USMC' && (
          <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            The form&apos;s page 3 note closes the list for Marines only. For any other service
            it says to &quot;use the correct and appropriate rank abbreviation&quot;, so this is
            a text box rather than a list the app invented.
          </p>
        )}

        {!gradeLocked && (
          <div className="space-y-1">
            <Label className="text-xs">Item 8A as it will print</Label>
            <ReadOnlyValue value={rankGrade} />
          </div>
        )}

        {diverges && (
          <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            {rankAbbrev} normally holds {officerPayGradeOf(rankAbbrev)}, and {payGrade} is
            entered. Correct for an officer with prior enlisted service, who wears {rankAbbrev}
            and is paid {payGrade}. Left as entered.
          </p>
        )}

        {/* WHAT THE PAY GRADE DECIDES, said where it is chosen. It is not a
            display field: it drives which punishment codes the item 6 picker
            offers and the ceiling A-1-d states. */}
        {payGrade !== '' && (
          <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
            {level === null ? (
              <>
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                {warrant ? (
                  <>
                    A warrant grade resolves no NJP authority level. 10 U.S.C. 815(b)(2) sets
                    the higher ceiling for a commanding officer of the grade of major or above,
                    so the app states no maximum punishment on JAGMAN A-1-d and marks the
                    field-grade punishment codes unverified. The form still records {payGrade}.
                  </>
                ) : (
                  <>Pay grade {payGrade} does not resolve to an NJP authority level.</>
                )}
              </>
            ) : (
              <>
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                {NJP_AUTHORITY_LEVEL_LABEL[level]} authority. This decides which punishment
                codes item 6 offers and the ceiling stated on JAGMAN A-1-d (10 U.S.C.
                815(b)(2), MCM Part V para 5.b(2)).
              </>
            )}
          </p>
        )}

        <div className="space-y-1">
          <Label className="text-xs">
            Item 8B - EDIPI
            {edipiLocked && <LockedBadge />}
          </Label>
          {edipiLocked ? (
            <ReadOnlyValue value={str(formData, 'njpAuthorityEdipi')} />
          ) : (
            <Input
              value={str(formData, 'njpAuthorityEdipi')}
              onChange={(e) =>
                write({ njpAuthorityEdipi: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })
              }
            />
          )}
        </div>
      </div>
    </SectionCard>
  );
}
