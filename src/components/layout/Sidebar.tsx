import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  X,
  MessageSquare,
  Mail,
  ScrollText,
  ClipboardList,
  Notebook,
  Briefcase,
  FileInput,
  Type,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ParagraphData } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface SidebarProps {
  className?: string;
  documentType: string;
  onDocumentTypeChange: (type: string) => void;
  paragraphs?: ParagraphData[];
  formData?: Record<string, any>;
  /**
   * Optional callback fired after the user selects a document type.
   * Used by the mobile slide-out drawer to auto-close on selection.
   * Desktop callers omit this prop and behavior remains unchanged.
   */
  onItemSelect?: () => void;
}

interface SearchResult {
  type: 'paragraph' | 'field';
  label: string;
  snippet: string;
  elementId?: string;
  fieldValue?: string;
}

const FIELD_LABELS: Record<string, string> = {
  from: 'From',
  to: 'To',
  subj: 'Subject',
  ssic: 'SSIC',
  sig: 'Signature',
  date: 'Date',
  originatorCode: 'Originator Code',
  delegationText: 'Delegation',
  line1: 'Unit Name',
  line1b: 'Unit Sub-Name',
  line2: 'Street Address',
  line3: 'City/State/Zip',
  directiveTitle: 'Designation Line',
  recipientName: 'Recipient Name',
  recipientTitle: 'Recipient Title',
  businessName: 'Business Name',
  salutation: 'Salutation',
  complimentaryClose: 'Complimentary Close',
  classification: 'Classification',
  drafterName: 'Drafter Name',
  drafterPhone: 'Drafter Phone',
  approverName: 'Approver Name',
  name: 'Name',
  edipi: 'DOD ID / EDIPI',
  remarksLeft: 'Left Column',
  remarksRight: 'Right Column',
  attentionLine: 'Attention Line',
  signerRank: 'Signer Rank',
  signerTitle: 'Signer Title',
};

const SKIP_FIELDS = new Set(['documentType', 'bodyFont', 'headerType', 'accentColor', 'adminSubsections']);

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function stripFormatting(text: string): string {
  return text.replace(/\*{1,3}|<\/?u>/g, '');
}

function getSnippet(text: string, query: string, maxLen = 60): string {
  const clean = stripFormatting(text);
  const lower = clean.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return clean.slice(0, maxLen);
  const start = Math.max(0, idx - 20);
  const end = Math.min(clean.length, idx + query.length + 30);
  let snippet = clean.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < clean.length) snippet += '...';
  return snippet;
}

