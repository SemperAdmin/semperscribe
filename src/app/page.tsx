'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { ParagraphData, SavedLetter, ValidationState, FormData, AdminSubsections, ReportData } from '@/types';
import { ModernAppShell } from '@/components/layout/ModernAppShell';
import { DocumentLayout } from '@/components/document/DocumentLayout';
import { getLoadedUnits } from '@/lib/reference-data';
import { getTodaysDate } from '@/lib/date-utils';
import { getMCOParagraphs, getMCBulParagraphs, getSecnavInstructionParagraphs, getSecnavNoticeParagraphs, getMOAParagraphs, getStaffingPaperParagraphs, getInformationPaperParagraphs, getExportFilename } from '@/lib/naval-format-utils';
import { validateSSIC, validateSubject, validateFromTo } from '@/lib/validation-utils';
import { loadSavedLetters, saveLetterToStorage, clearSavedLetters } from '@/lib/storage-utils';
import { runLetterValidators } from '@/lib/letter-validators';
import { configureConsole, debugUserAction, debugFormChange } from '@/lib/console-utils';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { AMHSPreview } from '@/components/amhs/AMHSPreview';
import { useToast } from '@/hooks/use-toast';
import { SignatureCeremonyPanel } from '@/components/signature/SignatureCeremonyPanel';
import { useParagraphs } from '@/hooks/useParagraphs';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useImportExport } from '@/hooks/useImportExport';
import { useDocumentImport } from '@/hooks/useDocumentImport';
import { DocumentImportModal } from '@/components/import/DocumentImportModal';
import { ImportPayload } from '@/services/import/extractionTypes';
import { ProofreadModal } from '@/components/ProofreadModal';
import { BatchGenerateModal } from '@/components/BatchGenerateModal';
import { SettingsDialog } from '@/components/SettingsDialog';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useLivePreview } from '@/hooks/useLivePreview';
import { useDocumentExport } from '@/hooks/useDocumentExport';
import { useSignatureWorkflow } from '@/hooks/useSignatureWorkflow';
import { useShareLinkLoader } from '@/hooks/useShareLinkLoader';
import { ITypePreview } from '@/components/itype/ITypePreview';
import { useITypeStore } from '@/store/iTypeStore';

