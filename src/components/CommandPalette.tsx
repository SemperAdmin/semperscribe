'use client';

/**
 * R8 (USER_DRIVEN_ROADMAP) - Ctrl+K command palette.
 *
 * A keyboard-first launcher over the actions the header and sidebar
 * already expose: switch document type, export, open the library /
 * share / find / guide / settings, insert a clause. Built on the
 * existing cmdk-backed command primitive; opens on Ctrl/Cmd+K.
 *
 * The palette only invokes handlers the parent passes - it owns no
 * business logic, so it can never drift from what the buttons do.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  FileText,
  Download,
  FolderOpen,
  Link2,
  Replace,
  BookOpen,
  Settings,
  Save,
  Eraser,
  BadgeCheck,
} from 'lucide-react';
import { DOCUMENT_TYPES } from '@/lib/schemas';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: string) => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  onSave: () => void;
  onOpenLibrary: () => void;
  onShareLink: () => void;
  onFindReplace: () => void;
  onCompliance: () => void;
  onGuide: () => void;
  onSettings: () => void;
  onClearForm: () => void;
  /** True when a document type is active (gates document actions). */
  hasDocument: boolean;
}

export function CommandPalette({
  open, onOpenChange, onSelectType, onExportPdf, onExportDocx, onSave,
  onOpenLibrary, onShareLink, onFindReplace, onCompliance, onGuide, onSettings, onClearForm,
  hasDocument,
}: CommandPaletteProps) {
  const run = (fn: () => void) => {
    onOpenChange(false);
    // Defer so the dialog close does not swallow a focus-dependent action.
    setTimeout(fn, 0);
  };

  const docTypes = useMemo(
    () => Object.entries(DOCUMENT_TYPES).map(([key, def]) => ({ key, name: def.name })),
    [],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search document types..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {hasDocument && (
          <>
            <CommandGroup heading="Document">
              <CommandItem onSelect={() => run(onSave)}>
                <Save className="mr-2 h-4 w-4" /> Save draft
              </CommandItem>
              <CommandItem onSelect={() => run(onExportPdf)}>
                <Download className="mr-2 h-4 w-4" /> Export PDF
              </CommandItem>
              <CommandItem onSelect={() => run(onExportDocx)}>
                <FileText className="mr-2 h-4 w-4" /> Export Word (.docx)
              </CommandItem>
              <CommandItem onSelect={() => run(onShareLink)}>
                <Link2 className="mr-2 h-4 w-4" /> Create share link
              </CommandItem>
              <CommandItem onSelect={() => run(onFindReplace)}>
                <Replace className="mr-2 h-4 w-4" /> Find and replace
              </CommandItem>
              <CommandItem onSelect={() => run(onCompliance)}>
                <BadgeCheck className="mr-2 h-4 w-4" /> Compliance issues
              </CommandItem>
              <CommandItem onSelect={() => run(onClearForm)}>
                <Eraser className="mr-2 h-4 w-4" /> Clear form
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Open">
          <CommandItem onSelect={() => run(onOpenLibrary)}>
            <FolderOpen className="mr-2 h-4 w-4" /> Document library
          </CommandItem>
          <CommandItem onSelect={() => run(onGuide)}>
            <BookOpen className="mr-2 h-4 w-4" /> Correspondence guide
          </CommandItem>
          <CommandItem onSelect={() => run(onSettings)}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="New document">
          {docTypes.map(({ key, name }) => (
            <CommandItem key={key} value={`new ${name}`} onSelect={() => run(() => onSelectType(key))}>
              <FileText className="mr-2 h-4 w-4" /> {name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Global Ctrl/Cmd+K toggle. Returns [open, setOpen]. */
export function useCommandPalette(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return [open, setOpen];
}