function collectFieldResults(
  data: any,
  query: string,
  results: SearchResult[],
  parentKey = ''
) {
  if (!data || typeof data !== 'object' || results.length >= 20) return;

  for (const [key, value] of Object.entries(data)) {
    if (results.length >= 20) return;
    if (SKIP_FIELDS.has(key)) continue;

    const fullKey = parentKey ? `${parentKey}.${key}` : key;

    if (typeof value === 'string' && value.length >= 2) {
      if (stripFormatting(value).toLowerCase().includes(query)) {
        const label = FIELD_LABELS[key] || formatFieldName(key);
        results.push({
          type: 'field',
          label,
          snippet: getSnippet(value, query),
          fieldValue: value,
        });
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (results.length >= 20) return;
        if (typeof item === 'string' && item.length >= 2) {
          if (stripFormatting(item).toLowerCase().includes(query)) {
            const label = FIELD_LABELS[key] || formatFieldName(key);
            results.push({
              type: 'field',
              label: `${label} [${i + 1}]`,
              snippet: getSnippet(item, query),
              fieldValue: item,
            });
          }
        } else if (typeof item === 'object' && item !== null) {
          collectFieldResults(item, query, results, `${fullKey}[${i}]`);
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      collectFieldResults(value, query, results, fullKey);
    }
  }
}

function scrollToResult(result: SearchResult, query: string) {
  // For paragraphs, scroll to the paragraph card
  if (result.elementId) {
    const el = document.getElementById(result.elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
      return;
    }
  }

  // For form fields, find the input/textarea with matching value
  if (result.type === 'field' && result.fieldValue) {
    const q = query.toLowerCase();
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
    for (const input of inputs) {
      if (input.value && stripFormatting(input.value).toLowerCase().includes(q)) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
        const parent = input.closest('.space-y-2, .rounded-md, [class*="card"]');
        if (parent instanceof HTMLElement) {
          parent.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => parent.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
        }
        return;
      }
    }
  }
}

export function Sidebar({ className, documentType, onDocumentTypeChange, paragraphs = [], formData, onItemSelect }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Wrap the document-type handler so the mobile drawer auto-closes on selection.
  // When onItemSelect is undefined (desktop), behavior is identical to a direct call.
  const handleSelect = (type: string) => {
    onDocumentTypeChange(type);
    onItemSelect?.();
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];

    const results: SearchResult[] = [];

    // Search paragraphs
    for (const p of paragraphs) {
      if (results.length >= 20) break;
      const contentClean = stripFormatting(p.content || '').toLowerCase();
      const titleClean = (p.title || '').toLowerCase();
      if (contentClean.includes(q) || titleClean.includes(q)) {
        results.push({
          type: 'paragraph',
          label: p.title ? `${p.title}` : `Paragraph`,
          snippet: getSnippet(p.content || p.title || '', searchQuery),
          elementId: `paragraph-${p.id}`,
        });
      }
    }

    // Search form data
    if (formData) {
      collectFieldResults(formData, q, results);
    }

    return results;
  }, [searchQuery, paragraphs, formData]);

  return (
    <aside className={cn("w-64 bg-card border-r border-border hidden md:flex flex-col h-full", className)}>
      <ScrollArea className="flex-1">
        {/* Document Type Selector */}
        <div className="p-4 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Document Type</h3>
          <Accordion
            type="multiple"
            defaultValue={[]}
            className="w-full"
          >
            {/* Standard Letter Group */}
            <AccordionItem value="standard-letter" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-foreground hover:no-underline">
                <span className="flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-primary" />
                  Standard Letter
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 pl-2">
                  <DocumentTypeButton
                    active={documentType === 'basic'}
                    onClick={() => handleSelect('basic')}
                    label="Basic Letter"
                  />
                  <DocumentTypeButton
                    active={documentType === 'multiple-address'}
                    onClick={() => handleSelect('multiple-address')}
                    label="Multiple-Address Letter"
                  />
                  <DocumentTypeButton
                    active={documentType === 'endorsement'}
                    onClick={() => handleSelect('endorsement')}
                    label="Endorsement"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Memorandums Group */}
            <AccordionItem value="memorandums" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-foreground hover:no-underline">
                <span className="flex items-center">
                  <Notebook className="w-4 h-4 mr-2 text-primary" />
                  Memorandums
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 pl-2">
                  <DocumentTypeButton
                    active={documentType === 'mfr'}
                    onClick={() => handleSelect('mfr')}
                    label="Memorandum for the Record"
                  />
                  <DocumentTypeButton
                    active={documentType === 'from-to-memo'}
                    onClick={() => handleSelect('from-to-memo')}
                    label="From-To Memorandum"
                  />
                  <DocumentTypeButton
                    active={documentType === 'letterhead-memo'}
                    onClick={() => handleSelect('letterhead-memo')}
                    label="Letterhead Memorandum"
                  />
                  <DocumentTypeButton
                    active={documentType === 'moa'}
                    onClick={() => handleSelect('moa')}
                    label="Memorandum of Agreement"
                  />
                  <DocumentTypeButton
                    active={documentType === 'mou'}
                    onClick={() => handleSelect('mou')}
                    label="Memorandum of Understanding"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Staffing Papers Group */}
            <AccordionItem value="staffing-papers" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-foreground hover:no-underline">
                <span className="flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-primary" />
                  Staffing Papers
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 pl-2">
                  <DocumentTypeButton
                    active={documentType === 'information-paper'}
                    onClick={() => handleSelect('information-paper')}
                    label="Information Paper"
                  />
                  <DocumentTypeButton
                    active={documentType === 'position-paper'}
                    onClick={() => handleSelect('position-paper')}
                    label="Position Paper"
                  />
                  <DocumentTypeButton
                    active={documentType === 'decision-paper'}
                    onClick={() => handleSelect('decision-paper')}
                    label="Decision Paper"
                  />
                  <DocumentTypeButton
                    active={documentType === 'coordination-page'}
                    onClick={() => handleSelect('coordination-page')}
                    label="Coordination Page"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* External & Executive Group */}
            <AccordionItem value="external-executive" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-foreground hover:no-underline">
                <span className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-2 text-primary" />
                  External & Executive
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 pl-2">
                  <DocumentTypeButton
                    active={documentType === 'business-letter'}
                    onClick={() => handleSelect('business-letter')}
                    label="Business Letter"
                  />
                  <DocumentTypeButton
                    active={documentType === 'executive-correspondence'}
                    onClick={() => handleSelect('executive-correspondence')}
                    label="Executive Correspondence"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* DLA Correspondence Group */}
            <AccordionItem value="dla-correspondence" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-foreground hover:no-underline">
                <span className="flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-primary" />
                  DLA Correspondence
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 pl-2">
                  <DocumentTypeButton
                    active={documentType === 'dla-memorandum'}
                    onClick={() => handleSelect('dla-memorandum')}
                    label="Standard Memorandum"
                  />
                  <DocumentTypeButton
                    active={documentType === 'dla-business-letter'}
                    onClick={() => handleSelect('dla-business-letter')}
                    label="Business Letter (DLA)"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Directives Group */}
            <AccordionItem value="directives" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-foreground hover:no-underline">
                <span className="flex items-center">
                  <ScrollText className="w-4 h-4 mr-2 text-primary" />
                  Directives
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 pl-2">
                  <DocumentTypeButton
                    active={documentType === 'mco'}
                    onClick={() => handleSelect('mco')}
                    label="Marine Corps Order"
                  />
                  <DocumentTypeButton
                    active={documentType === 'bulletin'}
                    onClick={() => handleSelect('bulletin')}
                    label="Marine Corps Bulletin"
                  />
                  <DocumentTypeButton
                    active={documentType === 'secnav-instruction'}
                    onClick={() => handleSelect('secnav-instruction')}
                    label="SECNAV Instruction"
                  />
                  <DocumentTypeButton
                    active={documentType === 'secnav-notice'}
                    onClick={() => handleSelect('secnav-notice')}
                    label="SECNAV Notice"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Forms Group */}
            <AccordionItem value="forms" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-foreground hover:no-underline">
                <span className="flex items-center">
                  <ClipboardList className="w-4 h-4 mr-2 text-primary" />
                  Forms
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 pl-2">
                  <DocumentTypeButton
                    active={documentType === 'aa-form'}
                    onClick={() => handleSelect('aa-form')}
                    label="AA Form (NAVMC 10274)"
                  />
                  <DocumentTypeButton
                    active={documentType === 'page11'}
                    onClick={() => handleSelect('page11')}
                    label="Pg. 11 (NAVMC 118(11))"
                  />
                  <DocumentTypeButton
                    active={documentType === 'navmc10922'}
                    onClick={() => handleSelect('navmc10922')}
                    label="Dependency Application (NAVMC 10922)"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Technical Publication Group */}
            <AccordionItem value="technical-publication" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-foreground hover:no-underline">
                <span className="flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-primary" />
                  Technical Publication
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 pl-2">
                  <DocumentTypeButton
                    active={documentType === 'i-type'}
                    onClick={() => handleSelect('i-type')}
                    label="I-Type"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* AMHS - Single Item Group */}
          <div className="border-none mt-1">
            <button
              onClick={() => handleSelect('amhs')}
              className={cn(
                "w-full flex items-center py-2 text-sm font-semibold hover:no-underline transition-all text-left",
                documentType === 'amhs' ? "text-primary" : "text-foreground hover:text-primary/80"
              )}
            >
              <MessageSquare className="w-4 h-4 mr-2 text-primary" />
              AMHS Message
            </button>
          </div>
        </div>

        {/* Find in Document */}
        <div className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Find in Document</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchQuery.trim().length >= 2 && (
            <div className="mt-3 space-y-1">
              {searchResults.length > 0 ? (
                <>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </div>
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToResult(result, searchQuery)}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground group-hover:text-primary">
                        {result.type === 'paragraph' ? (
                          <Type className="w-3 h-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileInput className="w-3 h-3 shrink-0 text-muted-foreground" />
                        )}
                        {result.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5 pl-[18px]">
                        {result.snippet}
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No matches found
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function DocumentTypeButton({ active, onClick, label, isSpecial }: { active: boolean, onClick: () => void, label: string, isSpecial?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center px-2 py-1.5 text-sm font-medium rounded-md group transition-colors",
        active
          ? "text-primary bg-primary/10 border border-primary/20 shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
      )}
    >
      <span className={cn(
        "w-4 h-4 rounded-full border mr-2 flex items-center justify-center transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
      )}>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-background"></span>}
      </span>
      {label}
    </button>
  );
}
