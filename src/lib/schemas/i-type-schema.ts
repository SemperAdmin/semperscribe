import { z } from 'zod';

export const ITypeSchema = z.object({
  documentType: z.literal('i-type'),

  // Metadata (form fields)
  service: z.string().min(1, 'Service is required'),
  entity: z.string().min(1, 'Entity is required'),
  address: z.string().min(1, 'Address is required'),
  date: z.string().min(1, 'Date is required'),
  publicationType: z.string().min(1, 'Publication type is required'),
  shortTitle: z.string().min(1, 'Short title is required'),
  signingAuthority: z.string().min(1, 'Signing authority is required'),
  controllingOffice: z.string().min(1, 'Controlling office is required'),
  cuiCategory: z.string().optional(),
  distributionControl: z.string().optional(),
  supersedureStatement: z.string().optional(),

  // Components Affected (read-only in form, rendered in PDF)
  componentsAffected: z.array(z.object({
    nomenclature: z.string(),
    nsn: z.string(),
    pn: z.string(),
  })).optional(),

  // Material (read-only in form, rendered in PDF)
  materialRequired: z.array(z.object({
    nomenclature: z.string(),
    nsn: z.string(),
    pn: z.string(),
    qty: z.number(),
  })).optional(),

  materialDiscarded: z.array(z.object({
    nomenclature: z.string(),
    nsn: z.string(),
    pn: z.string(),
    qty: z.number(),
  })).optional(),

  materialRetained: z.array(z.object({
    nomenclature: z.string(),
    nsn: z.string(),
    pn: z.string(),
    qty: z.number(),
  })).optional(),

  bulkMaterial: z.array(z.object({
    nomenclature: z.string(),
    nsn: z.string(),
    pn: z.string(),
    qty: z.number(),
  })).optional(),

  // Tools (read-only in form, rendered in PDF)
  specialTools: z.array(z.object({
    nomenclature: z.string(),
    nsn: z.string(),
    pn: z.string(),
    qty: z.number(),
  })).optional(),

  jigsFixtures: z.array(z.object({
    nomenclature: z.string(),
    nsn: z.string(),
    pn: z.string(),
    qty: z.number(),
  })).optional(),

  // FormData compatibility fields (for union with other doc types)
  paragraphs: z.array(z.any()).optional(),
  vias: z.array(z.string()).optional(),
  references: z.array(z.string()).optional(),
  enclosures: z.array(z.string()).optional(),
  copyTos: z.array(z.string()).optional(),
});

export type ITypeFormData = z.infer<typeof ITypeSchema>;
