'use client';

import { useCallback } from 'react';
import { FormData, ParagraphData, ValidationState } from '@/types';
import { getExportFilename } from '@/lib/naval-format-utils';
import { generateShareableUrl, generateEncryptedShareUrl, getStateFromUrl, clearShareParam, copyToClipboard, ShareableState } from '@/lib/url-state';
import type { ShareLinkOptions } from '@/components/ShareLinkDialog';
import { generateFullMessage, validateAMHSMessage } from '@/services/amhs/amhsFormatter';
import { getBasePath } from '@/lib/path-utils';
import { findLetterById } from '@/lib/storage-utils';
import { validateSSIC, validateSubject, validateFromTo } from '@/lib/validation-utils';
import { debugUserAction, debugFormChange } from '@/lib/console-utils';

interface ImportExportDeps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  paragraphs: ParagraphData[];
  setParagraphs: React.Dispatch<React.SetStateAction<ParagraphData[]>>;
  vias: string[];
  setVias: React.Dispatch<React.SetStateAction<string[]>>;
  references: string[];
  setReferences: React.Dispatch<React.SetStateAction<string[]>>;
  enclosures: string[];
  setEnclosures: React.Dispatch<React.SetStateAction<string[]>>;
  copyTos: string[];
  setCopyTos: React.Dispatch<React.SetStateAction<string[]>>;
  distList: string[];
  setDistList: React.Dispatch<React.SetStateAction<string[]>>;
  setFormKey: React.Dispatch<React.SetStateAction<number>>;
  setValidation: React.Dispatch<React.SetStateAction<ValidationState>>;
  savedLetters: any[];
  toast: (opts: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
}

/**
 * Hook for import, export, share, and AMHS clipboard operations.
 */
