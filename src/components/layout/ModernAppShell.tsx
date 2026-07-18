import React from 'react';
import Link from 'next/link';
import { Menu, Eye } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { LivePreview } from './LivePreview';
import { HeaderActions } from './HeaderActions';
import { PreviewModal } from './PreviewModal';
import { ParagraphData, SavedLetter, FormData } from '@/types';
import { getBasePath } from '@/lib/path-utils';
import { getExportFilename } from '@/lib/naval-format-utils';
import { FEEDBACK_URL } from '@/lib/app-links';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface ModernAppShellProps {
  children: React.ReactNode;
  documentType: string;
  onDocumentTypeChange: (type: string) => void;
  previewUrl?: string;
  validationIssues?: import('./LivePreview').PreviewIssue[];
  isGeneratingPreview?: boolean;
  onExportDocx: () => void;
  onGeneratePdf: () => void;
  onSave: () => void;
  paragraphs?: ParagraphData[];
  // New props for HeaderActions
  onLoadDraft: (id: string) => void;
  onImport: (data: any) => void;
  onImportDocument?: (file: File) => void;
  isImportingDocument?: boolean;
  onClearForm: () => void;
  savedLetters: SavedLetter[];
  /** P1.2: opens the document library dialog */
  onOpenLibrary?: () => void;
  onLoadTemplateUrl: (url: string) => void;
  currentUnitCode?: string;
  currentUnitName?: string;
  onExportNldp: () => void;
  onUpdatePreview: () => void;
  customRightPanel?: React.ReactNode;
  // AMHS Actions
  onCopyAMHS?: () => void;
  onExportAMHS?: () => void;
  // Share link
  onShareLink?: () => void;
  // For mobile preview modal
  formData?: FormData;
  onAddSignature?: () => void;
  onBatchGenerate?: () => void;
  onProofread?: () => void;
  /** R5: opens the compliance issues + autofix dialog */
  onCompliance?: () => void;
  /** R2: opens the revision compare dialog */
  onCompare?: () => void;
  /** R4: opens the package assembly dialog */
  onPackage?: () => void;
  /** P3.1 / P3.3 / P3.2 */
  onFindReplace?: () => void;
  onGuide?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onSettings?: () => void;
  isDirty?: boolean;
  lastSavedAt?: Date | null;
}

