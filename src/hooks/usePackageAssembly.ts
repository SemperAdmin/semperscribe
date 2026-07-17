'use client';

/**
 * R4 (USER_DRIVEN_ROADMAP) - package assembly orchestration.
 *
 * Owns the chain, measures real page counts through the PDF engine
 * (the only honest source), and exports the whole chain as one merged
 * PDF with continuous numbering applied to each member.
 */

import { useState, useCallback } from 'react';
import { SavedLetter } from '@/types';
import {
  PackageMember, ComputedSequence, computeSequences, validatePackage,
  applySequence, toMember, moveMember,
} from '@/lib/package-assembly';

interface UsePackageAssemblyArgs {
  savedLetters: SavedLetter[];
  toast: (opts: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
}

export function usePackageAssembly({ savedLetters, toast }: UsePackageAssemblyArgs) {
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const members: PackageMember[] = memberIds
    .map((id) => savedLetters.find((l) => l.id === id))
    .filter((l): l is SavedLetter => Boolean(l))
    .map((l) => toMember(l, pageCounts[l.id] ?? 0));

  const sequences: ComputedSequence[] = computeSequences(members);
  const issues = validatePackage(members);

  const add = (id: string) => setMemberIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const remove = (id: string) => setMemberIds((prev) => prev.filter((m) => m !== id));
  const move = (index: number, direction: -1 | 1) => {
    setMemberIds((prev) => moveMember(
      prev.map((id) => ({ id } as PackageMember)), index, direction,
    ).map((m) => m.id));
  };
  const clear = () => { setMemberIds([]); setPageCounts({}); };

  /** Renders each member to measure its real page count. */
  const measure = useCallback(async () => {
    setBusy(true);
    try {
      const { generatePdfForDocType } = await import('@/services/export/pdfPipelineService');
      const { getPDFPageCount } = await import('@/lib/pdf-generator');
      const counts: Record<string, number> = {};
      // Sequential, in order: each member's starting page depends on the
      // measured length of everything before it.
      let pagesSoFar = 0;
      let refsSoFar = 0;
      let enclsSoFar = 0;
      const { indexToRefLetter } = await import('@/lib/letter-validators');

      for (const id of memberIds) {
        const letter = savedLetters.find((l) => l.id === id);
        if (!letter) continue;
        const positioned: SavedLetter = pagesSoFar === 0
          ? { ...letter, startingPageNumber: 1, previousPackagePageCount: 0, startingReferenceLevel: 'a', startingEnclosureNumber: '1' }
          : {
              ...letter,
              startingPageNumber: pagesSoFar + 1,
              previousPackagePageCount: pagesSoFar,
              startingReferenceLevel: indexToRefLetter(refsSoFar + 1),
              startingEnclosureNumber: String(enclsSoFar + 1),
            };
        const blob = await generatePdfForDocType({
          formData: positioned,
          vias: positioned.vias ?? [],
          references: positioned.references ?? [],
          enclosures: positioned.enclosures ?? [],
          copyTos: positioned.copyTos ?? [],
          paragraphs: positioned.paragraphs ?? [],
          distList: positioned.distList ?? [],
        });
        const count = await getPDFPageCount(blob);
        counts[id] = count;
        pagesSoFar += count;
        refsSoFar += (letter.references ?? []).filter((r) => r.trim()).length;
        enclsSoFar += (letter.enclosures ?? []).filter((e) => e.trim()).length;
      }
      setPageCounts(counts);
      toast({ title: 'Package Measured', description: `${pagesSoFar} page(s) across ${memberIds.length} document(s).` });
    } catch (error) {
      console.error('Package measure failed', error);
      toast({ title: 'Measure Failed', description: 'Could not render one or more members.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }, [memberIds, savedLetters, toast]);

  /** Exports the chain as a single merged PDF with numbering applied. */
  const exportPackage = useCallback(async () => {
    if (memberIds.length === 0) return;
    setBusy(true);
    try {
      const { generatePdfForDocType } = await import('@/services/export/pdfPipelineService');
      const { PDFDocument } = await import('pdf-lib');
      const { indexToRefLetter } = await import('@/lib/letter-validators');

      const merged = await PDFDocument.create();
      let pagesSoFar = 0;
      let refsSoFar = 0;
      let enclsSoFar = 0;

      for (const id of memberIds) {
        const letter = savedLetters.find((l) => l.id === id);
        if (!letter) continue;
        const positioned: SavedLetter = pagesSoFar === 0
          ? { ...letter, startingPageNumber: 1, previousPackagePageCount: 0, startingReferenceLevel: 'a', startingEnclosureNumber: '1' }
          : {
              ...letter,
              startingPageNumber: pagesSoFar + 1,
              previousPackagePageCount: pagesSoFar,
              startingReferenceLevel: indexToRefLetter(refsSoFar + 1),
              startingEnclosureNumber: String(enclsSoFar + 1),
            };
        const blob = await generatePdfForDocType({
          formData: positioned,
          vias: positioned.vias ?? [],
          references: positioned.references ?? [],
          enclosures: positioned.enclosures ?? [],
          copyTos: positioned.copyTos ?? [],
          paragraphs: positioned.paragraphs ?? [],
          distList: positioned.distList ?? [],
        });
        const source = await PDFDocument.load(await blob.arrayBuffer());
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
        pagesSoFar += source.getPageCount();
        refsSoFar += (letter.references ?? []).filter((r) => r.trim()).length;
        enclsSoFar += (letter.enclosures ?? []).filter((e) => e.trim()).length;
      }

      const bytes = await merged.save();
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const first = savedLetters.find((l) => l.id === memberIds[0]);
      const base = (first?.subj || first?.name || 'Package').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40);
      link.download = `${base}_Package.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Package Exported', description: `${pagesSoFar} page(s) in one PDF.` });
    } catch (error) {
      console.error('Package export failed', error);
      toast({ title: 'Export Failed', description: 'Could not build the package PDF.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }, [memberIds, savedLetters, toast]);

  /** Returns the member document with its computed sequence applied. */
  const applyToLetter = useCallback((id: string): SavedLetter | null => {
    const letter = savedLetters.find((l) => l.id === id);
    const sequence = sequences.find((s) => s.id === id);
    if (!letter || !sequence) return null;
    return applySequence(letter, sequence);
  }, [savedLetters, sequences]);

  return {
    memberIds, members, sequences, issues, busy,
    add, remove, move, clear, measure, exportPackage, applyToLetter,
  };
}
