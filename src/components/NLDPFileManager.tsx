/**
 * NLDP File Manager Component
 * Provides modern UI for exporting and importing NLDP files
 */

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { 
  Package,
  Download,
  Upload,
  Check,
  AlertCircle
} from 'lucide-react';
import { useNLDP } from '../hooks/useNLDP';
import { NLDPExportConfig } from '../lib/nldp-format';
// Removed saveAs import - using manual download methods for better Next.js compatibility

interface NLDPFileManagerProps {
  formData: any;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: any[];
  onImportSuccess?: (data: any) => void;
  onImportError?: (error: string) => void;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (config: NLDPExportConfig) => void;
  isExporting: boolean;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ 
  isOpen, 
  onClose, 
  onExport, 
  isExporting 
}) => {
  const [config, setConfig] = useState<NLDPExportConfig>({
    includePersonalInfo: false,
    author: {
      name: '',
      unit: '',
      email: ''
    },
    package: {
      title: '',
      description: '',
      tags: []
    }
  });

  const [tagInput, setTagInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport(config);
  };

  const addTag = () => {
    if (tagInput.trim() && !config.package?.tags?.includes(tagInput.trim())) {
      setConfig(prev => ({
        ...prev,
        package: {
          ...prev.package,
          tags: [...(prev.package?.tags || []), tagInput.trim()]
        }
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setConfig(prev => ({
      ...prev,
      package: {
        ...prev.package,
        tags: prev.package?.tags?.filter(tag => tag !== tagToRemove) || []
      }
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-blue-600" />
            Export Directive Data Package
          </DialogTitle>
          <DialogDescription>
            Configure export settings and create a data package file (.nldp) for sharing your directive.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Package Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <Package className="h-4 w-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Package Information</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Package Title
                </label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Marine Corps Training Directive"
                  value={config.package?.title || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    package: { ...prev.package, title: e.target.value }
                  }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Brief description of the directive content..."
                  value={config.package?.description || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    package: { ...prev.package, description: e.target.value }
                  }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add tag (e.g., training, policy)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <button 
                    type="button" 
                    onClick={addTag} 
                    disabled={!tagInput.trim()} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.package?.tags?.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={() => removeTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Author Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="includePersonalInfo"
                checked={config.includePersonalInfo || false}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  includePersonalInfo: e.target.checked
                }))}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="includePersonalInfo" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Package className="h-4 w-4" />
                Include Author Information
              </label>
            </div>

            {config.includePersonalInfo && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Your name"
                      value={config.author?.name || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        author: { ...prev.author, name: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Your unit"
                      value={config.author?.unit || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        author: { ...prev.author, unit: e.target.value }
                      }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your.email@mil"
                    value={config.author?.email || ''}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      author: { ...prev.author, email: e.target.value }
                    }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isExporting}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isExporting} 
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <>
                  <span style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid white', 
                    borderTop: '2px solid transparent', 
                    borderRadius: '50%', 
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px'
                  }}></span>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 inline mr-2" />
                  Export Package
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const NLDPFileManager: React.FC<NLDPFileManagerProps> = ({
  formData,
  vias,
  references,
  enclosures,
  copyTos,
  paragraphs,
  onImportSuccess,
  onImportError
}) => {
  const {
    isExporting,
    isImporting,
    lastExportSize,
    error,
    exportToNLDP,
    importFromNLDP
  } = useNLDP();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showStatus = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ message, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };



  const handleExport = async (config: NLDPExportConfig) => {
    try {
      const success = await exportToNLDP(
        formData,
        vias,
        references,
        enclosures,
        copyTos,
        paragraphs,
        config
      );

      if (success) {
        showStatus(
          `Data package exported successfully${lastExportSize ? ` (${Math.round(lastExportSize / 1024)}KB)` : ''}`,
          'success'
        );
        setShowExportDialog(false);
      } else {
        showStatus(error || 'Export failed - please check console for details', 'error');
      }
    } catch (err) {
      showStatus(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };



  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      // Import the file using the useNLDP hook's importFromNLDP function
      const result = await importFromNLDP(file);
      
      if (result?.success && result.data) {
        showStatus('Data package imported successfully!', 'success');
        
        if (onImportSuccess) {
          onImportSuccess(result.data);
        }
      } else if (result?.error) {
        const errorMsg = result.error;
        
        // Provide more specific error messages
        let userFriendlyError = errorMsg;
        if (errorMsg.includes('Expected "NLDP"')) {
          userFriendlyError = 'Invalid file format. Please select a valid NLDP file (.nldp extension).';
        } else if (errorMsg.includes('Unsupported version')) {
          userFriendlyError = 'Unsupported NLDP version. This file may be from a newer version of the application.';
        } else if (errorMsg.includes('Missing metadata section')) {
          userFriendlyError = 'Invalid NLDP file: missing metadata section.';
        } else if (errorMsg.includes('Missing data section')) {
          userFriendlyError = 'Invalid NLDP file: missing data section.';
        }
        
        showStatus(userFriendlyError, 'error');
        
        if (onImportError) {
          onImportError(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      showStatus(errorMsg, 'error');
      
      if (onImportError) {
        onImportError(errorMsg);
      }
    }
    
    // Clear the input
    if (event.target) {
      event.target.value = '';
    }
  };





  return (
    <div>
      {/* Clean Export/Import Interface */}
      <div className="p-4">
        <div className="flex items-center justify-center gap-4">
          {/* Export Button */}
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={isExporting}
            className="flex-1 group relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <div className="flex items-center justify-center gap-2 relative z-10">
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
                  <span className="font-medium">Export Package</span>
                </>
              )}
            </div>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-200"></div>
          </button>

          {/* Import Button */}
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex-1 group relative overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <div className="flex items-center justify-center gap-2 relative z-10">
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
                  <span className="font-medium">Import Package</span>
                </>
              )}
            </div>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-200"></div>
          </button>

          {/* Status Message - Compact inline display */}
          {statusMessage && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium flex-shrink-0 max-w-xs ${
              statusMessage.type === 'error'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : statusMessage.type === 'success'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}>
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
              ) : (
                <Check className="w-3 h-3 flex-shrink-0" />
              )}
              <span className="truncate">{statusMessage.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept=".nldp,.json"
        ref={fileInputRef}
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  );
};