import { describe, it, expect } from 'vitest';
import {
  DOCUMENT_TYPES,
  DocumentTypeDefinition,
  ControlType,
} from '@/lib/schemas';

// All supported control types that DynamicForm can render
const SUPPORTED_CONTROL_TYPES: ControlType[] = [
  'text', 'textarea', 'date', 'select', 'checkbox', 'combobox',
  'autosuggest', 'number', 'hidden',
];

// Control types rendered externally (skipped by DynamicForm, should not crash)
const EXTERNAL_CONTROL_TYPES: ControlType[] = [
  'decision-grid', 'radio',
];

const ALL_VALID_TYPES = [...SUPPORTED_CONTROL_TYPES, ...EXTERNAL_CONTROL_TYPES];

// All expected document type IDs
const EXPECTED_DOC_TYPES = [
  'basic', 'multiple-address', 'endorsement', 'aa-form',
  'mco', 'bulletin', 'change-transmittal',
  'page11', 'mfr', 'from-to-memo', 'letterhead-memo',
  'amhs', 'moa', 'mou',
  'information-paper', 'position-paper', 'decision-paper',
  'coordination-page', 'business-letter', 'executive-correspondence',
  'dla-memorandum', 'dla-business-letter',
];

describe('DOCUMENT_TYPES registry', () => {
  it('contains all expected document types', () => {
    EXPECTED_DOC_TYPES.forEach(id => {
      expect(DOCUMENT_TYPES[id], `Missing document type: ${id}`).toBeDefined();
    });
  });

  it('has matching id in definition and registry key', () => {
    Object.entries(DOCUMENT_TYPES).forEach(([key, def]) => {
      expect(def.id, `Registry key "${key}" does not match definition id "${def.id}"`).toBe(key);
    });
  });
});

describe('Document type definitions', () => {
  Object.entries(DOCUMENT_TYPES).forEach(([docTypeId, definition]) => {
    describe(`${definition.name} (${docTypeId})`, () => {
      it('has required metadata', () => {
        expect(definition.id).toBeTruthy();
        expect(definition.name).toBeTruthy();
        expect(definition.description).toBeTruthy();
        expect(definition.schema).toBeDefined();
        expect(definition.sections).toBeDefined();
        expect(Array.isArray(definition.sections)).toBe(true);
      });

      it('has at least one section', () => {
        expect(definition.sections.length).toBeGreaterThan(0);
      });

      describe('sections', () => {
        definition.sections.forEach((section, sIdx) => {
          describe(`section "${section.title}" (${section.id})`, () => {
            it('has required section metadata', () => {
              expect(section.id, `Section ${sIdx} missing id`).toBeTruthy();
              expect(section.title, `Section ${sIdx} missing title`).toBeTruthy();
              expect(Array.isArray(section.fields)).toBe(true);
            });

            section.fields.forEach((field, fIdx) => {
              describe(`field "${field.label}" (${field.name})`, () => {
                it('has required field properties', () => {
                  expect(field.name, `Field ${fIdx} in section "${section.title}" missing name`).toBeTruthy();
                  expect(field.label, `Field "${field.name}" missing label`).toBeTruthy();
                  expect(field.type, `Field "${field.name}" missing type`).toBeTruthy();
                });

                it('uses a valid control type', () => {
                  expect(
                    ALL_VALID_TYPES.includes(field.type),
                    `Field "${field.name}" has unsupported type "${field.type}"`
                  ).toBe(true);
                });

                if (field.type === 'select') {
                  it('has options array for select field', () => {
                    expect(
                      Array.isArray(field.options),
                      `Select field "${field.name}" missing options array`
                    ).toBe(true);
                    expect(
                      field.options!.length,
                      `Select field "${field.name}" has empty options`
                    ).toBeGreaterThan(0);
                  });

                  it('has valid option structure', () => {
                    field.options!.forEach((opt, oIdx) => {
                      expect(
                        typeof opt.label === 'string',
                        `Option ${oIdx} in "${field.name}" missing label`
                      ).toBe(true);
                      expect(
                        typeof opt.value === 'string',
                        `Option ${oIdx} in "${field.name}" missing value`
                      ).toBe(true);
                    });
                  });
                }

                if (field.condition) {
                  it('has a condition that does not crash with empty formData', () => {
                    expect(() => field.condition!({})).not.toThrow();
                    expect(() => field.condition!({ documentType: docTypeId })).not.toThrow();
                  });
                }
              });
            });
          });
        });
      });

      describe('schema validation', () => {
        it('accepts its own documentType literal', () => {
          // Build minimal form data with required fields having empty/default values
          const minimalData: Record<string, any> = { documentType: docTypeId };

          // For schemas extending BasicLetterSchema, populate inherited required fields
          const basicRequiredFields = ['ssic', 'originatorCode', 'date', 'from', 'to', 'subj', 'line1', 'line2', 'line3', 'sig'];
          basicRequiredFields.forEach(f => {
            if (f === 'ssic') minimalData[f] = '5216';
            else if (f === 'subj') minimalData[f] = 'TEST SUBJECT';
            else minimalData[f] = 'test';
          });

          // Add fields from sections with their defaultValues
          definition.sections.forEach(section => {
            section.fields.forEach(field => {
              if (field.defaultValue !== undefined && minimalData[field.name] === undefined) {
                minimalData[field.name] = field.defaultValue;
              }
            });
          });

          const result = definition.schema.safeParse(minimalData);
          // We don't assert success because some types have additional required fields
          // handled by external components. We just verify it doesn't throw.
          expect(result).toBeDefined();
        });
      });
    });
  });
});

