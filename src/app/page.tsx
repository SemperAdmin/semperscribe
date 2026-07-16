'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { ParagraphData, SavedLetter, ValidationState, FormData, AdminSubsections, ReportData } from '@/types';
import { ModernAppShell } from '@/components/layout/ModernAppShell';
import { DocumentLayout } from '@/components/document/DocumentLayout';
import { getLoadedUnits } from '@/lib/reference-data';
import { getTodaysDate } from '@/lib/date-utils';
import { getMCOParagraphs, getMCBulParagraphs, getSecnavInstructionParagraphs, getSecnavNoticeParagraphs, getMOAParagraphs, getStaffingPaperParagraphs, getInformationPaperParagraphs, getExportFilename } from '@/lib/naval-format-utils';
import { validateSSIC, validateSubject, validateFromTo } from '@/lib/validation-utils';
import { loadSavedLetters, clearSavedLetters } from '@/lib/storage-utils';
import { libLoadAll, libPut, libDelete, libClear, migrateLegacyDrafts } from '@/lib/document-library';
import { backupDocument } from '@/lib/auto-backup';
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
import { ShareLinkDialog, UnlockShareDialog } from '@/components/ShareLinkDialog';
import { FindReplaceDialog } from '@/components/FindReplaceDialog';
import { GuidanceDialog } from '@/components/GuidanceDialog';
import { FindReplaceResult } from '@/lib/find-replace';
import { useUndoHistory } from '@/hooks/useUndoHistory';
import { EnclosureAttachment, moveAttachment } from '@/lib/enclosure-attachments';
import { DocumentLibraryDialog } from '@/components/DocumentLibraryDialog';
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
    addParagraph, removeParagraph, updateParagraphContent, updateParagraphMarking,
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

  // P1.1: share-link creation dialog state
  const [showShareDialog, setShowShareDialog] = useState(false);

  // P1.2: document library dialog state
  const [showLibrary, setShowLibrary] = useState(false);

  // P3.1 / P3.3: find-replace and guidance dialogs
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);

  // P3.6: attached PDF enclosures (session-scoped)
  const [attachments, setAttachments] = useState<EnclosureAttachment[]>([]);
  const [attachmentCoverPages, setAttachmentCoverPages] = useState(true);

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
  const { generateDocument } = useDocumentExport({ data: documentData, applySignatureFields, attachments, attachmentCoverPages });

  // Signature ceremony (placement modal, request links) via hook
  const {
    showSignatureModal, signaturePdfBlob, signaturePdfPageCount,
    handleOpenSignaturePlacement, handleSignatureConfirm,
    handleSignatureConfirmAndCopy, handleSignatureCancel,
    buildSignReadyBlob,
  } = useSignatureWorkflow({ data: documentData, setFormData, applySignatureFields, toast });

  // Load saved letters (P1.2: IndexedDB library with a one-time import
  // of the legacy localStorage drafts; the legacy key stays for rollback)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await migrateLegacyDrafts(loadSavedLetters());
        const letters = await libLoadAll();
        if (!cancelled) setSavedLetters(letters);
      } catch (error) {
        console.error('Document library unavailable, falling back to localStorage', error);
        if (!cancelled) setSavedLetters(loadSavedLetters());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Set today's date
  useEffect(() => {
    setFormData(prev => ({ ...prev, date: getTodaysDate() }));
  }, []);

  // Re-apply profile when settings change (e.g. user edits profile mid-session)
  // (Declared before the effect below that calls it - declaration-order
  // requirement from the React Compiler; behavior unchanged.)
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

  // Apply user profile defaults on initial load
  useEffect(() => {
    if (profileLoaded) {
      applyProfileToForm();
    }
    // Mount-gated by profileLoaded only - re-application on later profile
    // edits happens explicitly on Settings close (pre-existing contract).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded]);

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
      name: formData.subj || 'Untitled',
      updatedAt: now.toISOString(),
      vias,
      references,
      enclosures,
      copyTos,
      paragraphs,
    };

    // P1.2: IndexedDB is the store of record - no eviction cap. A
    // failed write is reported, never silently dropped.
    setSavedLetters(prev => [newLetter, ...prev]);
    libPut(newLetter)
      .then(() => {
        toast({ title: 'Draft Saved', description: `"${newLetter.name}" added to your document library.` });
        // P1.3: mirror to the backup folder when auto backup is on.
        backupDocument(newLetter).catch((error) => {
          console.error('Auto backup failed', error);
          toast({ title: 'Backup Skipped', description: 'The library save worked, but the folder backup failed. Check Settings, Data.', variant: 'destructive' });
        });
      })
      .catch((error) => {
        console.error('Library save failed', error);
        setSavedLetters(prev => prev.filter(l => l.id !== newLetter.id));
        toast({ title: 'Save Failed', description: 'Storage is full or unavailable. Export an .nldp backup instead.', variant: 'destructive' });
      });
  };

  // P1.2: per-document library operations
  const handleRenameDocument = (id: string, name: string) => {
    const letter = savedLetters.find(l => l.id === id);
    if (!letter) return;
    const updated = { ...letter, name, updatedAt: new Date().toISOString() };
    setSavedLetters(prev => prev.map(l => (l.id === id ? updated : l)));
    libPut(updated).catch((error) => console.error('Library rename failed', error));
  };

  const handleDuplicateDocument = (id: string) => {
    const letter = savedLetters.find(l => l.id === id);
    if (!letter) return;
    const now = new Date();
    const copy: SavedLetter = {
      ...letter,
      id: now.toISOString(),
      savedAt: now.toLocaleString(),
      updatedAt: now.toISOString(),
      name: `${letter.name || letter.subj || 'Untitled'} (copy)`,
    };
    setSavedLetters(prev => [copy, ...prev]);
    libPut(copy).catch((error) => console.error('Library duplicate failed', error));
  };

  const handleDeleteDocument = (id: string) => {
    setSavedLetters(prev => prev.filter(l => l.id !== id));
    libDelete(id).catch((error) => console.error('Library delete failed', error));
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
        setAttachments([]);
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
    libClear().catch((error) => console.error('Library clear failed', error));
    setSavedLetters([]);
  };

  // P3.2: undo/redo over the seven document slices (snapshot history)
  const { undo, redo, canUndo, canRedo } = useUndoHistory({
    formData, paragraphs, vias, references, enclosures, copyTos, distList,
    setFormData, setParagraphs, setVias, setReferences, setEnclosures, setCopyTos, setDistList,
    setFormKey,
  });

  // P3.1: apply a replace-all through the normal setters (one undo step)
  const handleFindReplaceApply = (result: FindReplaceResult) => {
    setFormData(result.formData);
    setParagraphs(result.paragraphs);
    setVias(result.vias);
    setReferences(result.references);
    setEnclosures(result.enclosures);
    setCopyTos(result.copyTos);
    setFormKey(prev => prev + 1);
    toast({ title: 'Replaced', description: `${result.replaced} occurrence${result.replaced === 1 ? '' : 's'} replaced.` });
  };

  // P3.6: attachment handlers - adding also appends the enclosure
  // line so the letter's Encl: block lists the attached document.
  const handleAddAttachment = (attachment: EnclosureAttachment) => {
    setAttachments(prev => [...prev, attachment]);
    setEnclosures(prev => [...prev.filter(e => e.trim()), attachment.title]);
  };

  const handleRemoveAttachment = (id: string) => {
    const target = attachments.find(a => a.id === id);
    setAttachments(prev => prev.filter(a => a.id !== id));
    if (target) {
      setEnclosures(prev => {
        const index = prev.findIndex(e => e === target.title);
        if (index === -1) return prev;
        const next = prev.filter((_, i) => i !== index);
        return next.length > 0 ? next : [''];
      });
    }
  };

  const handleMoveAttachment = (index: number, direction: -1 | 1) => {
    setAttachments(prev => moveAttachment(prev, index, direction));
  };

  // P3.5: insert a clause as a new level-1 body paragraph
  const handleInsertClause = (content: string) => {
    setParagraphs(prev => {
      const newId = (prev.length > 0 ? Math.max(...prev.map(p => p.id)) : 0) + 1;
      return [...prev, { id: newId, level: 1, content }];
    });
  };

  // Share-link intake (?share= legacy, #es= encrypted) and S2 routing slip
  const {
    routingRequest, setRoutingRequest,
    hasEncryptedPending, unlockEncrypted, dismissEncrypted,
  } = useShareLinkLoader({ handleImport, toast });

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
      onOpenLibrary={() => setShowLibrary(true)}
      onLoadTemplateUrl={handleLoadTemplateUrl}
      currentUnitCode={currentUnitCode}
      currentUnitName={currentUnitName}
      onExportNldp={handleExportNldp}
      onShareLink={() => setShowShareDialog(true)}
      onUpdatePreview={updatePreview}
      onCopyAMHS={handleCopyAMHS}
      onExportAMHS={handleExportAMHS}
      onProofread={() => setShowProofreadModal(true)}
      onFindReplace={() => setShowFindReplace(true)}
      onGuide={() => setShowGuidance(true)}
      onUndo={undo}
      onRedo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
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
        updateParagraphMarking={updateParagraphMarking}
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
        onDocumentTypeChange={handleDocumentTypeChange}
        onInsertClause={handleInsertClause}
        attachments={attachments}
        onAddAttachment={handleAddAttachment}
        onRemoveAttachment={handleRemoveAttachment}
        onMoveAttachment={handleMoveAttachment}
        attachmentCoverPages={attachmentCoverPages}
        onAttachmentCoverPagesChange={setAttachmentCoverPages}
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
      <ShareLinkDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        onCreate={handleShareLink}
      />
      <DocumentLibraryDialog
        open={showLibrary}
        onOpenChange={setShowLibrary}
        letters={savedLetters}
        onLoad={handleLoadDraft}
        onRename={handleRenameDocument}
        onDuplicate={handleDuplicateDocument}
        onDelete={handleDeleteDocument}
      />
      <UnlockShareDialog
        open={hasEncryptedPending}
        onUnlock={unlockEncrypted}
        onDismiss={dismissEncrypted}
      />
      <FindReplaceDialog
        open={showFindReplace}
        onOpenChange={setShowFindReplace}
        input={{ formData, paragraphs, vias, references, enclosures, copyTos }}
        onApply={handleFindReplaceApply}
      />
      <GuidanceDialog
        open={showGuidance}
        onOpenChange={setShowGuidance}
        documentType={formData.documentType}
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
