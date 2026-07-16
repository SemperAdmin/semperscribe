import React, { useRef, useState, useEffect } from 'react';
import { ParagraphData } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { SpellCheckBar } from '@/components/ui/SpellCheckBar';
import { useSpellCheck } from '@/hooks/useSpellCheck';
import {
  Mic,
  MicOff,
  Plus,
  ChevronUp,
  ChevronDown,
  Eraser,
  Indent,
  ArrowRight,
  AlertTriangle,
  Bold,
  Italic,
  Underline,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { portionPrefix } from '@/lib/classification';

interface ParagraphItemProps {
  paragraph: ParagraphData;
  index: number;
  totalParagraphs: number;
  activeVoiceInput: number | null;
  citation: string;
  levelColor: string;
  titleBadgeColor: string;
  onUpdateContent: (id: number, content: string) => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
  onToggleVoice: (id: number) => void;
  onAddParagraph: (type: 'main' | 'sub' | 'same' | 'up', afterId: number) => void;
  onRemove: (id: number) => void;
  onFocus: (id: number) => void;
  isFocused: boolean;
  documentType?: string;
  nextCitations?: { main?: string; sub?: string; same?: string; up?: string };
  /** P2: portion marking dropdown */
  portionMarking?: boolean;
  markingLevels?: string[];
  onUpdateMarking?: (id: number, marking: string) => void;
}

/**
 * Parses markdown-like formatting markers into styled React elements for UI preview.
 * Supports nested formatting: ***bold italic***, **<u>bold underline</u>**, *<u>italic underline</u>*, etc.
 */
function renderFormattedPreview(text: string): React.ReactNode[] {
  if (!text) return [];

  const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|<u>.*?<\/u>)/g);

  return parts.map((part, index) => {
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return <strong key={index}><em>{renderFormattedPreview(part.slice(3, -3))}</em></strong>;
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index}>{renderFormattedPreview(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={index}>{renderFormattedPreview(part.slice(1, -1))}</em>;
    }
    if (part.startsWith('<u>') && part.endsWith('</u>') && part.length >= 7) {
      return <span key={index} className="underline">{renderFormattedPreview(part.slice(3, -4))}</span>;
    }
    return part;
  });
}

