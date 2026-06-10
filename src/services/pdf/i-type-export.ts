import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { ITypePDF } from '@/components/pdf/ITypePDF';
import { FormData } from '@/types';

export async function generateITypePDF(
  formData: FormData & {
    service: string;
    entity: string;
    address: string;
    date: string;
    publicationType: string;
    shortTitle: string;
    signingAuthority: string;
    controllingOffice: string;
    cuiCategory?: string;
    distributionControl?: string;
    supersedureStatement?: string;
    componentsAffected?: Array<{ nomenclature: string; nsn: string; pn: string }>;
    materialRequired?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    materialDiscarded?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    materialRetained?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    bulkMaterial?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    specialTools?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    jigsFixtures?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
  },
  sealImageUrl?: string
): Promise<Blob> {
  try {
    const element = ITypePDF({ formData: formData as any, sealImageUrl });
    const blob = await pdf(element as any).toBlob();
    return blob;
  } catch (error) {
    console.error('I-Type PDF generation failed:', error);
    throw new Error(`Failed to generate I-Type PDF: ${error}`);
  }
}

export async function downloadITypePDF(
  formData: FormData,
  filename: string = 'i-type.pdf'
): Promise<void> {
  try {
    const blob = await generateITypePDF(formData as any);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('I-Type PDF download failed:', error);
    throw error;
  }
}
