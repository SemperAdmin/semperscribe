'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { ParagraphData, SavedLetter, ValidationState, FormData, ReportData, SamePageHost } from '@/types';
import { ModernAppShell } from '@/components/layout/ModernAppShell';
import { EXAMPLE_DOCUMENT_URL } from '@/components/layout/LandingPage';
import { DocumentLayout } from '@/components/document/DocumentLayout';
import { getLoadedUnits, loadUnits } from '@/lib/reference-data';
import { resolveUnit } from '@/hooks/useUserProfile';
import { getTodaysDate } from '@/lib/date-utils';
import { getMCOParagraphs, getMCBulParagraphs, getSecnavInstructionParagraphs, getSecnavNoticeParagraphs, getMOAParagraphs, getStaffingPaperParagraphs, getInformationPaperParagraphs, getExportFilename } from '@/lib/naval-format-utils';
import { loadSavedLetters, clearSavedLetters } from '@/lib/storage-utils';
import {
  libLoadAll, libPut, libDelete, libClear, migrateLegacyDrafts,
  filePut, fileGet, fileDeleteIfOwnedBy, fileDeleteForDoc, fileReparentByIds,
} from '@/lib/document-library';
import { putNavmc10132Base, navmc10132BaseFileIdOf } from '@/lib/navmc10132-base-file';
import { backupDocument } from '@/lib/auto-backup';
import { runLetterValidators } from '@/lib/letter-validators';
import type { ValidationIssue } from '@/lib/letter-validators';
import { configureConsole, debugUserAction, debugFormChange } from '@/lib/console-utils';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { resolvePickerType, pickerTypeFor } from '@/lib/document-type-options';
import { resolveHostBytes } from '@/lib/same-page-host';
import { emptySamePagePart } from '@/lib/same-page-composite';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
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
import { ShareLinkDialog, UnlockShareDialog, ConfirmShareDialog } from '@/components/ShareLinkDialog';
import { ExportNLDPDialog } from '@/components/ExportNLDPDialog';
import { FindReplaceDialog } from '@/components/FindReplaceDialog';
import { GuidanceDialog } from '@/components/GuidanceDialog';
import { FindReplaceResult } from '@/lib/find-replace';
import { useUndoHistory } from '@/hooks/useUndoHistory';
import { useSyncedState } from '@/hooks/useSyncedState';
import { EnclosureAttachment, EnclosureRow, newRow, reconcileRows } from '@/lib/enclosure-rows';
import { useAutosave } from '@/hooks/useAutosave';
import { RecoveryDialog, UnsavedWorkDialog } from '@/components/RecoveryDialog';
import type { PendingReplace } from '@/components/RecoveryDialog';
import type { WorkingCopy } from '@/lib/autosave';
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette';
import { ComplianceDialog } from '@/components/ComplianceDialog';
import { focusDocumentField } from '@/lib/field-focus';
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
import { GunnyBotPanel } from '@/components/gunnybot/GunnyBotPanel';
import { GunnyBotRuntime } from '@/components/gunnybot/GunnyBotRuntime';
import { ExportScanGate } from '@/components/ExportScanGate';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useLivePreview } from '@/hooks/useLivePreview';
import { useMilitaryDictionary } from '@/hooks/useReferenceData';
import { useDocumentExport } from '@/hooks/useDocumentExport';
import { useSignatureWorkflow } from '@/hooks/useSignatureWorkflow';
import { useShareLinkLoader } from '@/hooks/useShareLinkLoader';
import { useHydrated } from '@/hooks/useHydrated';
import { useSyncedUpdate } from '@/hooks/useSyncedState';
import { ITypePreview } from '@/components/itype/ITypePreview';
import { useITypeStore } from '@/store/iTypeStore';

