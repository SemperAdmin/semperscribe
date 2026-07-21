/**
 * Document Type Section Component
 * Manages document type selection (Basic/Endorsement), header type, and body font
 */

import React from 'react';
import { FormData, EndorsementLevel, ParagraphData } from '@/types';
import { StructuredReferenceInput } from './StructuredReferenceInput';
import { debugFormChange } from '@/lib/console-utils';
import { getMCOParagraphs, getMCBulParagraphs, getSecnavInstructionParagraphs, getSecnavNoticeParagraphs, getMOAParagraphs, getStaffingPaperParagraphs, getInformationPaperParagraphs, getAssumptionOfCommandParagraphs } from '@/lib/naval-format-utils';
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { FileText, FileSignature, ClipboardList, ScrollText, AlertCircle, Building2, Type, FileCheck, MessageSquare, Users, Notebook, Handshake, Lightbulb, Mic, BookOpen, Flag, Plane, Briefcase, Landmark } from 'lucide-react';

interface DocumentTypeSectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  setParagraphs?: React.Dispatch<React.SetStateAction<ParagraphData[]>>;
}

interface DocumentTypeCardProps {
  type: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  note: string;
  onClick: () => void;
  isActive: boolean;
}

const DocumentTypeCard = ({ type, icon, title, description, note, onClick, isActive }: DocumentTypeCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-start gap-4 p-5 text-left rounded-xl transition-all duration-300 border-2 relative group w-full",
      isActive 
        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
        : "bg-card text-card-foreground border-border hover:border-primary/50 hover:bg-accent/5"
    )}
  >
    <div className={cn(
      "text-4xl min-w-[60px] flex items-center justify-center transition-colors",
      isActive ? "text-primary-foreground" : "text-primary/80"
    )}>
      {icon}
    </div>
    <div className="flex-1">
      <div className="text-xl font-bold mb-2 flex items-center gap-2 font-headline tracking-wide">
        {title}
        {isActive && (
          <div className="ml-auto bg-primary-foreground/20 rounded-full p-1">
            <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <div className={cn("text-sm mb-2 leading-relaxed", isActive ? "opacity-90" : "text-muted-foreground")}>
        {description}
      </div>
      <div className={cn("text-xs font-medium uppercase tracking-wider opacity-80", isActive ? "text-primary-foreground" : "text-primary")}>
        {note}
      </div>
    </div>
  </button>
);

export function DocumentTypeSection({
  formData,
  setFormData,
  setParagraphs
}: DocumentTypeSectionProps) {
  const handleEndorsementLevelChange = (value: string) => {
    const level = value as EndorsementLevel;
    
    // We can't know the length of previous documents, so we reset to defaults and ask the user.
    // Endorsements must start at least on page 2 (after a 1-page basic letter).
    const defaultStartPage = 2; 

    setFormData(prev => ({
      ...prev,
      endorsementLevel: level,
      startingReferenceLevel: 'a', // Reset to 'a', user must verify
      startingEnclosureNumber: '1', // Reset to '1', user must verify
      previousPackagePageCount: defaultStartPage - 1,
      startingPageNumber: defaultStartPage
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Document Type Selector */}
      <section className="space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-1 bg-primary rounded-full" />
          <h2 className="text-2xl font-headline tracking-wide text-primary">Document Type</h2>
        </div>

        {/* Standard Correspondence Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm border-b pb-2">
            Standard Correspondence
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DocumentTypeCard
              type="basic"
              icon={<FileText className="w-10 h-10" />}
              title="Basic Letter"
              description="The standard format for routine correspondence and official communications."
              note="✓ Most common format"
              isActive={formData.documentType === 'basic'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'basic' }))}
            />

            <DocumentTypeCard
              type="multiple-address"
              icon={<Users className="w-10 h-10" />}
              title="Multiple-Address Letter"
              description="Same as Standard Letter but addresses multiple recipients (Distribution List)."
              note="→ For multiple recipients"
              isActive={formData.documentType === 'multiple-address'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'multiple-address', to: 'DISTRIBUTION LIST' }))}
            />

            <DocumentTypeCard
              type="endorsement"
              icon={<FileSignature className="w-10 h-10" />}
              title="New-Page Endorsement"
              description="Forwards correspondence on a new page. Use for longer comments and formal endorsements."
              note="→ For forwarding documents"
              isActive={formData.documentType === 'endorsement'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'endorsement' }))}
            />

            <DocumentTypeCard
              type="mco"
              icon={<ScrollText className="w-10 h-10" />}
              title="Order / Directive"
              description="Directives that establish policy or procedures (e.g. MCO, BnO)."
              note="→ For standing orders"
              isActive={formData.documentType === 'mco'}
              onClick={() => {
                setFormData(prev => ({ 
                  ...prev, 
                  documentType: 'mco', 
                  to: prev.to || 'Distribution List',
                  orderPrefix: prev.orderPrefix || 'MCO' 
                }));
                if (setParagraphs && formData.documentType !== 'mco') {
                  if (window.confirm('Do you want to load the standard SMEAC structure for this Order? Existing paragraphs will be replaced.')) {
                    setParagraphs(getMCOParagraphs());
                  }
                }
              }}
            />

            <DocumentTypeCard
              type="bulletin"
              icon={<AlertCircle className="w-10 h-10" />}
              title="Marine Corps Bulletin"
              description="Directives of a temporary nature (expire after 12 months)."
              note="→ For temporary orders"
              isActive={formData.documentType === 'bulletin'}
              onClick={() => {
                setFormData(prev => ({ ...prev, documentType: 'bulletin', to: prev.to || 'Distribution List' }));
                if (setParagraphs && formData.documentType !== 'bulletin') {
                  if (window.confirm('Do you want to load the standard Bulletin structure? Existing paragraphs will be replaced.')) {
                    setParagraphs(getMCBulParagraphs());
                  }
                }
              }}
            />

            <DocumentTypeCard
              type="secnav-instruction"
              icon={<ScrollText className="w-10 h-10" />}
              title="SECNAV Instruction"
              description="DON-level directives with continuing authority (SECNAV M-5215.1)."
              note="→ Courier New 12; 5-page text cap"
              isActive={formData.documentType === 'secnav-instruction'}
              onClick={() => {
                setFormData(prev => ({ ...prev, documentType: 'secnav-instruction', to: '', from: prev.from || 'Secretary of the Navy' }));
                if (setParagraphs && formData.documentType !== 'secnav-instruction') {
                  if (window.confirm('Do you want to load the standard SECNAV instruction structure? Existing paragraphs will be replaced.')) {
                    setParagraphs(getSecnavInstructionParagraphs());
                  }
                }
              }}
            />

            <DocumentTypeCard
              type="secnav-notice"
              icon={<AlertCircle className="w-10 h-10" />}
              title="SECNAV Notice"
              description="DON-level directives of brief duration; self-canceling (SECNAV M-5215.1)."
              note="→ No point number; Canc date required"
              isActive={formData.documentType === 'secnav-notice'}
              onClick={() => {
                setFormData(prev => ({ ...prev, documentType: 'secnav-notice', to: '', from: prev.from || 'Secretary of the Navy' }));
                if (setParagraphs && formData.documentType !== 'secnav-notice') {
                  if (window.confirm('Do you want to load the standard SECNAV notice structure? Existing paragraphs will be replaced.')) {
                    setParagraphs(getSecnavNoticeParagraphs());
                  }
                }
              }}
            />

            <DocumentTypeCard
              type="change-transmittal"
              icon={<FileSignature className="w-10 h-10" />}
              title="Change Transmittal"
              description="Transmits amendments (page replacements) to an existing order."
              note="→ MCO 5215.1K para 40-44"
              isActive={formData.documentType === 'change-transmittal'}
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  documentType: 'change-transmittal',
                  to: prev.to || 'Distribution List',
                  orderPrefix: prev.orderPrefix || 'MCO'
                }));
              }}
            />

            <DocumentTypeCard
              type="coordination-page"
              icon={<ClipboardList className="w-10 h-10" />}
              title="Coordination Page"
              description="Mandatory staffing table for routing packages. Tracks concurrence/non-concurrence."
              note="→ MCO 5216.20B, Fig 13-8"
              isActive={formData.documentType === 'coordination-page'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'coordination-page' }))}
            />
          </div>

          {/* MCO Specific Inputs */}
          {formData.documentType === 'mco' && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderPrefix" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Directive Prefix / Short Title
                  </Label>
                  <Input
                    id="orderPrefix"
                    value={formData.orderPrefix || 'MCO'}
                    onChange={(e) => setFormData(prev => ({ ...prev, orderPrefix: e.target.value.toUpperCase() }))}
                    placeholder="e.g. MCO, BnO, RegO, DivO"
                    className="max-w-xs font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Determines the export filename (e.g., <strong>{formData.orderPrefix || 'MCO'} {formData.ssic || 'XXXX.X'}</strong>)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Start Templates
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Load the Assumption of Command template? This will replace current paragraphs, SSIC, and subject.')) {
                        setFormData(prev => ({
                          ...prev,
                          ssic: '1301',
                          subj: 'ASSUMPTION OF COMMAND',
                          orderPrefix: 'DivO',
                          directiveTitle: '',
                        }));
                        if (setParagraphs) {
                          setParagraphs(getAssumptionOfCommandParagraphs());
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-background border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <ScrollText className="w-4 h-4 text-primary" />
                    Assumption of Command (SSIC 1301)
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Per MCO 5215.1K, Chapter 1, Figure 1-1
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bulletin Specific Inputs */}
          {formData.documentType === 'bulletin' && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Cancellation
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label htmlFor="cancellationType" className="text-xs">Type</Label>
                       <Select 
                        value={formData.cancellationType || 'fixed'} 
                        onValueChange={(val: 'fixed' | 'contingent') => setFormData(prev => ({ ...prev, cancellationType: val }))}
                       >
                        <SelectTrigger id="cancellationType">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed Date</SelectItem>
                          <SelectItem value="contingent">Contingency</SelectItem>
                        </SelectContent>
                       </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cancellationDate" className="text-xs">Cancellation Date</Label>
                      <DatePicker
                        date={formData.cancellationDate ? new Date(formData.cancellationDate + 'T00:00:00') : undefined}
                        setDate={(d) => setFormData(prev => ({ ...prev, cancellationDate: d ? format(d, 'yyyy-MM-dd') : '' }))}
                        placeholder="Pick cancellation date"
                      />
                    </div>
                    {formData.cancellationType === 'contingent' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="cancellationContingency" className="text-xs">Contingency Condition</Label>
                        <Input
                          id="cancellationContingency"
                          value={formData.cancellationContingency || ''}
                          placeholder="e.g. Upon receipt"
                          onChange={(e) => setFormData(prev => ({ ...prev, cancellationContingency: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Memorandums Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm border-b pb-2">
            Memorandums
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DocumentTypeCard
              type="from-to-memo"
              icon={<Notebook className="w-10 h-10" />}
              title="From-To Memorandum"
              description="Informal internal correspondence. Uses plain paper or command forms."
              note="→ For internal routine business"
              isActive={formData.documentType === 'from-to-memo'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'from-to-memo' }))}
            />

            <DocumentTypeCard
              type="mfr"
              icon={<FileText className="w-10 h-10" />}
              title="Memorandum for the Record"
              description="Internal document to record events or decisions. No 'To' line."
              note="→ For internal records"
              isActive={formData.documentType === 'mfr'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'mfr' }))}
            />

            <DocumentTypeCard
              type="letterhead-memo"
              icon={<Building2 className="w-10 h-10" />}
              title="Letterhead Memorandum"
              description="Formal memorandum. Uses command letterhead."
              note="→ For formal internal/external use"
              isActive={formData.documentType === 'letterhead-memo'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'letterhead-memo' }))}
            />

            <DocumentTypeCard
              type="moa"
              icon={<Handshake className="w-10 h-10" />}
              title="Memorandum of Agreement"
              description="Agreement between two or more parties (Conditional)."
              note="→ For binding agreements"
              isActive={formData.documentType === 'moa'}
              onClick={() => {
                setFormData(prev => ({ ...prev, documentType: 'moa' }));
                if (setParagraphs && formData.documentType !== 'moa') {
                  if (window.confirm('Do you want to load the standard MOA structure? Existing paragraphs will be replaced.')) {
                    setParagraphs(getMOAParagraphs('moa'));
                  }
                }
              }}
            />

            <DocumentTypeCard
              type="mou"
              icon={<Handshake className="w-10 h-10" />}
              title="Memorandum of Understanding"
              description="General understanding between two or more parties (Non-binding)."
              note="→ For general understanding"
              isActive={formData.documentType === 'mou'}
              onClick={() => {
                setFormData(prev => ({ ...prev, documentType: 'mou' }));
                if (setParagraphs && formData.documentType !== 'mou') {
                  if (window.confirm('Do you want to load the standard MOU structure? Existing paragraphs will be replaced.')) {
                    setParagraphs(getMOAParagraphs('mou'));
                  }
                }
              }}
            />

          </div>
        </div>

        {/* Staffing Papers Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm border-b pb-2">
            Staffing Papers (USMC Specific)
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DocumentTypeCard
              type="information-paper"
              icon={<Lightbulb className="w-10 h-10" />}
              title="Information Paper"
              description="Provides factual information in concise terms."
              note="→ For concise facts"
              isActive={formData.documentType === 'information-paper'}
              onClick={() => {
                setFormData(prev => ({ ...prev, documentType: 'information-paper' }));
                if (setParagraphs && formData.documentType !== 'information-paper') {
                  setParagraphs(getInformationPaperParagraphs());
                }
              }}
            />

            <DocumentTypeCard
              type="position-paper"
              icon={<Flag className="w-10 h-10" />}
              title="Position Paper"
              description="Articulates official stance on a specific issue."
              note="→ For official stance"
              isActive={formData.documentType === 'position-paper'}
              onClick={() => {
                setFormData(prev => ({ ...prev, documentType: 'position-paper' }));
                if (setParagraphs && formData.documentType !== 'position-paper') {
                  setParagraphs(getStaffingPaperParagraphs());
                }
              }}
            />

            <DocumentTypeCard
              type="decision-paper"
              icon={<Flag className="w-10 h-10" />}
              title="Decision Paper"
              description="Requests a decision from a senior official."
              note="→ For official decisions"
              isActive={formData.documentType === 'decision-paper'}
              onClick={() => {
                  setFormData(prev => ({ ...prev, documentType: 'decision-paper' }));
                  if (setParagraphs && formData.documentType !== 'decision-paper') {
                      setParagraphs(getStaffingPaperParagraphs());
                  }
              }}
            />

          </div>
        </div>

        {/* External & Executive Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm border-b pb-2">
            External & Executive
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DocumentTypeCard
              type="business-letter"
              icon={<Briefcase className="w-10 h-10" />}
              title="Business Letter"
              description="Formal correspondence with non-DoD entities, agencies, or private individuals."
              note="→ For civilian/external use"
              isActive={formData.documentType === 'business-letter'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'business-letter' }))}
            />

            <DocumentTypeCard
              type="executive-correspondence"
              icon={<Landmark className="w-10 h-10" />}
              title="Executive Correspondence"
              description="Letters and memorandums for Congress, OSD, SECNAV, CNO, and senior officials."
              note="→ SECNAV M-5216.5, Ch 12"
              isActive={formData.documentType === 'executive-correspondence'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'executive-correspondence', execFormat: prev.execFormat || 'letter' }))}
            />
          </div>
        </div>

        {/* Forms Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm border-b pb-2">
            Forms
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DocumentTypeCard
              type="aa-form"
              icon={<ClipboardList className="w-10 h-10" />}
              title="NAVMC 10274 (AA Form)"
              description="Administrative Action Form. Used for personnel requests and administrative matters."
              note="→ For admin requests"
              isActive={formData.documentType === 'aa-form'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'aa-form' }))}
            />

            <DocumentTypeCard
              type="page11"
              icon={<FileCheck className="w-10 h-10" />}
              title="NAVMC 118(11)"
              description="Administrative Remarks (Page 11). For permanent service record entries."
              note="→ For admin remarks"
              isActive={formData.documentType === 'page11'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'page11' }))}
            />

            <DocumentTypeCard
              type="navmc10922"
              icon={<Users className="w-10 h-10" />}
              title="NAVMC 10922"
              description="Dependency Application for BAH entitlements per MCO 1751.3 W/CH-1. Spouse and children."
              note="→ For dependency claims"
              isActive={formData.documentType === 'navmc10922'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'navmc10922' }))}
            />
          </div>
        </div>

        {/* Message Traffic Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
            Message Traffic
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DocumentTypeCard
              type="amhs"
              icon={<MessageSquare className="w-10 h-10" />}
              title="AMHS Message"
              description="Automated Message Handling System format for official organizational messages."
              note="→ For official traffic"
              isActive={formData.documentType === 'amhs'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'amhs' }))}
            />
          </div>
        </div>
      </section>

      {/* Header Type & Body Font - Only for Letters */}
      {formData.documentType !== 'aa-form' && formData.documentType !== 'page11' && formData.documentType !== 'navmc10922' && formData.documentType !== 'amhs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-border/50">
          <Card className="border-border shadow-sm bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center uppercase tracking-wider">
                <Type className="w-4 h-4 mr-2 text-primary" />
                Body Font
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <label className={cn(
                  "flex items-center p-3 rounded-lg border cursor-pointer transition-all",
                  formData.bodyFont === 'times' 
                    ? "bg-primary/5 border-primary ring-1 ring-primary" 
                    : "bg-background border-input hover:bg-accent/50"
                )}>
                  <input
                    type="radio"
                    name="bodyFont"
                    value="times"
                    checked={formData.bodyFont === 'times'}
                    onChange={() => {
                      setFormData({ ...formData, bodyFont: 'times' });
                      debugFormChange('Body Font', 'Times New Roman');
                    }}
                    className="w-4 h-4 text-primary border-primary focus:ring-primary"
                  />
                  <span className="ml-3 font-serif text-lg">Times New Roman</span>
                </label>
                
                <label className={cn(
                  "flex items-center p-3 rounded-lg border cursor-pointer transition-all",
                  formData.bodyFont === 'courier' 
                    ? "bg-primary/5 border-primary ring-1 ring-primary" 
                    : "bg-background border-input hover:bg-accent/50"
                )}>
                  <input
                    type="radio"
                    name="bodyFont"
                    value="courier"
                    checked={formData.bodyFont === 'courier'}
                    onChange={() => {
                      setFormData({ ...formData, bodyFont: 'courier' });
                      debugFormChange('Body Font', 'Courier New');
                    }}
                    className="w-4 h-4 text-primary border-primary focus:ring-primary"
                  />
                  <span className="ml-3 font-mono text-base">Courier New</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Endorsement-Specific Fields */}
      {formData.documentType === 'endorsement' && (
        <Card className="border-secondary/20 shadow-md overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="bg-secondary text-primary-foreground border-b border-secondary/10 p-4 flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary-foreground" />
            <h3 className="text-lg font-bold text-primary-foreground font-headline tracking-wide">Endorsement Details</h3>
          </div>
          
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endorsement Level</Label>
              <Select 
                value={formData.endorsementLevel} 
                onValueChange={handleEndorsementLevelChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select endorsement level..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST">FIRST ENDORSEMENT</SelectItem>
                  <SelectItem value="SECOND">SECOND ENDORSEMENT</SelectItem>
                  <SelectItem value="THIRD">THIRD ENDORSEMENT</SelectItem>
                  <SelectItem value="FOURTH">FOURTH ENDORSEMENT</SelectItem>
                  <SelectItem value="FIFTH">FIFTH ENDORSEMENT</SelectItem>
                  <SelectItem value="SIXTH">SIXTH ENDORSEMENT</SelectItem>
                  <SelectItem value="SEVENTH">SEVENTH ENDORSEMENT</SelectItem>
                  <SelectItem value="EIGHTH">EIGHTH ENDORSEMENT</SelectItem>
                  <SelectItem value="NINTH">NINTH ENDORSEMENT</SelectItem>
                  <SelectItem value="TENTH">TENTH ENDORSEMENT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.endorsementLevel && (
              <div className="space-y-4">
                <StructuredReferenceInput formData={formData} setFormData={setFormData} />
                
                <div className="p-4 bg-secondary/5 border border-secondary/10 rounded-lg text-sm font-mono text-muted-foreground flex items-center gap-2">
                  <span className="font-bold text-primary">Preview:</span> 
                  {formData.endorsementLevel} ENDORSEMENT on {formData.basicLetterReference || "[Basic Letter Reference]"}
                </div>
              </div>
            )}

            {formData.endorsementLevel && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                {/* Page Numbering Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-secondary flex items-center gap-2">
                    <span className="bg-secondary/10 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Page Numbering
                  </h4>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Last Page # of Previous Document</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.previousPackagePageCount}
                      onChange={(e) => {
                        const newPrevCount = parseInt(e.target.value) || 0;
                        setFormData(prev => ({
                          ...prev,
                          previousPackagePageCount: newPrevCount,
                          startingPageNumber: newPrevCount + 1
                        }))
                      }}
                    />
                    <p className="text-xs text-muted-foreground italic">
                      Enter the last page number of the document you are endorsing.
                    </p>
                  </div>

                  <div className="p-3 bg-secondary/5 rounded-lg border border-secondary/10">
                    <p className="text-sm text-secondary font-medium">
                      Endorsement starts on page <span className="font-bold text-lg">{formData.startingPageNumber}</span>
                    </p>
                  </div>
                </div>

                {/* Identifier Sequencing Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-secondary flex items-center gap-2">
                    <span className="bg-secondary/10 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Identifier Sequencing
                  </h4>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Start References At Letter</Label>
                    <Select
                      value={formData.startingReferenceLevel}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, startingReferenceLevel: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)).map(char => (
                          <SelectItem key={char} value={char}>{char}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground italic">
                      If basic letter has refs (a) and (b), start here at (c).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Start Enclosures At Number</Label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.startingEnclosureNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, startingEnclosureNumber: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground italic">
                      If basic letter has encl (1), start here at (2).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECNAV Notice-Specific Fields (P4.3) */}
      {formData.documentType === 'secnav-notice' && (
        <Card className="border-secondary/20 shadow-md overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="bg-secondary text-primary-foreground border-b border-secondary/10 p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary-foreground" />
            <h3 className="text-lg font-bold text-primary-foreground font-headline tracking-wide">Notice Details</h3>
          </div>

          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cancellation Date</Label>
                <DatePicker
                  date={formData.cancellationDate ? new Date(formData.cancellationDate + 'T00:00:00') : undefined}
                  setDate={(d) => setFormData(prev => ({ ...prev, cancellationDate: d ? format(d, 'yyyy-MM-dd') : '' }))}
                  placeholder="Pick cancellation date"
                />
                <p className="text-xs text-muted-foreground italic">
                  Always the last day of a month. Notices self-cancel at 1 year unless a longer Canc date is set (SECNAV M-5215.1).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulletin-Specific Fields */}
      {formData.documentType === 'bulletin' && (
        <Card className="border-secondary/20 shadow-md overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="bg-secondary text-primary-foreground border-b border-secondary/10 p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary-foreground" />
            <h3 className="text-lg font-bold text-primary-foreground font-headline tracking-wide">Bulletin Details</h3>
          </div>

          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cancellation Date</Label>
                <DatePicker
                  date={formData.cancellationDate ? new Date(formData.cancellationDate + 'T00:00:00') : undefined}
                  setDate={(d) => setFormData(prev => ({ ...prev, cancellationDate: d ? format(d, 'yyyy-MM-dd') : '' }))}
                  placeholder="Pick cancellation date"
                />
                <p className="text-xs text-muted-foreground italic">
                  Typically 12 months from issue date. Will display as "Mon YYYY" (e.g., Jan 2027).
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cancellation Type</Label>
                <Select
                  value={formData.cancellationType || 'fixed'}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, cancellationType: val as 'fixed' | 'contingent' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Date</SelectItem>
                    <SelectItem value="contingent">Contingent (Action Complete)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground italic">
                  "Contingent" adds a mandatory cancellation paragraph.
                </p>
              </div>
            </div>

            {/* Visual indicator when contingent is selected */}
            {formData.cancellationType === 'contingent' && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg animate-in fade-in slide-in-from-top-2">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Cancellation Contingency Paragraph Added
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    A mandatory "Cancellation Contingency" paragraph has been added to the body section below.
                    Fill it in to describe when this bulletin will be cancelled.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