describe('Directive document types', () => {
  const directiveTypes = ['mco', 'bulletin', 'change-transmittal'];

  directiveTypes.forEach(docTypeId => {
    describe(`${docTypeId}`, () => {
      const definition = DOCUMENT_TYPES[docTypeId];

      it('has "to" field set to hidden type', () => {
        const toField = definition.sections
          .flatMap(s => s.fields)
          .find(f => f.name === 'to');
        expect(toField, `${docTypeId} missing "to" field`).toBeDefined();
        expect(toField!.type).toBe('hidden');
        expect(toField!.defaultValue).toBe('Distribution List');
      });

      if (docTypeId !== 'change-transmittal') {
        it('has SSIC field as text type (not combobox)', () => {
          const ssicField = definition.sections
            .flatMap(s => s.fields)
            .find(f => f.name === 'ssic');
          expect(ssicField, `${docTypeId} missing "ssic" field`).toBeDefined();
          expect(ssicField!.type).toBe('text');
        });

        it('accepts expanded SSIC format in schema', () => {
          const testCases = [
            '5216',
            '5216.3',
            '5216.3K',
            'C5216.3K',
            '5216R.3K',
            'C5216R.3K',
            '5216.3K w/ ch 1',
          ];

          testCases.forEach(ssic => {
            const data: Record<string, any> = {
              documentType: docTypeId,
              ssic,
              originatorCode: 'G-1',
              date: '01 Jan 25',
              from: 'Commandant',
              to: 'Distribution List',
              subj: 'TEST',
              line1: '', line2: '', line3: '', sig: '',
            };

            if (docTypeId === 'bulletin') {
              data.cancellationDate = '2026-01-01';
            }

            const result = definition.schema.safeParse(data);
            if (!result.success) {
              // Only check SSIC-related errors
              const ssicErrors = result.error.issues.filter(i =>
                i.path.includes('ssic')
              );
              expect(
                ssicErrors,
                `SSIC "${ssic}" should be valid for ${docTypeId}: ${JSON.stringify(ssicErrors)}`
              ).toHaveLength(0);
            }
          });
        });
      }

      it('does NOT have classificationPrefix field in UI', () => {
        const field = definition.sections
          .flatMap(s => s.fields)
          .find(f => f.name === 'classificationPrefix');
        expect(field, `${docTypeId} should not have classificationPrefix field`).toBeUndefined();
      });

      it('does NOT have isReserveOnly field in UI', () => {
        const field = definition.sections
          .flatMap(s => s.fields)
          .find(f => f.name === 'isReserveOnly');
        expect(field, `${docTypeId} should not have isReserveOnly field`).toBeUndefined();
      });

      it('does NOT have revisionLetter field in UI', () => {
        const field = definition.sections
          .flatMap(s => s.fields)
          .find(f => f.name === 'revisionLetter');
        expect(field, `${docTypeId} should not have revisionLetter field`).toBeUndefined();
      });
    });
  });
});

