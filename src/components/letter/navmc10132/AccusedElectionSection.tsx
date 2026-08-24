'use client';

/**
 * Item 2 of the NAVMC 10132 (Unit Punishment Book), the accused's election
 * between accepting nonjudicial punishment and demanding trial, plus item 3,
 * the commanding officer's certification of rights.
 *
 * WHY THIS COMPONENT EXISTS. On the official fillable blank, the "2 BOOKER"
 * field looks like static text but is rewritten by three identical on-blur
 * scripts attached to "2 DEMAND", "2 COUNSELOPP", and "2 ACC REFUSE TO SIGN".
 * The blank ships with the ACCEPTANCE sentence already stored in that field.
 * If this app writes item 2 without reproducing that script's logic, a clerk
 * can produce a Unit Punishment Book that states the accused accepted NJP
 * even where the accused refused to sign or demanded trial. This component's
 * only job is to make that hidden behavior visible while the clerk works,
 * and to make sure the value this app emits is the value the script would
 * have produced, not whatever the blank happened to ship with.
 *
 * The demand-versus-refusal interaction is also load bearing. The form's own
 * script silently rewrites the DEMAND field itself when the accused refuses
 * to sign an acceptance, so a clerk reading only the demand dropdown can be
 * looking at a value the form is about to overwrite. coerceDemand reproduces
 * that rewrite here, in the open, with a note explaining why it happened.
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { IsoDatePicker } from '@/components/letter/navmc10132/IsoDatePicker';
import { FormData } from '@/types';
import { Gavel } from 'lucide-react';
import { bookerStatement, coerceDemand } from '@/lib/navmc10132-utils';
import { NAVMC_10132_DEMAND, type Navmc10132Demand } from '@/types/navmc';

type SectionCardProps = { icon: React.ReactNode; title: string; children: React.ReactNode };

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<SectionCardProps>;
}

type CounselOpportunity = '' | 'have' | 'have not';

/** Named branch labels, in the exact order the decoded on-blur script tests
 *  them. Matching that order matters, the vessel exception must win even
 *  when the accused also refused to sign, because the script's vessel
 *  branch is checked first and short circuits the rest of the chain. */
function bookerBranchName(
  demand: string,
  counselOpportunity: CounselOpportunity,
  refused: boolean,
): string {
  if (demand === NAVMC_10132_DEMAND.VESSEL) return 'vessel exception';
  if (refused) return 'refusal to sign';
  if (demand === NAVMC_10132_DEMAND.REFUSE) return 'refusal of NJP';
  if (counselOpportunity === 'have not') return 'no counsel opportunity';
  if (demand === NAVMC_10132_DEMAND.ACCEPT) return 'acceptance';
  return 'unset';
}

