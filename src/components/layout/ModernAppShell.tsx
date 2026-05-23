import React from 'react';
import { Sidebar } from './Sidebar';
import { LivePreview } from './LivePreview';
import { HeaderActions } from './HeaderActions';
import { PreviewModal } from './PreviewModal';
import { ParagraphData, SavedLetter, FormData } from '@/types';
import { getBasePath } from '@/lib/path-utils';

interface ModernAppShellProps {
  children: React.ReactNode;
  documentType: string;
  onDocumentTypeChange: (type: string) => void;
  previewUrl?: string;
  isGeneratingPreview?: boolean;
  onExportDocx: () => void;
  onGeneratePdf: () => void;
  onSave: () => void;
  paragraphs?: ParagraphData[];
  // New props for HeaderActions
  onLoadDraft: (id: string) => void;
  onImport: (data: any) => void;
  onClearForm: () => void;
  savedLetters: SavedLetter[];
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
  onSettings?: () => void;
  isDirty?: boolean;
  lastSavedAt?: Date | null;
}

export function ModernAppShell({
  children,
  documentType,
  onDocumentTypeChange,
  previewUrl,
  isGeneratingPreview,
  onExportDocx,
  onGeneratePdf,
  onSave,
  paragraphs,
  onLoadDraft,
  onImport,
  onClearForm,
  savedLetters,
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
  onSettings,
  isDirty,
  lastSavedAt,
}: ModernAppShellProps) {
  const [showPreview, setShowPreview] = React.useState(true);
  const [showPreviewModal, setShowPreviewModal] = React.useState(false);
  const [logoSrc, setLogoSrc] = React.useState('/logo.png');

  React.useEffect(() => {
    // Get basePath on client-side for proper logo loading
    const basePath = getBasePath();
    setLogoSrc(`${basePath}/logo.png`);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Persistent compliance banner. Maps to COMPLIANCE_REMEDIATION_PLAN.md Phase 4 P4-1. */}
      <div
        role="alert"
        aria-live="polite"
        className="bg-yellow-400 text-black border-b-2 border-yellow-600 px-4 py-1.5 text-xs sm:text-sm shrink-0 z-30 text-center"
      >
        <strong className="font-bold uppercase mr-2">Warning</strong>
        Non-official Proof of Concept. Do not enter CUI, PII, or other sensitive information. Outputs constitute Federal records under 44 USC 3301 when used in official business. Route through your CDRM.
      </div>
      {/* Top Header / Toolbar */}
      <header className="h-16 bg-secondary text-primary-foreground border-b border-secondary-foreground/10 flex items-center justify-between px-4 z-20 shrink-0 shadow-md">
        <div className="flex items-center space-x-4">
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
            onExportDocx={onExportDocx}
            onGeneratePdf={onGeneratePdf}
            onClearForm={onClearForm}
            savedLetters={savedLetters}
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
            onSettings={onSettings}
          />
      </header>

      {/* Main Content Area (3-Pane Grid) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Sidebar */}
        <Sidebar
          documentType={documentType}
          onDocumentTypeChange={onDocumentTypeChange}
          paragraphs={paragraphs}
          formData={formData as Record<string, any>}
        />

        {/* Center Pane: Editor */}
        <main className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-6 lg:p-8 relative scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6 pb-8">
             {children}
          </div>
        </main>

        {/* Right Pane: Live Preview or Custom Panel */}
        {showPreview && documentType && (
          customRightPanel ? (
            customRightPanel
          ) : (
            <LivePreview
              previewUrl={previewUrl}
              isLoading={isGeneratingPreview}
              onUpdatePreview={onUpdatePreview}
              documentType={documentType}
            />
          )
        )}
      </div>

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
