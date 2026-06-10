import { DocumentTemplate } from '@/lib/templates/types';
import { ITypeDefinition } from './definition';

export const ITypeTemplate: DocumentTemplate = {
  id: 'i-type-default',
  typeId: 'i-type',
  name: 'I-Type Technical Publication - Test Template',
  description: 'USMC instruction sheet template with sample data for all elements.',
  definition: ITypeDefinition,
  defaultData: {
    documentType: 'i-type',

    // Header Section
    date: new Date().toISOString().split('T')[0],
    shortTitle: 'TM-5305-15-14',
    volume: '1 OF 3',
    service: 'U.S. MARINE CORPS',
    entity: 'Marine Corps Systems Command',

    // Publication Section
    publicationType: 'TECHNICAL MANUAL',
    longTitle: 'MAINTENANCE AND OPERATION OF TACTICAL VEHICLE SYSTEM',
    category: 'export controlled',
    timeCompliance: 'NORMAL',
    nomenclature: 'HMMWV, ARMORED, FULL DRESS',

    // Distribution & Control Section
    address: '2200 Lester Street, Quantico, VA 22134-5050',
    signingAuthority: 'Program Manager',
    controllingOffice: 'Ground Weapons Systems',
    cuiCategory: 'CTI',
    distributionControl: 'NOFORN',
    supersedureNotice: 'SUPERSEDURE NOTICE',
    supersedureStatement: 'This publication supersedes TM 5305-15-13, dated June 2020.',
    destructionNotice: 'DESTRUCTION NOTICE',
    classificationDestructionProcedure: 'For unclassified, limited documents, destroy by any method that will prevent disclosure of contents or reconstruction of the document.',
    poc: '(703) 432-5000',
    pcn: '123 456789 01',

    // Components Affected Table
    componentsAffected: [
      { nomenclature: 'HMMWV, Armored, Full Dress', nsn: '2320-01-426-5065', pn: 'GMS-M998-FA' },
      { nomenclature: 'Engine, Gasoline, V8', nsn: '2815-01-088-1421', pn: 'GM 6.2L' },
      { nomenclature: 'Transmission, Automatic', nsn: '2520-01-156-5234', pn: 'GM TH400' },
    ],

    // Material Required Table
    materialRequired: [
      { nomenclature: 'Oil, Engine, Military Grade', nsn: '9150-01-398-8471', pn: 'MIL-PRF-2104', qty: 8 },
      { nomenclature: 'Coolant, Ethylene Glycol', nsn: '6830-01-089-6531', pn: 'MIL-DTL-32013', qty: 12 },
      { nomenclature: 'Spark Plugs, Gap .035', nsn: '5920-00-935-5820', pn: 'AC 44FF', qty: 8 },
      { nomenclature: 'Air Filter Element', nsn: '2940-01-088-1420', pn: 'GM 6.2L AFE', qty: 2 },
    ],

    // Material Discarded Table
    materialDiscarded: [
      { nomenclature: 'Old Engine Oil (used)', nsn: 'N/A', pn: 'WASTE-OIL-01', qty: 8 },
      { nomenclature: 'Used Air Filter', nsn: '2940-00-935-6100', pn: 'OLD-AFE-01', qty: 2 },
    ],

    // Material Retained Table
    materialRetained: [
      { nomenclature: 'Hydraulic Fluid, Remaining', nsn: '9150-01-451-9876', pn: 'MIL-PRF-23827', qty: 4 },
    ],

    // Bulk Material Table
    bulkMaterial: [
      { nomenclature: 'Grease, General Purpose', nsn: '9150-01-119-4419', pn: 'MIL-PRF-23836', qty: 2 },
    ],

    // Special Tools Table
    specialTools: [
      { nomenclature: 'Torque Wrench, 0-50 ft-lb', nsn: '5110-01-200-1234', pn: 'TW-50', qty: 1 },
      { nomenclature: 'Socket Set, 3/8" Drive', nsn: '5110-01-100-5678', pn: 'SS-3/8', qty: 1 },
    ],

    // Jigs and Fixtures Table
    jigsFixtures: [
      { nomenclature: 'Engine Timing Light', nsn: '6625-01-300-9012', pn: 'ETL-2000', qty: 1 },
      { nomenclature: 'Compression Tester', nsn: '6625-01-350-3456', pn: 'CT-500', qty: 1 },
    ],

    // Defaults for FormData compatibility
    paragraphs: [],
    vias: [],
    references: [],
    enclosures: [],
    copyTos: [],
  } as any,

  formatting: {
    dateStyle: 'standard',
    subjectCase: 'uppercase',
    font: 'Arial',
  },
};
