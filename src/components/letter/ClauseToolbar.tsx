'use client';

/**
 * P3.5 (DONDOCS_PARITY_PLAN) - clause insertion toolbar.
 * Preset and user-saved clauses insert as a new body paragraph; the
 * last paragraph saves as a reusable custom clause (matches the
 * DonDocs save-last-paragraph flow). Custom clauses delete inline
 * from the menu.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookMarked, Save, ChevronDown, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Clause, allClauses, loadCustomClauses, saveCustomClause, deleteCustomClause } from '@/lib/clause-library';

interface ClauseToolbarProps {
  onInsert: (content: string) => void;
  /** Content of the last body paragraph - the save-as-clause source. */
  lastParagraphContent?: string;
}

export function ClauseToolbar({ onInsert, lastParagraphContent }: ClauseToolbarProps) {
  const { toast } = useToast();
  const [clauses, setClauses] = useState<Clause[]>([]);

  useEffect(() => {
    setClauses(allClauses(loadCustomClauses()));
  }, []);

  const handleDelete = (event: React.MouseEvent, clause: Clause) => {
    event.stopPropagation();
    event.preventDefault();
    const remaining = deleteCustomClause(clause.id);
    setClauses(allClauses(remaining));
    toast({ title: 'Clause Deleted', description: `"${clause.name}" removed from your clause list.` });
  };

  const handleSaveLast = () => {
    const content = lastParagraphContent?.trim();
    if (!content) {
      toast({ title: 'Nothing to Save', description: 'The last paragraph is empty.', variant: 'destructive' });
      return;
    }
    const name = window.prompt('Name this clause:', content.slice(0, 40));
    if (name === null) return;
    const custom = saveCustomClause(name, content);
    setClauses(allClauses(custom));
    toast({ title: 'Clause Saved', description: `"${name || content.slice(0, 30)}" is now in your clause list.` });
  };

  const presets = clauses.filter((c) => !c.custom);
  const customs = clauses.filter((c) => c.custom);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs bg-background text-foreground">
            <BookMarked className="w-3.5 h-3.5 mr-1.5" />
            Insert clause
            <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 bg-card border-border text-card-foreground">
          <DropdownMenuLabel className="text-xs">Presets</DropdownMenuLabel>
          {presets.map((clause) => (
            <DropdownMenuItem
              key={clause.id}
              onClick={() => onInsert(clause.content)}
              className="cursor-pointer text-xs focus:bg-accent focus:text-accent-foreground"
            >
              {clause.name}
            </DropdownMenuItem>
          ))}
          {customs.length > 0 && (
            <>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuLabel className="text-xs">Custom</DropdownMenuLabel>
              {customs.map((clause) => (
                <DropdownMenuItem
                  key={clause.id}
                  onClick={() => onInsert(clause.content)}
                  className="cursor-pointer text-xs focus:bg-accent focus:text-accent-foreground flex items-center justify-between gap-2"
                >
                  <span className="truncate">{clause.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, clause)}
                    className="shrink-0 rounded p-0.5 text-destructive hover:bg-destructive/10"
                    aria-label={`Delete clause ${clause.name}`}
                    title="Delete this custom clause"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={handleSaveLast}
        title="Save the last paragraph as a reusable clause"
      >
        <Save className="w-3.5 h-3.5 mr-1" /> Save last ¶
      </Button>
    </div>
  );
}