export function useImportExport(deps: ImportExportDeps) {
  const {
    formData, setFormData,
    paragraphs, setParagraphs,
    vias, setVias,
    references, setReferences,
    enclosures, setEnclosures,
    copyTos, setCopyTos,
    distList, setDistList,
    setFormKey, setValidation,
    savedLetters, toast,
  } = deps;

  const handleImport = useCallback((inputData: any) => {
    try {
      const data = inputData.data ? inputData.data : inputData;
      let formDataToMerge = data.formData || data;

      if (formDataToMerge.type && !formDataToMerge.documentType) {
        formDataToMerge.documentType = formDataToMerge.type.toLowerCase();
      }
      if (formDataToMerge.subject && !formDataToMerge.subj) {
        formDataToMerge.subj = formDataToMerge.subject;
      }

      if (formDataToMerge.documentType === 'moa' || formDataToMerge.documentType === 'mou') {
        const defaultMoaData = {
          activityA: '',
          activityB: '',
          seniorSigner: { name: '', title: '', activity: '', date: '' },
          juniorSigner: { name: '', title: '', activity: '', date: '' },
          activityAHeader: {},
          activityBHeader: {},
        };

        formDataToMerge.moaData = {
          ...defaultMoaData,
          ...(formDataToMerge.moaData || {}),
          seniorSigner: { ...defaultMoaData.seniorSigner, ...(formDataToMerge.moaData?.seniorSigner || {}) },
          juniorSigner: { ...defaultMoaData.juniorSigner, ...(formDataToMerge.moaData?.juniorSigner || {}) },
          activityAHeader: { ...(formDataToMerge.moaData?.activityAHeader || {}) },
          activityBHeader: { ...(formDataToMerge.moaData?.activityBHeader || {}) },
        };
      }

      setFormData(prev => ({ ...prev, ...formDataToMerge }));

      if (data.paragraphs) setParagraphs(data.paragraphs);
      if (data.vias) setVias(data.vias);
      if (data.references) setReferences(data.references);
      if (data.enclosures) setEnclosures(data.enclosures);
      if (data.copyTos) setCopyTos(data.copyTos);
      if (data.distList) setDistList(data.distList);

      if (formDataToMerge.ssic) setValidation(prev => ({ ...prev, ssic: validateSSIC(formDataToMerge.ssic) }));
      if (formDataToMerge.subj) setValidation(prev => ({ ...prev, subj: validateSubject(formDataToMerge.subj) }));
      if (formDataToMerge.from) setValidation(prev => ({ ...prev, from: validateFromTo(formDataToMerge.from) }));
      if (formDataToMerge.to) setValidation(prev => ({ ...prev, to: validateFromTo(formDataToMerge.to) }));

      setFormKey(prev => prev + 1);
      debugUserAction('Import Data', { source: 'File/Template' });
    } catch (error) {
      console.error('Import failed', error);
      alert('Failed to import data structure.');
    }
  }, [setFormData, setParagraphs, setVias, setReferences, setEnclosures, setCopyTos, setDistList, setFormKey, setValidation]);

  const handleLoadDraft = useCallback((id: string) => {
    const letter = findLetterById(id, savedLetters);
    if (letter) handleImport(letter);
  }, [savedLetters, handleImport]);

  const handleLoadTemplateUrl = useCallback(async (url: string) => {
    try {
      const basePath = getBasePath();
      const fullUrl = url.startsWith('/') ? `${basePath}${url}` : url;
      const res = await fetch(fullUrl);
      if (!res.ok) throw new Error(`Failed to load template: ${res.statusText}`);
      const data = await res.json();
      handleImport(data);
      debugUserAction('Load Template', { url: fullUrl });
    } catch (error) {
      console.error('Template load failed', error);
      alert('Failed to load template. Please try again.');
    }
  }, [handleImport]);

  const handleExportNldp = useCallback(() => {
    const exportData = {
      metadata: {
        packageId: `export_${Date.now()}`,
        formatVersion: "1.0.0",
        createdAt: new Date().toISOString(),
        author: { name: formData.from || "Unknown" },
        package: {
          title: formData.subj || "Untitled Package",
          description: "Exported from Naval Letter Formatter",
          subject: formData.subj,
          documentType: formData.documentType,
        },
      },
      data: { formData, vias, references, enclosures, copyTos, distList, paragraphs },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Naval_Package_${formData.ssic || 'Draft'}.nldp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    debugUserAction('Export Data', { format: 'nldp' });
  }, [formData, vias, references, enclosures, copyTos, distList, paragraphs]);

  // P1.1 (DONDOCS_PARITY_PLAN): password-encrypted links by default,
  // legacy unprotected format behind an explicit opt-out.
  const handleShareLink = useCallback(async (options: ShareLinkOptions = {}) => {
    if (!formData.documentType) {
      toast({ title: "No Document", description: "Please select a document type first.", variant: "destructive" });
      return;
    }

    const state: ShareableState = { formData, paragraphs, references, enclosures, vias, copyTos, distList, version: 1 };
    if (options.password && options.expiresDays) {
      state.expires = new Date(Date.now() + options.expiresDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const { url, isLong, error } = options.password
      ? await generateEncryptedShareUrl(state, options.password)
      : generateShareableUrl(state);

    if (error && !url) {
      toast({ title: "Failed to Generate Link", description: error, variant: "destructive" });
      return;
    }

    const success = await copyToClipboard(url);
    if (success) {
      const lengthNote = isLong ? " Note: This link is very long and may not work in all applications." : "";
      toast({
        title: "Link Copied!",
        description: options.password
          ? `Encrypted link copied. Share the password through a separate channel.${lengthNote}`
          : `Unprotected link copied. Anyone with this link can view and edit the document.${lengthNote}`,
      });
    } else {
      toast({ title: "Copy Failed", description: "Could not copy to clipboard. Please try again.", variant: "destructive" });
    }
  }, [formData, paragraphs, references, enclosures, vias, copyTos, distList, toast]);

  const handleCopyAMHS = useCallback(() => {
    const validation = validateAMHSMessage(formData, formData.amhsReferences || []);
    if (!validation.isValid) {
      toast({ title: "Validation Failed", description: validation.errors.join('. '), variant: "destructive" });
      return;
    }

    const message = generateFullMessage(formData, formData.amhsReferences || [], formData.amhsPocs || []);
    navigator.clipboard.writeText(message);
    toast({ title: "Copied to Clipboard", description: "Message text is ready to paste into AMHS." });
  }, [formData, toast]);

  const handleExportAMHS = useCallback(() => {
    const validation = validateAMHSMessage(formData, formData.amhsReferences || []);
    if (!validation.isValid) {
      toast({ title: "Validation Failed", description: validation.errors.join('. '), variant: "destructive" });
      return;
    }

    const message = generateFullMessage(formData, formData.amhsReferences || [], formData.amhsPocs || []);
    const blob = new Blob([message], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const msgType = formData.amhsMessageType || 'MSG';
    a.download = `SEMPERADMIN_${msgType}_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [formData, toast]);

  return {
    handleImport,
    handleLoadDraft,
    handleLoadTemplateUrl,
    handleExportNldp,
    handleShareLink,
    handleCopyAMHS,
    handleExportAMHS,
  };
}
