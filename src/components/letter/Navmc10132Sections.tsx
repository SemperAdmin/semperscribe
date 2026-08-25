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
const DEF_APPEAL = subDefinition(['appeal']);

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
  return (
    <>
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
      />
      <AccusedElectionSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
      />
      {showAbsence && (
        <FormBlock>
          <DynamicForm
            key={`navmc10132-${formKey}-absence`}
            documentType={DEF_ABSENCE}
            onSubmit={onDynamicSync}
            defaultValues={formData}
          />
        </FormBlock>
      )}
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
      <FormBlock>
        <DynamicForm
          key={`navmc10132-${formKey}-punishment-tail`}
          documentType={DEF_PUNISHMENT_TAIL}
          onSubmit={onDynamicSync}
          defaultValues={formData}
        />
      </FormBlock>
      <FormBlock>
        <DynamicForm
          key={`navmc10132-${formKey}-appeal`}
          documentType={DEF_APPEAL}
          onSubmit={onDynamicSync}
          defaultValues={formData}
        />
      </FormBlock>
      <VictimsSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
      />
      <RemarksSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
      />
      <UnitDiarySection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
      />
    </>
  );
}
