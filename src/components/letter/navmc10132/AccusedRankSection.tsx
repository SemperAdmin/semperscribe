'use client';

/**
 * NAVMC 10132 item 19, the accused's rank and pay grade.
 *
 * This is a picker rather than a text box because the form's page 3
 * RANK/GRADE note fixes a CLOSED list: "Use only Pvt, PFC, LCpl, Cpl, Sgt,
 * SSgt, GySgt, MSgt, 1stSgt, MGySgt, SgtMaj ... as Marine ranks," with pay
 * grades limited to E1 through E9 and no dashes. A free text field invites
 * every spelling the note forbids.
 *
 * Navy is deliberately NOT a plain E1 through E9 list. The same note says
 * "For Navy petty officers, use the rating abbreviation," so an E5 corpsman
 * is HM2 and never PO2, and below E4 the abbreviation encodes the community,
 * HN for a corpsman against SN for the deck force. The composer builds the
 * correct string instead of offering a forbidden one.
 *
 * PAY GRADE IS A SEPARATE FIELD ON PURPOSE, and it stays editable after the
 * rank seeds it. The note ends "Pay attention to cases in which rank and pay
 * grade do not correspond (e.g., a Marine frocked to the next rank)." A
 * frocked Marine wears Sgt and is paid E4, and the form expects that
 * recorded accurately, so the app defaults the pair and never locks it.
 *
 * THE CLOBBER RULE. accusedService, accusedRankGrade, and accusedPayGrade
 * were removed from Navmc10132Definition's accused section for this reason.
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { isNavmc10132KeyLocked } from '@/lib/navmc10132-locks';
import { LockedBadge, ReadOnlyValue } from '@/components/letter/navmc10132/OffensesSection';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FormData } from '@/types';
import { BadgeCheck, Info, AlertTriangle } from 'lucide-react';

import {
  NAVMC_10132_ENLISTED_PAY_GRADES,
  NAVMC_10132_USMC_ENLISTED_RANKS,
  NAVMC_10132_USN_APPRENTICESHIPS,
  NAVMC_10132_USN_COMMON_RATINGS,
  composeNavyAbbreviation,
  formatRankGrade,
  payGradeOf,
  rankGradeDiverges,
} from '@/lib/navmc10132-ranks';

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  /**
   * Suppress the read-only echo of item 19 when the caller already shows it.
   * The parent collapses items 17-20 to a summary when a signature closes
   * every one of them, and that summary states the rank and pay grade. This
   * card still renders in that case, because years of service and sea pay
   * are not on the form and no signature closes them, so without this flag
   * item 19 would be printed twice on the same screen.
   */
  item19ShownByCaller?: boolean;
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