export function ModernAppShell({
  children,
  documentType,
  onDocumentTypeChange,
  previewUrl,
  validationIssues,
  isGeneratingPreview,
  onExportDocx,
  onGeneratePdf,
  onSave,
  paragraphs,
  onLoadDraft,
  onImport,
  onImportDocument,
  isImportingDocument,
  onClearForm,
  savedLetters,
  onOpenLibrary,
  onLoadTemplateUrl,
  currentUnitCode,
  currentUnitName,
  onExportNldp,
  onUpdatePreview,
  customRightPanel,
  onCopyAMHS,
  onExportAMHS,
  onShareLink,
  formData,
  onAddSignature,
  onBatchGenerate,
  onProofread,
  onCompliance,
  onCompare,
  onPackage,
  onFindReplace,
  onGuide,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSettings,
  isDirty,
  lastSavedAt,
}: ModernAppShellProps) {
  const [showPreview, setShowPreview] = React.useState(true);
  const [showPreviewModal, setShowPreviewModal] = React.useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = React.useState(false);
  const [logoSrc, setLogoSrc] = React.useState('/logo.png');

  React.useEffect(() => {
    // Get basePath on client-side for proper logo loading
    const basePath = getBasePath();
    setLogoSrc(`${basePath}/logo.png`);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* F3 (SECTION_508_FINDINGS): skip link - first focusable element */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:shadow-lg"
      >
        Skip to document form
      </a>

      {/* Persistent compliance banner. Maps to COMPLIANCE_REMEDIATION_PLAN.md Phase 4 P4-1. */}
      <div
        role="alert"
        aria-live="polite"
        className="bg-yellow-400 text-black border-b-2 border-yellow-600 px-4 py-1.5 text-xs sm:text-sm shrink-0 z-30 text-center"
      >
        <strong className="font-bold uppercase mr-2">Warning</strong>
        Non-official Proof of Concept. Do not enter CUI, PII, or other sensitive information. Outputs constitute Federal records under 44 USC 3301 when used in official business. Route through your CDRM.
        <Link href="/privacy" className="ml-2 underline font-semibold hover:no-underline">Privacy and Security Notice</Link>
      </div>
      {/* Top Header / Toolbar */}
      <header className="h-16 bg-secondary text-primary-foreground border-b border-secondary-foreground/10 flex items-center justify-between px-4 z-20 shrink-0 shadow-md">
        <div className="flex items-center space-x-4">
          {/* Mobile-only hamburger. Opens the Sidebar as a slide-out drawer below the md breakpoint. */}
          <button
            type="button"
            onClick={() => setShowMobileSidebar(true)}
            className="md:hidden inline-flex items-center justify-center h-10 w-10 -ml-2 rounded-md text-primary-foreground hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Open document menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-primary/50 shadow-sm bg-white/10">
              <img
                src={logoSrc}
                alt="USMC Seal"
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            </div>
            
            <div className="flex flex-col">
              <h1 className="text-primary font-bold text-lg leading-tight tracking-tight font-headline">Semper Scribe</h1>
            </div>
          </div>

          <div className="h-8 w-px bg-primary-foreground/20 hidden sm:block mx-2"></div>

          <div className="hidden sm:flex items-center space-x-2 text-sm">
            <span className="px-2 py-1 rounded bg-primary text-primary-foreground font-medium border border-primary-foreground/20 text-xs shadow-sm">
              {documentType === 'navmc10274' ? 'AA FORM' : (documentType ? documentType.toUpperCase() : 'HOME')}
            </span>
            {documentType && (
              <>
                <span className="text-primary-foreground/50">/</span>
                {isDirty ? (
                  <span className="text-amber-300 font-medium text-xs flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Unsaved
                  </span>
                ) : lastSavedAt ? (
                  <span className="text-emerald-300 font-medium text-xs flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Saved
                  </span>
                ) : (
                  <span className="text-primary-foreground/70 font-medium text-xs">Draft</span>
                )}
              </>
            )}
          </div>
        </div>

        <HeaderActions
            className="text-primary-foreground"
            documentType={documentType}
            onSave={onSave}
            onLoadDraft={onLoadDraft}
            onImport={onImport}
            onImportDocument={onImportDocument}
            isImportingDocument={isImportingDocument}
            onExportDocx={onExportDocx}
            onGeneratePdf={onGeneratePdf}
            onClearForm={onClearForm}
            savedLetters={savedLetters}
            onOpenLibrary={onOpenLibrary}
            onLoadTemplateUrl={onLoadTemplateUrl}
            currentUnitCode={currentUnitCode}
            currentUnitName={currentUnitName}
            isGenerating={isGeneratingPreview}
            onExportNldp={onExportNldp}
            onShareLink={documentType ? onShareLink : undefined}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
            onOpenPreviewModal={documentType ? () => setShowPreviewModal(true) : undefined}
            onCopyAMHS={onCopyAMHS}
            onExportAMHS={onExportAMHS}
            onAddSignature={onAddSignature}
            onBatchGenerate={onBatchGenerate}
            onProofread={onProofread}
            onCompliance={onCompliance}
            onCompare={onCompare}
            onPackage={onPackage}
            onFindReplace={onFindReplace}
            onGuide={onGuide}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            onSettings={onSettings}
          />
      </header>

      {/* Main Content Area (3-Pane Grid) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Sidebar - desktop only. Hidden below md to free horizontal space on phones. */}
        <Sidebar
          documentType={documentType}
          onDocumentTypeChange={onDocumentTypeChange}
          paragraphs={paragraphs}
          formData={formData as Record<string, any>}
        />

        {/* Mobile slide-out drawer hosting the same Sidebar. Closes automatically on selection. */}
        <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
          <SheetContent side="left" className="p-0 w-80 max-w-[85vw] md:hidden">
            <div className="h-full overflow-hidden">
              <Sidebar
                className="!flex w-full border-r-0"
                documentType={documentType}
                onDocumentTypeChange={onDocumentTypeChange}
                paragraphs={paragraphs}
                formData={formData as Record<string, any>}
                onItemSelect={() => setShowMobileSidebar(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Center Pane: Editor */}
        {/* F2 (SECTION_508_FINDINGS): app/layout.tsx owns the main
            landmark - this is a labeled region, not a second main. */}
        <div id="main-content" tabIndex={-1} role="region" aria-label="Document form" className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-6 lg:p-8 relative scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6 pb-8">
             {children}
          </div>
        </div>

        {/* Right Pane: Live Preview or Custom Panel */}
        {showPreview && documentType && (
          customRightPanel ? (
            <aside className="w-[45%] max-w-[900px] min-w-[500px] bg-muted/20 border-l border-border hidden xl:flex flex-col h-full overflow-hidden">
              <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</h3>
              </div>
              <div className="flex-1 overflow-y-auto relative bg-muted/40">
                {customRightPanel}
              </div>
            </aside>
          ) : (
            <LivePreview
              issues={validationIssues}
              onOpenIssues={onCompliance}
              previewUrl={previewUrl}
              isLoading={isGeneratingPreview}
              onUpdatePreview={onUpdatePreview}
              documentType={documentType}
              downloadFileName={formData ? getExportFilename(formData, 'pdf') : undefined}
              onDownloadExport={onGeneratePdf}
            />
          )
        )}
      </div>

      {/* P4.5: floating preview button - phones and tablets have no
          preview pane (hidden below xl), this opens the modal. */}
      {documentType && (
        <button
          type="button"
          onClick={() => setShowPreviewModal(true)}
          className="xl:hidden fixed bottom-16 right-4 z-40 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Open document preview"
        >
          <Eye className="w-4 h-4" /> Preview
        </button>
      )}

      {/* Compliance footer. Maps to COMPLIANCE_REMEDIATION_PLAN.md Phase 4 P4-2. */}
      <footer className="shrink-0 border-t bg-muted/40 text-muted-foreground text-xs px-4 py-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span>SemperScribe non-official Proof of Concept.</span>
        <Link href="/privacy" className="underline hover:no-underline">Privacy and Security Notice</Link>
        <a href="https://github.com/SemperAdmin/semperscribe/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Security disclosure</a>
        <a href="https://github.com/SemperAdmin/semperscribe/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">License (MIT)</a>
        <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Send Feedback</a>
      </footer>

      {/* Mobile Preview Modal */}
      <PreviewModal
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        documentType={documentType}
        formData={formData}
        amhsReferences={formData?.amhsReferences}
        previewUrl={previewUrl}
        isLoading={isGeneratingPreview}
        onUpdatePreview={onUpdatePreview}
      />
    </div>
  );
}
