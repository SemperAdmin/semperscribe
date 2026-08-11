import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Indent, Type } from 'lucide-react';
import { getNextParagraphString } from '@/utils/amhs/paragraphLogic';

interface MessageBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MessageBodyEditor({ value, onChange }: MessageBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;

    const newValue = 
      currentValue.substring(0, start) + 
      text + 
      currentValue.substring(end);

    onChange(newValue);

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const handleSmartInsert = (type: 'main' | 'sub-a' | 'sub-1' | 'sub-a2') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, start);
    
    const textToInsert = getNextParagraphString(type, textBeforeCursor);
    insertText(textToInsert);
  };

  return (
    <Card className="w-full">
      <CardHeader className="py-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Type className="h-5 w-5" />
          Message Text (GENTEXT/REMARKS)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleSmartInsert('main')}>
            1. Main Para
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleSmartInsert('sub-a')}>
            <Indent className="h-4 w-4 mr-1" /> 1.A. Sub Para
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleSmartInsert('sub-1')}>
            <Indent className="h-4 w-4 mr-1" /> 1.A.1. Sub-Sub
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleSmartInsert('sub-a2')}>
            <Indent className="h-4 w-4 mr-1" /> 1.A.1.A. Sub-Sub-Sub
          </Button>
        </div>

        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder="ENTER MESSAGE TEXT HERE..."
            className="font-mono min-h-[400px] uppercase text-sm leading-relaxed"
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 rounded">
            {value.length} chars
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Note: Text will be automatically wrapped to 69 characters per line in the preview/export.
        </div>
      </CardContent>
    </Card>
  );
}
