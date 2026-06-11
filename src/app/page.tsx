'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { ParagraphData, SavedLetter, ValidationState, FormData, AdminSubsections, ReportData } from '@/types';
import { ModernAppShell } from '@/components/layout/ModernAppShell';
import { DocumentLayout } from '@/components/document/DocumentLayout';
import { UNITS } from '@/lib/units';
import { getTodaysDate } from '@/lib/date-utils';
import { getMCOParagraphs, getMCBulParagraphs, getSecnavInstructionParagraphs, getSecnavNoticeParagraphs, getMOAParagraphs, getStaffingPaperParagraphs, getInformationPaperParagraphs, getExportFilename, mergeAdminSubsections } from '@/lib/naval-format-utils';
import { validateSSIC, validateSubject, validateFromTo } from '@/lib/validation-utils';
import { loadSavedLetters, saveLetterToStorage } from '@/lib/storage-utils';
import { getPDFPageCount, addMultipleSignaturesToBlob, ManualSignaturePosition } from '@/lib/pdf-generator';
import { generateDocxBlob } from '@/lib/docx-generator';
import { getExportBlockers, runLetterValidators, secnavPageCapIssue } from '@/lib/letter-validators';
import { SignaturePosition } from '@/types';
import { configureConsole, debugUserAction, debugFormChange } from '@/lib/console-utils';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { AMHSPreview } from '@/components/amhs/AMHSPreview';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { downloadDocument } from '@/services/export/index';
import { useToast } from '@/hooks/use-toast';
import { getStateFromUrl, clearShareParam, SignatureRouting } from '@/lib/url-state';
import { SignatureCeremonyPanel } from '@/components/signature/SignatureCeremonyPanel';
import { addSignatureField, addMultipleSignatureFields } from '@/lib/pdf-signature-field';
import { generateShareableUrl, copyToClipboard } from '@/lib/url-state';
import { useParagraphs } from '@/hooks/useParagraphs';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useImportExport } from '@/hooks/useImportExport';
import { ProofreadModal } from '@/components/ProofreadModal';
import { BatchGenerateModal } from '@/components/BatchGenerateModal';
import { SettingsDialog } from '@/components/SettingsDialog';
import { useUserProfile } from '@/hooks/useUserProfile';
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
    line1: '', line2: '', line3: '', ssic: '', originatorCode: '', date: '', from: '', to: '', subj: '', sig: '', delegationText: '',
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

  // Preview State
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

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

  // Signature placement state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signaturePdfBlob, setSignaturePdfBlob] = useState<Blob | null>(null);
  const [signaturePdfPageCount, setSignaturePdfPageCount] = useState(1);

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
      const unit = UNITS.find(u => u.ruc === profile.unitRuc);
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

  // Manual Preview Generation
  const handleUpdatePreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      const features = DOCUMENT_TYPES[formData.documentType]?.features;
      const isStaffingPaper = features?.category === 'staffing-papers';
      if (features?.pdfPipeline === 'standard' && !isStaffingPaper && !formData.subj && !formData.from) {
        setIsGeneratingPreview(false);
        return;
      }

      const blob = await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });

      const url = URL.createObjectURL(blob);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      console.error("Preview generation failed", e);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [formData, vias, references, enclosures, copyTos, paragraphs, distList]);

  // Auto-refresh preview when form data changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      handleUpdatePreview();
    }, 1500);
    return () => clearTimeout(timer);
  }, [handleUpdatePreview]);

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

  // Signature placement workflow handlers
  const handleOpenSignaturePlacement = async () => {
    try {
      const blob = await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
      const pageCount = await getPDFPageCount(blob);
      setSignaturePdfBlob(blob);
      setSignaturePdfPageCount(pageCount);
      setShowSignatureModal(true);
    } catch (error) {
      console.error('Error preparing signature placement:', error);
      alert('Failed to prepare PDF for signature placement.');
    }
  };

  // S2c (ruling 2026-06-10): the ORIGINATOR configures fields; confirm
  // persists them on the document — no download here. They travel with
  // the share link, drafts, and .nldp exports inside formData.
  const handleSignatureConfirm = (positions: SignaturePosition[]) => {
    setShowSignatureModal(false);
    setSignaturePdfBlob(null);
    setFormData(prev => ({ ...prev, signatureFields: positions }));
    toast({
      title: 'Signature fields saved',
      description: `${positions.length} field${positions.length === 1 ? '' : 's'} configured. Download the sign-ready PDF or copy a signature request link from the Signature Fields section.`,
    });
  };

  // S2c: sign-ready PDF using the configured fields (falls back to the
  // auto-anchored S1 field when none are configured).
  const buildSignReadyBlob = useCallback(async (): Promise<Blob> => {
    const blockers = getExportBlockers(formData, vias, references, paragraphs);
    if (blockers.length > 0) {
      throw new Error('Export blocked: ' + blockers.map((b) => b.rule).join('; '));
    }
    const base = await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
    const fields = (formData.signatureFields as SignaturePosition[] | undefined) ?? [];
    const bytes = fields.length > 0
      ? await addMultipleSignatureFields(await base.arrayBuffer(), fields.map(f => ({
          page: f.page, x: f.x, y: f.y, width: f.width, height: f.height,
          signerName: f.signerName, reason: f.reason, contactInfo: f.contactInfo,
        })))
      : await addSignatureField(await base.arrayBuffer(), { signerName: formData.sig });
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  }, [formData, vias, references, enclosures, copyTos, paragraphs, distList]);

  const handleDownloadSignReady = async () => {
    try {
      const blob = await buildSignReadyBlob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getExportFilename(formData, 'pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating sign-ready PDF:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate the sign-ready PDF.');
    }
  };

  // S2c: request link = share state v2; the e-mail carries the who/
  // when/where (ruling: no routing form fields).
  const handleCopySignatureRequest = async () => {
    const fields = (formData.signatureFields as SignaturePosition[] | undefined) ?? [];
    const { url, isLong, error } = generateShareableUrl({
      formData, paragraphs, references, enclosures, vias, copyTos, distList,
      routing: { requestedSigner: fields[0]?.signerName || formData.sig || '' },
      version: 2,
    });
    if (error && !url) {
      toast({ title: 'Failed to build link', description: error, variant: 'destructive' });
      return;
    }
    const ok = await copyToClipboard(url);
    toast(ok
      ? {
          title: 'Signature request link copied',
          description: (isLong ? 'Link is very long and may not work everywhere. ' : '') +
            'Paste it into your request e-mail. The link contains the full letter text — send it only through channels appropriate for the content.',
        }
      : { title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
  };

  const handleSignatureCancel = () => {
    setShowSignatureModal(false);
    setSignaturePdfBlob(null);
  };

  const generateDocument = async (format: 'docx' | 'pdf') => {
    // HARD EXPORT GATE (M-5216.5 Fig 7-3; audit line 69): window
    // envelope violations refuse export — a validator, not a warning.
    const blockers = getExportBlockers(formData, vias, references, paragraphs);
    if (blockers.length > 0) {
      alert(
        'Export blocked:\n\n' +
        blockers.map((b) => `- ${b.rule}\n  ${b.detail}\n  [${b.citation}]`).join('\n'),
      );
      return;
    }
    try {
      // Route I-Type documents through unified export
      if (formData.documentType === 'i-type') {
        await downloadDocument(formData.documentType, formData, format);
        return;
      }

      // P4.3 — SECNAV 5-page text cap, HARD BLOCK (SECNAV M-5215.1;
      // audit lines 85, 115). The PDF engine is the shared paginator:
      // its page count is the verdict for BOTH formats — DOCX is not
      // re-counted (divergence guard). The counted blob is reused for
      // PDF export so the gated artifact is the downloaded artifact.
      let secnavCountedBlob: Blob | null = null;
      if (formData.documentType === 'secnav-instruction' || formData.documentType === 'secnav-notice') {
        secnavCountedBlob = await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
        const capIssue = secnavPageCapIssue(formData.documentType, await getPDFPageCount(secnavCountedBlob));
        if (capIssue) {
          alert(`Export blocked:\n\n- ${capIssue.rule}\n  ${capIssue.detail}\n  [${capIssue.citation}]`);
          return;
        }
      }

      // Route other document types through existing pipeline
      let blob: Blob;

      if (format === 'pdf') {
        blob = secnavCountedBlob ?? await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
      } else {
        const features = DOCUMENT_TYPES[formData.documentType]?.features;
        const paragraphsToRender = features?.isDirective
          ? mergeAdminSubsections(paragraphs, formData.adminSubsections)
          : paragraphs;

        blob = await generateDocxBlob(formData, vias, references, enclosures, copyTos, paragraphsToRender, distList);
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getExportFilename(formData, format);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error generating ${format.toUpperCase()}:`, error);
      alert(`Failed to generate ${format.toUpperCase()}. Please check the console for details.`);
    }
  };

  const handleClearForm = () => {
      if (window.confirm('Are you sure you want to clear the form? All unsaved progress will be lost.')) {
        const currentType = formData.documentType;
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
            line1: defaults.line1, line2: defaults.line2, line3: defaults.line3,
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
      }
  };

  const handleClearSavedLetters = () => {
    localStorage.removeItem('navalLetters');
    setSavedLetters([]);
  };

  // S2: routing slip arriving on a request-for-signature link
  const [routingRequest, setRoutingRequest] = useState<SignatureRouting | null>(null);

  // Load shared state from URL on mount
  useEffect(() => {
    const sharedState = getStateFromUrl();
    if (sharedState) {
      handleImport(sharedState);
      clearShareParam();
      if (sharedState.routing) {
        setRoutingRequest(sharedState.routing);
        toast({
          title: "Signature requested",
          description: `This link asks ${sharedState.routing.requestedSigner || 'you'} to sign. Follow the steps at the top of the page.`,
        });
      } else {
        toast({
          title: "Document Loaded",
          description: "Shared document has been loaded. You can view and edit it.",
        });
      }
    }
  }, []);



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
      onClearForm={handleClearForm}
      savedLetters={savedLetters}
      onLoadTemplateUrl={handleLoadTemplateUrl}
      currentUnitCode={currentUnitCode}
      currentUnitName={currentUnitName}
      onExportNldp={handleExportNldp}
      onShareLink={handleShareLink}
      onUpdatePreview={handleUpdatePreview}
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
      <DocumentLayout
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
        onDownloadSignReady={handleDownloadSignReady}
        onCopySignatureRequest={handleCopySignatureRequest}
        showSignatureModal={showSignatureModal}
        handleSignatureCancel={handleSignatureCancel}
        handleSignatureConfirm={handleSignatureConfirm}
        signaturePdfBlob={signaturePdfBlob}
        signaturePdfPageCount={signaturePdfPageCount}
        handleDynamicFormSubmit={handleDynamicFormSubmit}
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
