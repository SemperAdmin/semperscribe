'use client';

/**
 * Item 22, victim demographics, five rows (A through E).
 *
 * Spec defect 3.1: the official form's row A dropdown carries the vocabulary
 * printed in its own item 22 instructions, but rows B through E are
 * non-editable closed combos that carry a different, undocumented vocabulary
 * with no crosswalk back to row A's list. Rather than silently mis-mapping
 * victims 2 through 5 into a vocabulary the instructions never describe,
 * this component uses ONE vocabulary, row A's, for every row. Only row A is
 * written to the item 22 grid. Rows B through E are routed into item 21
 * using the instruction's own "Additional Victims" format, see
 * composeRemarks() in the Phase 2 engine.
 *
 * Item 22 records demographics only. Victim personally identifying
 * information must not be entered here or in item 21, per the form's own
 * item 21 instruction. The authority to collect what item 22 does ask for is
 * the form's own Privacy Act statement, not any external statute.
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Users } from 'lucide-react';
import { isNavmc10132SectionLocked } from '@/lib/navmc10132-locks';
import { LockedBadge } from '@/components/letter/navmc10132/OffensesSection';
import { FormData } from '@/types';
import {
  NAVMC_10132_VICTIM_STATUS, NAVMC_10132_VICTIM_SEX,
  NAVMC_10132_VICTIM_RACE, NAVMC_10132_VICTIM_ETHNICITY,
  NAVMC_10132_EMPTY_VICTIM,
  type Navmc10132Victim,
} from '@/types/navmc';

type SectionCardProps = { icon: React.ReactNode; title: string; children: React.ReactNode };

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<SectionCardProps>;
}

const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Pads or trims formData.victims to the form's fixed five rows. */
function fiveVictims(formData: FormData): Navmc10132Victim[] {
  const rows: Navmc10132Victim[] = Array.isArray(formData.victims)
    ? [...(formData.victims as Navmc10132Victim[])]
    : [];
  while (rows.length < 5) rows.push({ ...NAVMC_10132_EMPTY_VICTIM });
  return rows.slice(0, 5);
}

function isVictimPopulated(victim: Navmc10132Victim): boolean {
  return Boolean(victim.status || victim.sex || victim.race || victim.ethnicity);
}

export function VictimsSection({ formData, setFormData, SectionCard }: SectionProps) {
  /**
   * THE VICTIM BLOCK CLOSES AT THE ACCUSED'S OWN SIGNATURE, which is the
   * first one on the form. Measured on a real pass-2 file: all TWENTY fields,
   * rows A through E, are in the item 2 lock list. That is why spec section
   * 13.2 puts victims in the PASS 1 UI, and why a clerk who leaves victim
   * data for later has nowhere to put it.
   *
   * Locked as a whole rather than per input. Every field the section owns
   * closes at the same signature, so a per-field answer would be the same
   * answer five times.
   */
  const locked = isNavmc10132SectionLocked(formData, 'victims');
  const victims = fiveVictims(formData);

  const lastActive = React.useMemo(() => {
    let idx = -1;
    victims.forEach((victim, i) => {
      if (isVictimPopulated(victim)) idx = i;
    });
    return idx;
  }, [victims]);

  const [visible, setVisible] = React.useState(() => Math.max(1, lastActive + 1));
  React.useEffect(() => {
    setVisible((v) => Math.max(v, lastActive + 1, 1));
  }, [lastActive]);

  const updateVictim = (index: number, patch: Partial<Navmc10132Victim>) => {
    setFormData((prev) => {
      const next = fiveVictims(prev);
      next[index] = { ...next[index], ...patch };
      return { ...prev, victims: next };
    });
  };

  return (
    <SectionCard icon={<Users className="mr-2 h-5 w-5" />} title="Item 22, Victims">
      {locked && (
        <div className="mb-3 rounded-md border bg-muted p-2">
          <p className="text-[11px] text-muted-foreground">
            <LockedBadge /> The accused signed item 2, and that signature closed all twenty
            victim fields. They are shown as recorded and the export will not write them.
          </p>
        </div>
      )}
      <fieldset disabled={locked} className={locked ? 'opacity-70' : undefined}>
      <p className="text-[11px] text-muted-foreground mb-3">
        Item 22 records victim demographics only. Do not enter victim personally
        identifying information here or in item 21, per the form's own item 21
        instruction. Collection authority for this data is the form's own
        Privacy Act statement.
      </p>
      <p className="text-[11px] text-muted-foreground mb-4">
        Match personnel records for military members, or the victim's own
        self-identification. Enter Unknown if the victim declines to answer.
      </p>

      <div className="space-y-4">
        {ROW_LETTERS.slice(0, visible).map((letter, index) => {
          const victim = victims[index];
          const isRowA = index === 0;
          return (
            <div key={letter} className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium">Victim {letter}</span>
                {!isRowA && (
                  <p className="text-[11px] text-muted-foreground">
                    This row prints in item 21, not on the item 22 grid, because
                    rows B through E on the official form offer a status
                    vocabulary that contradicts the form's own instructions.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={victim.status}
                    onValueChange={(value) => updateVictim(index, { status: value as Navmc10132Victim['status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {NAVMC_10132_VICTIM_STATUS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Sex</Label>
                  <Select
                    value={victim.sex}
                    onValueChange={(value) => updateVictim(index, { sex: value as Navmc10132Victim['sex'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      {NAVMC_10132_VICTIM_SEX.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Race</Label>
                  <Select
                    value={victim.race}
                    onValueChange={(value) => updateVictim(index, { race: value as Navmc10132Victim['race'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select race" />
                    </SelectTrigger>
                    <SelectContent>
                      {NAVMC_10132_VICTIM_RACE.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Ethnicity</Label>
                  <Select
                    value={victim.ethnicity}
                    onValueChange={(value) => updateVictim(index, { ethnicity: value as Navmc10132Victim['ethnicity'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ethnicity" />
                    </SelectTrigger>
                    <SelectContent>
                      {NAVMC_10132_VICTIM_ETHNICITY.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visible < 5 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setVisible((v) => Math.min(5, v + 1))}
        >
          Add another victim
        </Button>
      )}
    </fieldset>
    </SectionCard>
  );
}