// Inner component that uses useSearchParams (requires Suspense boundary)
function NavalLetterGeneratorInner() {
  // Configure console to suppress browser extension errors
  useEffect(() => {
    configureConsole();
  }, []);

  const { toast } = useToast();

  // P6-11: the service worker takes over open tabs on activation
  // (skipWaiting + clients.claim), so a tab's loaded chunks can be a
  // deploy behind the worker serving it. Both the controllerchange
  // event and the worker's own sw-updated message land here; the
  // toast fires once per activation.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    // A first install also claims the page; only a tab that already had
    // a controller has an old version to reload away from.
    const hadController = sw.controller !== null;
    let announced = false;
    const announce = () => {
      if (announced || !hadController) return;
      announced = true;
      toast({
        title: 'A new version is ready',
        description: 'Save your work, then reload the page to finish updating.',
      });
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && (event.data as { type?: string }).type === 'sw-updated') announce();
    };
    sw.addEventListener('controllerchange', announce);
    sw.addEventListener('message', onMessage);
    return () => {
      sw.removeEventListener('controllerchange', announce);
      sw.removeEventListener('message', onMessage);
    };
  }, [toast]);
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
    // E.1 (M-5216.5 9-1, 9-2.1.a). New page is the placement that
    // always works; the omission is the manual's own default once
    // same-page is chosen.
    endorsementPlacement: 'new-page',
    samePageOmitsIdentification: true,
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

  // Only the setter is consumed (child sections read their own state);
  // useImportExport writes through setValidation on import.
  const [, setValidation] = useState<ValidationState>({
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
  const [showExportNldpDialog, setShowExportNldpDialog] = useState(false);

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

  // P6-7: set when Save could not re-parent the bound files (enclosures,
  // the uploaded signed NAVMC 10132) to the saved document. While set, the
  // Clear Form sweep of working-copy files is skipped, because it would
  // delete files a saved document still depends on.
  const reparentFailedRef = useRef(false);

  // Unit header state (sourced from user profile)
  const [currentUnitCode, setCurrentUnitCode] = useState<string | undefined>(undefined);
  const [currentUnitName, setCurrentUnitName] = useState<string | undefined>(undefined);

  // R3: autosave working copy + crash recovery. P6-4: the working copy
  // and its write-through files are scoped to this tab's session id;
  // `workingCopyDocId` is the file owner id every attach below uses.
  const {
    recovery, recoveryRemaining, workingCopyDocId,
    laterRecovery, discardRecovery, acceptRecovery,
    clear: clearAutosave,
  } = useAutosave({
    formData, paragraphs, vias, references, enclosures, copyTos, distList,
    enclosureBindings: enclosureRows,
    ready: autosaveReady,
  });


  // Document state slices shared by preview, export, and signature
  const documentData = { formData, vias, references, enclosures, copyTos, paragraphs, distList };

  // E.3 (M-5216.5 9-1, Figure 9-1): the letter a same-page endorsement
  // is added to. An attached PDF's bytes are kept here for the session
  // and written through to the file store, keyed by fileId, the way
  // enclosure files are; a library letter is rendered on demand. The
  // resolver hands the preview and the export the same bytes.
  const [samePageHostBytes, setSamePageHostBytes] = useState<ReadonlyMap<string, ArrayBuffer>>(new Map());
  const samePageHost = formData.samePageHost as SamePageHost | undefined;
  const resolveSamePageHost = useCallback(async (): Promise<Uint8Array | null> => {
    if (!samePageHost) return null;
    return resolveHostBytes(samePageHost, {
      savedLetters,
      loadFile: async (fileId) => samePageHostBytes.get(fileId) ?? (await fileGet(fileId))?.bytes ?? null,
      renderLetter: (letter) => generatePdfForDocType({
        formData: letter,
        vias: letter.vias ?? [],
        references: letter.references ?? [],
        enclosures: letter.enclosures ?? [],
        copyTos: letter.copyTos ?? [],
        paragraphs: letter.paragraphs ?? [],
        distList: letter.distList ?? [],
      }),
    });
  }, [samePageHost, savedLetters, samePageHostBytes]);

  const clearSamePageHostFile = (host: SamePageHost | undefined) => {
    if (host?.kind !== 'file') return;
    setSamePageHostBytes(prev => { const next = new Map(prev); next.delete(host.fileId); return next; });
    fileDeleteIfOwnedBy(host.fileId, workingCopyDocId).catch((error) => console.error('Endorsed letter file delete failed', error));
  };

  const handleAttachSamePageHostFile = async (file: File) => {
    const bytes = await file.arrayBuffer();
    const head = new TextDecoder('latin1').decode(new Uint8Array(bytes.slice(0, 5)));
    if (head !== '%PDF-') {
      toast({ title: 'Not a PDF', description: `"${file.name}" is not a PDF. Attach the signed letter as a PDF.`, variant: 'destructive' });
      return;
    }
    const fileId = crypto.randomUUID();
    clearSamePageHostFile(samePageHost);
    setSamePageHostBytes(prev => new Map(prev).set(fileId, bytes));
    setFormData(prev => ({ ...prev, samePageHost: { kind: 'file', fileId, fileName: file.name } }));
    filePut({
      fileId,
      docId: workingCopyDocId,
      fileName: file.name,
      title: file.name,
      mimeType: 'application/pdf',
      bytes,
      byteLength: bytes.byteLength,
    }).catch((error) => {
      console.error('Endorsed letter persist failed', error);
      toast({
        title: 'File Not Saved to Browser Storage',
        description: `"${file.name}" is attached for this session and will export, but will not survive a reload. Storage may be full.`,
        variant: 'destructive',
      });
    });
  };

  const handleSelectSamePageHostDraft = (letterId: string) => {
    const letter = savedLetters.find(l => l.id === letterId);
    if (!letter) return;
    clearSamePageHostFile(samePageHost);
    setFormData(prev => ({
      ...prev,
      samePageHost: { kind: 'draft', letterId, title: letter.name || letter.subj || 'Saved letter' },
    }));
  };

  const handleClearSamePageHost = () => {
    clearSamePageHostFile(samePageHost);
    setFormData(prev => ({ ...prev, samePageHost: undefined }));
  };

  // Live preview (debounced PDF regeneration) via hook. ENC: the
  // preview merges bound enclosure files, so it shows the full package.
  const { previewUrl, isGeneratingPreview, updatePreview, applySignatureFields, samePageStatus } = useLivePreview(
    documentData,
    { enclosureRows, enclosureFiles, attachmentCoverPages },
    resolveSamePageHost,
  );

  // Export orchestration (gate, SECNAV cap, download) via hook
  // D.4: the export gate refuses a block-severity document, and the
  // refusal opens the compliance dialog on the blocking issues instead
  // of the native alert() the hook used to raise. The hook takes a
  // callback rather than the dialog, so no UI reaches into it.
  const [exportBlockers, setExportBlockers] = useState<ValidationIssue[] | null>(null);
  const { generateDocument } = useDocumentExport({
    data: documentData,
    applySignatureFields,
    enclosureRows,
    enclosureFiles,
    attachmentCoverPages,
    resolveSamePageHost,
    toast,
    onBlocked: (blockers) => {
      setExportBlockers(blockers);
      setShowCompliance(true);
    },
  });

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
    // P6-4: a copy from another session brings its write-through files
    // along. They move under THIS tab's owner id, so that session's
    // Discard (or its Clear Form sweep) no longer deletes bytes this
    // document now depends on. (A no-op for this tab's own copy.)
    const boundIds = (copy.enclosureBindings ?? []).map(b => b.fileId).filter((id): id is string => Boolean(id));
    const host = copy.formData.samePageHost as SamePageHost | undefined;
    if (host?.kind === 'file') boundIds.push(host.fileId);
    const navmcBaseId = navmc10132BaseFileIdOf(copy.formData);
    if (navmcBaseId) boundIds.push(navmcBaseId);
    fileReparentByIds(boundIds, workingCopyDocId).catch((error) => console.error('Recovered file re-parent failed', error));
    acceptRecovery();
    toast({ title: 'Work Restored', description: 'Your in-progress document is back.' });
  };

  // P6-3: only the explicit, confirmed Discard button reaches this.
  // P6-4: it deletes the copy on offer and that copy's files - never
  // another session's, never a saved document's (different owner ids).
  const handleDiscardRecovery = () => {
    const ownerId = discardRecovery();
    if (ownerId) {
      fileDeleteForDoc(ownerId).catch((error) => console.error('Working-copy file cleanup failed', error));
    }
  };

  // Today's date, applied on the first client render. Not part of the
  // initial state: the static export is prerendered at build time, and a
  // build-date value in the markup would mismatch the client's on
  // hydration. useHydrated is false for that render and true after it.
  const hydrated = useHydrated();
  useSyncedUpdate(hydrated, (isClient) => {
    if (isClient) setFormData(prev => ({ ...prev, date: getTodaysDate() }));
  });

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
      ...(prev.line1 ? {} : { line1: defaults.line1, line1b: defaults.line1b, line2: defaults.line2, line3: defaults.line3 }),
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
  }, [getFormDefaults, profile.unitRuc, profile.manualUnitName]);

  // Apply user profile defaults once the profile has loaded. Keyed on
  // the loaded flag only: re-application on later profile edits happens
  // explicitly on Settings close (pre-existing contract). Every write in
  // applyProfileToForm is this component's own state, so it runs in the
  // render where the flag flips rather than one commit later.
  useSyncedUpdate(profileLoaded, (loaded) => {
    if (loaded) applyProfileToForm();
  });

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
  }, [formData.documentType, formData.cancellationType, paragraphs, setParagraphs]);

  // Sync Reports to Admin Subsections. Re-derived when the reports list
  // or the document type changes identity, same triggers as the effect
  // this replaces, and written back only when the text differs.
  const reportsSource = useMemo(
    () => ({ reports: formData.reports as ReportData[] | undefined, documentType: formData.documentType }),
    [formData.reports, formData.documentType],
  );
  useSyncedUpdate(reportsSource, ({ reports, documentType }) => {
    if (!DOCUMENT_TYPES[documentType]?.features?.showReports) return;
    let content = 'None.';
    const validReports = reports?.filter(r => r.title) || [];

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
  });

  // Sync I-Type form data to store for real-time preview
  useEffect(() => {
    if (formData.documentType === 'i-type') {
      setITypeFormData(formData);
    }
  }, [formData, setITypeFormData]);

  const handleDocumentTypeChange = (pickedType: string) => {
    // E.2: the picker offers the same-page endorsement as its own
    // option; it resolves to the endorsement type with same-page
    // placement (M-5216.5 9-1). Every other option is a document type
    // and resolves to itself with new-page placement.
    const { documentType: newType, endorsementPlacement } = resolvePickerType(pickedType);
    const newFeatures = DOCUMENT_TYPES[newType]?.features;
    const oldFeatures = DOCUMENT_TYPES[formData.documentType]?.features;

    // Every branch below assigns (the chain ends in a plain else).
    let newParagraphs: ParagraphData[];
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
      // SEED THE NAVMC 10132 STAGE ON FIRST SWITCH. The export gate reads an
      // ABSENT `stage` as `'complete'` on purpose (see
      // navmc10132ExportGateStage): a document saved before the field existed
      // is likelier finished than freshly started, and treating a finished one
      // as pass 1 would silently drop real blockers. That default is only safe
      // if a NEW document actually carries the field. It did not, because
      // createEmptyNavmc10132Data is a test helper this path never calls, so
      // every fresh UPB read as `'complete'` and fired every later pass's
      // blockers while the selector displayed "Notification". Preserve an
      // existing value so re-selecting the type never rewinds the stage.
      stage: newType === 'navmc10132' ? ((prev as FormData).stage ?? 1) : (prev as FormData).stage,
      // E.3: an endorsement opens as a FIRST endorsement unless the
      // drafter has chosen a level; the line is missing until one is set.
      endorsementLevel: newType === 'endorsement'
        ? (prev.endorsementLevel || 'FIRST')
        : newType === 'basic' ? '' : prev.endorsementLevel,
      // E.3: the letter being endorsed belongs to an endorsement only.
      samePageHost: newType === 'endorsement' ? prev.samePageHost : undefined,
      // E.5: the same-page option is the two-half document; the
      // endorsement half starts empty, dated today, and takes its
      // addressing from the letter as it is written.
      samePageEndorsement: endorsementPlacement === 'same-page'
        ? (prev.samePageEndorsement ?? { ...emptySamePagePart(), date: getTodaysDate() })
        : undefined,
      basicLetterReference: newType === 'basic' ? '' : prev.basicLetterReference,
      referenceWho: newType === 'basic' ? '' : prev.referenceWho,
      referenceType: newType === 'basic' ? '' : prev.referenceType,
      referenceDate: newType === 'basic' ? '' : prev.referenceDate,
      to: newFeatures?.isDirective ? 'Distribution List' : prev.to,
      startingReferenceLevel: 'a',
      startingEnclosureNumber: '1',
      endorsementPlacement,
      samePageOmitsIdentification: true,
      startingPageNumber: 1,
      previousPackagePageCount: 0,
    }));

    setParagraphs(newParagraphs);
  };

  // D.2: the header save state. Edits are counted from the moment the
  // initial load settles, the same gate autosave uses, so the profile
  // defaults and the date effect never read as a user edit. Save Draft
  // records the count it wrote, and any edit after it is unsaved work.
  // The autosaved working copy deliberately does not read as saved,
  // because the drafter did not choose to keep it.
  const documentSlices = useMemo(
    () => ({ formData, paragraphs, vias, references, enclosures, copyTos, distList }),
    [formData, paragraphs, vias, references, enclosures, copyTos, distList],
  );
  const [changeCount] = useSyncedState<typeof documentSlices, number>(
    documentSlices,
    (_slices, previousCount) => {
      if (previousCount === undefined) return 0;
      return autosaveReady ? previousCount + 1 : 0;
    },
  );
  const [savedMark, setSavedMark] = useState<{ at: Date; changeCount: number } | null>(null);
  const isDirty = savedMark ? changeCount !== savedMark.changeCount : changeCount > 0;

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

    // P1.2: IndexedDB is the store of record - no eviction cap. A
    // failed write is reported, never silently dropped.
    setSavedLetters(prev => [newLetter, ...prev]);
    libPut(newLetter)
      .then(() => {
        // P6-2: the working copy is cleared and the header reads "Saved"
        // only once the write has landed. Both used to run before the
        // write, so a quota failure left the header on "Saved" with the
        // only surviving copy of the work gone.
        // R3: an explicit save supersedes the autosaved working copy.
        clearAutosave();
        // D.2: this is the only place the header reads as saved.
        setSavedMark({ at: now, changeCount });
        toast({ title: 'Draft Saved', description: `"${newLetter.name}" added to your document library.` });
        // ENC: ownership follows the latest save - bound files re-point
        // to this document so its cascade delete governs them.
        const boundIds = enclosureRows.map(r => r.fileId).filter((id): id is string => Boolean(id));
        // E.3: the attached letter being endorsed is owned the same way.
        const host = newLetter.samePageHost as SamePageHost | undefined;
        if (host?.kind === 'file') boundIds.push(host.fileId);
        // P6-7: the uploaded signed NAVMC 10132 is owned the same way too.
        // Left out, it stayed under the working copy and Clear Form after
        // Save deleted the saved document's signed file.
        const navmcBaseId = navmc10132BaseFileIdOf(newLetter as FormData);
        if (navmcBaseId) boundIds.push(navmcBaseId);
        fileReparentByIds(boundIds, newLetter.id).catch((error) => {
          console.error('Enclosure file re-parent failed', error);
          // The files still belong to the working copy, so the next Clear
          // Form sweep would delete what this save depends on. Hold the
          // sweep off and say so.
          if (boundIds.length > 0) {
            reparentFailedRef.current = true;
            toast({
              title: 'Attached files not moved to the saved document',
              description: 'The draft saved, but its attached files (enclosures, a signed NAVMC 10132) could not be re-parented to it. Save again before clearing the form.',
              variant: 'destructive',
            });
          }
        });
        // P1.3: mirror to the backup folder when auto backup is on.
        backupDocument(newLetter).catch((error) => {
          console.error('Auto backup failed', error);
          toast({ title: 'Backup Skipped', description: 'The library save worked, but the folder backup failed. Check Settings, Data.', variant: 'destructive' });
        });
      })
      .catch((error) => {
        console.error('Library save failed', error);
        setSavedLetters(prev => prev.filter(l => l.id !== newLetter.id));
        // P6-2: nothing was saved, so nothing reads as saved. The working
        // copy is left in place: it is the only copy of this work.
        setSavedMark(null);
        toast({ title: 'Save Failed', description: 'Storage is full or unavailable. Export an .nldp backup instead.', variant: 'destructive' });
      });
  };

  // P1.2: per-document library operations. P6-17: each is optimistic
  // and, on a failed write, reverts the list and says so - the way Save
  // does - instead of leaving the screen and the store disagreeing.
  const handleRenameDocument = (id: string, name: string) => {
    const letter = savedLetters.find(l => l.id === id);
    if (!letter) return;
    const updated = { ...letter, name, updatedAt: new Date().toISOString() };
    setSavedLetters(prev => prev.map(l => (l.id === id ? updated : l)));
    libPut(updated).catch((error) => {
      console.error('Library rename failed', error);
      setSavedLetters(prev => prev.map(l => (l.id === id ? letter : l)));
      toast({ title: 'Rename Failed', description: 'The new name could not be written. Storage may be full or unavailable.', variant: 'destructive' });
    });
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
    libPut(copy).catch((error) => {
      console.error('Library duplicate failed', error);
      setSavedLetters(prev => prev.filter(l => l.id !== copy.id));
      toast({ title: 'Duplicate Failed', description: 'The copy could not be written. Storage may be full or unavailable.', variant: 'destructive' });
    });
  };

  const handleDeleteDocument = (id: string) => {
    const removed = savedLetters.find(l => l.id === id);
    setSavedLetters(prev => prev.filter(l => l.id !== id));
    libDelete(id).catch((error) => {
      console.error('Library delete failed', error);
      if (removed) setSavedLetters(prev => (prev.some(l => l.id === id) ? prev : [removed, ...prev]));
      toast({ title: 'Delete Failed', description: 'The document could not be removed from storage. It is still in your library.', variant: 'destructive' });
    });
  };

  // Resets every piece of document state to a blank form of the given type.
  // Shared by Clear Form and the Word/PDF import's replace-on-confirm.
  const resetDocumentState = (documentType: string) => {
        // The letterhead comes from the profile here (an empty `line1`
        // makes blankFormData fall back to the defaults), so Clear Form
        // resets the unit lines the way it always has.
        setFormData(blankFormData({ documentType, line1: '', line1b: '', line2: '', line3: '' }));
        setParagraphs([{ id: 1, level: 1, content: '', acronymError: '' }]);
        setVias(['']);
        setReferences(['']);
        setEnclosureRows([newRow()]);
        setEnclosureFiles(new Map());
        // ENC: clear-form abandons unsaved write-through files, the
        // uploaded signed NAVMC 10132 among them (navmc10132-base-file.ts).
        // The new document carries no base id, so it fills the blank
        // whether or not the sweep runs. P6-7: skipped when the last Save
        // failed to move its files off the working copy.
        if (reparentFailedRef.current) {
          reparentFailedRef.current = false;
          console.warn('Working-copy file cleanup skipped: the last save could not re-parent its files.');
        } else {
          fileDeleteForDoc(workingCopyDocId).catch((error) => console.error('Working-copy file cleanup failed', error));
        }
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

  /**
   * The app's blank document, built from the one being replaced: its
   * document type and letterhead carry (a template without a letterhead
   * of its own keeps the unit on screen), profile defaults fill the rest,
   * and nothing else survives. Shared by Clear Form and, through the
   * import hook (P6-9), every draft, .nldp, template and share-link load,
   * so stale keys - signatureFields, samePageHost, the NAVMC 10132 base
   * id and load report, stage - never reach the new document.
   */
  const blankFormData = useCallback((previous: Partial<FormData> & { documentType: string }): FormData => {
    const currentType = previous.documentType;
    const defaults = getFormDefaults();
    return {
      documentType: currentType,
      // SEEDED HERE TOO, and this is the hole the D-43 guard could
      // not see. That guard scans for setFormData calls producing a
      // LITERAL 'navmc10132'; this one uses a variable, so it passed
      // the scan while leaving `stage` undefined. An absent stage is
      // read as 1 for display and as 'complete' by the export gate,
      // so Clear Form on a UPB produced a blank document that fired
      // every later-pass blocker at once. Undefined for every other
      // document type, which is what those types expect.
      ...(currentType === 'navmc10132' ? { stage: 1 } : {}),
      endorsementLevel: '',
      basicLetterReference: '',
      referenceWho: '',
      referenceType: '',
      referenceDate: '',
      startingReferenceLevel: 'a',
      startingEnclosureNumber: '1',
      endorsementPlacement: 'new-page',
      samePageOmitsIdentification: true,
      line1: previous.line1 || defaults.line1,
      line1b: previous.line1 ? (previous.line1b ?? '') : defaults.line1b,
      line2: previous.line1 ? (previous.line2 ?? '') : defaults.line2,
      line3: previous.line1 ? (previous.line3 ?? '') : defaults.line3,
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
      amhsTextBody: '',
    };
  }, [getFormDefaults]);


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
    blankFormData,
  });

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

  /**
   * A NAVMC 10132 read out of a PDF MERGES, it does not replace.
   *
   * `applyDocumentImport` above calls `resetDocumentState` first, which is
   * right for a text import: the document in front of you replaces the one
   * behind you. It is wrong here. Loading a signed UPB is the return leg of
   * a case the clerk is already working, so the file adds what has been
   * signed and the app keeps what has not been entered on paper yet. That
   * is Stephen's rule, 2026-08-25: the app updates what is not updated yet
   * and does not preload anything.
   */
  const applyNavmc10132Load = useCallback(
    (patch: Record<string, unknown>, report: unknown, bytes: ArrayBuffer, fileName: string) => {
      // P6-1: the base is keyed by an id minted per load and recorded on
      // the document, so the export reads THIS document's file and no
      // other. The previous base of this document, if any, is replaced.
      const previousBaseId = navmc10132BaseFileIdOf(formData);
      setFormData(prev => ({ ...prev, ...patch, navmc10132LoadReport: report }));

      // REMOUNT EVERY DYNAMICFORM, and this line is the whole of Stephen's
      // 2026-08-26 report: "on inport it did not pull the Unit and Accused
      // (Items 17-20) ... data". They were pulled. RHF then wrote its own
      // stale defaults straight back over them.
      //
      // DynamicForm calls useForm once per mount and never resets, so a load
      // that only writes formData leaves every mounted form holding the
      // values it seeded BEFORE the file arrived, and its next debounced
      // sync clobbers the patch. Item 17, item 18 and item 20 live in the
      // accused DynamicForm, which is exactly the set that came back blank.
      // Every other path replacing document state already bumps this;
      // this one did not.
      setFormKey(prev => prev + 1);

      // THE FILE ITSELF IS KEPT, not just what was read out of it. Every
      // later export writes an incremental update INTO these bytes so the
      // CAC signatures stay valid, and the live preview renders them, so a
      // loaded document previews as itself rather than as a fresh blank.
      // Five megabytes, so IndexedDB rather than document state, which is
      // JSON-serialized on every autosave. See navmc10132-base-file.ts.
      //
      // NOT AWAITED, DELIBERATELY. The form is already populated and
      // usable. The id lands on the document once the bytes are stored; a
      // storage failure leaves no id, so the export fills the blank and its
      // toast says the signed file is not available, rather than failing.
      putNavmc10132Base(bytes, fileName, { docId: workingCopyDocId, replaces: previousBaseId })
        .then((id) => setFormData(prev => ({ ...prev, navmc10132BaseFileId: id })))
        .catch((error) => {
          console.error('Storing the uploaded NAVMC 10132 failed; exports will fill the blank instead:', error);
          // The previous base was not replaced (the put failed before the
          // delete), but it belongs to the file that was loaded BEFORE this
          // one; the document now describes the new file, so no base.
          setFormData(prev => (navmc10132BaseFileIdOf(prev) === previousBaseId
            ? { ...prev, navmc10132BaseFileId: undefined }
            : prev));
          toast({
            title: 'Signed file not kept',
            description: 'The uploaded NAVMC 10132 could not be stored in this browser. Exports will fill the blank form, without its signatures, until it is loaded again.',
            variant: 'destructive',
          });
        });

      debugFormChange('NAVMC 10132 Loaded From PDF', patch);
    },
    // formData is read once, for the previous base id. The consumer
    // (useDocumentImport) already re-creates its callback on every
    // formData change, so this dependency costs nothing extra.
    [formData, toast, workingCopyDocId],
  );

  /**
   * D.7: whether the document on screen holds work worth protecting.
   * Body text or any of the four SECNAV M-5216.5 header elements the
   * drafter types counts. The pre-filled date and the unit lines do not,
   * because the app puts those there before the user has done anything.
   */
  const documentHasContent =
    paragraphs.some(p => p.content.trim() !== '') ||
    [formData.ssic, formData.subj, formData.from, formData.to]
      .some(value => typeof value === 'string' && value.trim() !== '');

  /**
   * P6-9: a draft, an .nldp/.json import or a template replaces the
   * document on screen. When that document holds content the drafter has
   * not saved, the replacement waits on a confirmation (the same dialog
   * pattern as the share-link intake, not window.confirm). The pending
   * action is held here; confirm runs it, dismiss drops it.
   */
  const [pendingReplace, setPendingReplace] = useState<(PendingReplace & { run: () => void }) | null>(null);
  const guardUnsavedWork = useCallback((pending: PendingReplace, run: () => void) => {
    if (documentHasContent && isDirty) {
      setPendingReplace({ ...pending, run });
      return;
    }
    run();
  }, [documentHasContent, isDirty]);
  const confirmPendingReplace = () => {
    const pending = pendingReplace;
    setPendingReplace(null);
    pending?.run();
  };
  const dismissPendingReplace = () => setPendingReplace(null);

  /**
   * P6-1: `handleImport` MERGES over the previous document state, so a
   * draft, a template, a share link or an `.nldp` that carries no signed
   * file would otherwise inherit the previous document's base id and load
   * report, and export INTO the previous Marine's signed file. Clearing
   * both first leaves the incoming document with exactly what it brought:
   * a saved draft of a loaded UPB carries its own id and gets its own base
   * back; everything else fills the blank.
   *
   * P6-9 generalised this: the import hook now rebuilds from
   * `blankFormData` before it spreads, so EVERY stale key is dropped, not
   * only these two. The explicit clear stays as belt-and-braces for the
   * base id, the one key whose leak exports another Marine's signed file.
   *
   * The bytes are not deleted here: a saved document may own them, and
   * an unsaved base falls to the Clear Form sweep.
   */
  const dropNavmc10132Base = useCallback(() => {
    setFormData(prev => (
      prev.navmc10132BaseFileId === undefined && prev.navmc10132LoadReport === undefined
        ? prev
        : { ...prev, navmc10132BaseFileId: undefined, navmc10132LoadReport: undefined }
    ));
  }, []);

  const handleImportFresh = useCallback((payload: Parameters<typeof handleImport>[0]) => {
    guardUnsavedWork(
      { action: 'Import file', description: 'Importing this file replaces the document you are editing, which has unsaved changes.' },
      () => {
        dropNavmc10132Base();
        handleImport(payload);
      },
    );
  }, [guardUnsavedWork, dropNavmc10132Base, handleImport]);

  const handleLoadDraftFresh = useCallback((id: string) => {
    const name = savedLetters.find(l => l.id === id)?.name;
    guardUnsavedWork(
      { action: 'Load draft', description: `Loading ${name ? `"${name}"` : 'this draft'} replaces the document you are editing, which has unsaved changes.` },
      () => {
        dropNavmc10132Base();
        handleLoadDraft(id);
      },
    );
  }, [guardUnsavedWork, savedLetters, dropNavmc10132Base, handleLoadDraft]);

  // The raw template loader is called here and nowhere else; the guarded
  // wrapper below is what the UI gets.
  const loadTemplateUrlNow = useCallback((url: string) => {
    dropNavmc10132Base();
    return handleLoadTemplateUrl(url);
  }, [dropNavmc10132Base, handleLoadTemplateUrl]);

  const handleLoadTemplateUrlFresh = useCallback((url: string) => {
    guardUnsavedWork(
      { action: 'Load template', description: 'Loading this template replaces the document you are editing, which has unsaved changes.' },
      () => { void loadTemplateUrlNow(url); },
    );
  }, [guardUnsavedWork, loadTemplateUrlNow]);

  const documentImport = useDocumentImport({
    applyImport: applyDocumentImport,
    toast,
    // So the review modal can name what confirming DESTROYS, not only what
    // it creates. See replacementWarning in the hook.
    currentDocumentType: formData.documentType,
    currentFormData: formData as unknown as Record<string, unknown>,
    applyNavmc10132: applyNavmc10132Load,
  });

  /**
   * D.7: picking a template of another document type switches the type
   * first, through the same handleDocumentTypeChange the sidebar uses,
   * so the paragraph template and the type-dependent header fields are
   * set the way the app sets them everywhere else. Loading the template
   * alone left the directive and paper types with a basic letter's
   * single empty paragraph under their own document type.
   *
   * P6-9: a same-type pick over a dirty document used to load with no
   * confirmation at all; both cases now go through the unsaved-work
   * dialog, which names the type switch when there is one.
   */
  const handleTemplatePick = (url: string, templateDocumentType?: string) => {
    const targetType = templateDocumentType || 'basic';
    // E.4: templates name the picker option they belong to, so a
    // same-page template switches to the same-page option.
    const switchesType = targetType !== pickerTypeFor(formData);
    const run = () => {
      if (switchesType) handleDocumentTypeChange(targetType);
      void loadTemplateUrlNow(url);
    };
    if (documentHasContent && (isDirty || switchesType)) {
      setPendingReplace({
        action: 'Load template',
        description: switchesType
          ? `This template is a ${targetType} document. Switching document types replaces the paragraphs you have written, and the document you are editing has unsaved changes.`
          : 'Loading this template replaces the document you are editing, which has unsaved changes.',
        run,
      });
      return;
    }
    run();
  };

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
    fileDeleteIfOwnedBy(fileId, workingCopyDocId).catch((error) => console.error('Enclosure file delete failed', error));
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
    fileDeleteForDoc(workingCopyDocId).catch((error) => console.error('Working-copy file cleanup failed', error));
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
      fileDeleteIfOwnedBy(oldFileId, workingCopyDocId).catch((error) => console.error('Enclosure file delete failed', error));
    }
    // ENC: write-through - the file survives a crash before Save. A
    // failed persist keeps the in-memory binding (export still works)
    // and says so.
    filePut({
      fileId: attachment.id,
      docId: workingCopyDocId,
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
    sharedPending, confirmShared, dismissShared,
  } = useShareLinkLoader({
    handleImport: handleImportFresh,
    toast,
    // EDMS handoff. Scalars only: no subject, no names, no body. See
    // lib/edms-handoff.ts for why the payload is deliberately narrow.
    onEdmsPrefill: (p) => {
      setFormData(prev => ({
        ...prev,
        documentType: p.docType || prev.documentType,
        ssic: p.ssic || prev.ssic,
      }));
      // Units are lazy-loaded, and this runs on mount, so resolveUnit()
      // would read an empty snapshot if called synchronously here.
      void loadUnits().then(() => {
        const unit = resolveUnit(p.ruc);
        if (!unit.line1) return;
        setFormData(prev => ({ ...prev, line1: unit.line1, line2: unit.line2, line3: unit.line3 }));
      });
      toast({
        title: 'Drafting for EDMS',
        description: p.requestId
          ? `Request ${p.requestId}. Export the PDF, then attach it in EDMS.`
          : 'Export the PDF, then attach it to your EDMS request.',
      });
    },
    onComments: (incoming) => {
      setComments(incoming);
      toast({
        title: 'Review Comments Received',
        description: `${incoming.filter((c) => !c.resolved).length} open comment(s) arrived with this document.`,
      });
    },
  });

  // D.8: the landing page's filled example. It routes through
  // handleLoadTemplateUrl, the same fetch-parse-import path the File
  // menu uses for a .nldp, so the example loads exactly as a drafter's
  // own package would.
  const handleLoadExample = useCallback(() => {
    handleLoadTemplateUrlFresh(EXAMPLE_DOCUMENT_URL);
  }, [handleLoadTemplateUrlFresh]);

  // Phase 2: inline compliance issues for the live preview banner. The
  // military dictionary only adds suggested expansions to acronym
  // warnings, so it is fetched once there is body text to scan (B.5);
  // the issues re-derive when it arrives.
  const hasBodyText = paragraphs.some(p => p.content.trim() !== '');
  const { dictionary } = useMilitaryDictionary(hasBodyText);
  const validationIssues = useMemo(
    () => runLetterValidators(formData, vias, references, paragraphs, { dictionary, enclosures }),
    [formData, vias, references, paragraphs, enclosures, dictionary],
  );

  return (
    <ModernAppShell
      validationIssues={validationIssues}
      isDirty={isDirty}
      lastSavedAt={savedMark?.at ?? null}
      documentType={formData.documentType}
      onDocumentTypeChange={handleDocumentTypeChange}
      previewUrl={previewUrl}
      isGeneratingPreview={isGeneratingPreview}
      onExportDocx={() => generateDocument('docx')}
      onGeneratePdf={() => generateDocument('pdf')}
      onSave={saveLetter}
      paragraphs={paragraphs}
      onLoadDraft={handleLoadDraftFresh}
      onImport={handleImportFresh}
      onImportDocument={documentImport.startImport}
      isImportingDocument={documentImport.isProcessing}
      onPasteImport={documentImport.startPasteImport}
      onOpenCommandPalette={() => setPaletteOpen(true)}
      onClearForm={handleClearForm}
      savedLetters={savedLetters}
      onOpenLibrary={() => setShowLibrary(true)}
      onLoadTemplateUrl={handleTemplatePick}
      currentUnitCode={currentUnitCode}
      currentUnitName={currentUnitName}
      onExportNldp={() => setShowExportNldpDialog(true)}
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
        onClearForm={handleClearForm}
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
        onLoadExample={handleLoadExample}
        savedLetters={savedLetters}
        samePageStatus={samePageStatus}
        onAttachSamePageHostFile={handleAttachSamePageHostFile}
        onSelectSamePageHostDraft={handleSelectSamePageHostDraft}
        onClearSamePageHost={handleClearSamePageHost}
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
        onImportText={documentImport.importFromText}
      />
      <ProofreadModal
        open={showProofreadModal}
        onOpenChange={setShowProofreadModal}
        formData={formData}
        paragraphs={paragraphs}
        enclosures={enclosures}
        references={references}
        vias={vias}
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
      <ExportNLDPDialog
        open={showExportNldpDialog}
        onOpenChange={setShowExportNldpDialog}
        onExport={handleExportNldp}
      />
      <DocumentLibraryDialog
        open={showLibrary}
        onOpenChange={setShowLibrary}
        letters={savedLetters}
        onLoad={handleLoadDraftFresh}
        onRename={handleRenameDocument}
        onDuplicate={handleDuplicateDocument}
        onDelete={handleDeleteDocument}
        onSaveCurrent={saveLetter}
        canSaveCurrent={documentHasContent}
      />
      <UnlockShareDialog
        open={hasEncryptedPending}
        onUnlock={unlockEncrypted}
        onDismiss={dismissEncrypted}
      />
      <ConfirmShareDialog
        pending={sharedPending}
        onConfirm={confirmShared}
        onDismiss={dismissShared}
      />
      <RecoveryDialog
        copy={recovery}
        remaining={recoveryRemaining}
        onRestore={handleRestoreRecovery}
        onDiscard={handleDiscardRecovery}
        onLater={laterRecovery}
      />
      <UnsavedWorkDialog
        pending={pendingReplace}
        onConfirm={confirmPendingReplace}
        onDismiss={dismissPendingReplace}
      />
      <RevisionCompareDialog
        open={showCompare}
        onOpenChange={setShowCompare}
        letters={savedLetters}
        onRestore={handleLoadDraftFresh}
      />
      <PackageDialog
        open={showPackage}
        onOpenChange={setShowPackage}
        savedLetters={savedLetters}
        members={pkg.members}
        sequences={pkg.sequences}
        issues={pkg.issues}
        busy={pkg.busy}
        fits={pkg.fits}
        onAdd={pkg.add}
        onRemove={pkg.remove}
        onMove={pkg.move}
        onClear={pkg.clear}
        onMeasure={pkg.measure}
        onExport={pkg.exportPackage}
      />
      <ComplianceDialog
        open={showCompliance}
        onOpenChange={(next) => {
          setShowCompliance(next);
          if (!next) setExportBlockers(null);
        }}
        issues={exportBlockers ?? validationIssues}
        onFix={handleFixIssue}
        onFixAll={handleFixAll}
        onJumpToField={(field) => {
          setShowCompliance(false);
          setExportBlockers(null);
          focusDocumentField(field);
        }}
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
      <GunnyBotPanel />
      <GunnyBotRuntime />
      <ExportScanGate />
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
