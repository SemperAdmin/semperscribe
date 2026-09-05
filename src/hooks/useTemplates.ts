import { useState, useEffect, useMemo } from 'react';
import { getBasePath } from '@/lib/path-utils';

export interface Template {
  id: string;
  title: string;
  description?: string;
  unitName?: string;
  unitCode?: string;
  documentType?: string;
  url: string;
}

interface UseTemplatesProps {
  documentType?: string;
  currentUnitCode?: string;
  currentUnitName?: string;
}

/**
 * Whether a template belongs in the list for the current search and
 * document type. Pure, so the memoised filters above list exactly the
 * inputs they read.
 *
 * With a search query the document-type filter is skipped, so a user
 * finds templates across types (searching "DLA" from a basic letter).
 * Without one, the list is limited to the current type; a template with
 * no type counts as 'basic'.
 */
export function templateMatches(t: Template, searchQuery: string, documentType?: string): boolean {
  const q = searchQuery.trim().toLowerCase();
  const hasSearchQuery = q.length > 0;

  if (!hasSearchQuery && documentType) {
    if (t.documentType && t.documentType !== documentType) return false;
    if (!t.documentType && documentType !== 'basic') return false;
  }

  if (!hasSearchQuery) return true;

  return [
    t.title,
    t.description || '',
    t.unitName || '',
    t.unitCode || '',
    t.documentType || '',
  ].some(field => field.toLowerCase().includes(q));
}

export function useTemplates({ documentType, currentUnitCode, currentUnitName }: UseTemplatesProps) {
  const [globalTemplates, setGlobalTemplates] = useState<Template[]>([]);
  const [unitTemplates, setUnitTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'global' | 'unit'>('global');

  useEffect(() => {
    const loadIndexes = async () => {
      try {
        setIsLoading(true);
        const basePath = getBasePath();
        const [g, u] = await Promise.all([
          fetch(`${basePath}/templates/global/index.json`).then(r => r.ok ? r.json() : []),
          fetch(`${basePath}/templates/unit/index.json`).then(r => r.ok ? r.json() : []),
        ]);
        setGlobalTemplates(Array.isArray(g) ? g : []);
        setUnitTemplates(Array.isArray(u) ? u : []);
      } catch (e) {
        setError('Failed to load template indexes');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadIndexes();
  }, []);

  const filteredGlobalTemplates = useMemo(
    () => globalTemplates.filter(t => templateMatches(t, searchQuery, documentType)),
    [globalTemplates, searchQuery, documentType],
  );

  // Unit templates: every match of the search and type query. The
  // original UI had a "Match Selected Unit" toggle; nothing here
  // prioritises the user's unit yet.
  const filteredUnitTemplates = useMemo(
    () => unitTemplates.filter(t => templateMatches(t, searchQuery, documentType)),
    [unitTemplates, searchQuery, documentType],
  );

  return {
    globalTemplates: filteredGlobalTemplates,
    unitTemplates: filteredUnitTemplates,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab
  };
}
