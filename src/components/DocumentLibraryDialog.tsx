'use client';

/**
 * P1.2 (DONDOCS_PARITY_PLAN) - document library dialog.
 * Search, sort (recent / alphabetical), load, rename, duplicate, and
 * per-document delete over the IndexedDB-backed library.
 */

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Search, Pencil, Copy, Trash2, Check, X } from 'lucide-react';
import { SavedLetter } from '@/types';

type SortMode = 'recent' | 'alpha';

interface DocumentLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  letters: SavedLetter[];
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function displayName(letter: SavedLetter): string {
  return letter.name || letter.subj || 'Untitled';
}

function displayStamp(letter: SavedLetter): string {
  const iso = letter.updatedAt ?? (/^\d{4}-\d{2}-\d{2}T/.test(letter.id) ? letter.id : null);
  if (iso) {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return letter.savedAt;
}

function sortValue(letter: SavedLetter): string {
  return letter.updatedAt ?? (/^\d{4}-\d{2}-\d{2}T/.test(letter.id) ? letter.id : letter.savedAt);
}

export function DocumentLibraryDialog({
  open,
  onOpenChange,
  letters,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
}: DocumentLibraryDialogProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q.length === 0
      ? letters
      : letters.filter(l =>
          displayName(l).toLowerCase().includes(q) ||
          (l.subj || '').toLowerCase().includes(q) ||
          (l.documentType || '').toLowerCase().includes(q)
        );
    return [...filtered].sort((a, b) =>
      sort === 'alpha'
        ? displayName(a).localeCompare(displayName(b))
        : sortValue(b).localeCompare(sortValue(a))
    );
  }, [letters, query, sort]);

  const startRename = (letter: SavedLetter) => {
    setRenamingId(letter.id);
    setRenameValue(displayName(letter));
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setRenamingId(null); setConfirmDeleteId(null); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[560px] h-[70vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FolderOpen className="w-4 h-4" /> Document Library
          </DialogTitle>
          <DialogDescription>
            Saved on this computer only. {letters.length} document{letters.length === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, subject, or type"
              className="pl-8"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="alpha">A to Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {visible.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {letters.length === 0 ? 'No saved documents yet. Use File, Save Draft.' : 'No documents match your search.'}
            </div>
          ) : (
            <div className="space-y-1">
              {visible.map((letter) => (
                <div
                  key={letter.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    {renamingId === letter.id ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={commitRename} aria-label="Confirm rename">
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setRenamingId(null)} aria-label="Cancel rename">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-left w-full group"
                        onClick={() => { onLoad(letter.id); onOpenChange(false); }}
                      >
                        <span className="block font-medium text-sm truncate group-hover:underline">
                          {displayName(letter)}
                        </span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {displayStamp(letter)}
                        </span>
                      </button>
                    )}
                  </div>
                  {letter.documentType && renamingId !== letter.id && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {letter.documentType}
                    </Badge>
                  )}
                  {renamingId !== letter.id && (
                    <div className="flex items-center shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startRename(letter)} aria-label="Rename">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDuplicate(letter.id)} aria-label="Duplicate">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {confirmDeleteId === letter.id ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-xs"
                          onClick={() => { onDelete(letter.id); setConfirmDeleteId(null); }}
                        >
                          Confirm
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteId(letter.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
