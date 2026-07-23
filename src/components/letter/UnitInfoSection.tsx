import React, { useState } from 'react';
import { FormData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Building, Search, X, Pencil, Check } from 'lucide-react';
import type { Unit } from '@/lib/units';
import { useUnits } from '@/hooks/useReferenceData';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface UnitInfoSectionProps {
    formData: Partial<FormData>;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  setCurrentUnitCode: (code: string | undefined) => void;
  setCurrentUnitName: (name: string | undefined) => void;
}

export function UnitInfoSection({ 
  formData, 
  setFormData, 
  setCurrentUnitCode, 
  setCurrentUnitName 
}: UnitInfoSectionProps) {
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { units, loading: unitsLoading } = useUnits();

  const handleUnitSelect = (unit: Unit) => {
    const headingLines = unit.letterhead?.length
      ? unit.letterhead.map(l => l.toUpperCase())
      : undefined;
    setFormData(prev => ({
      ...prev,
      line1: (headingLines?.[0] ?? unit.unitName).toUpperCase(),
      line1b: '',
      line2: unit.streetAddress.toUpperCase(),
      line3: `${unit.cityState} ${unit.zip}`.toUpperCase(),
      headingLines,
    }));
    setCurrentUnitCode(unit.ruc);
    setCurrentUnitName(unit.unitName.toUpperCase());
    setIsSearchOpen(false);
    setIsEditing(false);
    setSearchQuery('');
  };

  const clearUnitInfo = () => {
    setFormData(prev => ({ ...prev, line1: '', line1b: '', line2: '', line3: '', headingLines: undefined }));
    setCurrentUnitCode(undefined);
    setCurrentUnitName(undefined);
    setIsEditing(false);
  };

  // Optional letterhead sub-name line (Line 2) applies only to the standard
  // letter family: Basic Letter, Multiple-Address Letter, New-Page Endorsement.
  const showSubName = ['basic', 'multiple-address', 'endorsement'].includes(
    formData.documentType || ''
  );

  const filteredUnits = searchQuery.length > 1
    ? units.filter(unit =>
        unit.unitName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.ruc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.mcc.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 50)
    : [];

  return (
    <Card className="border-border shadow-sm border-l-4 border-l-primary">
      <CardHeader className="pb-3 border-b border-border bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="text-sm font-semibold flex items-center uppercase tracking-wider font-headline">
          <Building className="w-4 h-4 mr-2 text-primary-foreground" />
          Unit Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Find Unit</Label>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 justify-start text-foreground bg-background border-dashed border-border hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="w-4 h-4 mr-2 text-muted-foreground group-hover:text-primary" />
              {formData.line1 ? 'Change Unit...' : 'Search for a unit...'}
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={clearUnitInfo}
              title="Clear Unit Information"
                    aria-label="Clear Unit Information"
              className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              disabled={!formData.line1}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent className="sm:max-w-[600px] flex flex-col h-[80vh] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Search className="w-5 h-5 text-primary" />
                Search Units
              </DialogTitle>
            </DialogHeader>
            <div className="p-1">
              <Input
                placeholder="Search by Name, RUC, or MCC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border-input focus-visible:ring-primary"
                autoFocus
              />
            </div>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-2">
                {searchQuery.length > 1 && unitsLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading unit directory...
                  </div>
                )}
                {searchQuery.length > 1 && !unitsLoading && filteredUnits.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No units found matching &quot;{searchQuery}&quot;
                  </div>
                )}
                {filteredUnits.map((unit) => (
                  <button
                    key={`${unit.ruc}-${unit.mcc}`}
                    onClick={() => handleUnitSelect(unit)}
                    className="w-full text-left p-3 rounded-lg hover:bg-secondary/5 hover:text-secondary-foreground transition-colors border border-transparent hover:border-secondary/20 flex flex-col gap-1 group"
                  >
                    <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {unit.unitName}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2">
                      <Badge variant="secondary" className="text-[10px] h-5 bg-secondary/10 text-secondary hover:bg-secondary/20">RUC: {unit.ruc}</Badge>
                      <Badge variant="outline" className="text-[10px] h-5 border-secondary/20 text-secondary-foreground/70">MCC: {unit.mcc}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {unit.streetAddress}, {unit.cityState} {unit.zip}
                    </div>
                  </button>
                ))}
                {searchQuery.length <= 1 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Type at least 2 characters to search...
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {isEditing ? (
          <div className="space-y-3 rounded-md border border-border p-4 bg-muted/10">
             <div className="flex items-center justify-between mb-2">
               <Label className="text-xs font-semibold text-muted-foreground uppercase">Manual Entry</Label>
               <Button 
                 variant="ghost" 
                 size="sm" 
                 className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary"
                 onClick={() => setIsEditing(false)}
                 title="Done"
               >
                 <Check className="w-4 h-4" />
               </Button>
             </div>
             
             <div className="space-y-2">
               <div className="space-y-1">
                 <Label className="text-xs">Unit Name (Line 1)</Label>
                 <Input
                   value={formData.line1}
                   onChange={(e) => setFormData(prev => ({ ...prev, line1: e.target.value.toUpperCase() }))}
                   placeholder="e.g. HEADQUARTERS BATTALION"
                 />
               </div>
               {showSubName && (
                 <div className="space-y-1">
                   <Label className="text-xs">Unit Sub-Name (Line 2) <span className="text-muted-foreground font-normal">- optional</span></Label>
                   <Input
                     value={formData.line1b || ''}
                     onChange={(e) => setFormData(prev => ({ ...prev, line1b: e.target.value.toUpperCase() }))}
                     placeholder="e.g. MARINE CORPS BASE"
                   />
                 </div>
               )}
               <div className="space-y-1">
                 <Label className="text-xs">Street Address (Line {showSubName ? 3 : 2})</Label>
                 <Input
                   value={formData.line2}
                   onChange={(e) => setFormData(prev => ({ ...prev, line2: e.target.value.toUpperCase() }))}
                   placeholder="e.g. 3250 CATLIN AVENUE"
                 />
               </div>
               <div className="space-y-1">
                 <Label className="text-xs">City, State Zip (Line {showSubName ? 4 : 3})</Label>
                 <Input
                   value={formData.line3}
                   onChange={(e) => setFormData(prev => ({ ...prev, line3: e.target.value.toUpperCase() }))}
                   placeholder="e.g. QUANTICO VA 22134-5001"
                 />
               </div>
             </div>
          </div>
        ) : (
          <>
            {!formData.line1 && (
              <Button 
                variant="link" 
                size="sm" 
                className="text-muted-foreground h-auto p-0 text-xs hover:text-primary"
                onClick={() => setIsEditing(true)}
              >
                Or enter manually...
              </Button>
            )}

            {formData.line1 && (
                <div className="group relative rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1 hover:border-primary/40 transition-colors">
                    <div className="font-medium text-sm text-primary pr-6">{formData.line1}</div>
                    {showSubName && formData.line1b && <div className="text-xs text-foreground/80">{formData.line1b}</div>}
                    <div className="text-xs text-foreground/80">{formData.line2}</div>
                    <div className="text-xs text-foreground/80">{formData.line3}</div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                      onClick={() => setIsEditing(true)}
                      title="Edit Unit Information"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
