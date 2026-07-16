/**
 * Enclosures Section Component
 * Manages the list of document enclosures with dynamic add/remove functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { FormData } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AttachedEnclosures } from './AttachedEnclosures';
import { EnclosureAttachment } from '@/lib/enclosure-attachments';

interface EnclosuresSectionProps {
  enclosures: string[];
  setEnclosures: (encls: string[]) => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
  /** P3.6: attached PDF enclosures (session-scoped, PDF export merge) */
  attachments?: EnclosureAttachment[];
  onAddAttachment?: (attachment: EnclosureAttachment) => void;
  onRemoveAttachment?: (id: string) => void;
  onMoveAttachment?: (index: number, direction: -1 | 1) => void;
  attachmentCoverPages?: boolean;
  onAttachmentCoverPagesChange?: (value: boolean) => void;
}

export function EnclosuresSection({ enclosures, setEnclosures, formData, setFormData, attachments, onAddAttachment, onRemoveAttachment, onMoveAttachment, attachmentCoverPages, onAttachmentCoverPagesChange }: EnclosuresSectionProps) {
  const [showEncl, setShowEncl] = useState(false);

  useEffect(() => {
    setShowEncl(enclosures.some(e => e.trim() !== ''));
  }, [enclosures]);

  const addItem = useCallback(() => setEnclosures([...enclosures, '']), [enclosures, setEnclosures]);
  const removeItem = useCallback((index: number) => setEnclosures(enclosures.filter((_, i) => i !== index)), [enclosures, setEnclosures]);
  const updateItem = useCallback((index: number, value: string) => setEnclosures(enclosures.map((item, i) => i === index ? value : item)), [enclosures, setEnclosures]);

  const isPositionPaper = formData.documentType === 'position-paper';
  const labelText = isPositionPaper ? 'Tabs' : 'Enclosures';
  const itemLabel = isPositionPaper ? 'Tab' : 'Enclosure';
  const itemPlaceholder = isPositionPaper 
    ? 'Enter tab details (e.g., Detailed Financial Analysis)' 
    : 'Enter enclosure details (e.g., Training Certificate, Medical Records)';

  const getEnclosureIndicator = (index: number, startingNumber: string): string => {
    if (isPositionPaper) {
        // Tabs use Letters (A, B, C...)
        return String.fromCharCode(65 + index); // 65 is 'A'
    }
    return `(${parseInt(startingNumber || '1', 10) + index})`;
  };

  const handleRadioChange = (value: string) => {
    if (value === 'yes') {
      setShowEncl(true);
      if (enclosures.length === 0) setEnclosures(['']);
    } else {
      setShowEncl(false);
      setEnclosures(['']);
    }
  };

  const generateEnclosureOptions = () => {
    return Array.from({ length: 20 }, (_, i) => {
      const num = i + 1;
      return {
        value: num.toString(),
        label: `Start with enclosure (${num})`
      };
    });
  };

  return (
    <Card className="shadow-sm border-border mb-6 border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold font-headline tracking-wide">
          <Paperclip className="mr-2 h-5 w-5 text-primary-foreground" />
          {labelText}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-6 pt-2">
          <RadioGroup 
            defaultValue={showEncl ? 'yes' : 'no'} 
            value={showEncl ? 'yes' : 'no'}
            onValueChange={handleRadioChange}
            className="flex flex-row gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="encl-yes" />
              <Label htmlFor="encl-yes" className="cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="encl-no" />
              <Label htmlFor="encl-no" className="cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </div>

        {!showEncl && (
          <p className="text-sm text-muted-foreground pt-1">
            Select &quot;Yes&quot; to attach supporting documents (e.g., training certificates, reports).
          </p>
        )}

        {showEncl && (
          <div className="space-y-4 pt-2">
            {formData.documentType === 'endorsement' && (
              <>
                <Alert variant="default" className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200 font-semibold ml-2">Endorsement Enclosure Rules</AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300 ml-2">
                    Only add NEW enclosures not mentioned in the basic letter or previous endorsements. Continue the numbering sequence from the last enclosure.
                  </AlertDescription>
                </Alert>
                
                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap">Starting Enclosure:</Label>
                  <Select
                    value={formData.startingEnclosureNumber}
                    onValueChange={(val) => setFormData({ ...formData, startingEnclosureNumber: val })}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select starting number" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateEnclosureOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-3">
              <Label className="font-semibold mb-2 flex items-center">
                <Paperclip className="mr-2 h-4 w-4" />
                Enter {itemLabel}(s):
              </Label>
              {enclosures.map((encl, index) => (
                <div key={`encl-${index}`} className="flex w-full gap-2 items-center">
                  <span className="flex h-10 w-12 items-center justify-center flex-shrink-0 rounded-md bg-secondary text-secondary-foreground border border-secondary font-medium shadow-sm">
                    {getEnclosureIndicator(index, formData.startingEnclosureNumber)}
                  </span>
                  <Input
                    className="flex-1 border-input focus-visible:ring-primary"
                    type="text"
                    placeholder={itemPlaceholder}
                    value={encl}
                    onChange={(e) => updateItem(index, e.target.value)}
                    aria-label={`${itemLabel} ${getEnclosureIndicator(index, formData.startingEnclosureNumber)}`}
                  />
                  {index === enclosures.length - 1 ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="flex-shrink-0 border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                      onClick={addItem}
                      title="Add Enclosure"
                    aria-label="Add Enclosure"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      className="flex-shrink-0 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => removeItem(index)}
                      title="Remove Enclosure"
                    aria-label="Remove Enclosure"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {!isPositionPaper && attachments && onAddAttachment && onRemoveAttachment && onMoveAttachment && onAttachmentCoverPagesChange && (
              <AttachedEnclosures
                attachments={attachments}
                onAdd={onAddAttachment}
                onRemove={onRemoveAttachment}
                onMove={onMoveAttachment}
                coverPages={attachmentCoverPages ?? true}
                onCoverPagesChange={onAttachmentCoverPagesChange}
                startingNumber={parseInt(formData.startingEnclosureNumber || '1', 10) + Math.max(0, enclosures.filter(e => e.trim()).length - attachments.length)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