// Inner component that uses useSearchParams (requires Suspense boundary)
function NavalLetterGeneratorInner() {
  // Configure console to suppress browser extension errors
  useEffect(() => {
    configureConsole();
  }, []);

  const { toast } = useToast();
  const { profile, loaded: profileLoaded, updateProfile, clearProfile, getFormDefaults } = useUserProfile();
  const [showSettings, setShowSettings] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    documentType: '',
    endorsementLevel: '',
    basicLetterReference: '',
    basicLetterSsic: '',
    referenceWho: '',
    referenceType: '',
    referenceDate: '',
    startingReferenceLevel: 'a',
    startingEnclosureNumber: '1',
    line1: '', line1b: '', line2: '', line3: '', ssic: '', originatorCode: '', date: '', from: '', to: '', subj: '', sig: '', delegationText: '',
    startingPageNumber: 1,
    previousPackagePageCount: 0,
    headerType: 'USMC',
    bodyFont: 'times',
    directiveTitle: '',
    cancellationDate: '',
    cancellationType: 'fixed',
    distribution: { type: 'none' },
    reports: [],
    adminSubsections: {
      recordsManagement: { show: false, content: '', order: 0 },
      privacyAct: { show: false, content: '', order: 0 },
      reportsRequired: { show: false, content: 'None.', order: 0 }
    },
    actionNo: '',
    orgStation: '',
    name: '',
    edipi: '',
    box11: ''
  });

  const handleDynamicFormSubmit = useCallback((data: any) => {
    setFormData(prev => ({
        ...prev,
        ...data,
    }));
    debugFormChange('Dynamic Form Update', data);
  }, []);

  const [validation, setValidation] = useState<ValidationState>({
    ssic: { isValid: false, message: '' },
    subj: { isValid: false, message: '' },
    from: { isValid: false, message: '' },
    to: { isValid: false, message: '' }
  });

  const [vias, setVias] = useState<string[]>(['']);
  const [references, setReferences] = useState<string[]>(['']);
  const [enclosures, setEnclosures] = useState<string[]>(['']);
  const [copyTos, setCopyTos] = useState<string[]>(['']);
  const [distList, setDistList] = useState<string[]>(['']);

  // Paragraph state and CRUD via hook
  const {
    paragraphs, setParagraphs,
    addParagraph, removeParagraph, updateParagraphContent,
    moveParagraphUp, moveParagraphDown,
    getUiCitation, validateParagraphNumbering,
  } = useParagraphs();

  const [savedLetters, setSavedLetters] = useState<SavedLetter[]>([]);

  // Voice recognition via hook
  const { activeVoiceInput, toggleVoiceInput } = useVoiceInput(paragraphs, updateParagraphContent);

  // I-Type store for real-time preview
  const { setFormData: setITypeFormData } = useITypeStore();

  // Key to force form remount on import
  const [formKey, setFormKey] = useState(0);

  // Proofread modal state
  const [showProofreadModal, setShowProofreadModal] = useState(false);

  // Batch generate modal state
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Unit header state (sourced from user profile)
  const [currentUnitCode, setCurrentUnitCode] = useState<string | undefined>(undefined);
  const [currentUnitName, setCurrentUnitName] = useState<string | undefined>(undefined);

  // Import/Export/Share via hook
  const {
    handleImport, handleLoadDraft, handleLoadTemplateUrl,
    handleExportNldp, handleShareLink,
    handleCopyAMHS, handleExportAMHS,
  } = useImportExport({
    formData, setFormData,
    paragraphs, setParagraphs,
    vias, setVias,
    references, setReferences,
    enclosures, setEnclosures,
    copyTos, setCopyTos,
    distList, setDistList,
    setFormKey, setValidation,
    savedLetters, toast,
  });

  // Document state slices shared by preview, export, and signature
  const documentData = { formData, vias, references, enclosures, copyTos, paragraphs, distList };

  // Live preview (debounced PDF regeneration) via hook
  const { previewUrl, isGeneratingPreview, updatePreview, applySignatureFields } = useLivePreview(documentData);

  // Export orchestration (gate, SECNAV cap, download) via hook
  const { generateDocument } = useDocumentExport({ data: documentData, applySignatureFields });

  // Signature ceremony (placement modal, request links) via hook
  const {
    showSignatureModal, signaturePdfBlob, signaturePdfPageCount,
    handleOpenSignaturePlacement, handleSignatureConfirm,
    handleSignatureConfirmAndCopy, handleSignatureCancel,
    buildSignReadyBlob,
  } = useSignatureWorkflow({ data: documentData, setFormData, applySignatureFields, toast });

  // Load saved letters
  useEffect(() => {
    const letters = loadSavedLetters();
    setSavedLetters(letters);
  }, []);

  // Set today's date
  useEffect(() => {
    setFormData(prev => ({ ...prev, date: getTodaysDate() }));
  }, []);

  // Apply user profile defaults on initial load
  useEffect(() => {
    if (profileLoaded) {
      applyProfileToForm();
    }
  }, [profileLoaded]);

  // Re-apply profile when settings change (e.g. user edits profile mid-session)
  const applyProfileToForm = useCallback(() => {
    const defaults = getFormDefaults();
    setFormData(prev => ({
      ...prev,
      // Identity fields: apply if field is empty
      ...(prev.sig ? {} : { sig: defaults.sig }),
      ...(prev.from ? {} : { from: defaults.from }),
      ...(prev.originatorCode ? {} : { originatorCode: defaults.originatorCode }),
      ...(prev.line1 ? {} : { line1: defaults.line1, line2: defaults.line2, line3: defaults.line3 }),
      // Formatting defaults always track the profile
      headerType: defaults.headerType,
      bodyFont: defaults.bodyFont,
      accentColor: defaults.accentColor,
      amhsClassification: defaults.amhsClassification,
      amhsPrecedence: defaults.amhsPrecedence,
    }));
    // Sync unit code/name for header display
    if (profile.unitRuc) {
      const unit = getLoadedUnits().find(u => u.ruc === profile.unitRuc);
      if (unit) {
        setCurrentUnitCode(unit.ruc);
        setCurrentUnitName(unit.unitName.toUpperCase());
      }
    }
    setFormKey(prev => prev + 1);
  }, [getFormDefaults, profile.unitRuc]);

  // Handle Cancellation Contingency for MCBul
  useEffect(() => {
    if (formData.documentType === 'bulletin') {
      const needsContingencyPara = formData.cancellationType === 'contingent';
      const hasContingencyPara = paragraphs.some(p => p.title === 'Cancellation Contingency');

      if (needsContingencyPara && !hasContingencyPara) {
        const newId = (paragraphs.length > 0 ? Math.max(...paragraphs.map(p => p.id)) : 0) + 1;
        setParagraphs(prev => [...prev, {
          id: newId,
          level: 1,
          content: '',
          isMandatory: true,
          title: 'Cancellation Contingency'
        }]);
      } else if (!needsContingencyPara && hasContingencyPara) {
        setParagraphs(prev => prev.filter(p => p.title !== 'Cancellation Contingency'));
      }
    }
  }, [formData.documentType, formData.cancellationType, paragraphs]);

  // Sync Reports to Admin Subsections
  useEffect(() => {
    if (DOCUMENT_TYPES[formData.documentType]?.features?.showReports) {
      let content = 'None.';
      const validReports = (formData.reports as ReportData[] | undefined)?.filter(r => r.title) || [];

      if (validReports.length > 0) {
        const reportTexts = validReports.map(r => {
          if (r.exempt) {
            return `${r.title} is exempt from reports control.`;
          }
          return `${r.title} (Report Control Symbol ${r.controlSymbol || 'TBD'})`;
        });
        content = reportTexts.join(' ');
      }

      if (formData.adminSubsections?.reportsRequired?.content !== content) {
         setFormData(prev => ({
            ...prev,
            adminSubsections: {
                ...prev.adminSubsections!,
                reportsRequired: {
                    ...prev.adminSubsections!.reportsRequired,
                    content
                }
            }
         }));
      }
    }
  }, [formData.reports, formData.documentType]);

  // Sync I-Type form data to store for real-time preview
  useEffect(() => {
    if (formData.documentType === 'i-type') {
      setITypeFormData(formData);
    }
  }, [formData, setITypeFormData]);

  // Validation Handlers
  const handleValidateSSIC = (value: string) => {
    setValidation(prev => ({ ...prev, ssic: validateSSIC(value) }));
  };

  const handleValidateSubject = (value: string) => {
    setValidation(prev => ({ ...prev, subj: validateSubject(value) }));
  };

  const handleValidateFromTo = (value: string, field: 'from' | 'to') => {
    setValidation(prev => ({ ...prev, [field]: validateFromTo(value) }));
  };

  const handleUpdateAdminSubsection = (key: keyof AdminSubsections, field: 'show' | 'content' | 'order', value: any) => {
    setFormData(prev => {
        const currentSubsections = prev.adminSubsections || {
            recordsManagement: { show: false, content: '', order: 0 },
            privacyAct: { show: false, content: '', order: 0 },
            reportsRequired: { show: false, content: 'None.', order: 0 }
        };

        return {
            ...prev,
            adminSubsections: {
                ...currentSubsections,
                [key]: {
                    ...currentSubsections[key],
                    [field]: value
                }
            }
        };
    });
  };

  const handleDocumentTypeChange = (newType: string) => {
    const newFeatures = DOCUMENT_TYPES[newType]?.features;
    const oldFeatures = DOCUMENT_TYPES[formData.documentType]?.features;

    let newParagraphs: ParagraphData[] = [{ id: 1, level: 1, content: '', acronymError: '' }];
    const template = newFeatures?.paragraphTemplate;
    if (template === 'mco') {
      newParagraphs = getMCOParagraphs();
    } else if (template === 'bulletin') {
      newParagraphs = getMCBulParagraphs();
    } else if (template === 'secnav-instruction') {
      newParagraphs = getSecnavInstructionParagraphs();
    } else if (template === 'secnav-notice') {
      newParagraphs = getSecnavNoticeParagraphs();
    } else if (template === 'moa') {
      newParagraphs = getMOAParagraphs();
    } else if (template === 'staffing-paper') {
      newParagraphs = getStaffingPaperParagraphs();
    } else if (template === 'information-paper') {
      newParagraphs = getInformationPaperParagraphs();
    } else if (oldFeatures?.paragraphTemplate) {
      newParagraphs = [{ id: 1, level: 1, content: '', acronymError: '' }];
    } else {
      newParagraphs = paragraphs;
    }

    setFormData(prev => ({
      ...prev,
      documentType: newType as FormData['documentType'],
      endorsementLevel: newType === 'basic' ? '' : prev.endorsementLevel,
      basicLetterReference: newType === 'basic' ? '' : prev.basicLetterReference,
      referenceWho: newType === 'basic' ? '' : prev.referenceWho,
      referenceType: newType === 'basic' ? '' : prev.referenceType,
      referenceDate: newType === 'basic' ? '' : prev.referenceDate,
      to: newFeatures?.isDirective ? 'Distribution List' : prev.to,
      startingReferenceLevel: 'a',
      startingEnclosureNumber: '1',
      startingPageNumber: 1,
      previousPackagePageCount: 0,
    }));

    setParagraphs(newParagraphs);
  };

  const saveLetter = () => {
    debugUserAction('Save Letter', {
      subject: formData.subj.substring(0, 30) + (formData.subj.length > 30 ? '...' : ''),
      paragraphCount: paragraphs.length
    });

    const now = new Date();
    const newLetter: SavedLetter = {
      ...formData,
      id: now.toISOString(),
      savedAt: now.toLocaleString(),
      vias,
      references,
      enclosures,
      copyTos,
      paragraphs,
    };

    const updatedLetters = saveLetterToStorage(newLetter, savedLetters);
    setSavedLetters(updatedLetters);
  };

  // Resets every piece of document state to a blank form of the given type.
  // Shared by Clear Form and the Word/PDF import's replace-on-confirm.
  const resetDocumentState = (documentType: string) => {
        const currentType = documentType;
        const defaults = getFormDefaults();

        setFormData({
            documentType: currentType,
            endorsementLevel: '',
            basicLetterReference: '',
            referenceWho: '',
            referenceType: '',
            referenceDate: '',
            startingReferenceLevel: 'a',
            startingEnclosureNumber: '1',
            line1: defaults.line1, line1b: '', line2: defaults.line2, line3: defaults.line3,
            ssic: '', originatorCode: defaults.originatorCode, date: getTodaysDate(),
            from: defaults.from, to: '', subj: '', sig: defaults.sig, delegationText: '',
            startingPageNumber: 1,
            previousPackagePageCount: 0,
            headerType: defaults.headerType,
            bodyFont: defaults.bodyFont,
            accentColor: defaults.accentColor,
            directiveTitle: '',
            cancellationDate: '',
            cancellationType: 'fixed',
            distribution: { type: 'none' },
            reports: [],
            actionNo: '',
            orgStation: '',
            name: '',
            edipi: '',
            box11: '',
            amhsMessageType: 'GENADMIN',
            amhsClassification: defaults.amhsClassification,
            amhsPrecedence: defaults.amhsPrecedence,
            amhsDtg: '',
            amhsOfficeCode: '',
            amhsPocs: [],
            amhsReferences: [],
            amhsTextBody: ''
        });
        setParagraphs([{ id: 1, level: 1, content: '', acronymError: '' }]);
        setVias(['']);
        setReferences(['']);
        setEnclosures(['']);
        setCopyTos(['']);
        setValidation({
            ssic: { isValid: false, message: '' },
            subj: { isValid: false, message: '' },
            from: { isValid: false, message: '' },
            to: { isValid: false, message: '' }
        });
        setFormKey(prev => prev + 1);
  };

  const handleClearForm = () => {
      if (window.confirm('Are you sure you want to clear the form? All unsaved progress will be lost.')) {
        resetDocumentState(formData.documentType);
      }
  };

  // Word/PDF import: replace the pending document, then apply the reviewed
  // payload through the normal import path (validation, formKey remount).
  const applyDocumentImport = (payload: ImportPayload) => {
    resetDocumentState(payload.formData.documentType);
    handleImport(payload);
  };

  const documentImport = useDocumentImport({ applyImport: applyDocumentImport, toast });

  const handleClearSavedLetters = () => {
    clearSavedLetters();
    setSavedLetters([]);
  };

  // Share-link intake (?share=) and S2 routing slip via hook
  const { routingRequest, setRoutingRequest } = useShareLinkLoader({ handleImport, toast });

  // Phase 2: inline compliance issues for the live preview banner.
  const validationIssues = useMemo(
    () => runLetterValidators(formData, vias, references, paragraphs),
    [formData, vias, references, paragraphs],
  );

  return (
    <ModernAppShell
      validationIssues={validationIssues}
      documentType={formData.documentType}
      onDocumentTypeChange={handleDocumentTypeChange}
      previewUrl={previewUrl}
      isGeneratingPreview={isGeneratingPreview}
      onExportDocx={() => generateDocument('docx')}
      onGeneratePdf={() => generateDocument('pdf')}
      onSave={saveLetter}
      paragraphs={paragraphs}
      onLoadDraft={handleLoadDraft}
      onImport={handleImport}
      onImportDocument={documentImport.startImport}
      isImportingDocument={documentImport.isProcessing}
      onClearForm={handleClearForm}
      savedLetters={savedLetters}
      onLoadTemplateUrl={handleLoadTemplateUrl}
      currentUnitCode={currentUnitCode}
      currentUnitName={currentUnitName}
      onExportNldp={handleExportNldp}
      onShareLink={handleShareLink}
      onUpdatePreview={updatePreview}
      onCopyAMHS={handleCopyAMHS}
      onExportAMHS={handleExportAMHS}
      onProofread={() => setShowProofreadModal(true)}
      onBatchGenerate={() => setShowBatchModal(true)}
      onSettings={() => setShowSettings(true)}
      customRightPanel={
        formData.documentType === 'i-type' ? (
          <ITypePreview formData={formData} />
        ) : formData.documentType === 'amhs' ? (
          <AMHSPreview
            formData={formData}
            references={formData.amhsReferences || []}
          />
        ) : undefined
      }
      formData={formData}
    >
      {routingRequest && (
        <SignatureCeremonyPanel
          routing={routingRequest}
          fileName={getExportFilename(formData, 'pdf')}
          generateSignReadyPdf={buildSignReadyBlob}
          onDismiss={() => setRoutingRequest(null)}
        />
      )}
      {/* S2e: signing mode — the receiver sees the document and the
          ceremony, not the form metadata. Dismiss opens the editor. */}
      {!routingRequest && <DocumentLayout
        formData={formData}
        setFormData={setFormData}
        formKey={formKey}
        setCurrentUnitCode={setCurrentUnitCode}
        setCurrentUnitName={setCurrentUnitName}
        vias={vias}
        setVias={setVias}
        references={references}
        setReferences={setReferences}
        enclosures={enclosures}
        setEnclosures={setEnclosures}
        copyTos={copyTos}
        setCopyTos={setCopyTos}
        distList={distList}
        setDistList={setDistList}
        paragraphs={paragraphs}
        activeVoiceInput={activeVoiceInput}
        validateParagraphNumbering={validateParagraphNumbering}
        getUiCitation={getUiCitation}
        moveParagraphUp={moveParagraphUp}
        moveParagraphDown={moveParagraphDown}
        updateParagraphContent={updateParagraphContent}
        toggleVoiceInput={toggleVoiceInput}
        addParagraph={addParagraph}
        removeParagraph={removeParagraph}
        handleOpenSignaturePlacement={handleOpenSignaturePlacement}
        handleSignatureConfirmAndCopy={handleSignatureConfirmAndCopy}
        showSignatureModal={showSignatureModal}
        handleSignatureCancel={handleSignatureCancel}
        handleSignatureConfirm={handleSignatureConfirm}
        signaturePdfBlob={signaturePdfBlob}
        signaturePdfPageCount={signaturePdfPageCount}
        handleDynamicFormSubmit={handleDynamicFormSubmit}
      />}
      <DocumentImportModal
        open={documentImport.isOpen}
        fileName={documentImport.fileName}
        result={documentImport.result}
        detection={documentImport.detection}
        onChangeDocumentType={documentImport.changeDocumentType}
        onConfirm={documentImport.confirmImport}
        onCancel={documentImport.cancelImport}
      />
      <ProofreadModal
        open={showProofreadModal}
        onOpenChange={setShowProofreadModal}
        formData={formData}
        paragraphs={paragraphs}
        enclosures={enclosures}
        references={references}
      />
      <BatchGenerateModal
        open={showBatchModal}
        onOpenChange={setShowBatchModal}
        formData={formData}
        paragraphs={paragraphs}
        vias={vias}
        references={references}
        enclosures={enclosures}
        copyTos={copyTos}
        distList={distList}
      />
      <SettingsDialog
        open={showSettings}
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) applyProfileToForm();
        }}
        profile={profile}
        onUpdateProfile={updateProfile}
        onClearProfile={clearProfile}
        savedLetterCount={savedLetters.length}
        onClearSavedLetters={handleClearSavedLetters}
      />
    </ModernAppShell>
  );
}

export default function NavalLetterGenerator() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <NavalLetterGeneratorInner />
    </Suspense>
  );
}
