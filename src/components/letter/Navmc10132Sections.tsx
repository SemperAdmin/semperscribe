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
 * STAGE GATING. `formData.stage` (src/types/navmc.ts, set by the loaded
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
import { Button } from '@/components/ui/button';
import { RotateCcw, Lock, User, Users } from 'lucide-react';
import { FormData } from '@/types';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { DOCUMENT_TYPES, DocumentTypeDefinition } from '@/lib/schemas';
import { OffensesSection } from '@/components/letter/navmc10132/OffensesSection';
import { AccusedElectionSection } from '@/components/letter/navmc10132/AccusedElectionSection';
import { AccusedRankSection } from '@/components/letter/navmc10132/AccusedRankSection';
import { PunishmentSection } from '@/components/letter/navmc10132/PunishmentSection';
import { ProceedingScriptButton } from '@/components/letter/navmc10132/ProceedingScriptButton';
import { SuspensionSection } from '@/components/letter/navmc10132/SuspensionSection';
import { VictimsSection } from '@/components/letter/navmc10132/VictimsSection';
import { NjpAuthoritySection } from '@/components/letter/navmc10132/NjpAuthoritySection';
import { Page11Section } from '@/components/letter/navmc10132/Page11Section';
import { RemarksSection } from '@/components/letter/navmc10132/RemarksSection';
import { UnitDiarySection } from '@/components/letter/navmc10132/UnitDiarySection';
import { VacationSection } from '@/components/letter/navmc10132/VacationSection';
import { LoadReportPanel } from '@/components/letter/navmc10132/LoadReportPanel';
import { LockedBadge } from '@/components/letter/navmc10132/OffensesSection';
import { navmc10132LockedKeys, isNavmc10132SectionLocked } from '@/lib/navmc10132-locks';
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
  /**
   * The app's Clear Form action. OPTIONAL so every existing test harness and
   * any other caller keeps working without it; the button renders only when
   * one is supplied.
   */
  onClearForm?: () => void;
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

/**
 * A section every one of whose fields a signature has closed, shown as a
 * collapsed read-only summary instead of a form.
 *
 * STEPHEN, 2026-08-26: "We can also hide sections that are locked on the
 * form from the UI. Example when item 2 is signed we do not need the Unit
 * and Accused (Items 17-20) or Item 22, Victims sections".
 *
 * COLLAPSED RATHER THAN REMOVED, and the difference is deliberate. What is
 * gone is the editing surface, which is what "we do not need" is about: a
 * row of boxes nobody may type in is noise on every later pass. What stays
 * is the RECORD. The accused's name, unit and EDIPI appear nowhere else in
 * this app, so deleting the card would leave a clerk working a pass-4 form
 * unable to see whose form it is, and this file's own stage-gating rule
 * already says an invisible field on a legal record is found by its absence
 * at an audit years later. One click reopens it, and the values are the
 * signed ones by construction: they are the only ones the export will write.
 */
function SignedSectionSummary({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <SectionCard icon={icon} title={title}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Signed on the loaded form and closed to editing. Click to show what it carries.
          </span>
        </summary>
        <dl className="mt-3 space-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-2 text-sm">
              <dt className="w-56 shrink-0 text-muted-foreground">{label}</dt>
              {/* An EMPTY signed field is shown as empty, never skipped. A row
                  the file left blank is itself a fact about the record. */}
              <dd className="font-medium">{value === '' ? '(blank)' : value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </SectionCard>
  );
}

/**
 * The item 22 summary rows.
 *
 * ROW A ONLY on the grid, plus a COUNT of the rest, because that is what the
 * form itself holds: spec defect 3.1 puts victims B through E into item 21
 * in the instruction's "Additional Victims" format rather than into the item
 * 22 grid. A summary that listed five rows would describe a form that does
 * not exist. The count is there so a collapsed card never hides the fact
 * that more victims were recorded.
 */
function victimSummaryRows(formData: FormData): ReadonlyArray<readonly [string, string]> {
  const value: unknown = formData.victims;
  const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  const first = rows[0] ?? {};
  const str = (key: string): string => {
    const raw = first[key];
    return typeof raw === 'string' ? raw.trim() : '';
  };
  const additional = rows
    .slice(1)
    .filter((row) =>
      ['status', 'sex', 'race', 'ethnicity'].some(
        (key) => typeof row?.[key] === 'string' && (row[key] as string).trim() !== '',
      ),
    ).length;
  return [
    ['Status (item 22A)', str('status')],
    ['Sex (item 22A)', str('sex')],
    ['Race (item 22A)', str('race')],
    ['Ethnicity (item 22A)', str('ethnicity')],
    ['Additional victims, carried in item 21', String(additional)],
  ];
}

/** A FormData value as a trimmed string, whatever the loose bag holds. */
function text(formData: FormData, key: string): string {
  const value: unknown = (formData as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
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
  onClearForm,
}: Navmc10132SectionsProps) {
  const showAbsence = hasAbsenceOffense(formData);
  const stage = navmc10132Stage(formData);
  /**
   * Fields a signature on the loaded file has closed. EMPTY unless a file
   * was loaded, so a fresh document is never locked: locks come from a
   * signed PDF, not from the stage. See navmc10132-locks.ts.
   */
  const lockedKeys = navmc10132LockedKeys(formData);
  /**
   * Sections a signature has closed OUTRIGHT, every field of them, which is
   * a stricter test than any one input being locked. See
   * NAVMC_10132_SECTION_LOCKS: a block with one field still open stays a
   * form, because that open field is work somebody still has to do.
   */
  const accusedClosed = isNavmc10132SectionLocked(formData, 'accused');
  const victimsClosed = isNavmc10132SectionLocked(formData, 'victims');
  return (
    <>
      {onClearForm && <StartNewCaseButton onClearForm={onClearForm} formData={formData} />}
      {/* THE ONLY PLACE THE STAGE IS SHOWN, now that nobody sets it by hand.
          The panel reports the pass the uploaded file put the document at,
          which is also the pass the sections below are gated on. With no
          file loaded it renders nothing and the document sits at pass 1. */}
      <LoadReportPanel formData={formData} setFormData={setFormData} />
      {accusedClosed ? (
        <SignedSectionSummary
          icon={<User className="mr-2 h-5 w-5" />}
          title="Unit and Accused (Items 17-20)"
          rows={[
            ['Unit (item 17)', text(formData, 'unit')],
            ['Name (item 18)', text(formData, 'accusedName')],
            ['Rank and pay grade (item 19)', text(formData, 'accusedRankGrade')],
            ['EDIPI (item 20)', text(formData, 'accusedEdipi')],
          ]}
        />
      ) : (
        <FormBlock>
          <DynamicForm
            key={`navmc10132-${formKey}-accused`}
            lockedFields={lockedKeys}
            lockedBadge={<LockedBadge />}
            documentType={DEF_ACCUSED}
            onSubmit={onDynamicSync}
            defaultValues={formData}
          />
        </FormBlock>
      )}
      {/* NOT PAIRED WITH THE BLOCK ABOVE, and not gated on the accused lock.
          An earlier revision hid this card whenever items 17-20 closed, on the
          reasoning that it is only the item 19 picker. That was wrong and the
          2026-08-25 demo showed the cost: the card ALSO carries years of
          service and sea and hardship duty pay, neither of which is on the
          NAVMC 10132, so no signature closes them, and both feed the
          forfeiture ceiling. Hiding the card on a signed upload left the
          ceiling uncomputable with no way to supply the two numbers. The card
          closes its own item 19 half on `isNavmc10132KeyLocked`, so the
          signed field stays read-only without hiding the open ones. */}
      <AccusedRankSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
        item19ShownByCaller={accusedClosed}
      />
      <OffensesSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
        stage={stage}
      />
      {showAbsence && navmc10132StageAtLeast(stage, 3) && (
        <FormBlock>
          <DynamicForm
            key={`navmc10132-${formKey}-absence`}
            lockedFields={lockedKeys}
            lockedBadge={<LockedBadge />}
            documentType={DEF_ABSENCE}
            onSubmit={onDynamicSync}
            defaultValues={formData}
          />
        </FormBlock>
      )}
      {navmc10132StageAtLeast(stage, 3) && (
        <>
          {/* BEFORE THE PUNISHMENT, because the script is what the hearing is
              conducted FROM and item 6 is what it produces. Same pass-3 gate
              it had inside that card, so nothing about when it appears
              changes; only where. */}
          <ProceedingScriptButton formData={formData} SectionCard={SectionCard} />
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
      <NjpAuthoritySection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
      />
      {/* AFTER THE PROCEEDINGS, BEFORE THE APPEAL. Stephen's placement,
          2026-08-26: "towards the end after the NJP proceedings and before an
          appeal". Both entries are made BECAUSE of the punishment, so neither
          can be written before item 6 is, and the promotion restriction
          states the period a suspension runs, which is item 7. PASS 4, not
          pass 3: pass 3 opens the moment the item 3 election signature closes
          pass 2, which is BEFORE the hearing, so a pass-3 gate showed an
          empty 6105 alongside the punishment builder. SSgt Jara asked about
          exactly that on the 2026-08-25 demo and Stephen ruled it: "that
          first page 11 we saw should not have been seen at all at that time."
          The item 9 NJP authority signature closes pass 3
          (NAVMC_10132_PASS_SIGNATURES), so pass 4 is the first stage at which
          a punishment has actually been imposed and an entry has facts to
          state. */}
      {navmc10132StageAtLeast(stage, 4) && (
        <Page11Section
          formData={formData}
          setFormData={setFormData}
          SectionCard={SectionCard}
        />
      )}
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
            lockedFields={lockedKeys}
            lockedBadge={<LockedBadge />}
            documentType={DEF_APPEAL_BY_STAGE[String(stage)]}
            onSubmit={onDynamicSync}
            defaultValues={formData}
          />
        </FormBlock>
      )}
      {victimsClosed ? (
        <SignedSectionSummary
          icon={<Users className="mr-2 h-5 w-5" />}
          title="Item 22, Victims"
          rows={victimSummaryRows(formData)}
        />
      ) : (
        <VictimsSection
          formData={formData}
          setFormData={setFormData}
          SectionCard={SectionCard}
        />
      )}
      {/* ITEM 2 SITS AFTER ITEM 22, NOT IN FORM ORDER. Stephen's placement,
          2026-08-26. On paper item 2 is near the top of page 1 and item 22 is
          on page 2, so this deliberately breaks form order, and the reason is
          the WORK order rather than the print order: the election is what the
          accused SIGNS, and the JAGMAN A-1-c/A-1-d advisement generated from
          this card needs the offenses, the rank and the unit already entered.
          Reaching it last means every input it depends on is behind the
          clerk rather than ahead. Nothing about the exported PDF changes:
          navmc10132-acroform.ts writes by field name, never by section
          order. */}
      <AccusedElectionSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
        stage={stage}
      />
      <RemarksSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={SectionCard}
        stage={stage}
      />
      {/* ITEM 12, NOT ITEM 16. Stephen, 2026-08-26: "Once item 12 is signed we
          need to have the ability to see the Unit Diary action section". The
          item 12 signature closes pass 5, so the document is at pass 6 the
          moment it is applied, and 'complete' still sorts after every pass,
          so a closed-out case keeps the section it had before.

          WHAT THIS TRADES. Waiting for item 16 meant the figures could not
          move any more. At item 12 they still can: an accused who states an
          intent to appeal may have the punishment reduced or set aside at
          item 14, and a diary entry posted from the pre-appeal figures would
          then be wrong. The section says so itself rather than the app
          holding the whole panel back for a case that may never appeal. */}
      {navmc10132StageAtLeast(stage, 6) && (
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

/**
 * Start a new case, at the top of the form.
 *
 * STEPHEN, 2026-08-26, answering where the uploaded base file goes away:
 * "Clear Form deletes it add a button for this at the top".
 *
 * IT IS THE SAME CLEAR FORM ACTION, deliberately, not a second reset path.
 * `resetDocumentState` already drops the working copy's stored files through
 * `fileDeleteForDoc`, and the uploaded NAVMC 10132 base is one of them. A
 * second implementation would be one more place for those two to drift.
 *
 * WHY IT NEEDED SURFACING AT ALL. On every other document type Clear Form
 * discards typing. On this one it also discards the SIGNED PDF the app is
 * writing into, and until now the only ways to reach it were a header
 * dropdown and the command palette. Starting a second case by any other
 * route leaves the app exporting into the previous Marine's signed file,
 * because switching document type away and back merges rather than resets.
 * A data-integrity action was harder to find than a formatting one.
 *
 * THE COPY CHANGES WITH THE STATE, because the consequence does. With a file
 * loaded the button says the file is what goes away, and names it.
 */
function StartNewCaseButton({
  onClearForm,
  formData,
}: {
  onClearForm: () => void;
  formData: FormData;
}) {
  const report: unknown = formData.navmc10132LoadReport;
  const fileName =
    report && typeof report === 'object' && typeof (report as { fileName?: unknown }).fileName === 'string'
      ? (report as { fileName: string }).fileName
      : '';

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
      <div>
        <p className="text-sm font-medium">
          {fileName === '' ? 'Start a new case' : 'Start a new case, and drop the uploaded file'}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {fileName === ''
            ? 'Clears every field on this Unit Punishment Book and starts a blank one.'
            : `Clears every field and discards ${fileName}, which the app is currently writing ` +
              'into. Do this before beginning a different Marine, or the next export goes into ' +
              'that file.'}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onClearForm}>
        <RotateCcw className="mr-1 h-4 w-4" />
        Start a new case
      </Button>
    </div>
  );
}
