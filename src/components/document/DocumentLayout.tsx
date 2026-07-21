'use client';

import { ParagraphData, FormData } from '@/types';
import { DocumentFeatures, DOCUMENT_TYPES } from '@/lib/schemas';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { AMHSEditor } from '@/components/amhs/AMHSEditor';
import { LandingPage } from '@/components/layout/LandingPage';
import { UnitInfoSection } from '@/components/letter/UnitInfoSection';
import { ParagraphSection } from '@/components/letter/ParagraphSection';
import { ClassificationSection } from '@/components/letter/ClassificationSection';
import { Page11RemarksSection } from '@/components/letter/Page11RemarksSection';
import { Navmc10922FormSections } from '@/components/letter/Navmc10922Sections';
import { getClassification } from '@/lib/classification';
import { ClosingBlockSection } from '@/components/letter/ClosingBlockSection';
import { MultipleToSection } from '@/components/letter/MultipleToSection';
import { ViaSection } from '@/components/letter/ViaSection';
import { ReferencesSection } from '@/components/letter/ReferencesSection';
import { EnclosuresSection } from '@/components/letter/EnclosuresSection';
import { MOAFormSection } from '@/components/letter/MOAFormSection';
import { ReportsSection } from '@/components/letter/ReportsSection';
import { DistributionSection } from '@/components/letter/DistributionSection';
import { SignaturePlacementModal } from '@/components/SignaturePlacementModal';
import { HeaderSettingsSection } from './HeaderSettingsSection';
import { FontSelectorSection } from './FontSelectorSection';
import { EndorsementDetailsSection } from './EndorsementDetailsSection';
import { SignatureFieldSection } from './SignatureFieldSection';
import { DecisionGridSection } from '@/components/letter/DecisionGridSection';
import { CoordinationPageForm } from '@/components/letter/CoordinationPageForm';
import { ITypeFormSections } from '@/components/itype/ITypeFormSections';

interface DocumentLayoutProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  formKey: number;
  // Unit info
  setCurrentUnitCode: (code: string | undefined) => void;
  setCurrentUnitName: (name: string | undefined) => void;
  // Lists
  vias: string[];
  setVias: React.Dispatch<React.SetStateAction<string[]>>;
  references: string[];
  setReferences: React.Dispatch<React.SetStateAction<string[]>>;
  copyTos: string[];
  setCopyTos: React.Dispatch<React.SetStateAction<string[]>>;
  distList: string[];
  setDistList: React.Dispatch<React.SetStateAction<string[]>>;
  // Paragraphs
  paragraphs: ParagraphData[];
  activeVoiceInput: number | null;
  validateParagraphNumbering: (paragraphs: ParagraphData[]) => string[];
  getUiCitation: (paragraph: ParagraphData, index: number, allParagraphs: ParagraphData[]) => string;
  moveParagraphUp: (id: number) => void;
  moveParagraphDown: (id: number) => void;
  updateParagraphContent: (id: number, content: string) => void;
  updateParagraphMarking: (id: number, marking: string) => void;
  toggleVoiceInput: (id: number) => void;
  addParagraph: (type: 'main' | 'sub' | 'same' | 'up', afterId: number) => void;
  removeParagraph: (id: number) => void;
  // Signature
  handleOpenSignaturePlacement: () => void;
  handleSignatureConfirmAndCopy: (positions: import('@/types').SignaturePosition[]) => void;
  showSignatureModal: boolean;
  handleSignatureCancel: () => void;
  handleSignatureConfirm: (positions: any) => void;
  signaturePdfBlob: Blob | null;
  signaturePdfPageCount: number;
  /** ENC: letter-page boundary - pages beyond are view-only enclosures. */
  signatureLetterPageCount?: number;
  // Dynamic form
  handleDynamicFormSubmit: (data: any) => void;
  /** ENC: enclosure rows (title + optional bound file) and file map */
  enclosureRows: import('@/lib/enclosure-attachments').EnclosureRow[];
  enclosureFiles: ReadonlyMap<string, import('@/lib/enclosure-attachments').EnclosureAttachment>;
  onAddEnclosureRow: () => void;
  onRemoveEnclosureRow: (key: string) => void;
  onUpdateEnclosureTitle: (key: string, title: string) => void;
  onMoveEnclosureRow: (key: string, direction: -1 | 1) => void;
  onClearEnclosureRows: () => void;
  onBindEnclosureFile: (rowKey: string, attachment: import('@/lib/enclosure-attachments').EnclosureAttachment) => void;
  onUnbindEnclosureFile: (rowKey: string) => void;
  attachmentCoverPages?: boolean;
  onAttachmentCoverPagesChange?: (value: boolean) => void;
  /** Landing quick starts route through the same handler as the sidebar. */
  onDocumentTypeChange?: (type: string) => void;
  /** R1: review comments threaded to the paragraph pins. */
  comments?: import('@/lib/review-comments').ReviewComment[];
  reviewMode?: boolean;
  onAddComment?: (comment: import('@/lib/review-comments').ReviewComment) => void;
  onToggleComment?: (id: string) => void;
  onRemoveComment?: (id: string) => void;
  commentAuthor?: string;
}