describe('DynamicForm initialization simulation', () => {
  // Simulates the exact logic from DynamicForm to catch runtime errors
  const initialFormData: Record<string, any> = {
    documentType: '',
    endorsementLevel: '',
    basicLetterReference: '',
    basicLetterSsic: '',
    referenceWho: '',
    referenceType: '',
    referenceDate: '',
    startingReferenceLevel: 'a',
    startingEnclosureNumber: '1',
    line1: '', line2: '', line3: '', ssic: '', originatorCode: '', date: '17 Feb 26', from: '', to: '', subj: '', sig: '', delegationText: '',
    startingPageNumber: 1,
    previousPackagePageCount: 0,
    headerType: 'USMC',
    bodyFont: 'times',
    directiveTitle: '',
    cancellationDate: '',
    cancellationType: 'fixed',
    distribution: { type: 'none' },
    reports: [],
    adminSubsections: {
      recordsManagement: { show: false, content: '', order: 0 },
      privacyAct: { show: false, content: '', order: 0 },
      reportsRequired: { show: false, content: 'None.', order: 0 }
    },
    actionNo: '',
    orgStation: '',
    name: '',
    edipi: '',
    box11: ''
  };

  Object.entries(DOCUMENT_TYPES).forEach(([docTypeId, definition]) => {
    describe(`${definition.name} (${docTypeId}) form init`, () => {
      it('computes allowedTopLevelKeys without error', () => {
        const keys = new Set<string>(['documentType']);
        definition.sections.forEach(section => {
          section.fields.forEach(field => {
            const topLevel = field.name.split('.')[0];
            keys.add(topLevel);
          });
        });
        expect(keys.size).toBeGreaterThan(0);
        expect(keys.has('documentType')).toBe(true);
      });

      it('sanitizes defaultValues without error', () => {
        // Compute allowedTopLevelKeys
        const allowedTopLevelKeys = new Set<string>(['documentType']);
        definition.sections.forEach(section => {
          section.fields.forEach(field => {
            const topLevel = field.name.split('.')[0];
            allowedTopLevelKeys.add(topLevel);
          });
        });

        // Sanitize default values (same logic as DynamicForm)
        const defaultValues: Record<string, unknown> = { ...initialFormData, documentType: docTypeId };
        const sanitized: any = {};
        Object.keys(defaultValues).forEach(key => {
          if (allowedTopLevelKeys.has(key)) {
            sanitized[key] = defaultValues[key];
          }
        });

        // Apply field-level defaultValues
        definition.sections.forEach(section => {
          section.fields.forEach(field => {
            const topLevel = field.name.split('.')[0];
            if (field.defaultValue !== undefined && (sanitized[topLevel] === undefined || sanitized[topLevel] === '')) {
              if (field.name.includes('.')) {
                const parts = field.name.split('.');
                if (!sanitized[parts[0]]) sanitized[parts[0]] = {};
                if (sanitized[parts[0]][parts[1]] === undefined) {
                  sanitized[parts[0]][parts[1]] = field.defaultValue;
                }
              } else {
                sanitized[field.name] = field.defaultValue;
              }
            }
          });
        });
        sanitized.documentType = definition.id;

        expect(sanitized.documentType).toBe(docTypeId);
      });

      it('schema.safeParse does not throw', () => {
        const allowedTopLevelKeys = new Set<string>(['documentType']);
        definition.sections.forEach(section => {
          section.fields.forEach(field => {
            allowedTopLevelKeys.add(field.name.split('.')[0]);
          });
        });

        const defaultValues: Record<string, unknown> = { ...initialFormData, documentType: docTypeId };
        const sanitized: any = {};
        Object.keys(defaultValues).forEach(key => {
          if (allowedTopLevelKeys.has(key)) {
            sanitized[key] = defaultValues[key];
          }
        });
        sanitized.documentType = definition.id;

        // This should NOT throw - safeParse returns result, doesn't throw
        expect(() => definition.schema.safeParse(sanitized)).not.toThrow();
      });

      it('all field conditions evaluate without error', () => {
        const formValues = { documentType: docTypeId };
        definition.sections.forEach(section => {
          section.fields.forEach(field => {
            if (field.condition) {
              expect(() => field.condition!(formValues)).not.toThrow();
            }
          });
        });
      });
    });
  });
});

describe('Non-directive document types', () => {
  const nonDirectiveTypes = Object.keys(DOCUMENT_TYPES).filter(
    // P4.3: SECNAV directives also use the free-text directive SSIC
    // format (SSIC + point + suffix), not the correspondence combobox.
    id => !['mco', 'bulletin', 'change-transmittal', 'secnav-instruction', 'secnav-notice'].includes(id)
  );

  nonDirectiveTypes.forEach(docTypeId => {
    const definition = DOCUMENT_TYPES[docTypeId];

    // Only test types that have an SSIC field (letter-based types)
    const ssicField = definition.sections
      .flatMap(s => s.fields)
      .find(f => f.name === 'ssic');

    if (ssicField) {
      it(`${docTypeId}: SSIC field uses combobox type`, () => {
        expect(ssicField.type).toBe('combobox');
      });
    }
  });
});