export function AccusedElectionSection({ formData, setFormData, SectionCard }: SectionProps) {
  const demand = ((formData.demand as string) ?? '') as Navmc10132Demand;
  const counselOpportunity = ((formData.counselOpportunity as string) ?? '') as CounselOpportunity;
  const refused = Boolean(formData.accusedRefusedToSign);
  const electionDate = (formData.electionDate as string) ?? '';
  const rightsAttestDate = (formData.rightsAttestDate as string) ?? '';
  const storedDemand = demand;
  const storedBooker = (formData.bookerStatement as string) ?? '';

  // Reproduce the form's own coercion, in the open, ahead of any state write.
  // This is a pure calculation from the current inputs, not a read of
  // formData.demand's previous history, so it is safe to recompute every
  // render.
  const coercedDemand = coerceDemand(demand, refused) as Navmc10132Demand;
  const wasCoerced = coercedDemand !== demand;

  // The value the script would leave in "2 BOOKER" right now, computed from
  // the coerced demand so the preview and the write-back never disagree
  // about which demand value is in effect.
  const booker = bookerStatement(coercedDemand, counselOpportunity, refused);
  const branchName = bookerBranchName(coercedDemand, counselOpportunity, refused);

  // Write the derived values back into formData so the emitter reads the
  // same string this preview shows. The infinite-render hazard here is
  // real, this effect's own write changes formData, which re-runs the
  // component, which recomputes coercedDemand and booker from that new
  // formData. The guard is that both are PURE functions of demand,
  // counselOpportunity, and refused, so once formData.demand equals
  // coercedDemand and formData.bookerStatement equals booker, recomputing
  // them again yields the identical strings and the effect's own
  // before-and-after comparison (both outside and inside the updater) makes
  // it a no-op. The dependency array lists only the derived primitives, not
  // formData itself, so a change to any other field on formData does not
  // re-trigger this effect at all.
  React.useEffect(() => {
    if (coercedDemand === storedDemand && booker === storedBooker) return;
    setFormData((prev) => {
      const prevDemand = (prev.demand as string) ?? '';
      const prevBooker = (prev.bookerStatement as string) ?? '';
      if (prevDemand === coercedDemand && prevBooker === booker) return prev;
      return { ...prev, demand: coercedDemand, bookerStatement: booker };
    });
  }, [coercedDemand, booker, storedDemand, storedBooker, setFormData]);

  return (
    <SectionCard icon={<Gavel className="mr-2 h-5 w-5" />} title="Item 2, Accused Election">
      <p className="text-[11px] text-muted-foreground">
        The Booker statement below is derived, not typed. It comes straight from the three
        identical on-blur scripts the official blank attaches to the demand, counsel, and
        refusal fields, reproduced here so the clerk sees what those scripts would have written
        instead of trusting whatever text the blank shipped with.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Item 2, election</Label>
          <Select
            value={coercedDemand}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, demand: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select the accused's election" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NAVMC_10132_DEMAND.ACCEPT}>{NAVMC_10132_DEMAND.ACCEPT}</SelectItem>
              <SelectItem value={NAVMC_10132_DEMAND.REFUSE}>{NAVMC_10132_DEMAND.REFUSE}</SelectItem>
              <SelectItem value={NAVMC_10132_DEMAND.VESSEL}>{NAVMC_10132_DEMAND.VESSEL}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Item 2, date of election</Label>
          <IsoDatePicker
            value={electionDate}
            onChange={(value: string) => setFormData((prev) => ({ ...prev, electionDate: value }))}
          />
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-1 text-sm">
        <span>I further certify that I</span>
        <Select
          value={counselOpportunity}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, counselOpportunity: value as CounselOpportunity }))
          }
        >
          <SelectTrigger className="h-7 w-28 px-2 text-sm">
            <SelectValue placeholder="have / have not" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="have">have</SelectItem>
            <SelectItem value="have not">have not</SelectItem>
          </SelectContent>
        </Select>
        <span>been given the opportunity to consult with a military lawyer.</span>
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Checkbox
          id="accused-refused-to-sign"
          checked={refused}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, accusedRefusedToSign: Boolean(checked) }))
          }
        />
        <Label htmlFor="accused-refused-to-sign" className="text-sm font-normal">
          Accused refused to sign
        </Label>
      </div>

      {wasCoerced && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          The election was changed to &quot;{NAVMC_10132_DEMAND.REFUSE}&quot; because the
          accused refused to sign. The form's own on-blur script does the same rewrite when an
          acceptance is on record at the moment of refusal, so this app matches it rather than
          leaving a stale acceptance behind an unchecked box.
        </p>
      )}

      <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Item 2, Booker statement (derived)</Label>
          <span className="text-[11px] text-muted-foreground">Branch: {branchName}</span>
        </div>
        {booker ? (
          <p className="mt-1 whitespace-pre-wrap font-mono text-[12px] leading-relaxed">
            {booker}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            No branch of the form's script matches the current election yet, so this field will
            be written empty. Left alone, the blank form would instead keep the acceptance
            sentence it ships with, which would misstate that the accused accepted NJP. Select
            an election above to derive the correct statement.
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <Label className="text-xs">Item 3, CO certification of rights, date</Label>
        <IsoDatePicker
          value={rightsAttestDate}
          onChange={(value: string) => setFormData((prev) => ({ ...prev, rightsAttestDate: value }))}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Must be dated on or before the date punishment is imposed, per the form's item 3
          instruction, because the certification of rights necessarily precedes the imposition
          of punishment.
        </p>
      </div>
    </SectionCard>
  );
}
