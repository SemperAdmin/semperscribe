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
 *
 * STAGE-GATED AT PASS 1 (NOTIFICATION). Per section 13.2 of the spec and
 * decision row D-41, item 2 belongs to the member filling the exported PDF
 * in Acrobat, not to this app: the form's own on-blur scripts compose the
 * Booker statement from the member's elections, so the app's job on
 * re-upload is to VERIFY that composition, never to author it ahead of
 * time. At pass 1 this component therefore shows only the two facts the
 * app genuinely owns before the document goes out: the vessel exception,
 * which is app state deciding which rights advisement applies, and the
 * advisement itself. Every other control here (the election, the counsel
 * sentence, the refusal checkbox, the derived Booker preview, and the item
 * 3 CO certification date) stays hidden until a later stage.
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { IsoDatePicker } from '@/components/letter/navmc10132/IsoDatePicker';
import { isNavmc10132KeyLocked } from '@/lib/navmc10132-locks';
import { LockedBadge, ReadOnlyValue } from '@/components/letter/navmc10132/OffensesSection';
import { FormData } from '@/types';
import { Gavel, FileDown, Ship, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  rightsElectionReadiness,
  renderRightsElection,
  maximumPunishmentStatus,
} from '@/lib/njp-package';
import { bookerStatement, coerceDemand } from '@/lib/navmc10132-utils';
import { NAVMC_10132_DEMAND, type Navmc10132Demand, type Navmc10132Stage } from '@/types/navmc';
import { NJP_AUTHORITY_LEVEL_LABEL } from '@/lib/njp-maximum-punishment';

type SectionCardProps = { icon: React.ReactNode; title: string; children: React.ReactNode };

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<SectionCardProps>;
  /** See the stage-gating note above: pass 1 shows a reduced view. */
  stage: Navmc10132Stage;
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

export function AccusedElectionSection({ formData, setFormData, SectionCard, stage }: SectionProps) {
  const showFullElection = stage !== 1;

  /**
   * ITEM 2 IS THE ACCUSED'S OWN SIGNATURE BLOCK, so on a loaded file it is
   * closed before anything else is. Measured on a real pass-2 file: all five
   * of `2 DEMAND`, `2 COUNSELOPP`, `2 ACC REFUSE TO SIGN`,
   * `2 ACC ELECTION AND RIGHTS DATE` and `2 BOOKER` are closed by the item 2
   * signature itself.
   *
   * Reported by Stephen 2026-08-26 as still editable, which it was: this
   * section knew about the STAGE and not about the LOCKS. An editable
   * election over a signed one is a promise the export cannot keep, and on
   * this field it is worse than most, because what it would appear to let a
   * clerk change is what the accused personally elected and signed for.
   *
   * ONE CONTROL IS DELIBERATELY NOT LOCKED. `vesselException` is APP STATE,
   * not a form field, and it selects which rights advisement gets served. It
   * has no lock because it has nothing on the form to be locked by.
   */
  const electionLocked = isNavmc10132KeyLocked(formData, 'demand');
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
      {showFullElection ? (
        <p className="text-[11px] text-muted-foreground">
          The Booker statement below is derived, not typed. It comes straight from the three
          identical on-blur scripts the official blank attaches to the demand, counsel, and
          refusal fields, reproduced here so the clerk sees what those scripts would have written
          instead of trusting whatever text the blank shipped with.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          At notification, item 2 belongs to the member, not to this app. The election, the
          counsel opportunity, the refusal to sign, and the Booker statement they compose are
          filled by the accused on the exported PDF in Acrobat, and this app's job on re-upload
          is to verify that composition, not to author it ahead of time. What the app owns before
          the document goes out is only the vessel exception below, since it decides which rights
          advisement applies, and the advisement itself.
        </p>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-md border p-3">
        <Ship className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="vessel-exception"
              checked={!!formData.vesselException}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, vesselException: checked === true }))
              }
            />
            <Label htmlFor="vessel-exception" className="text-sm">
              The accused is attached to or embarked in a vessel
            </Label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A fact about the accused&apos;s status, not an election. It decides which rights
            advisement is served, A-1-c when it applies and A-1-d when it does not, and that
            choice is made before the accused answers anything. Set it here rather than
            reading it back off the demand below.
          </p>
        </div>
      </div>

      {showFullElection && electionLocked && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">
                Item 2, election
                <LockedBadge />
              </Label>
              <ReadOnlyValue value={coercedDemand} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Item 2, date of election
                <LockedBadge />
              </Label>
              <ReadOnlyValue value={electionDate} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Opportunity to consult a military lawyer
                <LockedBadge />
              </Label>
              <ReadOnlyValue value={counselOpportunity} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Accused refused to sign
                <LockedBadge />
              </Label>
              <ReadOnlyValue value={refused ? 'Yes' : 'No'} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The accused signed item 2, and that signature closed this block. What is shown is
            what they elected. Nothing here can be changed in the app, and the export will not
            write any of it.
          </p>
        </div>
      )}

      {showFullElection && !electionLocked && (
        <>
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
        </>
      )}

      <RightsElectionButton formData={formData} />
    </SectionCard>
  );
}

/**
 * Generates the JAGMAN rights advisement, A-1-c or A-1-d, from the data this
 * section and the two above it already carry.
 *
 * The button sits HERE rather than in a package panel elsewhere because this
 * is the section that owns the last field it needs. The form's section order
 * follows the paper's own preparation order, so the button appears at the
 * point in the process where the document is actually served.
 *
 * It stays enabled before any election is recorded, on purpose. The
 * advisement is what the accused reads in order to elect, so requiring the
 * election first would invert the sequence.
 */
function RightsElectionButton({ formData }: { formData: FormData }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const readiness = rightsElectionReadiness(formData);
  const vessel = !!formData.vesselException;
  // The ceiling turns on item 8A, which sits in a LATER section. This is
  // advisory only: the advisement still generates with paragraph 3 blank,
  // because it is served before the authority is even recorded.
  const maximum = maximumPunishmentStatus(formData);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const doc = await renderRightsElection(formData);
      const url = window.URL.createObjectURL(
        new Blob([new Uint8Array(doc.bytes)], { type: 'application/pdf' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the advisement.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-2 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            Rights advisement, JAGMAN Appendix {vessel ? 'A-1-c' : 'A-1-d'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {vessel
              ? 'Vessel exception applies, so the accused cannot refuse NJP and A-1-c is served.'
              : 'Vessel exception does not apply, so A-1-d is served and it carries the right to refuse.'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={!readiness.ready || busy} onClick={generate}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          Generate
        </Button>
      </div>

      {!readiness.ready && (
        <p className="text-[11px] text-muted-foreground">
          Still needed: {readiness.missing.join(', ')}.
        </p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        Served before the accused elects anything, so it carries no finding and no imposed
        punishment.
      </p>
      <div className="rounded-md bg-muted/40 p-2">
        <p className="text-[11px] font-medium">
          Maximum punishment, A-1-d paragraph 3
          {maximum.level ? ` - ${NJP_AUTHORITY_LEVEL_LABEL[maximum.level]}` : ''}
        </p>
        <p className="text-[11px] text-muted-foreground">{maximum.detail}</p>
        {maximum.notes.map((note) => (
          <p key={note} className="mt-1 text-[11px] text-muted-foreground">
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}
