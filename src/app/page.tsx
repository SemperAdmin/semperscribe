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
import {
  libLoadAll, libPut, libDelete, libClear, migrateLegacyDrafts,
  filePut, fileGet, fileDeleteIfOwnedBy, fileDeleteForDoc, fileReparentByIds,
  WORKING_COPY_DOC_ID,
} from '@/lib/document-library';
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
import { EnclosureAttachment, EnclosureRow, newRow, reconcileRows } from '@/lib/enclosure-attachments';
import { useAutosave } from '@/hooks/useAutosave';
import { RecoveryDialog } from '@/components/RecoveryDialog';
import type { WorkingCopy } from '@/lib/autosave';
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette';
import { ComplianceDialog } from '@/components/ComplianceDialog';
import { getFixer, fixAll, DocumentSlices } from '@/lib/autofix';
import { RevisionCompareDialog } from '@/components/RevisionCompareDialog';
import { PackageDialog } from '@/components/PackageDialog';
import { usePackageAssembly } from '@/hooks/usePackageAssembly';
import { ReviewPanel } from '@/components/review/ReviewPanel';
import {
  ReviewComment, addComment, toggleResolved, removeComment, pruneOrphans,
} from '@/lib/review-comments';
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
  const [copyTos, setCopyTos] = useState<string[]>(['']);
  const [distList, setDistList] = useState<string[]>(['']);

  // ENC (ENCLOSURE_UPLOAD_PLAN): enclosure ROWS are the source of
  // truth - each row optionally binds an uploaded file, and the row's
  // position is its number. `enclosures` (string[]) derives for every
  // legacy reader; `setEnclosures` reconciles titles onto rows so
  // legacy writers (undo, find-replace, import, recovery) keep their
  // contract without learning about files.
  const [enclosureRows, setEnclosureRows] = useState<EnclosureRow[]>(() => [newRow()]);
  const [enclosureFiles, setEnclosureFiles] = useState<ReadonlyMap<string, EnclosureAttachment>>(new Map());
  const enclosures = useMemo(() => enclosureRows.map(r => r.title), [enclosureRows]);
  const setEnclosures = useCallback((next: React.SetStateAction<string[]>) => {
    setEnclosureRows(prevRows => {
      const titles = typeof next === 'function' ? next(prevRows.map(r => r.title)) : next;
      return reconcileRows(prevRows, titles);
    });
  }, []);

  // ENC: restores rows + files from a saved document or recovery copy.
  // Files resolve by fileId (sibling saves of one session share bytes);
  // a missing file strips its binding and reports, never silently.
  const hydrateEnclosureBindings = useCallback((bindings: { key: string; title: string; fileId?: string }[]) => {
    const rows: EnclosureRow[] = bindings.length > 0
      ? bindings.map(b => ({ key: b.key, title: b.title, fileId: b.fileId }))
      : [newRow()];
    setEnclosureRows(rows);
    setEnclosureFiles(new Map());
    void (async () => {
      const map = new Map<string, EnclosureAttachment>();
      const missing: string[] = [];
      for (const b of bindings) {
        if (!b.fileId) continue;
        try {
          const record = await fileGet(b.fileId);
          if (record) {
            map.set(record.fileId, {
              id: record.fileId,
              fileName: record.fileName,
              title: record.title,
              mimeType: record.mimeType,
              bytes: record.bytes,
            });
          } else {
            missing.push(b.title || b.fileId);
          }
        } catch {
          missing.push(b.title || b.fileId);
        }
      }
      setEnclosureFiles(map);
      if (missing.length > 0) {
        setEnclosureRows(prev => prev.map(r => (r.fileId && !map.has(r.fileId) ? { ...r, fileId: undefined } : r)));
        toast({
          title: 'Enclosure Files Missing',
          description: `${missing.length} attached file(s) were not found in this browser. Re-attach: ${missing.join(', ')}`,
          variant: 'destructive',
        });
      }
    })();
  }, [toast]);

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

  // R8: Ctrl+K command palette
  const [paletteOpen, setPaletteOpen] = useCommandPalette();

  // R5: compliance issues + autofix dialog
  const [showCompliance, setShowCompliance] = useState(false);

  // R2: revision compare dialog
  const [showCompare, setShowCompare] = useState(false);

  // R4: package assembly dialog
  const [showPackage, setShowPackage] = useState(false);

  // R1: review comments (travel on the encrypted share link)
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [reviewMode, setReviewMode] = useState(false);

  // ENC: cover sheets are the M-5216.5 fallback; the default mark is
  // the first-page stamp, so this starts OFF.
  const [attachmentCoverPages, setAttachmentCoverPages] = useState(false);

  // R3: autosave becomes active once the initial document load settles
  const [autosaveReady, setAutosaveReady] = useState(false);

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
    savedLetters, toast, comments,
    onEnclosureBindings: hydrateEnclosureBindings,
  });

  // Document state slices shared by preview, export, and signature
  const documentData = { formData, vias, references, enclosures, copyTos, paragraphs, distList };

  // Live preview (debounced PDF regeneration) via hook. ENC: the
  // preview merges bound enclosure files, so it shows the full package.
  const { previewUrl, isGeneratingPreview, updatePreview, applySignatureFields } = useLivePreview(
    documentData,
    { enclosureRows, enclosureFiles, attachmentCoverPages },
  );

  // Export orchestration (gate, SECNAV cap, download) via hook
  const { generateDocument } = useDocumentExport({ data: documentData, applySignatureFields, enclosureRows, enclosureFiles, attachmentCoverPages });

  // Signature ceremony (placement modal, request links) via hook.
  // ENC: enclosures show in the placement modal (view-only pages) and
  // merge into the sign-ready download.
  const {
    showSignatureModal, signaturePdfBlob, signaturePdfPageCount, signatureLetterPageCount,
    handleOpenSignaturePlacement, handleSignatureConfirm,
    handleSignatureConfirmAndCopy, handleSignatureCancel,
    buildSignReadyBlob,
  } = useSignatureWorkflow({
    data: documentData, setFormData, applySignatureFields, toast,
    enclosureRows, enclosureFiles, attachmentCoverPages,
  });

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

  // R3: autosave working copy + crash recovery
  const { recovery, dismissRecovery, clear: clearAutosave } = useAutosave({
    formData, paragraphs, vias, references, enclosures, copyTos, distList,
    enclosureBindings: enclosureRows,
    ready: autosaveReady,
  });

  // Enable autosave shortly after mount, once profile defaults and the
  // date effect have settled (they run in their own mount effects).
  useEffect(() => {
    const t = setTimeout(() => setAutosaveReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const handleRestoreRecovery = () => {
    if (!recovery) return;
    const copy: WorkingCopy = recovery;
    setFormData(copy.formData);
    setParagraphs(copy.paragraphs);
    setVias(copy.vias);
    setReferences(copy.references);
    // ENC: bindings restore rows AND files; older copies carry titles only.
    if (copy.enclosureBindings) {
      hydrateEnclosureBindings(copy.enclosureBindings);
    } else {
      setEnclosures(copy.enclosures);
    }
    setCopyTos(copy.copyTos);
    setDistList(copy.distList);
    setFormKey(prev => prev + 1);
    dismissRecovery();
    toast({ title: 'Work Restored', description: 'Your in-progress document is back.' });
  };

  const handleDiscardRecovery = () => {
    clearAutosave();
    // ENC: a discarded copy's write-through files are garbage. Files a
    // SAVED document owns are untouched (different owner id).
    fileDeleteForDoc(WORKING_COPY_DOC_ID).catch((error) => console.error('Working-copy file cleanup failed', error));
    dismissRecovery();
  };

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
    } else if (profile.manualUnitName.trim()) {
      // SET-1: manual unit has no RUC - name only.
      setCurrentUnitCode(undefined);
      setCurrentUnitName(profile.manualUnitName.trim().toUpperCase());
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
      // ENC: bindings persist with the document; bytes live in the
      // enclosureFiles store, keyed by fileId.
      enclosureBindings: enclosureRows,
    };

    // R3: an explicit save supersedes the autosaved working copy.
    clearAutosave();

    // P1.2: IndexedDB is the store of record - no eviction cap. A
    // failed write is reported, never silently dropped.
    setSavedLetters(prev => [newLetter, ...prev]);
    libPut(newLetter)
      .then(() => {
        toast({ title: 'Draft Saved', description: `"${newLetter.name}" added to your document library.` });
        // ENC: ownership follows the latest save - bound files re-point
        // to this document so its cascade delete governs them.
        const boundIds = enclosureRows.map(r => r.fileId).filter((id): id is string => Boolean(id));
        fileReparentByIds(boundIds, newLetter.id).catch((error) => console.error('Enclosure file re-parent failed', error));
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
        setEnclosureRows([newRow()]);
        setEnclosureFiles(new Map());
        // ENC: clear-form abandons unsaved write-through files.
        fileDeleteForDoc(WORKING_COPY_DOC_ID).catch((error) => console.error('Working-copy file cleanup failed', error));
        setCopyTos(['']);
        setComments([]);
        setReviewMode(false);
        clearAutosave();
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

  // ENC: enclosure row operations - the file binding rides the row,
  // so reorder and remove keep title and file together by construction.
  const handleAddEnclosureRow = () => setEnclosureRows(prev => [...prev, newRow()]);

  const handleUpdateEnclosureTitle = (key: string, title: string) =>
    setEnclosureRows(prev => prev.map(r => (r.key === key ? { ...r, title } : r)));

  const handleMoveEnclosureRow = (key: string, direction: -1 | 1) =>
    setEnclosureRows(prev => {
      const index = prev.findIndex(r => r.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const handleUnbindEnclosureFile = (rowKey: string) => {
    const fileId = enclosureRows.find(r => r.key === rowKey)?.fileId;
    if (!fileId) return;
    setEnclosureFiles(prev => {
      const next = new Map(prev);
      next.delete(fileId);
      return next;
    });
    setEnclosureRows(prev => prev.map(r => (r.key === rowKey ? { ...r, fileId: undefined } : r)));
    // ENC: bytes delete only when the working copy owns them - a saved
    // document's file falls to that document's own cascade delete.
    fileDeleteIfOwnedBy(fileId, WORKING_COPY_DOC_ID).catch((error) => console.error('Enclosure file delete failed', error));
  };

  const handleRemoveEnclosureRow = (key: string) => {
    handleUnbindEnclosureFile(key);
    setEnclosureRows(prev => {
      const next = prev.filter(r => r.key !== key);
      return next.length > 0 ? next : [newRow()];
    });
  };

  const handleClearEnclosureRows = () => {
    setEnclosureRows([newRow()]);
    setEnclosureFiles(new Map());
    fileDeleteForDoc(WORKING_COPY_DOC_ID).catch((error) => console.error('Working-copy file cleanup failed', error));
  };

  const handleBindEnclosureFile = (rowKey: string, attachment: EnclosureAttachment) => {
    const oldFileId = enclosureRows.find(r => r.key === rowKey)?.fileId;
    setEnclosureFiles(prev => {
      const next = new Map(prev);
      if (oldFileId) next.delete(oldFileId);
      next.set(attachment.id, attachment);
      return next;
    });
    setEnclosureRows(prev => prev.map(r => (r.key === rowKey ? { ...r, fileId: attachment.id } : r)));
    if (oldFileId) {
      fileDeleteIfOwnedBy(oldFileId, WORKING_COPY_DOC_ID).catch((error) => console.error('Enclosure file delete failed', error));
    }
    // ENC: write-through - the file survives a crash before Save. A
    // failed persist keeps the in-memory binding (export still works)
    // and says so.
    filePut({
      fileId: attachment.id,
      docId: WORKING_COPY_DOC_ID,
      fileName: attachment.fileName,
      title: attachment.title,
      mimeType: attachment.mimeType,
      bytes: attachment.bytes,
      byteLength: attachment.bytes.byteLength,
    }).catch((error) => {
      console.error('Enclosure file persist failed', error);
      toast({
        title: 'File Not Saved to Browser Storage',
        description: `"${attachment.fileName}" is attached for this session and will export, but will not survive a reload. Storage may be full.`,
        variant: 'destructive',
      });
    });
  };

  // R5: apply fixer output through the normal setters, so one fix is
  // one undo step. Slices in, slices out - the fixers stay pure.
  const applySlices = (next: DocumentSlices) => {
    setFormData(next.formData);
    setParagraphs(next.paragraphs);
    setVias(next.vias);
    setReferences(next.references);
    setEnclosures(next.enclosures);
    setCopyTos(next.copyTos);
    setDistList(next.distList);
    setFormKey(prev => prev + 1);
  };

  const currentSlices = (): DocumentSlices => ({
    formData, paragraphs, vias, references, enclosures, copyTos, distList,
  });

  const handleFixIssue = (issueId: string) => {
    const fixer = getFixer(issueId);
    if (!fixer) return;
    applySlices(fixer.apply(currentSlices()));
    toast({ title: 'Fixed', description: fixer.label });
  };

  const handleFixAll = (issueIds: string[]) => {
    applySlices(fixAll(currentSlices(), issueIds));
    toast({ title: 'Fixes Applied', description: `${issueIds.length} issue${issueIds.length === 1 ? '' : 's'} corrected. Undo reverses this.` });
  };

  // R4: endorsement-chain package assembly
  const pkg = usePackageAssembly({ savedLetters, toast });

  // R1: comment handlers. Orphans (comments on deleted paragraphs) are
  // pruned on add so a stranded note never hides from the drafter.
  const handleAddComment = (comment: ReviewComment) => {
    setComments((prev) => pruneOrphans(addComment(prev, comment), paragraphs.map((p) => p.id)));
  };
  const handleToggleComment = (id: string) => setComments((prev) => toggleResolved(prev, id));
  const handleRemoveComment = (id: string) => setComments((prev) => removeComment(prev, id));

  // Share-link intake (?share= legacy, #es= encrypted) and S2 routing slip
  const {
    routingRequest, setRoutingRequest,
    hasEncryptedPending, unlockEncrypted, dismissEncrypted,
  } = useShareLinkLoader({
    handleImport,
    toast,
    onComments: (incoming) => {
      setComments(incoming);
      toast({
        title: 'Review Comments Received',
        description: `${incoming.filter((c) => !c.resolved).length} open comment(s) arrived with this document.`,
      });
    },
  });

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
      onCompliance={() => setShowCompliance(true)}
      onCompare={() => setShowCompare(true)}
      onPackage={() => setShowPackage(true)}
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
      {/* R1: review comments - shown to a drafter receiving a reviewed
          link, and to a reviewer annotating one. */}
      {!routingRequest && formData.documentType && (
        <ReviewPanel
          comments={comments}
          paragraphs={paragraphs}
          reviewMode={reviewMode}
          onReviewModeChange={setReviewMode}
          onAdd={handleAddComment}
          onToggleResolved={handleToggleComment}
          onRemove={handleRemoveComment}
          authorName={profile.fullName || ''}
        />
      )}
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
        signatureLetterPageCount={signatureLetterPageCount}
        handleDynamicFormSubmit={handleDynamicFormSubmit}
        onDocumentTypeChange={handleDocumentTypeChange}
        enclosureRows={enclosureRows}
        enclosureFiles={enclosureFiles}
        onAddEnclosureRow={handleAddEnclosureRow}
        onRemoveEnclosureRow={handleRemoveEnclosureRow}
        onUpdateEnclosureTitle={handleUpdateEnclosureTitle}
        onMoveEnclosureRow={handleMoveEnclosureRow}
        onClearEnclosureRows={handleClearEnclosureRows}
        onBindEnclosureFile={handleBindEnclosureFile}
        onUnbindEnclosureFile={handleUnbindEnclosureFile}
        attachmentCoverPages={attachmentCoverPages}
        onAttachmentCoverPagesChange={setAttachmentCoverPages}
        comments={comments}
        reviewMode={reviewMode}
        onAddComment={handleAddComment}
        onToggleComment={handleToggleComment}
        onRemoveComment={handleRemoveComment}
        commentAuthor={profile.fullName || ''}
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
      <RecoveryDialog
        copy={recovery}
        onRestore={handleRestoreRecovery}
        onDiscard={handleDiscardRecovery}
      />
      <RevisionCompareDialog
        open={showCompare}
        onOpenChange={setShowCompare}
        letters={savedLetters}
        onRestore={handleLoadDraft}
      />
      <PackageDialog
        open={showPackage}
        onOpenChange={setShowPackage}
        savedLetters={savedLetters}
        members={pkg.members}
        sequences={pkg.sequences}
        issues={pkg.issues}
        busy={pkg.busy}
        onAdd={pkg.add}
        onRemove={pkg.remove}
        onMove={pkg.move}
        onClear={pkg.clear}
        onMeasure={pkg.measure}
        onExport={pkg.exportPackage}
      />
      <ComplianceDialog
        open={showCompliance}
        onOpenChange={setShowCompliance}
        issues={validationIssues}
        onFix={handleFixIssue}
        onFixAll={handleFixAll}
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        hasDocument={Boolean(formData.documentType)}
        onSelectType={handleDocumentTypeChange}
        onExportPdf={() => generateDocument('pdf')}
        onExportDocx={() => generateDocument('docx')}
        onSave={saveLetter}
        onOpenLibrary={() => setShowLibrary(true)}
        onShareLink={() => setShowShareDialog(true)}
        onFindReplace={() => setShowFindReplace(true)}
        onCompliance={() => setShowCompliance(true)}
        onGuide={() => setShowGuidance(true)}
        onSettings={() => setShowSettings(true)}
        onClearForm={handleClearForm}
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
