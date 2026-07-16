import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ArrowRight, CheckSquare, List, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

interface DecisionGridData {
  recommenders: Array<{
    id: string;
    role: string;
    options: string[];
  }>;
  finalDecision: {
    role: string;
    options: string[];
  };
  coas?: string[];
  recommendationItems?: Array<{
    id: string;
    text: string;
  }>;
}

type DecisionMode = 'SINGLE' | 'MULTIPLE_CHOICE' | 'MULTIPLE_RECS';

interface DecisionGridSectionProps {
  data: DecisionGridData;
  mode: DecisionMode;
  onDataChange: (data: DecisionGridData) => void;
  onModeChange: (mode: DecisionMode) => void;
}

const DEFAULT_OPTIONS = ['Approve', 'Disapprove'];
const DEFAULT_FINAL_OPTIONS = ['Approved', 'Disapproved'];

export function DecisionGridSection({ data, mode, onDataChange, onModeChange }: DecisionGridSectionProps) {
  // Ensure we have valid data structure to work with
  const safeData: DecisionGridData = {
    recommenders: data?.recommenders || [],
    finalDecision: data?.finalDecision || { role: 'CMC', options: [...DEFAULT_FINAL_OPTIONS] },
    coas: data?.coas || [],
    recommendationItems: data?.recommendationItems || []
  };

  const handleModeChange = (newMode: DecisionMode) => {
    onModeChange(newMode);
    
    // Reset options based on mode
    let newRecommenders = [...safeData.recommenders];
    let newFinalDecision = { ...safeData.finalDecision };
    
    if (newMode === 'SINGLE' || newMode === 'MULTIPLE_RECS') {
        // Reset to Approve/Disapprove
        newRecommenders = newRecommenders.map(rec => ({
            ...rec,
            options: [...DEFAULT_OPTIONS]
        }));
        newFinalDecision.options = [...DEFAULT_FINAL_OPTIONS];
    } else if (newMode === 'MULTIPLE_CHOICE') {
        // Reset to COAs if exist, or empty
        const coas = safeData.coas && safeData.coas.length > 0 ? safeData.coas : ['COA 1', 'COA 2'];
        newRecommenders = newRecommenders.map(rec => ({
            ...rec,
            options: [...coas]
        }));
        newFinalDecision.options = [...coas]; // Initialize with COAs
        
        // Also update COAs if empty
        if (!safeData.coas || safeData.coas.length === 0) {
            onDataChange({ ...safeData, recommenders: newRecommenders, finalDecision: newFinalDecision, coas: ['COA 1', 'COA 2'] });
            return;
        }
    }
    
    onDataChange({ ...safeData, recommenders: newRecommenders, finalDecision: newFinalDecision });
  };

  const addRecommender = () => {
    let options = [...DEFAULT_OPTIONS];
    if (mode === 'MULTIPLE_CHOICE' && safeData.coas && safeData.coas.length > 0) {
        options = [...safeData.coas];
    }

    const newData = {
      ...safeData,
      recommenders: [
        ...safeData.recommenders,
        {
          id: crypto.randomUUID(),
          role: '',
          options
        }
      ]
    };
    onDataChange(newData);
  };

  const updateRecommender = (index: number, field: 'role' | 'options', value: any) => {
    const newRecommenders = [...safeData.recommenders];
    newRecommenders[index] = { ...newRecommenders[index], [field]: value };
    onDataChange({ ...safeData, recommenders: newRecommenders });
  };

  const removeRecommender = (index: number) => {
    const newRecommenders = safeData.recommenders.filter((_, i) => i !== index);
    onDataChange({ ...safeData, recommenders: newRecommenders });
  };

  const updateFinalDecision = (field: 'role' | 'options', value: any) => {
    onDataChange({
      ...safeData,
      finalDecision: { ...safeData.finalDecision, [field]: value }
    });
  };

  // --- COA Management (Mode B) ---
  const addCoa = () => {
      const newCoas = [...(safeData.coas || []), `COA ${(safeData.coas?.length || 0) + 1}`];
      updateCoas(newCoas);
  };

  const removeCoa = (index: number) => {
      const newCoas = (safeData.coas || []).filter((_, i) => i !== index);
      updateCoas(newCoas);
  };

  const updateCoa = (index: number, value: string) => {
      const newCoas = [...(safeData.coas || [])];
      newCoas[index] = value;
      updateCoas(newCoas);
  };

  const updateCoas = (newCoas: string[]) => {
      // Sync COAs to all recommenders
      const newRecommenders = safeData.recommenders.map(rec => ({
          ...rec,
          options: [...newCoas]
      }));
      
      // Also sync to Final Decision (user can manually add extras afterwards)
      const newFinalDecision = {
          ...safeData.finalDecision,
          options: [...newCoas]
      };
      
      onDataChange({
          ...safeData,
          coas: newCoas,
          recommenders: newRecommenders,
          finalDecision: newFinalDecision
      });
  };

  // --- Recommendation Items Management (Mode C) ---
  const addRecItem = () => {
      const newItems = [...(safeData.recommendationItems || []), { id: crypto.randomUUID(), text: '' }];
      onDataChange({ ...safeData, recommendationItems: newItems });
  };

  const removeRecItem = (index: number) => {
      const newItems = (safeData.recommendationItems || []).filter((_, i) => i !== index);
      onDataChange({ ...safeData, recommendationItems: newItems });
  };

  const updateRecItem = (index: number, text: string) => {
      const newItems = [...(safeData.recommendationItems || [])];
      newItems[index] = { ...newItems[index], text };
      onDataChange({ ...safeData, recommendationItems: newItems });
  };

  return (
    <Card className="border-l-4 border-l-blue-600">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Layers className="w-5 h-5 mr-2 text-blue-600" />
          Decision Grid & Recommendations
        </CardTitle>
        <CardDescription>
          Configure the recommendation type and routing chain per MCO 5216.20B.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Mode Selection */}
        <div className="space-y-3">
            <Label className="text-base font-medium">Decision Mode</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                    className={`cursor-pointer border rounded-lg p-4 flex flex-col gap-2 hover:bg-accent/50 transition-colors ${mode === 'SINGLE' ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'border-border'}`}
                    onClick={() => handleModeChange('SINGLE')}
                >
                    <div className="flex items-center gap-2 font-semibold">
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                        Single Rec
                    </div>
                    <p className="text-xs text-muted-foreground">Standard Yes/No decision. Grid at bottom.</p>
                </div>

                <div 
                    className={`cursor-pointer border rounded-lg p-4 flex flex-col gap-2 hover:bg-accent/50 transition-colors ${mode === 'MULTIPLE_CHOICE' ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'border-border'}`}
                    onClick={() => handleModeChange('MULTIPLE_CHOICE')}
                >
                    <div className="flex items-center gap-2 font-semibold">
                        <List className="w-4 h-4 text-blue-600" />
                        Multiple Choice
                    </div>
                    <p className="text-xs text-muted-foreground">Select 1 of N COAs. Grid at bottom.</p>
                </div>

                <div 
                    className={`cursor-pointer border rounded-lg p-4 flex flex-col gap-2 hover:bg-accent/50 transition-colors ${mode === 'MULTIPLE_RECS' ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'border-border'}`}
                    onClick={() => handleModeChange('MULTIPLE_RECS')}
                >
                    <div className="flex items-center gap-2 font-semibold">
                        <Layers className="w-4 h-4 text-blue-600" />
                        Multiple Recs
                    </div>
                    <p className="text-xs text-muted-foreground">Independent decisions. Grid interleaved.</p>
                </div>
            </div>
        </div>

        <Separator />

        {/* Dynamic Content based on Mode */}
        
        {/* Mode B: COA Builder */}
        {mode === 'MULTIPLE_CHOICE' && (
            <div className="space-y-4 border rounded-md p-4 bg-secondary/10">
                <Label className="text-base font-medium">Courses of Action (COAs)</Label>
                <p className="text-xs text-muted-foreground mb-2">Define the options available for selection.</p>
                
                {(safeData.coas || []).map((coa, idx) => (
                    <div key={idx} className="flex gap-2">
                        <Input 
                            value={coa} 
                            onChange={(e) => updateCoa(idx, e.target.value)}
                            placeholder={`COA ${idx + 1}`}
                        />
                        <Button variant="ghost" size="icon" aria-label="Remove course of action" onClick={() => removeCoa(idx)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCoa} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Add COA
                </Button>
            </div>
        )}

        {/* Mode C: Recommendation Items */}
        {mode === 'MULTIPLE_RECS' && (
            <div className="space-y-4 border rounded-md p-4 bg-secondary/10">
                <Label className="text-base font-medium">Recommendation Items (Paragraph 4)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                    Enter each independent recommendation. The routing chain grid will be repeated for each item.
                </p>
                
                {(safeData.recommendationItems || []).map((item, idx) => (
                    <div key={item.id} className="flex gap-2 items-start">
                        <span className="mt-3 text-sm font-mono font-bold text-muted-foreground">{String.fromCharCode(97 + idx)}.</span>
                        <Textarea 
                            value={item.text} 
                            onChange={(e) => updateRecItem(idx, e.target.value)}
                            placeholder="Enter recommendation text..."
                            className="flex-1"
                        />
                        <Button variant="ghost" size="icon" aria-label="Remove recommendation item" onClick={() => removeRecItem(idx)} className="mt-1">
                            <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={addRecItem} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Add Recommendation Item
                </Button>
            </div>
        )}

        {/* Recommenders List (Chain of Command) */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Routing Chain (Recommenders)</Label>
          
          {safeData.recommenders.length === 0 && (
            <div className="text-sm text-muted-foreground italic p-4 border border-dashed rounded-md text-center">
              No recommenders added yet. Click "Add Recommender" to start the chain.
            </div>
          )}

          {safeData.recommenders.map((rec, index) => (
            <div key={rec.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-muted/20 p-4 rounded-md border border-border">
              <div className="md:col-span-5 space-y-2">
                <Label className="text-xs">Role / Position</Label>
                <Input
                  value={rec.role}
                  onChange={(e) => updateRecommender(index, 'role', e.target.value)}
                  placeholder="e.g. Dir Ops, DC PP&O"
                  className="bg-background"
                />
              </div>
              
              <div className="md:col-span-6 space-y-2">
                <Label className="text-xs">Options</Label>
                {mode === 'SINGLE' || mode === 'MULTIPLE_RECS' ? (
                     <div className="flex flex-wrap gap-1 mt-1 p-2 bg-background border rounded-md">
                        {rec.options.map((opt, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] h-5">{opt}</Badge>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground p-2 bg-background border rounded-md italic">
                        {rec.options.join(', ')} (Synced with COAs)
                    </div>
                )}
              </div>

              <div className="md:col-span-1 flex justify-end pt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRecommender(index)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button onClick={addRecommender} variant="outline" size="sm" className="w-full border-dashed">
            <Plus className="w-4 h-4 mr-2" />
            Add Recommender
          </Button>
        </div>

        <Separator />

        {/* Final Decision Maker */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Final Decision Authority</Label>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-md border border-blue-100 dark:border-blue-900/30">
            <div className="md:col-span-5 space-y-2">
              <Label className="text-xs">Role / Position</Label>
              <Input
                value={safeData.finalDecision.role}
                onChange={(e) => updateFinalDecision('role', e.target.value)}
                placeholder="e.g. CMC, ACMC"
                className="bg-background"
              />
            </div>
            
            <div className="md:col-span-7 space-y-2">
              <Label className="text-xs">Options (Comma separated)</Label>
              {mode === 'MULTIPLE_CHOICE' ? (
                 <div className="space-y-2">
                    <Input
                        value={safeData.finalDecision.options.join(', ')}
                        onChange={(e) => updateFinalDecision('options', e.target.value.split(',').map(s => s.trim()))}
                        placeholder="COA 1, COA 2, Other"
                        className="bg-background"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                        Defaults to COAs. Add "Other", "Approved", or "Disapproved" if needed for the Decision Authority.
                    </p>
                 </div>
              ) : (
                  <Input
                    value={safeData.finalDecision.options.join(', ')}
                    onChange={(e) => updateFinalDecision('options', e.target.value.split(',').map(s => s.trim()))}
                    placeholder="Approved, Disapproved"
                    className="bg-background"
                  />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
