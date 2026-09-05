'use client';

/**
 * R4 (USER_DRIVEN_ROADMAP) - package assembly orchestration.
 *
 * Owns the chain, measures real page counts through the PDF engine
 * (the only honest source), and exports the whole chain as one merged
 * PDF with continuous numbering applied to each member.
 *
 * E.1 (M-5216.5 9-1) adds the fit decision. A member set to same-page
 * placement is rendered as a block and composed onto the previous
 * member's signature page. When the block fits it adds no page; when it
 * does not, the member is exported as a new-page endorsement with its
 * identification restored, which is what Figure 9-1's second
 * endorsement shows. The drafter is told which of the two happened.
 */

import { useState, useCallback } from 'react';
import { SavedLetter } from '@/types';
import {
  PackageMember, ComputedSequence, computeSequences, validatePackage,
  applySequence, toMember, moveMember, asNewPageFallback,
} from '@/lib/package-assembly';
import { isSamePageEndorsement, asSamePageBlock } from '@/lib/same-page-endorsement';

interface UsePackageAssemblyArgs {
  savedLetters: SavedLetter[];
  toast: (opts: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
}

/** What the measure pass learned about one same-page member. */
export interface SamePageFit {
  fits: boolean;
  /** Page of the previous member the block lands on, when it fits. */
  page?: number;
  /** Why it does not fit, when it does not. */
  reason?: string;
}

export function usePackageAssembly({ savedLetters, toast }: UsePackageAssemblyArgs) {
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const [fits, setFits] = useState<Record<string, SamePageFit>>({});
  const [busy, setBusy] = useState(false);

  const members: PackageMember[] = memberIds
    .map((id) => savedLetters.find((l) => l.id === id))
    .filter((l): l is SavedLetter => Boolean(l))
    .map((l) => toMember(l, pageCounts[l.id] ?? 0, fits[l.id]?.fits));

  const sequences: ComputedSequence[] = computeSequences(members);
  const issues = validatePackage(members);

  const add = (id: string) => setMemberIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const remove = (id: string) => setMemberIds((prev) => prev.filter((m) => m !== id));
  const move = (index: number, direction: -1 | 1) => {
    setMemberIds((prev) => moveMember(
      prev.map((id) => ({ id } as PackageMember)), index, direction,
    ).map((m) => m.id));
  };
  const clear = () => { setMemberIds([]); setPageCounts({}); setFits({}); };

  /**
   * Renders each member in order and records what it costs the package.
   * A same-page member is rendered as a block, composed against the
   * document before it, and recorded as zero pages when it fits.
   */
  const measure = useCallback(async () => {
    setBusy(true);
    try {
      const { generatePdfForDocType } = await import('@/services/export/pdfPipelineService');
      const { composeSamePage } = await import('@/lib/same-page-endorsement');
      const counts: Record<string, number> = {};
      const measuredFits: Record<string, SamePageFit> = {};
      // Sequential, in order: each member's starting page depends on the
      // measured length of everything before it.
      let pagesSoFar = 0;
      let refsSoFar = 0;
      let enclsSoFar = 0;
      let previousBytes: Uint8Array | null = null;
      const { indexToRefLetter } = await import('@/lib/letter-validators');

      for (const id of memberIds) {
        const letter = savedLetters.find((l) => l.id === id);
        if (!letter) continue;
        const samePage = isSamePageEndorsement(letter) && previousBytes !== null;
        const positioned: SavedLetter = pagesSoFar === 0
          ? { ...letter, startingPageNumber: 1, previousPackagePageCount: 0, startingReferenceLevel: 'a', startingEnclosureNumber: '1' }
          : {
              ...letter,
              startingPageNumber: samePage ? pagesSoFar : pagesSoFar + 1,
              previousPackagePageCount: samePage ? pagesSoFar - 1 : pagesSoFar,
              startingReferenceLevel: indexToRefLetter(refsSoFar + 1),
              startingEnclosureNumber: String(enclsSoFar + 1),
            };
        // E.4: a same-page member composes as the bare block.
        const blob = await renderMember(generatePdfForDocType, samePage ? asSamePageBlock(positioned) : positioned);
        let bytes = new Uint8Array(await blob.arrayBuffer());

        if (samePage && previousBytes) {
          const result = await composeSamePage(previousBytes, bytes);
          if (result.fits) {
            measuredFits[id] = { fits: true, page: pagesSoFar };
            counts[id] = 0;
            previousBytes = result.bytes;
            refsSoFar += (letter.references ?? []).filter((r) => r.trim()).length;
            enclsSoFar += (letter.enclosures ?? []).filter((e) => e.trim()).length;
            continue;
          }
          measuredFits[id] = { fits: false, reason: result.reason };
          const fallback = await renderMember(generatePdfForDocType, {
            ...asNewPageFallback(letter),
            startingPageNumber: pagesSoFar + 1,
            previousPackagePageCount: pagesSoFar,
            startingReferenceLevel: indexToRefLetter(refsSoFar + 1),
            startingEnclosureNumber: String(enclsSoFar + 1),
          });
          bytes = new Uint8Array(await fallback.arrayBuffer());
        }

        const { getPDFPageCount } = await import('@/lib/pdf-generator');
        const count = await getPDFPageCount(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
        counts[id] = count;
        pagesSoFar += count;
        previousBytes = bytes;
        refsSoFar += (letter.references ?? []).filter((r) => r.trim()).length;
        enclsSoFar += (letter.enclosures ?? []).filter((e) => e.trim()).length;
      }
      setPageCounts(counts);
      setFits(measuredFits);
      const moved = Object.values(measuredFits).filter((f) => !f.fits).length;
      toast({
        title: 'Package Measured',
        description: moved > 0
          ? `${pagesSoFar} page(s) across ${memberIds.length} document(s). ${moved} same-page endorsement(s) do not fit and export on a new page.`
          : `${pagesSoFar} page(s) across ${memberIds.length} document(s).`,
      });
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
      const { composeSamePage } = await import('@/lib/same-page-endorsement');
      const { indexToRefLetter } = await import('@/lib/letter-validators');

      // Each member's own bytes are held until the member after it has
      // had its chance to be drawn onto them, then they are merged.
      const rendered: Uint8Array[] = [];
      let pagesSoFar = 0;
      let refsSoFar = 0;
      let enclsSoFar = 0;
      let movedToNewPage = 0;
      let addedInPlace = 0;

      for (const id of memberIds) {
        const letter = savedLetters.find((l) => l.id === id);
        if (!letter) continue;
        const samePage = isSamePageEndorsement(letter) && rendered.length > 0;
        const positioned: SavedLetter = pagesSoFar === 0
          ? { ...letter, startingPageNumber: 1, previousPackagePageCount: 0, startingReferenceLevel: 'a', startingEnclosureNumber: '1' }
          : {
              ...letter,
              startingPageNumber: samePage ? pagesSoFar : pagesSoFar + 1,
              previousPackagePageCount: samePage ? pagesSoFar - 1 : pagesSoFar,
              startingReferenceLevel: indexToRefLetter(refsSoFar + 1),
              startingEnclosureNumber: String(enclsSoFar + 1),
            };
        // E.4: a same-page member composes as the bare block.
        const blob = await renderMember(generatePdfForDocType, samePage ? asSamePageBlock(positioned) : positioned);
        let bytes = new Uint8Array(await blob.arrayBuffer());

        if (samePage) {
          const host = rendered[rendered.length - 1];
          const result = await composeSamePage(host, bytes);
          if (result.fits) {
            // The block is now part of the host's last page, so the
            // package gains no page and no member is appended (9-1).
            rendered[rendered.length - 1] = result.bytes;
            addedInPlace += 1;
            refsSoFar += (letter.references ?? []).filter((r) => r.trim()).length;
            enclsSoFar += (letter.enclosures ?? []).filter((e) => e.trim()).length;
            continue;
          }
          movedToNewPage += 1;
          const fallback = await renderMember(generatePdfForDocType, {
            ...asNewPageFallback(letter),
            startingPageNumber: pagesSoFar + 1,
            previousPackagePageCount: pagesSoFar,
            startingReferenceLevel: indexToRefLetter(refsSoFar + 1),
            startingEnclosureNumber: String(enclsSoFar + 1),
          });
          bytes = new Uint8Array(await fallback.arrayBuffer());
        }

        const source = await PDFDocument.load(bytes);
        pagesSoFar += source.getPageCount();
        rendered.push(bytes);
        refsSoFar += (letter.references ?? []).filter((r) => r.trim()).length;
        enclsSoFar += (letter.enclosures ?? []).filter((e) => e.trim()).length;
      }

      const merged = await PDFDocument.create();
      for (const bytes of rendered) {
        const source = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
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
      const notes: string[] = [`${merged.getPageCount()} page(s) in one PDF.`];
      if (addedInPlace > 0) {
        notes.push(`${addedInPlace} endorsement(s) added to the signature page above.`);
      }
      if (movedToNewPage > 0) {
        notes.push(`${movedToNewPage} did not fit and exported as a new-page endorsement.`);
      }
      toast({ title: 'Package Exported', description: notes.join(' ') });
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
    memberIds, members, sequences, issues, busy, fits,
    add, remove, move, clear, measure, exportPackage, applyToLetter,
  };
}

/** One member through the same pipeline the editor's own export uses. */
async function renderMember(
  generate: (ctx: {
    formData: SavedLetter;
    vias: string[];
    references: string[];
    enclosures: string[];
    copyTos: string[];
    paragraphs: SavedLetter['paragraphs'];
    distList: string[];
  }) => Promise<Blob>,
  positioned: SavedLetter,
): Promise<Blob> {
  return generate({
    formData: positioned,
    vias: positioned.vias ?? [],
    references: positioned.references ?? [],
    enclosures: positioned.enclosures ?? [],
    copyTos: positioned.copyTos ?? [],
    paragraphs: positioned.paragraphs ?? [],
    distList: positioned.distList ?? [],
  });
}
