'use client';

/**
 * NAVMC 10132 form sections - Phase 3 of docs/NAVMC_10132_BUILD_PLAN.md.
 *
 * Why this exists instead of one DynamicForm: the paper form's order interleaves
 * scalar blocks with grids and derived text. A single DynamicForm renders every
 * scalar section in one run, which would push the offense grid, the Booker
 * preview, the punishment builder, the victim grid, and the remark composer all
 * below the appeal block. This component interleaves narrow DynamicForm
 * instances with the five custom sections so the screen follows the paper.
 *
 * THE CLOBBER RULE. Each DynamicForm instance sanitises to its own section keys
 * and the parent merge is a shallow spread, so instances and custom sections
 * never overwrite each other. Every field a custom section owns was left OUT of
 * Navmc10132Definition.sections in Phase 1 for this reason. React Hook Form
 * seeds its defaults once at mount and clobbers external writes on its next
 * debounced sync, which bit the NAVMC 10922 build twice.
 *
 * Screen order, matching the form's own ELECTRONIC SIGNING AND LOCKING note
 * (prepare 1, 17-20, 22 first, then 2, then 3, then 4-11, then 12, then 13-16):
 *
 *   Accused and unit          items 17-20      DynamicForm
 *   Rank and pay grade        item 19          custom picker, closed list
 *   Offenses and findings     items 1 and 5    custom grid
 *   Accused election          item 2 and 3     custom, Booker preview
 *   Unauthorised absence      item 4           DynamicForm, Art 85 or 86 only
 *   Punishment                items 6 and 10   custom builder
 *   Suspension                item 7           custom picker over item 6
 *   Authority                 item 8           DynamicForm
 *   Appeal                    items 11-15      DynamicForm
 *   Victims                   item 22          custom grid
 *   Remarks and final action  items 21 and 16  custom composer
 *
 * STAGE GATING. `formData.stage` (src/types/navmc.ts, set by StageSelector
 * above) additionally hides sections that belong to a pass later than the
 * one the document is currently at, per docs/NAVMC_10132_SPEC.md section 13
 * and decision rows D-43/D-46/D-47. Sections are ADDITIVE, never exclusive:
 * once a pass's fields open they stay visible at every later stage, because
 * a later pass can still need to read what an earlier one recorded. FOUR
 * sections filter their OWN controls rather than being hidden outright,
 * because each carries fields from more than one pass: OffensesSection
 * (item 1 at pass 1, item 5 at pass 3), AccusedElectionSection (the vessel
 * flag at pass 1, item 2 at pass 2), RemarksSection (item 21 throughout,
 * item 16 at pass 7), and the appeal block (items 11 through 15, across
 * passes 4, 5, 6 and 7). The first three are hand-written JSX and take a
 * `stage` prop. The appeal block is schema-driven, so it filters its
 * DEFINITION instead, see `APPEAL_FIELD_PASS` below.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormData } from '@/types';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { DOCUMENT_TYPES, DocumentTypeDefinition } from '@/lib/schemas';
import { OffensesSection } from '@/components/letter/navmc10132/OffensesSection';
import { AccusedElectionSection } from '@/components/letter/navmc10132/AccusedElectionSection';
import { AccusedRankSection } from '@/components/letter/navmc10132/AccusedRankSection';
import { PunishmentSection } from '@/components/letter/navmc10132/PunishmentSection';
import { SuspensionSection } from '@/components/letter/navmc10132/SuspensionSection';
import { VictimsSection } from '@/components/letter/navmc10132/VictimsSection';
import { RemarksSection } from '@/components/letter/navmc10132/RemarksSection';
import { UnitDiarySection } from '@/components/letter/navmc10132/UnitDiarySection';
import { VacationSection } from '@/components/letter/navmc10132/VacationSection';
import { StageSelector } from '@/components/letter/navmc10132/StageSelector';
import { LoadReportPanel } from '@/components/letter/navmc10132/LoadReportPanel';
import {
  navmc10132Stage,
  navmc10132StageAtLeast,
  NAVMC_10132_STAGE_VALUES,
  type Navmc10132Stage,
} from '@/types/navmc';

interface Navmc10132SectionsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  /** The page-level dynamic form merge handler. */
  onDynamicSync: (data: any) => void;
  formKey: number | string;
}