export function ParagraphItem({
  paragraph,
  index,
  totalParagraphs,
  activeVoiceInput,
  citation,
  levelColor,
  titleBadgeColor,
  onUpdateContent,
  onMoveUp,
  onMoveDown,
  onToggleVoice,
  onAddParagraph,
  onRemove,
  onFocus,
  isFocused,
  documentType,
  nextCitations,
  portionMarking,
  markingLevels,
  onUpdateMarking
}: ParagraphItemProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localContent, setLocalContent] = useState(paragraph.content || '');
  const lastEmitted = useRef(paragraph.content || '');
  const [isEditing, setIsEditing] = useState(false);
  const { issues: spellIssues } = useSpellCheck(localContent);

  // Sync from props if paragraph.content changes externally
  useEffect(() => {
    if (paragraph.content !== lastEmitted.current) {
      setLocalContent(paragraph.content || '');
      lastEmitted.current = paragraph.content || '';
    }
  }, [paragraph.content]);

  // Debounce update to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localContent !== lastEmitted.current) {
        lastEmitted.current = localContent;
        onUpdateContent(paragraph.id, localContent);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localContent, paragraph.id, onUpdateContent]);

  // Auto-grow textarea to fit content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && isEditing) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [localContent, isEditing]);

  const applyFormat = (type: 'bold' | 'italic' | 'underline') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = localContent || '';

    if (start === end) return; // No selection

    const selection = text.substring(start, end);

    // Strip existing formatting layers to detect what's already applied
    let inner = selection;
    let hasBold = false;
    let hasItalic = false;
    let hasUnderline = false;

    let changed = true;
    while (changed) {
      changed = false;
      if (inner.startsWith('***') && inner.endsWith('***') && inner.length >= 6) {
        hasBold = true;
        hasItalic = true;
        inner = inner.slice(3, -3);
        changed = true;
      } else if (inner.startsWith('**') && inner.endsWith('**') && inner.length >= 4) {
        hasBold = true;
        inner = inner.slice(2, -2);
        changed = true;
      } else if (inner.startsWith('*') && inner.endsWith('*') && inner.length >= 2) {
        hasItalic = true;
        inner = inner.slice(1, -1);
        changed = true;
      }
      if (inner.startsWith('<u>') && inner.endsWith('</u>') && inner.length >= 7) {
        hasUnderline = true;
        inner = inner.slice(3, -4);
        changed = true;
      }
    }

    // Toggle the requested format
    if (type === 'bold') hasBold = !hasBold;
    else if (type === 'italic') hasItalic = !hasItalic;
    else if (type === 'underline') hasUnderline = !hasUnderline;

    // Rebuild with correct nesting: asterisks outside, underline inside
    let formatted = inner;
    if (hasUnderline) formatted = `<u>${formatted}</u>`;
    if (hasBold && hasItalic) formatted = `***${formatted}***`;
    else if (hasBold) formatted = `**${formatted}**`;
    else if (hasItalic) formatted = `*${formatted}*`;

    const newContent = text.substring(0, start) + formatted + text.substring(end);
    setLocalContent(newContent);

    // Restore focus and selection to cover the formatted result
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + formatted.length);
    }, 0);
  };

  return (
    <Card 
      id={`paragraph-${paragraph.id}`}
      className={cn(
        "transition-all duration-300 border-l-4 shadow-sm hover:shadow-md bg-card text-card-foreground",
        // Dynamic border colors based on level
        paragraph.level === 1 ? 'border-l-primary' :
        paragraph.level === 2 ? 'border-l-primary/80' :
        paragraph.level === 3 ? 'border-l-primary/60' :
        paragraph.level === 4 ? 'border-l-primary/40' : 'border-l-muted',
        isFocused && "ring-2 ring-primary/20 shadow-md"
      )}
      style={{ marginLeft: `${Math.min((paragraph.level - 1) * 24, 48)}px` }}
    >
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <Badge 
              variant="outline" 
              className="text-xs font-mono bg-secondary/10 text-primary border-primary/20 font-bold"
            >
              L{paragraph.level} • {citation}
            </Badge>

            {portionMarking && onUpdateMarking && (
              <select
                value={paragraph.marking ?? ''}
                onChange={(e) => onUpdateMarking(paragraph.id, e.target.value)}
                className="h-6 rounded border border-border bg-background text-xs px-1 text-foreground"
                title="Portion marking"
                aria-label="Portion marking"
              >
                <option value="">Banner default</option>
                {(markingLevels ?? []).map((level) => (
                  <option key={level} value={level}>{portionPrefix(level)} {level}</option>
                ))}
              </select>
            )}

            {/* Ensure MOU displays "UNDERSTANDING" for paragraph 4, even if data says "AGREEMENT" due to legacy state */}
            {paragraph.title && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
                {documentType === 'mou' && paragraph.title === 'AGREEMENT' ? 'UNDERSTANDING' : paragraph.title}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-1">
            {index > 0 && (
                <Button
                variant="ghost"
                size="sm"
                onClick={() => onMoveUp(paragraph.id)}
                className="h-8 w-8 p-0 hover:bg-primary/10 text-muted-foreground hover:text-primary"
                title="Move Up"
                >
                <ChevronUp className="h-4 w-4" />
                </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMoveDown(paragraph.id)}
              disabled={index === totalParagraphs - 1}
              className="h-8 w-8 p-0 hover:bg-primary/10 text-muted-foreground hover:text-primary"
              title="Move Down"
              >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        <div className="relative group">
          {/* Formatting Toolbar - shown only in edit mode */}
          {isEditing && (
            <div className="flex items-center gap-1 mb-1.5 opacity-100 transition-opacity bg-accent/5 w-fit p-1 rounded-md border border-border/50">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-primary/10 text-muted-foreground hover:text-primary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyFormat('bold')}
                title="Bold (**text**)"
              >
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-primary/10 text-muted-foreground hover:text-primary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyFormat('italic')}
                title="Italic (*text*)"
              >
                <Italic className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-primary/10 text-muted-foreground hover:text-primary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyFormat('underline')}
                title="Underline (<u>text</u>)"
              >
                <Underline className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {isEditing ? (
            <Textarea
              ref={textareaRef}
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              onFocus={() => onFocus(paragraph.id)}
              onBlur={() => {
                onFocus(-1);
                setIsEditing(false);
              }}
              placeholder="Enter paragraph content..."
              className="min-h-[100px] resize-none overflow-hidden focus:ring-2 focus:ring-primary/50 pr-16 text-base font-serif bg-background text-foreground border-border"
              autoFocus
            />
          ) : (
            <div
              onClick={() => {
                setIsEditing(true);
                setTimeout(() => textareaRef.current?.focus(), 0);
              }}
              className="min-h-[100px] p-3 text-base font-serif bg-background text-foreground border border-border rounded-md cursor-text whitespace-pre-wrap"
            >
              {localContent
                ? renderFormattedPreview(localContent)
                : <span className="text-muted-foreground">Enter paragraph content...</span>
              }
            </div>
          )}

          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground pointer-events-none group-hover:text-foreground transition-colors">
            {(localContent || '').length} chars
          </div>
        </div>

        {spellIssues.length > 0 && (
          <SpellCheckBar issues={spellIssues} />
        )}

        {paragraph.acronymError && (
            <div className="flex items-center text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
            <AlertTriangle className="h-3 w-3 mr-1.5" />
            {paragraph.acronymError}
            </div>
        )}

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
          <Button
            variant={activeVoiceInput === paragraph.id ? "destructive" : "outline"}
            size="sm"
            onClick={() => onToggleVoice(paragraph.id)}
            className={cn(
              "flex items-center space-x-1.5 h-8 text-xs",
              activeVoiceInput === paragraph.id && 'animate-pulse'
            )}
          >
            {activeVoiceInput === paragraph.id ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            <span>{activeVoiceInput === paragraph.id ? 'Recording...' : 'Voice'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdateContent(paragraph.id, '')}
            disabled={!paragraph.content}
            className="flex items-center space-x-1.5 h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Clear content"
          >
            <Eraser className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(paragraph.id)}
            className="flex items-center space-x-1.5 h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Delete paragraph"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          <div className="flex-1"></div>

          <div className="flex items-center bg-muted/20 rounded-md p-1 gap-1 border border-border">
            {!['information-paper', 'position-paper'].includes(documentType || '') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddParagraph('main', paragraph.id)}
                className="h-7 px-2 text-xs font-medium hover:bg-background hover:shadow-sm hover:text-primary"
                title="Add Main Paragraph (Next Number)"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {nextCitations?.main ? `+ ${nextCitations.main}` : 'Main'}
              </Button>
            )}

            {!['information-paper', 'position-paper'].includes(documentType || '') && <div className="w-px h-4 bg-border mx-0.5"></div>}

            {paragraph.level < (['information-paper', 'position-paper'].includes(documentType || '') ? 4 : 8) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddParagraph('sub', paragraph.id)}
                className="h-7 px-2 text-xs hover:bg-background hover:shadow-sm hover:text-primary"
                title="Add Sub-paragraph (Indent)"
              >
                <Indent className="h-3.5 w-3.5 mr-1" />
                {nextCitations?.sub ? `+ ${nextCitations.sub}` : 'Sub'}
              </Button>
            )}

            {paragraph.level > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddParagraph('same', paragraph.id)}
                className="h-7 px-2 text-xs hover:bg-background hover:shadow-sm hover:text-primary"
                title="Add Sibling Paragraph (Same Level)"
              >
                <ArrowRight className="h-3.5 w-3.5 mr-1" />
                {nextCitations?.same ? `+ ${nextCitations.same}` : 'Same'}
              </Button>
            )}

            {paragraph.level > 2 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAddParagraph('up', paragraph.id)}
                    className="h-7 px-2 text-xs hover:bg-background hover:shadow-sm hover:text-primary"
                    title="Add Paragraph Level Up (Outdent)"
                >
                    <ArrowRight className="h-3.5 w-3.5 mr-1 transform rotate-180" />
                    {nextCitations?.up ? `+ ${nextCitations.up}` : 'Up'}
                </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
