'use client';

import { useState, useCallback, useEffect } from 'react';
import { ParagraphData } from '@/types';

/**
 * Converts a number to Excel-style letters (1=a, 2=b... 26=z, 27=aa, 28=ab)
 */
function numberToLetter(num: number): string {
  let result = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Hook for paragraph state management and CRUD operations.
 * Encapsulates add, remove, move, update, citation generation, and validation.
 */
export function useParagraphs(initialParagraphs?: ParagraphData[]) {
  const [paragraphs, setParagraphs] = useState<ParagraphData[]>(
    initialParagraphs || [{ id: 1, level: 1, content: '', acronymError: '' }]
  );

  // Auto-correct level 0 to level 1 (legacy data migration)
  useEffect(() => {
    let hasChanges = false;
    const newParagraphs = paragraphs.map(p => {
      if (p.level === 0) {
        hasChanges = true;
        return { ...p, level: 1 };
      }
      return p;
    });

    if (hasChanges) {
      setParagraphs(newParagraphs);
    }
  }, [paragraphs]);

  const addParagraph = useCallback((type: 'main' | 'sub' | 'same' | 'up', afterId: number) => {
    setParagraphs(prev => {
      const currentParagraph = prev.find(p => p.id === afterId);
      if (!currentParagraph) return prev;

      let newLevel = 1;
      switch (type) {
        case 'main': newLevel = 1; break;
        case 'same': newLevel = currentParagraph.level; break;
        case 'sub': newLevel = Math.min(currentParagraph.level + 1, 8); break;
        case 'up': newLevel = Math.max(currentParagraph.level - 1, 1); break;
      }

      const newId = (prev.length > 0 ? Math.max(...prev.map(p => p.id)) : 0) + 1;
      const currentIndex = prev.findIndex(p => p.id === afterId);
      const newParagraphs = [...prev];
      newParagraphs.splice(currentIndex + 1, 0, { id: newId, level: newLevel, content: '' });
      return newParagraphs;
    });
  }, []);

  const removeParagraph = useCallback((id: number) => {
    setParagraphs(prev => {
      const paragraphToRemove = prev.find(p => p.id === id);
      if (paragraphToRemove?.isMandatory) {
        alert("This paragraph is mandatory for the selected document type and cannot be removed.");
        return prev;
      }

      if (prev.length <= 1) {
        if (prev[0].id === id) {
          return prev.map(p => p.id === id ? { ...p, content: '' } : p);
        }
      }

      const newParagraphs = prev.filter(p => p.id !== id);
      const numberingErrors = validateParagraphNumbering(newParagraphs);
      if (numberingErrors.length > 0) {
        const proceed = window.confirm(
          `Removing this paragraph may create numbering issues:\n\n${numberingErrors.join('\n')}\n\nDo you want to proceed?`
        );
        if (!proceed) return prev;
      }

      return newParagraphs;
    });
  }, []);

  const updateParagraphContent = useCallback((id: number, content: string) => {
    const cleanedContent = content
      .replace(/\u00A0/g, ' ')
      .replace(/\u2007/g, ' ')
      .replace(/\u202F/g, ' ')
      .replace(/[\r\n]/g, ' ');

    setParagraphs(prev => prev.map(p => p.id === id ? { ...p, content: cleanedContent } : p));
  }, []);

  // P2: portion marking level for a paragraph ('' clears to banner default)
  const updateParagraphMarking = useCallback((id: number, marking: string) => {
    setParagraphs(prev => prev.map(p => p.id === id ? { ...p, marking: marking || undefined } : p));
  }, []);

  const moveParagraphUp = useCallback((id: number) => {
    setParagraphs(prev => {
      const currentIndex = prev.findIndex(p => p.id === id);
      if (currentIndex <= 0) return prev;

      const currentPara = prev[currentIndex];
      const paraAbove = prev[currentIndex - 1];
      if (currentPara.level > paraAbove.level) return prev;

      const newParagraphs = [...prev];
      [newParagraphs[currentIndex - 1], newParagraphs[currentIndex]] = [newParagraphs[currentIndex], newParagraphs[currentIndex - 1]];
      return newParagraphs;
    });
  }, []);

  const moveParagraphDown = useCallback((id: number) => {
    setParagraphs(prev => {
      const currentIndex = prev.findIndex(p => p.id === id);
      if (currentIndex >= prev.length - 1) return prev;

      const newParagraphs = [...prev];
      [newParagraphs[currentIndex], newParagraphs[currentIndex + 1]] = [newParagraphs[currentIndex + 1], newParagraphs[currentIndex]];
      return newParagraphs;
    });
  }, []);

  const getUiCitation = useCallback((
    paragraph: ParagraphData,
    index: number,
    allParagraphs: ParagraphData[],
    options?: { fourDigitNumbering?: boolean; chapterNumber?: number }
  ): string => {
    const { level } = paragraph;
    const isFourDigit = options?.fourDigitNumbering;
    const chapterNum = options?.chapterNumber || 1;

    const getCitationPart = (targetLevel: number, parentIndex: number) => {
      let listStartIndex = 0;
      if (targetLevel > 1) {
        for (let i = parentIndex - 1; i >= 0; i--) {
          if (allParagraphs[i].level < targetLevel) {
            listStartIndex = i + 1;
            break;
          }
        }
      }

      let count = 0;
      for (let i = listStartIndex; i <= parentIndex; i++) {
        if (allParagraphs[i].level === targetLevel) {
          count++;
        }
      }

      // 4-digit numbering shifts level mapping per MCO 5215.1K para 34
      if (isFourDigit) {
        switch (targetLevel) {
          case 1: return `${chapterNum}${String(count).padStart(3, '0')}.`;
          case 2: return `${count}`;
          case 3: return `${numberToLetter(count)}`;
          case 4: return `(${count})`;
          case 5: return `(${numberToLetter(count)})`;
          case 6: return `${count}.`;
          case 7: return `${numberToLetter(count)}.`;
          case 8: return `(${count})`;
          default: return '';
        }
      }

      switch (targetLevel) {
        case 1: return `${count}.`;
        case 2: return `${numberToLetter(count)}`;
        case 3: return `(${count})`;
        case 4: return `(${numberToLetter(count)})`;
        case 5: return `${count}.`;
        case 6: return `${numberToLetter(count)}.`;
        case 7: return `(${count})`;
        case 8: return `(${numberToLetter(count)})`;
        default: return '';
      }
    };

    if (level === 1) return getCitationPart(1, index);
    if (level === 2) {
      let parentCitation = '';
      for (let i = index - 1; i >= 0; i--) {
        if (allParagraphs[i].level === 1) {
          parentCitation = getCitationPart(1, i).replace('.', '');
          break;
        }
      }
      const sep = isFourDigit ? '.' : '';
      return `${parentCitation}${sep}${getCitationPart(2, index)}`;
    }

    const citationPath: string[] = [];
    let parentLevel = level - 1;
    for (let i = index - 1; i >= 0; i--) {
      const p = allParagraphs[i];
      if (p.level === parentLevel) {
        citationPath.unshift(getCitationPart(p.level, i).replace(/[.()]/g, ''));
        parentLevel--;
        if (parentLevel === 0) break;
      }
    }
    citationPath.push(getCitationPart(level, index));
    return citationPath.join('');
  }, []);

  const validateParagraphNumbering = useCallback((allParagraphs: ParagraphData[]): string[] => {
    const errors: string[] = [];
    const levelGroups: { [key: string]: number[] } = {};

    allParagraphs.forEach((paragraph, index) => {
      const { level } = paragraph;
      let parentPath = '';
      let currentLevel = level - 1;
      for (let i = index - 1; i >= 0 && currentLevel > 0; i--) {
        if (allParagraphs[i].level === currentLevel) {
          const citation = getUiCitation(allParagraphs[i], i, allParagraphs);
          parentPath = citation.replace(/[.()]/g, '') + parentPath;
          currentLevel--;
        }
      }
      const groupKey = `${parentPath}_level${level}`;
      if (!levelGroups[groupKey]) levelGroups[groupKey] = [];
      levelGroups[groupKey].push(index);
    });

    Object.entries(levelGroups).forEach(([, indices]) => {
      if (indices.length === 1) {
        const index = indices[0];
        const paragraph = allParagraphs[index];
        const citation = getUiCitation(paragraph, index, allParagraphs);
        if (paragraph.level > 1) {
          errors.push(`Paragraph ${citation} requires at least one sibling paragraph at the same level.`);
        }
      }
    });
    return errors;
  }, [getUiCitation]);

  return {
    paragraphs,
    setParagraphs,
    addParagraph,
    removeParagraph,
    updateParagraphContent,
    updateParagraphMarking,
    moveParagraphUp,
    moveParagraphDown,
    getUiCitation,
    validateParagraphNumbering,
  };
}