export function AccusedRankSection({
  formData,
  setFormData,
  SectionCard,
  item19ShownByCaller = false,
}: SectionProps) {
  const service = str(formData, 'accusedService') || 'USMC';
  const payGrade = str(formData, 'accusedPayGrade');
  const rankGrade = str(formData, 'accusedRankGrade');

  // The rank half of item 19, recovered from the composed string so the
  // picker shows what was chosen without storing it twice.
  const rankAbbrev = rankGrade.includes(',') ? rankGrade.split(',')[0].trim() : rankGrade.trim();

  // Navy pieces are local: only the composed result reaches the model, which
  // is what item 19 prints. Storing the rating separately would leave two
  // sources for one field.
  const [rating, setRating] = React.useState('');
  const [community, setCommunity] = React.useState('Hospitalman');

  const write = (patch: Record<string, string>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  /** Selecting a Marine rank seeds the pay grade. A DEFAULT, not a lock. */
  const pickUsmcRank = (abbrev: string) => {
    const seeded = payGradeOf(abbrev);
    write({
      accusedRankGrade: formatRankGrade(abbrev, seeded ?? payGrade),
      ...(seeded ? { accusedPayGrade: seeded } : {}),
    });
  };

  const pickPayGrade = (grade: string) => {
    write({ accusedPayGrade: grade, accusedRankGrade: formatRankGrade(rankAbbrev, grade) });
  };

  const composeNavy = (nextRating: string, nextCommunity: string, grade: string) => {
    const petty = composeNavyAbbreviation(nextRating, grade);
    const apprentice = NAVMC_10132_USN_APPRENTICESHIPS.find((a) => a.community === nextCommunity);
    const index = NAVMC_10132_ENLISTED_PAY_GRADES.indexOf(grade as never);
    const junior = apprentice && index >= 0 && index <= 2 ? apprentice.grades[index] : null;
    return petty ?? junior ?? '';
  };

  const setNavy = (next: { rating?: string; community?: string; grade?: string }) => {
    const r = next.rating ?? rating;
    const c = next.community ?? community;
    const g = next.grade ?? payGrade;
    if (next.rating !== undefined) setRating(next.rating);
    if (next.community !== undefined) setCommunity(next.community);
    write({
      accusedPayGrade: g,
      accusedRankGrade: formatRankGrade(composeNavy(r, c, g), g),
    });
  };

  const diverges = service === 'USMC' && rankGradeDiverges(rankAbbrev, payGrade);
  const isPettyOfficer = NAVMC_10132_ENLISTED_PAY_GRADES.indexOf(payGrade as never) >= 3;

  /**
   * ITEM 19 IS ON THE FORM AND CAN BE CLOSED BY A SIGNATURE; THE TWO FIELDS
   * BELOW IT ARE NOT AND CANNOT.
   *
   * Stephen, 2026-08-26: item 19's data "should have been blocked as it is on
   * the form", but completed years of service and sea or hardship duty pay
   * should not, because they are not on it. Measured on his signed file:
   * `19 ACCUSED RANK/GRADE` is one of the 45 closed fields, and there is no
   * AcroForm field for either of the other two anywhere on the form.
   *
   * So the lock covers service, rank and pay grade, which together COMPOSE
   * item 19, and stops there. Years of service and sea pay feed the
   * forfeiture ceiling, which is app-side arithmetic a clerk may still need
   * to correct on a signed document.
   */
  const item19Locked = isNavmc10132KeyLocked(formData, 'accusedRankGrade');

  return (
    <SectionCard icon={<BadgeCheck className="mr-2 h-5 w-5" />} title="Rank and Pay Grade (Item 19)">
      <div className="space-y-4">
        <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          The form&apos;s page 3 note fixes these spellings. No periods in Marine ranks, no
          dashes in pay grades. Navy petty officers use the rating abbreviation, so an E5
          corpsman is HM2.
        </p>

        {item19Locked ? (
          <div className="space-y-1">
            <Label className="text-xs">
              Item 19, as it prints on the signed form
              <LockedBadge />
            </Label>
            {!item19ShownByCaller && <ReadOnlyValue value={rankGrade} />}
            <p className="text-[11px] text-muted-foreground">
              Service, rank and pay grade compose this one field, and a signature has closed
              it. Correcting it means a corrected copy and a new signature, not an edit here.
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Service</Label>
            <Select
              value={service}
              onValueChange={(value) => write({ accusedService: value, accusedRankGrade: '' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USMC">Marine Corps</SelectItem>
                <SelectItem value="USN">Navy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {service === 'USMC' ? (
            <div className="space-y-1">
              <Label className="text-xs">Rank</Label>
              <Select value={rankAbbrev} onValueChange={pickUsmcRank}>
                <SelectTrigger><SelectValue placeholder="Select a rank" /></SelectTrigger>
                <SelectContent>
                  {NAVMC_10132_USMC_ENLISTED_RANKS.map((rank) => (
                    <SelectItem key={rank.abbreviation} value={rank.abbreviation}>
                      {rank.abbreviation} - {rank.title} ({rank.payGrade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">{isPettyOfficer ? 'Rating' : 'Community'}</Label>
              {isPettyOfficer ? (
                <Input
                  list="usn-ratings"
                  value={rating}
                  placeholder="HM"
                  onChange={(e) => setNavy({ rating: e.target.value })}
                />
              ) : (
                <Select value={community} onValueChange={(v) => setNavy({ community: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NAVMC_10132_USN_APPRENTICESHIPS.map((a) => (
                      <SelectItem key={a.community} value={a.community}>{a.community}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <datalist id="usn-ratings">
                {NAVMC_10132_USN_COMMON_RATINGS.map((r) => (
                  <option key={r.abbreviation} value={r.abbreviation}>{r.title}</option>
                ))}
              </datalist>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Pay grade</Label>
            <Select
              value={payGrade}
              onValueChange={(value) =>
                service === 'USMC' ? pickPayGrade(value) : setNavy({ grade: value })
              }
            >
              <SelectTrigger><SelectValue placeholder="E1 to E9" /></SelectTrigger>
              <SelectContent>
                {NAVMC_10132_ENLISTED_PAY_GRADES.map((grade) => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        )}

        {service === 'USN' && !isPettyOfficer && (
          <p className="text-[11px] text-muted-foreground">
            Below E4 the Navy uses the community abbreviation rather than a rating, so an E3
            corpsman is HN and an E3 in the deck force is SN.
          </p>
        )}

        {diverges && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[11px] text-amber-800">
              {rankAbbrev} normally holds {payGradeOf(rankAbbrev)}, and {payGrade} is entered.
              This is legitimate for a Marine frocked to the next rank, which the form&apos;s
              page 3 note tells you to expect. Left as entered. Correct the pay grade above if
              it was a slip.
            </p>
          </div>
        )}

        {/* ITEM 19'S PREVIEW, and nothing else. Years of service and sea
            or hardship duty pay used to sit here as a second column, on the
            reasoning that length of service belongs with the grade it prices.
            Stephen moved them into a card of their own on 2026-08-27, after
            the 2026-08-25 demo showed the cost of tying two off-form inputs
            to the lifecycle of an on-form one. See AccusedPayFactsSection. */}
        {!item19Locked && (
          <div className="space-y-1 rounded-md border p-3 sm:max-w-sm">
            <Label className="text-xs">Item 19, as it will print</Label>
            <div className="rounded border bg-muted/40 px-2 py-2 text-sm">
              {rankGrade || <span className="text-muted-foreground">Nothing selected yet.</span>}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
