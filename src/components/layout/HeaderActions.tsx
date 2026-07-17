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
  LayoutTemplate,
  Eye,
  EyeOff,
  Link2,
  Check,
  FileSpreadsheet,
  ClipboardCheck,
  MoreVertical,
  Settings,
  MessageSquare,
  Undo2,
  Redo2,
  Replace,
  BookOpen,
  BadgeCheck,
  GitCompare,
  Layers
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SavedLetter } from '@/types';
import { useTemplates, Template } from '@/hooks/useTemplates';

function TemplateList({ templates, onSelect }: { templates: Template[]; onSelect: (url: string) => void }) {
  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No templates found matching your criteria.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
      {templates.map(template => (
        <button
          key={template.id}
          onClick={() => onSelect(template.url)}
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
          {template.unitName && (
            <Badge variant="secondary" className="mt-2 text-[10px] font-normal bg-secondary/10 text-secondary border border-secondary/20">
              {template.unitName}
            </Badge>
          )}
        </button>
      ))}
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
  onExportDocx: () => void;
  onGeneratePdf: () => void;
  onClearForm: () => void;
  savedLetters: SavedLetter[];
  onLoadTemplateUrl: (url: string) => void;
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
    searchQuery, 
    setSearchQuery, 
  } = useTemplates({ documentType, currentUnitCode, currentUnitName });
  
  // Helper to merge classes for buttons
  const buttonClass = (baseClass: string) => cn(baseClass, className ? "text-secondary-foreground hover:text-primary hover:bg-white/10" : "text-muted-foreground hover:text-foreground");
  const iconClass = className ? "text-secondary-foreground/80" : "text-muted-foreground";

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

  const handleTemplateSelect = (url: string) => {
    onLoadTemplateUrl(url);
    setIsTemplateOpen(false);
  };

  return (
    <div className="flex items-center space-x-2">
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
      {onSettings && (
        <Button variant="ghost" size="sm" className={buttonClass("hidden sm:flex")} onClick={onSettings} title="Settings">
          <Settings className={cn("w-4 h-4", iconClass)} />
        </Button>
      )}

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

          <Tabs defaultValue="global" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="global">Standard Templates ({globalTemplates.length})</TabsTrigger>
              <TabsTrigger value="unit">Unit Templates ({unitTemplates.length})</TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-1 mt-4 h-[300px] pr-4">
              <TabsContent value="global" className="mt-0">
                <TemplateList templates={globalTemplates} onSelect={handleTemplateSelect} />
              </TabsContent>
              <TabsContent value="unit" className="mt-0">
                <TemplateList templates={unitTemplates} onSelect={handleTemplateSelect} />
              </TabsContent>
            </ScrollArea>
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
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <File className="w-4 h-4 mr-2" />
            File
            <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border text-card-foreground">
          <DropdownMenuLabel>Document Actions</DropdownMenuLabel>
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


          <DropdownMenuItem onClick={onExportNldp} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Download className="w-4 h-4 mr-2" />
            Export Data Package (.nldp)
          </DropdownMenuItem>

          {onShareLink && (
            <>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={onShareLink} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                <Link2 className="w-4 h-4 mr-2" />
                Copy Share Link
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator className="bg-border" />
          
          <DropdownMenuItem onClick={onClearForm} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Form
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-4 w-px bg-border hidden md:block mx-2"></div>

      {/* Export/Generate Buttons */}
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
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex",
                    className
                      ? "bg-transparent text-secondary-foreground border-secondary-foreground/30 hover:bg-white/10 hover:text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="hidden sm:inline">Actions</span>
                  <MoreVertical className="w-4 h-4 sm:hidden" />
                  <ChevronDown className="w-3 h-3 ml-1 opacity-50 hidden sm:inline-flex" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border text-card-foreground">
                {onOpenPreviewModal && (
                  <DropdownMenuItem onClick={onOpenPreviewModal} className="cursor-pointer focus:bg-accent focus:text-accent-foreground xl:hidden">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview (Modal)
                  </DropdownMenuItem>
                )}
                {onTogglePreview && (
                  <DropdownMenuItem onClick={onTogglePreview} className="cursor-pointer focus:bg-accent focus:text-accent-foreground hidden xl:flex">
                    {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </DropdownMenuItem>
                )}
                {onProofread && <DropdownMenuSeparator className="bg-border xl:hidden" />}
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
                {onPackage && (
                  <DropdownMenuItem onClick={onPackage} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                    <Layers className="w-4 h-4 mr-2" />
                    Assemble Package
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
                {onSettings && <DropdownMenuSeparator className="bg-border" />}
                {onSettings && (
                  <DropdownMenuItem onClick={onSettings} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer')}
                  className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Feedback...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 border border-primary-foreground/10"
                  disabled={isGenerating}
                >
                  <Download className="mr-2 w-4 h-4" />
                  {isGenerating ? 'Generating...' : 'Export'}
                  <ChevronDown className="ml-2 w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border text-card-foreground">
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
                {documentType !== 'page11' && (
                  <DropdownMenuItem onClick={onExportDocx} disabled={isGenerating} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                    <FileText className="w-4 h-4 mr-2" />
                    Word Document (.docx)
                  </DropdownMenuItem>
                )}
                {/* F1 (SECTION_508_FINDINGS): PDF exports are untagged. */}
                <div className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground" role="note">
                  Screen-reader accessible copy needed? Export DOCX - PDF exports carry no accessibility tags.
                </div>
                {onBatchGenerate && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onBatchGenerate} disabled={isGenerating} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Batch Generate (Mail Merge)
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
