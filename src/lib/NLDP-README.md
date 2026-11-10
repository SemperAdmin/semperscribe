# NLDP File Sharing System

## Overview

The NLDP (Naval Letter Data Package) file sharing system allows users to export and import Marine Corps directive data between applications. This system provides data integrity verification, standardized formatting, and secure data packaging.

## Features

- **Data Integrity**: SHA-256 hashing and CRC32 checksums prevent corruption
- **Security**: Input sanitization and validation
- **Compatibility**: JSON-based format for broad compatibility  
- **Metadata**: Optional personal information and package descriptions
- **Version Control**: Format versioning for future compatibility

## Components

### 1. Format Specification (`nldp-format.ts`)
Defines the NLDP file structure with interfaces for:
- File metadata and integrity verification
- Form data, paragraphs, references, enclosures
- Export configuration and import results
- Validation interfaces

### 2. Core Utilities (`nldp-utils.ts`)
Provides core functions for:
- **`createNLDPFile()`**: Package application data into NLDP format
- **`importNLDPFile()`**: Validate and import NLDP packages  
- **`validateNLDPFile()`**: Comprehensive file validation
- **`generateNLDPFilename()`**: Automatic filename generation

### 3. React Hook (`useNLDP.ts`)
React hook providing:
- Export/import operations with loading states
- Error handling and user feedback
- File dialog triggers
- Blob creation and download management

### 4. UI Component (`NLDPFileManager.tsx`)
Complete user interface featuring:
- Export dialog with metadata input fields
- Import via file picker with validation feedback
- Status messages and loading indicators
- Responsive design

## Usage

### Basic Setup

```typescript
import { NLDPFileManager } from './components/NLDPFileManager';
import { useNLDP } from './hooks/useNLDP';
```

### Component Usage

```jsx
<NLDPFileManager
  formData={formData}
  vias={vias}
  references={references}
  enclosures={enclosures}
  copyTos={copyTos}
  paragraphs={paragraphs}
  onImportSuccess={(data) => {
    // Update your application state
    setFormData(data.formData);
    setParagraphs(data.paragraphs);
    // ... update other state
  }}
  onImportError={(error) => {
    console.error('Import failed:', error);
  }}
/>
```

### Hook Usage

```typescript
const { 
  exportToNLDP, 
  importFromNLDP, 
  triggerImportDialog,
  isExporting, 
  isImporting 
} = useNLDP();

// Export data
const handleExport = async () => {
  const config = {
    package: {
      title: "My Directive",
      description: "Important policy directive"
    }
  };
  
  const success = await exportToNLDP(
    formData, vias, references, enclosures, 
    copyTos, paragraphs, config
  );
};

// Import with file dialog
const handleImport = async () => {
  const result = await triggerImportDialog();
  if (result?.success) {
    // Handle successful import
    updateApplicationState(result.data);
  }
};
```

## File Format

NLDP files use `.nldp` extension with this structure:

```json
{
  "format": "NLDP",
  "version": "1.0",
  "metadata": {
    "createdAt": "2024-08-30T12:00:00.000Z",
    "formatVersion": "1.0",
    "createdBy": "Semper Scribe",
    "author": { ... },
    "package": { ... }
  },
  "integrity": {
    "dataHash": "sha256-hash",
    "crc32": "checksum",
    "recordCount": 42
  },
  "data": {
    "formData": { ... },
    "paragraphs": [ ... ],
    "references": [ ... ],
    "enclosures": [ ... ],
    "vias": [ ... ],
    "copyTos": [ ... ]
  }
}
```

## Integration Example

See `NLDPIntegrationExample.tsx` for complete integration examples showing:

1. **Full Component Integration**: Using the complete UI component
2. **Hook-Only Usage**: Direct hook usage for custom UIs  
3. **State Management**: How to update application state on import

## Security Features

- **Data Sanitization**: Input validation and content sanitization
- **Integrity Verification**: SHA-256 and CRC32 checksums
- **Size Limits**: 10MB maximum file size  
- **Format Validation**: Strict structure validation
- **Optional Personal Info**: Choose whether to include author details

## Error Handling

The system provides comprehensive error handling for:

- File format validation
- Data integrity verification  
- Import/export failures
- Network or file system issues
- Invalid or corrupted data

## File Size and Performance

- **Efficient JSON Format**: Compact data representation
- **Size Estimation**: Preview export size before download
- **Streaming**: Large file handling for imports
- **Memory Management**: Proper cleanup of file resources

## Browser Compatibility

Compatible with modern browsers supporting:
- Web Crypto API (for SHA-256 hashing)
- File API (for file reading)
- Blob API (for file downloads)

## Dependencies

- `file-saver`: For download functionality
- `React`: For UI components and hooks
- Built-in Web APIs: Crypto, File, Blob APIs

## Future Enhancements

Potential improvements include:
- Encryption for sensitive data
- Batch import/export operations  
- Cloud storage integration
- Real-time collaboration features
- Advanced metadata schemas

## Troubleshooting

**Import Issues:**
- Verify file has `.nldp` extension
- Check file size (max 10MB)
- Ensure file is valid JSON

**Export Issues:**  
- Check browser compatibility
- Verify all required data is present
- Try with minimal metadata first

**Data Integrity Errors:**
- File may be corrupted during transfer
- Verify download completed successfully
- Check source application version compatibility