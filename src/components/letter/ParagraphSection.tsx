
/**
 * Paragraph Section Component
 * Manages the body paragraphs with multi-level indentation, voice input, and validation
 * Modernized UI based on Marine Corps Directives Formatter
 */

import { ParagraphData, AdminSubsections } from '@/types';
import { ClassificationConfig, STANDARD_LEVELS, TRAINING_LEVELS } from '@/lib/classification';
import { ParagraphItem } from './ParagraphItem';
import { 
  Indent,
  AlertTriangle,
  FileText,
  ShieldAlert,
  BookOpen,
  FileWarning
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import React, { useState } from 'react';

interface ParagraphSectionProps {
  paragraphs: ParagraphData[];
  documentType: string;
  adminSubsections?: AdminSubsections;
  onUpdateAdminSubsection?: (key: keyof AdminSubsections, field: 'show' | 'content' | 'order', value: any) => void;
  activeVoiceInput: number | null;
  validateParagraphNumbering: (paragraphs: ParagraphData[]) => string[];
  getUiCitation: (paragraph: ParagraphData, index: number, allParagraphs: ParagraphData[], options?: { fourDigitNumbering?: boolean; chapterNumber?: number }) => string;
  moveParagraphUp: (id: number) => void;
  moveParagraphDown: (id: number) => void;
  updateParagraphContent: (id: number, content: string) => void;
  toggleVoiceInput: (id: number) => void;
  addParagraph: (type: 'main' | 'sub' | 'same' | 'up', afterId: number) => void;
  removeParagraph: (id: number) => void;
  fourDigitNumbering?: boolean;
  chapterNumber?: number;
  /** P2: marking config; portion dropdowns render when enabled. */
  classification?: ClassificationConfig;
  onUpdateMarking?: (id: number, marking: string) => void;
  /** R1: review comments */
  comments?: import('@/lib/review-comments').ReviewComment[];
  reviewMode?: boolean;
  onAddComment?: (comment: import('@/lib/review-comments').ReviewComment) => void;
  onToggleComment?: (id: string) => void;
  onRemoveComment?: (id: string) => void;
  commentAuthor?: string;
}

export function ParagraphSection({
  paragraphs,
  documentType,
  adminSubsections,
  onUpdateAdminSubsection,
  activeVoiceInput,
  validateParagraphNumbering,
  getUiCitation,
  moveParagraphUp,
  moveParagraphDown,
  updateParagraphContent,
  toggleVoiceInput,
  addParagraph,
  removeParagraph,
  fourDigitNumbering,
  chapterNumber,
  classification,
  onUpdateMarking,
  comments,
  reviewMode,
  onAddComment,
  onToggleComment,
  onRemoveComment,
  commentAuthor
}: ParagraphSectionProps) {
  const numberingErrors = validateParagraphNumbering(paragraphs);
  const portionMarking = Boolean(classification?.enabled && classification.portionMarking && onUpdateMarking);
  const markingLevels: string[] = classification?.customLevels
    ? [...STANDARD_LEVELS, ...TRAINING_LEVELS]
    : [...STANDARD_LEVELS];
  const [focusedId, setFocusedId] = useState<number | null>(null);

  // Options for 4-digit numbering (passed through to citation generation)
  const citationOpts = fourDigitNumbering ? { fourDigitNumbering, chapterNumber } : undefined;

  // Compute next citation hints for add-paragraph buttons
  const getNextCitations = (paragraph: ParagraphData, index: number) => {
    const hints: { main?: string; sub?: string; same?: string; up?: string } = {};
    const hypothetical: ParagraphData = { id: -1, level: 1, content: '' };

    // "Main" = new level-1 paragraph after current
    hypothetical.level = 1;
    const withMain = [...paragraphs.slice(0, index + 1), hypothetical, ...paragraphs.slice(index + 1)];
    hints.main = getUiCitation(hypothetical, index + 1, withMain, citationOpts);

    // "Sub" = new paragraph at level+1 after current
    if (paragraph.level < 8) {
      hypothetical.level = paragraph.level + 1;
      const withSub = [...paragraphs.slice(0, index + 1), { ...hypothetical }, ...paragraphs.slice(index + 1)];
      hints.sub = getUiCitation({ ...hypothetical }, index + 1, withSub, citationOpts);
    }

    // "Same" = new paragraph at same level after current
    if (paragraph.level > 1) {
      hypothetical.level = paragraph.level;
      const withSame = [...paragraphs.slice(0, index + 1), { ...hypothetical }, ...paragraphs.slice(index + 1)];
      hints.same = getUiCitation({ ...hypothetical }, index + 1, withSame, citationOpts);
    }

    // "Up" = new paragraph at level-1 after current
    if (paragraph.level > 2) {
      hypothetical.level = paragraph.level - 1;
      const withUp = [...paragraphs.slice(0, index + 1), { ...hypothetical }, ...paragraphs.slice(index + 1)];
      hints.up = getUiCitation({ ...hypothetical }, index + 1, withUp, citationOpts);
    }

    return hints;
  };

  const isDirective = documentType === 'order' || documentType === 'bulletin' || documentType === 'directive';
  const showAdminSubsections = isDirective && adminSubsections && onUpdateAdminSubsection;

  // Updated to use more neutral/theme-compatible colors
  const getLevelColor = (level: number) => {
    const colors = {
      1: 'bg-background border-border', // Main level
      2: 'bg-muted/30 border-border/80', // First indent
      3: 'bg-muted/50 border-border/60', // Second indent
      4: 'bg-muted/70 border-border/40', // Third indent
      5: 'bg-muted/90 border-border/20', // Deep indent
    };
    return colors[level as keyof typeof colors] || 'bg-background border-border';
  };

  return (
    <Card className="mb-8 border-border shadow-sm border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="text-lg font-semibold flex items-center font-headline tracking-wide">
          <Indent className="mr-2 h-5 w-5 text-primary-foreground" />
          Body Paragraphs
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        {numberingErrors.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 rounded-r-md shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Paragraph Numbering Issues</h3>
                <div className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  {numberingErrors.map((error, index) => (
                    <p key={index}>• {error}</p>
                  ))}
                </div>
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Per MCO 5215.1K para 32h: A paragraph may not be subdivided unless it produces at least two subdivisions.
                </p>
              </div>
            </div>
          </div>
        )}

        {showAdminSubsections && adminSubsections && onUpdateAdminSubsection && (
          <div className="p-4 bg-muted/20 rounded-lg border border-border">
            <h3 className="text-sm font-semibold mb-4 flex items-center text-primary">
              <BookOpen className="w-4 h-4 mr-2" />
              Directive Administration Statements
            </h3>
            
            <div className="space-y-6">
              {/* Records Management */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Records Management</Label>
                    <p className="text-xs text-muted-foreground">Mandatory for all Orders (MCO 5210.1)</p>
                  </div>
                  <Switch
                    checked={adminSubsections.recordsManagement.show}
                    onCheckedChange={(checked) => onUpdateAdminSubsection('recordsManagement', 'show', checked)}
                  />
                </div>
                {adminSubsections.recordsManagement.show && (
                  <Textarea
                    value={adminSubsections.recordsManagement.content}
                    onChange={(e) => onUpdateAdminSubsection('recordsManagement', 'content', e.target.value)}
                    className="min-h-[100px] text-sm bg-background"
                    placeholder="Records created as a result of this Order shall be managed..."
                  />
                )}
              </div>

              <Separator />

              {/* Privacy Act */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Privacy Act Statement</Label>
                    <p className="text-xs text-muted-foreground">Required if PII is collected/handled</p>
                  </div>
                  <Switch
                    checked={adminSubsections.privacyAct.show}
                    onCheckedChange={(checked) => onUpdateAdminSubsection('privacyAct', 'show', checked)}
                  />
                </div>
                {adminSubsections.privacyAct.show && (
                  <Textarea
                    value={adminSubsections.privacyAct.content}
                    onChange={(e) => onUpdateAdminSubsection('privacyAct', 'content', e.target.value)}
                    className="min-h-[100px] text-sm bg-background"
                    placeholder="Any misuse or unauthorized disclosure of Personally Identifiable Information (PII)..."
                  />
                )}
              </div>

              <Separator />

               {/* Reports Required */}
               <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Reports Required</Label>
                    <p className="text-xs text-muted-foreground">List any reports required by this directive</p>
                  </div>
                  <Switch
                    checked={adminSubsections.reportsRequired.show}
                    onCheckedChange={(checked) => onUpdateAdminSubsection('reportsRequired', 'show', checked)}
                  />
                </div>
                {adminSubsections.reportsRequired.show && (
                  <Textarea
                    value={adminSubsections.reportsRequired.content}
                    onChange={(e) => onUpdateAdminSubsection('reportsRequired', 'content', e.target.value)}
                    className="min-h-[60px] text-sm bg-background"
                    placeholder="None."
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {paragraphs.map((paragraph, index) => {
            let citation = getUiCitation(paragraph, index, paragraphs, citationOpts);
            
            if (documentType === 'information-paper' && paragraph.level > 1) {
              citation = (paragraph.level === 2 ? '•' : paragraph.level === 3 ? '◦' : '▪');
            } else if (documentType === 'business-letter') {
               if (paragraph.level === 1) {
                   citation = '';
               } else {
                   // Strip parent prefixes for business letters as main paragraphs aren't numbered
                   // This is a heuristic: take the last part of the citation if it looks like a path
                   // But getUiCitation returns things like "1a". We just want "a".
                   // Actually, standard naval letter format for sub-paragraphs is just "a", "b", etc. 
                   // If getUiCitation returns "1a", we need to strip the "1".
                   // A simple way is to re-calculate the local marker or strip digits from start.
                   // However, for level 3 "(1)", it might be "1a(1)".
                   
                   // Let's rely on the fact that getUiCitation composes paths.
                   // We basically want the "local" citation part.
                   // But we don't have access to getCitationPart here.
                   
                   // HACK: Use a regex to extract the last segment?
                   // Level 2: "a" (from "1a")
                   // Level 3: "(1)" (from "1a(1)")
                   
                   // Actually, let's just show the full citation for now but check if it looks weird.
                   // If level 1 is hidden, level 2 "1a" looks weird.
                   // Let's try to match the last character(s).
                   
                   // Better approach: Re-implement local counting for business letter here or update useParagraphs.
                   // Since useParagraphs is a hook, updating it affects everything.
                   // Let's just do a localized fix.
                   
                   // For level 2 (a, b, c):
                   const matchAlpha = citation.match(/[a-z]$/);
                   if (paragraph.level === 2 && matchAlpha) {
                       citation = matchAlpha[0] + ".";
                   }
                   
                   // For level 3 (1), (2):
                   const matchParen = citation.match(/\(\d+\)$/);
                   if (paragraph.level === 3 && matchParen) {
                       citation = matchParen[0];
                   }
                   
                   // For level 4 (a), (b):
                   const matchParenAlpha = citation.match(/\([a-z]\)$/);
                   if (paragraph.level === 4 && matchParenAlpha) {
                       citation = matchParenAlpha[0];
                   }
               }
            }
            
            return (
              <ParagraphItem
            key={paragraph.id}
            paragraph={paragraph}
            index={index}
            totalParagraphs={paragraphs.length}
            activeVoiceInput={activeVoiceInput}
            citation={citation}
            levelColor={getLevelColor(paragraph.level)}
            titleBadgeColor="bg-primary/10 text-primary border border-primary/20"
            onUpdateContent={updateParagraphContent}
            onMoveUp={moveParagraphUp}
            onMoveDown={moveParagraphDown}
            onToggleVoice={toggleVoiceInput}
            onAddParagraph={addParagraph}
            onRemove={removeParagraph}
            onFocus={setFocusedId}
            isFocused={focusedId === paragraph.id}
            documentType={documentType}
            nextCitations={getNextCitations(paragraph, index)}
            portionMarking={portionMarking}
            markingLevels={markingLevels}
            onUpdateMarking={onUpdateMarking}
            comments={comments}
            showComments={Boolean(reviewMode || (comments ?? []).some((c) => c.anchor === `paragraph:${paragraph.id}`))}
            onAddComment={onAddComment}
            onToggleComment={onToggleComment}
            onRemoveComment={onRemoveComment}
            commentAuthor={commentAuthor}
          />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