export function DocumentLayout({
  formData,
  setFormData,
  formKey,
  setCurrentUnitCode,
  setCurrentUnitName,
  vias,
  setVias,
  references,
  setReferences,
  copyTos,
  setCopyTos,
  distList,
  setDistList,
  paragraphs,
  activeVoiceInput,
  validateParagraphNumbering,
  getUiCitation,
  moveParagraphUp,
  moveParagraphDown,
  updateParagraphContent,
  updateParagraphMarking,
  toggleVoiceInput,
  addParagraph,
  removeParagraph,
  handleOpenSignaturePlacement,
  handleSignatureConfirmAndCopy,
  showSignatureModal,
  handleSignatureCancel,
  handleSignatureConfirm,
  signaturePdfBlob,
  signaturePdfPageCount,
  signatureLetterPageCount,
  enclosureRows,
  enclosureFiles,
  onAddEnclosureRow,
  onRemoveEnclosureRow,
  onUpdateEnclosureTitle,
  onMoveEnclosureRow,
  onClearEnclosureRows,
  onBindEnclosureFile,
  onUnbindEnclosureFile,
  attachmentCoverPages,
  onAttachmentCoverPagesChange,
  onDocumentTypeChange,
  comments,
  reviewMode,
  onAddComment,
  onToggleComment,
  onRemoveComment,
  commentAuthor,
  handleDynamicFormSubmit,
}: DocumentLayoutProps) {
  // Show landing page when no document type is selected
  if (!formData.documentType) {
    return <LandingPage onSelectType={onDocumentTypeChange} />;
  }

  const docTypeDef = DOCUMENT_TYPES[formData.documentType] || DOCUMENT_TYPES['basic'];
  const features: DocumentFeatures = docTypeDef.features;

  return (
    <>
      {/* Document Type Header */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6 flex items-center gap-4">
        <div className="text-4xl text-primary">
          {docTypeDef.icon || DOCUMENT_TYPES['basic'].icon}
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {docTypeDef.name || DOCUMENT_TYPES['basic'].name}
          </h2>
          <p className="text-muted-foreground">
            {docTypeDef.description || DOCUMENT_TYPES['basic'].description}
          </p>
        </div>
      </div>

      {/* I-Type Form - Exclusive View */}
      {formData.documentType === 'i-type' ? (
        <ITypeFormSections
          formData={formData}
          setFormData={setFormData}
        />
      ) : features.isAMHS ? (
        <AMHSEditor
          formData={formData}
          onUpdate={(data) => setFormData(prev => ({ ...prev, ...data }))}
        />
      ) : (
        <>
          {features.showHeaderSettings && (
            <HeaderSettingsSection formData={formData} setFormData={setFormData} />
          )}

          {!features.showHeaderSettings && features.showFontSelector && (
            <FontSelectorSection formData={formData} setFormData={setFormData} />
          )}

          {features.showUnitInfo && (
            <UnitInfoSection
              formData={formData}
              setFormData={setFormData}
              setCurrentUnitCode={setCurrentUnitCode}
              setCurrentUnitName={setCurrentUnitName}
            />
          )}

          {features.showMOAForm && (
            <MOAFormSection formData={formData} setFormData={setFormData} />
          )}

          {features.showEndorsementDetails && (
            <EndorsementDetailsSection formData={formData} setFormData={setFormData} />
          )}

          {/* NAVMC 10922: four narrow DynamicForm instances interleaved
              with the dependents/custodian/dissolution grids so the
              screen follows the paper's section order. Everything else
              keeps the single schema-driven form. */}
          {formData.documentType === 'navmc10922' ? (
            <Navmc10922FormSections
              formData={formData}
              setFormData={setFormData}
              onDynamicSync={handleDynamicFormSubmit}
              formKey={formKey}
            />
          ) : (
            /* Dynamic Header Form based on Document Type */
            <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
              <DynamicForm
                key={`${formData.documentType}-${formKey}`}
                documentType={docTypeDef}
                onSubmit={handleDynamicFormSubmit}
                defaultValues={formData}
              />
            </div>
          )}

          {/* PG11-1: remarks columns with the right-column template
              insert. Custom because the dynamic form cannot host the
              button; the schema still owns validation. */}
          {formData.documentType === 'page11' && (
            <Page11RemarksSection formData={formData} setFormData={setFormData} />
          )}

          {/* P2 (DONDOCS_PARITY_PLAN): classification markings. Hidden
              for the NAVMC forms - the official form has no banner
              block, so the engine would have nowhere to render. */}
          {features.showClassification && (
            <ClassificationSection formData={formData} setFormData={setFormData} />
          )}

          {features.showCoordinationTable && (
            <CoordinationPageForm formData={formData} setFormData={setFormData} />
          )}

          {features.showMultipleTo && (
            <MultipleToSection
              recipients={formData.distribution?.recipients || ['']}
              setRecipients={(recipients) => setFormData(prev => ({
                ...prev,
                distribution: { ...prev.distribution, recipients }
              }))}
              toDistribution={!!formData.distribution?.toDistribution}
              {...(features.showToDistribution ? {
                setToDistribution: (value: boolean) => setFormData(prev => ({
                  ...prev,
                  distribution: { ...prev.distribution, toDistribution: value }
                }))
              } : {})}
            />
          )}

          {features.showVia && (
            <ViaSection vias={vias} setVias={setVias} />
          )}

          {features.showReferences && (
            <ReferencesSection
              references={references}
              setReferences={setReferences}
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {features.showEnclosures && (
            <EnclosuresSection
              rows={enclosureRows}
              onAddRow={onAddEnclosureRow}
              onRemoveRow={onRemoveEnclosureRow}
              onUpdateTitle={onUpdateEnclosureTitle}
              onMoveRow={onMoveEnclosureRow}
              onClearRows={onClearEnclosureRows}
              files={enclosureFiles}
              onBindFile={onBindEnclosureFile}
              onUnbindFile={onUnbindEnclosureFile}
              coverPages={attachmentCoverPages ?? false}
              onCoverPagesChange={onAttachmentCoverPagesChange ?? (() => {})}
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {features.showDistribution && (
              <ReportsSection
                reports={formData.reports || []}
                onUpdateReports={(reports) => setFormData(prev => ({ ...prev, reports }))}
              />
          )}

          {features.showParagraphs && (
            <ParagraphSection
              paragraphs={paragraphs}
              documentType={formData.documentType}
              activeVoiceInput={activeVoiceInput}
              validateParagraphNumbering={validateParagraphNumbering}
              getUiCitation={getUiCitation}
              moveParagraphUp={moveParagraphUp}
              moveParagraphDown={moveParagraphDown}
              updateParagraphContent={updateParagraphContent}
              toggleVoiceInput={toggleVoiceInput}
              addParagraph={addParagraph}
              removeParagraph={removeParagraph}
              classification={getClassification(formData)}
              onUpdateMarking={updateParagraphMarking}
              comments={comments}
              reviewMode={reviewMode}
              onAddComment={onAddComment}
              onToggleComment={onToggleComment}
              onRemoveComment={onRemoveComment}
              commentAuthor={commentAuthor}
            />
          )}

          {features.showDecisionGrid && (
            <DecisionGridSection
              data={formData.decisionGrid || {
                recommenders: [],
                finalDecision: { role: '', options: ['Approved', 'Disapproved'] },
                coas: [],
                recommendationItems: []
              }}
              mode={formData.decisionMode || 'SINGLE'}
              onDataChange={(data) => setFormData(prev => ({ ...prev, decisionGrid: data }))}
              onModeChange={(mode) => setFormData(prev => ({ ...prev, decisionMode: mode }))}
            />
          )}

          {features.showClosingBlock && (
            <ClosingBlockSection
              formData={formData}
              setFormData={setFormData}
              copyTos={copyTos}
              setCopyTos={setCopyTos}
              distList={distList}
              setDistList={setDistList}
            />
          )}

          {features.showDistribution && (
              <DistributionSection
                distribution={formData.distribution || { type: 'none' }}
                onUpdateDistribution={(dist) => setFormData(prev => ({ ...prev, distribution: dist }))}
              />
          )}

          {features.showSignature && (
            <>
              <SignatureFieldSection
                onOpenSignaturePlacement={handleOpenSignaturePlacement}
                signatureFields={(formData.signatureFields as { signerName?: string }[] | undefined) ?? []}
              />
              <SignaturePlacementModal
                open={showSignatureModal}
                onClose={handleSignatureCancel}
                onConfirm={handleSignatureConfirm}
                onConfirmAndCopyLink={handleSignatureConfirmAndCopy}
                pdfBlob={signaturePdfBlob}
                totalPages={signaturePdfPageCount}
                placeablePages={signatureLetterPageCount}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
