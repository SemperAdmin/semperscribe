import { useState, useEffect, useMemo } from 'react';
import { useSyncedState } from '@/hooks/useSyncedState';
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
 * Whether a template belongs to the document type on screen. A template
 * with no type of its own counts as 'basic', which is how the index has
 * always been read.
 */
export function templateMatchesDocumentType(t: Template, documentType: string): boolean {
  return (t.documentType || 'basic') === documentType;
}

/**
 * Whether a template belongs in the list for the current search and
 * document type. Pure, so the memoised filters below list exactly the
 * inputs they read.
 *
 * `documentType` is passed only while the type filter is on, so the
 * caller owns that choice and the visible count reports what the list
 * holds. Search narrows within the active filter: searching with the
 * filter on returns matches of this type, and turning the filter off
 * searches every template in the index.
 */
export function templateMatches(t: Template, searchQuery: string, documentType?: string): boolean {
  if (documentType && !templateMatchesDocumentType(t, documentType)) return false;

  const q = searchQuery.trim().toLowerCase();
  if (q.length === 0) return true;

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

  /**
   * How many templates across both indexes carry the document type on
   * screen. Of the 69 shipped templates, 27 are AA forms and 15 are Page
   * 11 entries, so most types have exactly one and several have none.
   */
  const typeMatchCount = useMemo(() => {
    if (!documentType) return 0;
    const matches = (t: Template) => templateMatchesDocumentType(t, documentType);
    return globalTemplates.filter(matches).length + unitTemplates.filter(matches).length;
  }, [globalTemplates, unitTemplates, documentType]);

  /**
   * D.7: the type filter is a control the user sees, not a hidden rule.
   * It starts on when the current type has templates of its own and off
   * when it has none, so a type with nothing of its own never presents
   * an empty dialog over a full index. A toggle by the user stands until
   * the document type changes or the indexes finish loading, which is
   * what re-derives the default.
   */
  const [typeFilterOn, setTypeFilterOn] = useSyncedState(
    `${documentType ?? ''}|${typeMatchCount}`,
    () => typeMatchCount > 0,
  );

  const activeType = typeFilterOn && documentType ? documentType : undefined;

  const filteredGlobalTemplates = useMemo(
    () => globalTemplates.filter(t => templateMatches(t, searchQuery, activeType)),
    [globalTemplates, searchQuery, activeType],
  );

  // Unit templates: every match of the search and type query. The
  // original UI had a "Match Selected Unit" toggle; nothing here
  // prioritises the user's unit yet.
  const filteredUnitTemplates = useMemo(
    () => unitTemplates.filter(t => templateMatches(t, searchQuery, activeType)),
    [unitTemplates, searchQuery, activeType],
  );

  return {
    globalTemplates: filteredGlobalTemplates,
    unitTemplates: filteredUnitTemplates,
    /** Every entry in each index, before the search and the type filter. */
    globalTotal: globalTemplates.length,
    unitTotal: unitTemplates.length,
    typeFilterOn,
    setTypeFilterOn,
    typeMatchCount,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab
  };
}
