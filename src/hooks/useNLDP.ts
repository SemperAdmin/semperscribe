/**
 * React Hook for NLDP File Operations
 * Provides a clean interface for importing and exporting NLDP files
 */

import { useState, useCallback } from 'react';
// Import removed - using manual download methods for better Next.js compatibility
import { 
  createNLDPFile, 
  importNLDPFile, 
  generateNLDPFilename,
  estimateNLDPFileSize 
} from '../lib/nldp-utils';
import { NLDPExportConfig, NLDPImportResult } from '../lib/nldp-format';

export interface UseNLDPState {
  isExporting: boolean;
  isImporting: boolean;
  lastExportSize?: number;
  error?: string;
}

export interface UseNLDPOperations {
  exportToNLDP: (
    formData: any,
    vias: string[],
    references: string[],
    enclosures: string[],
    copyTos: string[],
    paragraphs: any[],
    config?: NLDPExportConfig
  ) => Promise<boolean>;
  
  importFromNLDP: (file: File) => Promise<NLDPImportResult>;
  
  triggerExportDialog: (
    formData: any,
    vias: string[],
    references: string[],
    enclosures: string[],
    copyTos: string[],
    paragraphs: any[],
    config?: NLDPExportConfig
  ) => Promise<void>;
  
  triggerImportDialog: () => Promise<NLDPImportResult | null>;
  
  clearError: () => void;
}

export interface UseNLDPReturn extends UseNLDPState, UseNLDPOperations {}

export function useNLDP(): UseNLDPReturn {
  const [state, setState] = useState<UseNLDPState>({
    isExporting: false,
    isImporting: false
  });

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: undefined }));
  }, []);

  const exportToNLDP = useCallback(async (
    formData: any,
    vias: string[],
    references: string[],
    enclosures: string[],
    copyTos: string[],
    paragraphs: any[],
    config: NLDPExportConfig = {}
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isExporting: true, error: undefined }));
    
    try {
      // Validate required data
      if (!formData) {
        throw new Error('Form data is required for export');
      }
      
      if (!paragraphs || paragraphs.length === 0) {
        console.warn('No paragraphs found for export - this is allowed but unusual');
      }
      
      // Create the NLDP file
      const nldpFile = await createNLDPFile(
        formData,
        vias || [],
        references || [],
        enclosures || [],
        copyTos || [],
        paragraphs || [],
        config
      );
      
      // Estimate file size
      const fileSize = estimateNLDPFileSize(nldpFile);

      // Convert to JSON and create blob
      const jsonString = JSON.stringify(nldpFile, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Generate filename
      const filename = generateNLDPFilename(formData, config);

      // Manual download method for better browser compatibility
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        a.style.position = 'absolute';
        a.style.left = '-9999px';
        
        document.body.appendChild(a);
        a.click();
        
        // Clean up after a short delay
        setTimeout(() => {
          try {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (cleanupError) {
            console.warn('Cleanup error (non-critical):', cleanupError);
          }
        }, 100);
        
      } catch (downloadError) {
        console.error('Manual download failed:', downloadError);
        
        // Last resort - try opening in new window for manual save
        try {
          const url = URL.createObjectURL(blob);
          const newWindow = window.open(url, '_blank');
          // Sever the reverse handle; assigning opener (rather than passing
          // the 'noopener' feature) keeps the popup-blocked null check valid.
          if (newWindow) newWindow.opener = null;

          if (newWindow) {
            // Clean up after delay
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } else {
            throw new Error('Unable to download file. Please check browser popup blocker and download settings.');
          }
        } catch (windowError) {
          console.error('New window method failed:', windowError);
          throw new Error('Unable to download file. Please check browser download permissions.');
        }
      }

      setState(prev => ({ 
        ...prev, 
        isExporting: false, 
        lastExportSize: fileSize 
      }));

      return true;

    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      setState(prev => ({ 
        ...prev, 
        isExporting: false, 
        error: `Export failed: ${errorMessage}` 
      }));
      return false;
    }
  }, []);

  const importFromNLDP = useCallback(async (file: File): Promise<NLDPImportResult> => {
    setState(prev => ({ ...prev, isImporting: true, error: undefined }));

    try {
      // Validate file type
      if (!file.name.endsWith('.nldp') && file.type !== 'application/json') {
        throw new Error('Invalid file type. Expected .nldp file.');
      }

      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 10MB.');
      }

      // Read file content
      const fileContent = await file.text();

      // Import and validate
      const result = await importNLDPFile(fileContent);

      setState(prev => ({ ...prev, isImporting: false }));

      if (!result.success) {
        setState(prev => ({ 
          ...prev, 
          error: `Import failed: ${result.error}` 
        }));
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown import error';
      const result: NLDPImportResult = {
        success: false,
        error: errorMessage
      };

      setState(prev => ({ 
        ...prev, 
        isImporting: false, 
        error: `Import failed: ${errorMessage}` 
      }));

      return result;
    }
  }, []);

  const triggerExportDialog = useCallback(async (
    formData: any,
    vias: string[],
    references: string[],
    enclosures: string[],
    copyTos: string[],
    paragraphs: any[],
    config: NLDPExportConfig = {}
  ): Promise<void> => {
    // For now, directly export - can be enhanced with a dialog later
    await exportToNLDP(formData, vias, references, enclosures, copyTos, paragraphs, config);
  }, [exportToNLDP]);

  const triggerImportDialog = useCallback(async (): Promise<NLDPImportResult | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.nldp,application/json';
      input.style.display = 'none';

      input.addEventListener('change', async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          const result = await importFromNLDP(file);
          resolve(result);
        } else {
          resolve(null);
        }
        document.body.removeChild(input);
      });

      input.addEventListener('cancel', () => {
        resolve(null);
        document.body.removeChild(input);
      });

      document.body.appendChild(input);
      input.click();
    });
  }, [importFromNLDP]);

  return {
    // State
    isExporting: state.isExporting,
    isImporting: state.isImporting,
    lastExportSize: state.lastExportSize,
    error: state.error,

    // Operations
    exportToNLDP,
    importFromNLDP,
    triggerExportDialog,
    triggerImportDialog,
    clearError
  };
}