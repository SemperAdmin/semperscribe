import React, { useEffect } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import { FormData, AMHSReference } from '@/types';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { AMHSDefinition } from '@/lib/schemas';
import { ReferenceManager } from './ReferenceManager';
import { POCManager } from './POCManager';
import { MessageBodyEditor } from './MessageBodyEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Clock } from 'lucide-react';
import { generateDTG } from '@/services/amhs/amhsFormatter';

interface AMHSEditorProps {
  formData: FormData;
  onUpdate: (data: Partial<FormData>) => void;
}

export function AMHSEditor({ formData, onUpdate }: AMHSEditorProps) {

  // Auto-generate the DTG once, at first load, when the message has
  // none. Mount-only on purpose: the field is editable, and re-running
  // whenever it empties would refill it under the user's cursor. The
  // ref supplies the current field value and callback to that one run.
  const latest = useLatestRef({ amhsDtg: formData.amhsDtg, onUpdate });
  useEffect(() => {
    if (!latest.current.amhsDtg) {
      latest.current.onUpdate({ amhsDtg: generateDTG() });
    }
  }, [latest]);

  const handleRefreshDTG = () => {
    onUpdate({ amhsDtg: generateDTG() });
  };

  const handleReferencesChange = (refs: AMHSReference[]) => {
    onUpdate({ amhsReferences: refs });
  };

  const handleNarrativeChange = (narrative: string) => {
    onUpdate({ amhsNarrative: narrative });
  };

  const handlePocsChange = (pocs: string[]) => {
    onUpdate({ amhsPocs: pocs });
  };

  const handleBodyChange = (text: string) => {
    onUpdate({ amhsTextBody: text });
  };

  const handleFormChange = (data: any) => {
    onUpdate(data);
  };

  if (!AMHSDefinition) {
    console.error("AMHSDefinition is undefined. Check schemas.ts export.");
    return <div className="p-4 text-destructive border border-destructive rounded bg-destructive/10">
      Error: AMHS Definition failed to load. Please refresh or check console.
    </div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* DTG with Refresh Button */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Date-Time Group
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="dtg-input" className="text-xs">DTG (Zulu Time)</Label>
              <Input
                id="dtg-input"
                value={formData.amhsDtg || ''}
                onChange={(e) => onUpdate({ amhsDtg: e.target.value.toUpperCase() })}
                placeholder="DDHHMMZMMMYY"
                className="font-mono uppercase"
              />
            </div>
            <Button onClick={handleRefreshDTG} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Format: DDHHMM(Z)MMMYY. Auto-generated in Zulu (GMT) time.
          </p>
        </CardContent>
      </Card>

      {/* Metadata & Header */}
      <DynamicForm
        documentType={AMHSDefinition}
        onSubmit={handleFormChange}
        defaultValues={formData}
      />
      
      {/* References */}
      <ReferenceManager
        references={formData.amhsReferences || []}
        onChange={handleReferencesChange}
        narrative={formData.amhsNarrative || ''}
        onNarrativeChange={handleNarrativeChange}
      />

      {/* POCs */}
      <POCManager 
        pocs={formData.amhsPocs || []} 
        onChange={handlePocsChange} 
      />
      
      {/* Body */}
      <MessageBodyEditor 
        value={formData.amhsTextBody || ''} 
        onChange={handleBodyChange} 
      />
    </div>
  );
}