// Narrow sub-definitions sharing the registered schema. Module scope keeps them
// referentially stable, which DynamicForm's memos expect.
function subDefinition(ids: string[]): DocumentTypeDefinition {
  const def = DOCUMENT_TYPES['navmc10132'];
  return { ...def, sections: def.sections.filter((s) => ids.includes(s.id)) };
}
const DEF_ACCUSED = subDefinition(['accused']);
const DEF_ABSENCE = subDefinition(['absence']);
// Item 7 left this sub-definition when it became a custom section. Item 8
// remains a plain scalar block.
const DEF_PUNISHMENT_TAIL = subDefinition(['authority']);
/**
 * Which pass each appeal field belongs to, from the section 13.1 lock table
 * in docs/NAVMC_10132_SPEC.md. Decision row D-61.
 *
 * THE APPEAL BLOCK SPANS FOUR PASSES, and it used to open all eight fields
 * at pass 4 because it is gated as a section like every other DynamicForm.
 * That offered a clerk a decision on an appeal that had not been taken yet.
 * The other three spanning sections filter their own controls in hand-
 * written JSX; this one is schema-driven, so it filters the DEFINITION
 * instead and gets the same result.
 *
 * SAFE ONLY BECAUSE OF A MEASURED PROPERTY, and the measurement is a test
 * rather than a comment: `tests/components/navmc10132-dynamicform-clobber.test.tsx`.
 * DynamicForm's watch subscription OMITS keys its definition does not name,
 * rather than emitting them empty, and `handleDynamicFormSubmit` in
 * page.tsx merges with a spread. Together those mean a field dropped from
 * this map's reach keeps its value in `formData`. If either half ever
 * changes, dropping a field here becomes silent data loss on a legal
 * record, and that test goes red before this does.
 */
export const APPEAL_FIELD_PASS: Record<string, 4 | 5 | 6 | 7> = {
  appealAdvisementDate: 4, // item 11, closes at 11 APPEAL ADVISEMENT SIGNATURE
  intendAppeal: 5, // item 12, closes at 12 APPEAL INTENT SIGNATURE
  appealIntentDate: 5, // item 12
  notAppealed: 6, // item 13, closes at 14 APPEAL DECISION SIGNATURE
  appealDate: 6, // item 13
  appealDecision: 6, // item 14
  appealDecisionDate: 6, // item 14
  appealDecisionNoticeDate: 7, // item 15, closes at 16 FINAL ADMIN INIT
};

/**
 * What the appeal card is called at a given stage, so a clerk shown one
 * field is not also told the card holds items 11 through 15.
 */
function appealTitleForStage(stage: Navmc10132Stage): string {
  if (navmc10132StageAtLeast(stage, 7)) return 'Appeal (Items 11-15)';
  if (navmc10132StageAtLeast(stage, 6)) return 'Appeal (Items 11-14)';
  if (navmc10132StageAtLeast(stage, 5)) return 'Appeal (Items 11-12)';
  return 'Appeal (Item 11)';
}

/**
 * The appeal sub-definition holding only the fields open at `stage`.
 *
 * A FIELD THIS MAP DOES NOT KNOW IS SHOWN, NOT HIDDEN, and that direction is
 * chosen rather than defaulted. A new appeal field added to
 * `Navmc10132Definition` without a decision here appears too early, which a
 * clerk can see and report. Hiding it instead would make it invisible at
 * every stage, and an invisible field on a legal record is found by its
 * absence at an audit years later. `navmc10132-stage-visibility.test.tsx`
 * carries a guard that fails the moment such a field exists, so the fail-open
 * behaviour is a safety net rather than the plan.
 */
function appealDefinitionForStage(stage: Navmc10132Stage): DocumentTypeDefinition {
  const def = subDefinition(['appeal']);
  return {
    ...def,
    sections: def.sections.map((section) => ({
      ...section,
      title: appealTitleForStage(stage),
      fields: section.fields.filter((field) => {
        const pass = APPEAL_FIELD_PASS[field.name];
        return pass === undefined || navmc10132StageAtLeast(stage, pass);
      }),
    })),
  };
}

/**
 * One definition per stage, built once at module scope. DynamicForm memoizes
 * `allowedTopLevelKeys` and `sanitizedDefaultValues` on the definition's
 * IDENTITY, so building a fresh object each render would recompute both on
 * every keystroke of every other section.
 */
const DEF_APPEAL_BY_STAGE: Record<string, DocumentTypeDefinition> = Object.fromEntries(
  NAVMC_10132_STAGE_VALUES.map((stage) => [String(stage), appealDefinitionForStage(stage)]),
);

/** Shared card chrome so every section reads the same. */
export function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm border-border mb-6">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

function FormBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
      {children}
    </div>
  );
}

/** True when item 7 carries at least one suspension, which is the thing a
 *  vacation targets. Reads through unknown rather than casting off the `any`
 *  index signature, matching every other reader of this array. */
function hasSuspension(formData: FormData): boolean {
  const value: unknown = formData.suspensions;
  return Array.isArray(value) && value.length > 0;
}

/**
 * Item 4 is completed only when the accused is receiving punishment for an
 * Article 85 or Article 86 offense, per the form's item 4 instruction. Hiding it
 * otherwise keeps a clerk from filling a block the instruction says to leave
 * blank, and the Phase 4 validators still warn if the data disagrees.
 */
function hasAbsenceOffense(formData: FormData): boolean {
  const rows = Array.isArray(formData.offenses) ? formData.offenses : [];
  return rows.some((row: any) => /^Art\.\s+8[56]\b/.test(String(row?.articleLabel ?? '')));
}

export function Navmc10132FormSections({
  formData,
  setFormData,
  onDynamicSync,
  formKey,
}: Navmc10132SectionsProps) {
  const showAbsence = hasAbsenceOffense(formData);
  const stage = navmc10132Stage(formData);
  return (
    <>
      {/* ABOVE THE STAGE SELECTOR, because when a file has been loaded the
          stage came FROM the file and the panel is what says so. Reading
          them the other way round makes the selector look hand-set. */}
      <LoadReportPanel formData={formData} setFormData={setFormData} />
      <StageSelector formData={formData} setFormData={setFormData} />
      <FormBlock>
        <DynamicForm
          key={`navmc10132-${formKey}-accused`}
          documentType={DEF_ACCUSED}
          onSubmit={onDynamicSync}
          defaultValues={formData}
        />
      </FormBlock>
      <AccusedRankSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
      />
      <OffensesSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
        stage={stage}
      />
      <AccusedElectionSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
        stage={stage}
      />
      {showAbsence && navmc10132StageAtLeast(stage, 3) && (
        <FormBlock>
          <DynamicForm
            key={`navmc10132-${formKey}-absence`}
            documentType={DEF_ABSENCE}
            onSubmit={onDynamicSync}
            defaultValues={formData}
          />
        </FormBlock>
      )}
      {navmc10132StageAtLeast(stage, 3) && (
        <>
          <PunishmentSection
            formData={formData}
            setFormData={setFormData}
            SectionCard={SectionCard}
          />
          <SuspensionSection
            formData={formData}
            setFormData={setFormData}
            SectionCard={SectionCard}
          />
        </>
      )}
      <FormBlock>
        <DynamicForm
          key={`navmc10132-${formKey}-punishment-tail`}
          documentType={DEF_PUNISHMENT_TAIL}
          onSubmit={onDynamicSync}
          defaultValues={formData}
        />
      </FormBlock>
      {navmc10132StageAtLeast(stage, 4) && (
        <FormBlock>
          <DynamicForm
            // THE STAGE IS PART OF THE KEY ON PURPOSE. DynamicForm calls
            // useForm once per mount and never resets, so a definition that
            // gains fields on a stage change would render those fields
            // against a form whose defaults predate them: they would show
            // empty even where formData holds a value. Remounting reseeds
            // them. Safe to remount because the values live in formData,
            // not in the form instance.
            key={`navmc10132-${formKey}-appeal-${stage}`}
            documentType={DEF_APPEAL_BY_STAGE[String(stage)]}
            onSubmit={onDynamicSync}
            defaultValues={formData}
          />
        </FormBlock>
      )}
      <VictimsSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
      />
      <RemarksSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
        stage={stage}
      />
      {stage === 'complete' && (
        <UnitDiarySection
          formData={formData}
          setFormData={setFormData}
          SectionCard={SectionCard}
        />
      )}
      {/* CLOSED OUT, AND ONLY WITH A SUSPENSION TO VACATE. MCO 5800.16 Vol 14
          para 011202 has the unit administrators update block 16 on the
          ORIGINAL UPB after a vacation, and block 16 is pass 7, so a vacation
          is by construction something that happens to a UPB already closed
          out. Nothing can be vacated before item 7 carries a suspension
          either. Both conditions are this one expression, easy to relax if a
          unit turns out to vacate before final action. */}
      {stage === 'complete' && hasSuspension(formData) && (
        <VacationSection
          formData={formData}
          setFormData={setFormData}
          SectionCard={SectionCard}
        />
      )}
    </>
  );
}
