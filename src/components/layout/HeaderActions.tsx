import React, { useRef } from 'react';
import {
  FileText,
  FileUp,
  Download,
  Save,
  FolderOpen,
  Upload,
  Trash2,
  File,
  ChevronDown,
  Search,
  Filter,
  ClipboardPaste,
  LayoutTemplate,
  Eye,
  EyeOff,
  Link2,
  FileSpreadsheet,
  ClipboardCheck,
  Settings,
  MessageSquare,
  Undo2,
  Redo2,
  Replace,
  BookOpen,
  BadgeCheck,
  GitCompare,
  Layers,
  Bot,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FEEDBACK_URL } from '@/lib/app-links';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SavedLetter } from '@/types';
import { useTemplates, templateMatchesDocumentType, Template } from '@/hooks/useTemplates';
import { useGunnyStore } from '@/store/gunnyStore';

interface TemplateListProps {
  templates: Template[];
  onSelect: (template: Template) => void;
  /** The document type on screen, so each card states whether it matches. */
  documentType?: string;
  /** Shown in the empty state, so a hidden filter is never the dead end. */
  typeFilterOn: boolean;
}

function TemplateList({ templates, onSelect, documentType, typeFilterOn }: TemplateListProps) {
  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {typeFilterOn
          ? 'No templates of this document type match. Turn off "Matches this document type" to search every template.'
          : 'No templates found matching your criteria.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
      {templates.map(template => {
        const matchesType = Boolean(documentType) && templateMatchesDocumentType(template, documentType!);
        return (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="flex flex-col items-start p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
          >
            <div className="font-medium text-foreground group-hover:text-primary">
              {template.title}
            </div>
            {template.description && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {template.description}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {documentType && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-normal',
                    matchesType
                      ? 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {matchesType
                    ? 'Matches this document type'
                    : `Switches to ${template.documentType || 'basic'}`}
                </Badge>
              )}
              {template.unitName && (
                <Badge variant="secondary" className="text-[10px] font-normal bg-secondary/10 text-secondary border border-secondary/20">
                  {template.unitName}
                </Badge>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface HeaderActionsProps {
  onSave: () => void;
  onLoadDraft: (id: string) => void;
  /** P1.2: opens the document library dialog */
  onOpenLibrary?: () => void;
  onImport: (data: any) => void;
  onImportDocument?: (file: File) => void;
  isImportingDocument?: boolean;
  /** R11 (D.7): opens the import review modal on its paste step. */
  onPasteImport?: () => void;
  onExportDocx: () => void;
  onGeneratePdf: () => void;
  onClearForm: () => void;
  savedLetters: SavedLetter[];
  /** D.7: the picked template's document type rides along with its url. */
  onLoadTemplateUrl: (url: string, templateDocumentType?: string) => void;
  documentType: string;
  currentUnitCode?: string;
  currentUnitName?: string;
  isGenerating?: boolean;
  onExportNldp?: () => void;
  onShareLink?: () => void;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  onOpenPreviewModal?: () => void;
  className?: string;
  // AMHS Actions
  onCopyAMHS?: () => void;
  onExportAMHS?: () => void;
  // Signature
  onAddSignature?: () => void;
  // Batch Generate
  onBatchGenerate?: () => void;
  // Proofread
  onProofread?: () => void;
  // R5: compliance issues + autofix
  onCompliance?: () => void;
  // R2: revision compare
  onCompare?: () => void;
  // R4: package assembly
  onPackage?: () => void;
  // P3: find/replace, guide, undo/redo
  onFindReplace?: () => void;
  onGuide?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  // Settings
  onSettings?: () => void;
}

export function HeaderActions({
  onSave,
  onLoadDraft,
  onOpenLibrary,
  onImport,
  onImportDocument,
  isImportingDocument,
  onPasteImport,
  onExportDocx,
  onGeneratePdf,
  onClearForm,
  savedLetters,
  onLoadTemplateUrl,
  documentType,
  currentUnitCode,
  currentUnitName,
  isGenerating,
  onExportNldp,
  onShareLink,
  showPreview,
  onTogglePreview,
  onOpenPreviewModal,
  className,
  onCopyAMHS,
  onExportAMHS,
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
  onSettings
}: HeaderActionsProps) {
  const {
    globalTemplates,
    unitTemplates,
    globalTotal,
    unitTotal,
    typeFilterOn,
    setTypeFilterOn,
    typeMatchCount,
    searchQuery,
    setSearchQuery,
  } = useTemplates({ documentType, currentUnitCode, currentUnitName });

  // GunnyBot opens from the store, the same wiring the header bot button used
  // before the regrouping. No prop and no ModernAppShell change needed.
  const openGunnyBot = useGunnyStore((s) => s.setPanelOpen);

  // Helper to merge classes for buttons
  const buttonClass = (baseClass: string) => cn(baseClass, className ? "text-secondary-foreground hover:text-primary hover:bg-white/10" : "text-muted-foreground hover:text-foreground");

  const [isTemplateOpen, setIsTemplateOpen] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportDocumentClick = () => {
    documentInputRef.current?.click();
  };

  const handleDocumentFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportDocument?.(file);
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        onImport(data);
      } catch (error) {
        console.error('Failed to parse imported file', error);
        alert('Failed to parse file. Please ensure it is a valid .nldp or .json file.');
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000; // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  // D.7: the template's own document type travels with the pick, so the
  // page switches the type through its normal path before loading a
  // template from another type.
  const handleTemplateSelect = (template: Template) => {
    onLoadTemplateUrl(template.url, template.documentType || 'basic');
    setIsTemplateOpen(false);
  };

  // Review always offers GunnyBot Review; the document checks gate on their
  // own handlers. hasOtherReview drives the divider above GunnyBot Review.
  const hasOtherReview = Boolean(onProofread || onCompliance || onCompare || onFindReplace || onGuide);

  return (
    <div className="flex items-center gap-1 sm:gap-2 min-w-0 overflow-x-auto md:overflow-visible">
      {/* Hidden file inputs. These must live OUTSIDE the dropdown menu:
          Radix unmounts DropdownMenuContent when the menu closes, and
          clicking an import item closes the menu while the OS file
          picker is still open — an input inside the content would be
          detached by selection time and its change event lost. */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".nldp,.json"
      />
      <input
        type="file"
        ref={documentInputRef}
        onChange={handleDocumentFileChange}
        className="hidden"
        accept=".docx,.pdf"
      />

      {/* Templates Dialog */}
      <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="hidden md:flex text-muted-foreground hover:text-foreground">
            <LayoutTemplate className="w-4 h-4 mr-2" />
            Templates
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Browse Templates</DialogTitle>
            <DialogDescription>
              Select a template to start a new document.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center space-x-2 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search templates..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-background border-input"
            />
          </div>

          {/* D.7: the type filter, visible and reversible. It used to run
              silently, which left 68 of the 69 shipped templates
              unreachable from a basic letter with nothing on screen
              saying so. */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <button
              type="button"
              role="switch"
              aria-checked={typeFilterOn}
              disabled={!documentType}
              onClick={() => setTypeFilterOn(on => !on)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50',
                typeFilterOn
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Filter className="w-3 h-3" />
              Matches this document type
            </button>
            <p className="text-xs text-muted-foreground" data-testid="template-filter-label">
              {typeFilterOn && documentType
                ? `Showing ${globalTemplates.length + unitTemplates.length} of ${globalTotal + unitTotal}, filtered to ${documentType}.`
                : `Showing ${globalTemplates.length + unitTemplates.length} of ${globalTotal + unitTotal}, every document type.`}
              {documentType && (
                <span> {typeMatchCount} match this document type.</span>
              )}
            </p>
          </div>

          <Tabs defaultValue="global" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="global">Standard Templates ({globalTemplates.length})</TabsTrigger>
              <TabsTrigger value="unit">Unit Templates ({unitTemplates.length})</TabsTrigger>
            </TabsList>
            
            {/* Native overflow scrolling - the Radix ScrollArea here
                stopped scrolling once the list outgrew the dialog
                (26+ templates). A plain overflow-y div cannot fail. */}
            <div className="flex-1 min-h-0 mt-4 max-h-[55vh] overflow-y-auto pr-2">
              <TabsContent value="global" className="mt-0">
                <TemplateList
                  templates={globalTemplates}
                  onSelect={handleTemplateSelect}
                  documentType={documentType}
                  typeFilterOn={typeFilterOn}
                />
              </TabsContent>
              <TabsContent value="unit" className="mt-0">
                <TemplateList
                  templates={unitTemplates}
                  onSelect={handleTemplateSelect}
                  documentType={documentType}
                  typeFilterOn={typeFilterOn}
                />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* P3.2: undo/redo */}
      {onUndo && onRedo && (
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="h-4 w-px bg-border hidden md:block mx-2"></div>

      {/* File Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-foreground">
            <File className="w-4 h-4 mr-2 hidden sm:inline-flex" />
            File
            <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border text-card-foreground">
          <DropdownMenuLabel>Working project</DropdownMenuLabel>
          <DropdownMenuItem onClick={onSave} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </DropdownMenuItem>
          
          {onOpenLibrary && (
            <DropdownMenuItem onClick={onOpenLibrary} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <FolderOpen className="w-4 h-4 mr-2" />
              Document Library...
            </DropdownMenuItem>
          )}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <FolderOpen className="w-4 h-4 mr-2" />
              Open Saved...
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64 max-h-[300px] overflow-y-auto bg-card border-border text-card-foreground">
               {savedLetters.length === 0 ? (
                 <div className="p-2 text-xs text-muted-foreground text-center">No saved drafts</div>
               ) : (
                 savedLetters.map((letter) => (
                   <DropdownMenuItem key={letter.id} onClick={() => onLoadDraft(letter.id)} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                     <div className="flex flex-col gap-0.5">
                       <span className="font-medium truncate max-w-[200px]">{'subj' in letter ? (letter.subj as string) || 'Untitled' : 'Untitled'}</span>
                       <span className="text-[10px] text-muted-foreground">{formatTimeAgo(letter.savedAt)}</span>
                     </div>
                   </DropdownMenuItem>
                 ))
               )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator className="bg-border" />
          
          <DropdownMenuItem onClick={handleImportClick} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Upload className="w-4 h-4 mr-2" />
            Import Data Package (.nldp)
          </DropdownMenuItem>

          {onImportDocument && (
            <DropdownMenuItem onClick={handleImportDocumentClick} disabled={isImportingDocument} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <FileUp className="w-4 h-4 mr-2" />
              {isImportingDocument ? 'Reading Document...' : 'Import Word/PDF Document...'}
            </DropdownMenuItem>
          )}

          {/* R11 (D.7): the same extraction pipeline, reached by pasting
              letter text from an email instead of opening a file. */}
          {onPasteImport && (
            <DropdownMenuItem onClick={onPasteImport} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <ClipboardPaste className="w-4 h-4 mr-2" />
              Paste Text to Import...
            </DropdownMenuItem>
          )}


          <DropdownMenuSeparator className="bg-border" />

          <DropdownMenuItem onClick={onClearForm} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Form
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Review Menu - the old "Actions" catch-all, narrowed to check-and-
          refine operations. Preview toggle, package, settings, and feedback
          all moved out. GunnyBot Review always shows, so the menu always
          renders. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex px-2 sm:px-3",
              className ? "text-secondary-foreground hover:text-primary hover:bg-white/10" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ClipboardCheck className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Review</span>
            <ChevronDown className="w-3 h-3 ml-1 opacity-50 hidden sm:inline-flex" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border text-card-foreground">
          <DropdownMenuLabel>Check and refine</DropdownMenuLabel>
          {onProofread && (
            <DropdownMenuItem onClick={onProofread} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Proofread
            </DropdownMenuItem>
          )}
          {onCompliance && (
            <DropdownMenuItem onClick={onCompliance} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <BadgeCheck className="w-4 h-4 mr-2" />
              Compliance Issues
            </DropdownMenuItem>
          )}
          {onCompare && (
            <DropdownMenuItem onClick={onCompare} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <GitCompare className="w-4 h-4 mr-2" />
              Compare Revisions
            </DropdownMenuItem>
          )}
          {onFindReplace && (
            <DropdownMenuItem onClick={onFindReplace} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Replace className="w-4 h-4 mr-2" />
              Find and Replace
            </DropdownMenuItem>
          )}
          {onGuide && (
            <DropdownMenuItem onClick={onGuide} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              Correspondence Guide
            </DropdownMenuItem>
          )}
          {hasOtherReview && <DropdownMenuSeparator className="bg-border" />}
          <DropdownMenuItem onClick={() => openGunnyBot(true)} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Bot className="w-4 h-4 mr-2" />
            GunnyBot Review
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Export - every produce-an-output action: rendered documents, the
          editable data files pulled from File, batch, and the distribution
          actions pulled from the removed Share menu. AMHS keeps its own
          Copy/Export pair. */}
      <div className="flex items-center space-x-1 sm:space-x-2">

        {documentType === 'amhs' ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "hidden sm:flex",
                className
                  ? "bg-transparent text-secondary-foreground border-secondary-foreground/30 hover:bg-white/10 hover:text-primary"
                  : ""
              )}
              onClick={onCopyAMHS}
            >
              <FileText className={cn("mr-2 w-4 h-4", className ? "text-secondary-foreground" : "text-primary")} />
              Copy
            </Button>
            <Button
              size="sm"
              className="text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 border border-primary-foreground/10"
              onClick={onExportAMHS}
            >
              <Download className="mr-2 w-4 h-4" />
              Export
            </Button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 border border-primary-foreground/10"
                disabled={isGenerating}
                aria-label="Export"
              >
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'Export'}</span>
                <ChevronDown className="ml-1 sm:ml-2 w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border text-card-foreground">
              <DropdownMenuLabel>Export</DropdownMenuLabel>
              <DropdownMenuItem onClick={onGeneratePdf} disabled={isGenerating} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                <Download className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating PDF...' : 'PDF Document (.pdf)'}
              </DropdownMenuItem>
              {onAddSignature && (
                <DropdownMenuItem onClick={onAddSignature} disabled={isGenerating} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                  <FileText className="w-4 h-4 mr-2" />
                  PDF with Signature Fields
                </DropdownMenuItem>
              )}
              {documentType !== 'page11' && documentType !== 'navmc10922' && documentType !== 'navmc10132' && (
                <DropdownMenuItem onClick={onExportDocx} disabled={isGenerating} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                  <FileText className="w-4 h-4 mr-2" />
                  Word Document (.docx)
                </DropdownMenuItem>
              )}
              {/* F1 (SECTION_508_FINDINGS): PDF exports are untagged. */}
              <div className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground" role="note">
                Screen-reader accessible copy needed? Export DOCX - PDF exports carry no accessibility tags.
              </div>

              {/* Editable data files, moved out of File. */}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExportNldp} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                <Save className="w-4 h-4 mr-2" />
                Save as Data Package (.nldp)...
              </DropdownMenuItem>

              {onBatchGenerate && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onBatchGenerate} disabled={isGenerating} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Batch Generate (Mail Merge)
                  </DropdownMenuItem>
                </>
              )}

              {/* Distribution, moved out of the removed Share menu. */}
              {(onShareLink || onPackage) && <DropdownMenuSeparator />}
              {onShareLink && (
                <DropdownMenuItem onClick={onShareLink} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                  <Link2 className="w-4 h-4 mr-2" />
                  Copy Share Link
                </DropdownMenuItem>
              )}
              {onPackage && (
                <DropdownMenuItem onClick={onPackage} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                  <Layers className="w-4 h-4 mr-2" />
                  Assemble Package
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="h-4 w-px bg-border hidden md:block mx-2"></div>

      {/* View - a visible toggle, not a menu item. Gold when the preview is
          on. Below xl there is no preview pane, so the icon opens the modal. */}
      {onOpenPreviewModal && (
        <Button
          variant="ghost"
          size="icon"
          className={buttonClass("h-8 w-8 hidden md:flex xl:hidden")}
          onClick={onOpenPreviewModal}
          title="Preview"
          aria-label="Open preview"
        >
          <Eye className="w-4 h-4" />
        </Button>
      )}
      {onTogglePreview && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 hidden xl:flex",
            showPreview
              ? "text-primary bg-primary/10 hover:bg-primary/15"
              : buttonClass("")
          )}
          onClick={onTogglePreview}
          title={showPreview ? 'Hide preview' : 'Show preview'}
          aria-label={showPreview ? 'Hide preview' : 'Show preview'}
          aria-pressed={showPreview}
        >
          {showPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </Button>
      )}

      {/* GunnyBot - opens the assistant panel from the store. */}
      <Button
        variant="ghost"
        size="icon"
        className={buttonClass("h-8 w-8 hidden md:flex")}
        onClick={() => openGunnyBot(true)}
        title="GunnyBot assistant"
        aria-label="Open GunnyBot assistant"
      >
        <Bot className="w-4 h-4" />
      </Button>

      {/* App - one Settings gear. Send Feedback lives here, out of the
          document menus. */}
      {onSettings && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={buttonClass("h-8 w-8 hidden md:flex")}
              title="Settings"
              aria-label="Settings and feedback"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border text-card-foreground">
            <DropdownMenuItem onClick={onSettings} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer')}
              className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Send Feedback...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Mobile overflow - below md the trailing icon buttons (Preview,
          GunnyBot, Settings) fall off the right edge of a phone screen,
          so they collapse into this single always-visible menu. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={buttonClass("h-8 w-8 md:hidden shrink-0")}
            title="More"
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-card border-border text-card-foreground">
          {onOpenPreviewModal && (
            <DropdownMenuItem onClick={onOpenPreviewModal} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => openGunnyBot(true)} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Bot className="w-4 h-4 mr-2" />
            GunnyBot Assistant
          </DropdownMenuItem>
          {onSettings && (
            <>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={onSettings} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer')}
                className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Feedback...
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
