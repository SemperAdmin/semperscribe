import { create } from 'zustand';
import { FormData } from '@/types';

interface ITypeFormState {
  formData: FormData & {
    service?: string;
    entity?: string;
    address?: string;
    date?: string;
    publicationType?: string;
    shortTitle?: string;
    volume?: string;
    longTitle?: string;
    signingAuthority?: string;
    controllingOffice?: string;
    cuiCategory?: string;
    distributionControl?: string;
    supersedureNotice?: string;
    supersedureStatement?: string;
    destructionNotice?: string;
    classificationDestructionProcedure?: string;
    nomenclature?: string;
    poc?: string;
    pcn?: string;
    category?: string;
    timeCompliance?: string;
    componentsAffected?: Array<{ nomenclature: string; nsn: string; pn: string }>;
    materialRequired?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    materialDiscarded?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    materialRetained?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    bulkMaterial?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    specialTools?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
    jigsFixtures?: Array<{ nomenclature: string; nsn: string; pn: string; qty: number }>;
  };
  sealImageBase64: string | null;
  isLoading: boolean;
  updateField: (field: string, value: any) => void;
  setFormData: (data: any) => void;
  setSealImage: (base64: string) => void;
  setLoading: (loading: boolean) => void;
}

const defaultFormData = {
  documentType: 'i-type',
  service: '',
  entity: '',
  address: '',
  date: '',
  publicationType: 'TECHNICAL MANUAL',
  shortTitle: 'TM-#####X-##/#',
  volume: '',
  longTitle: 'INSERT LONG TITLE HERE',
  signingAuthority: '',
  controllingOffice: '',
  cuiCategory: '',
  distributionControl: '',
  category: '',
  timeCompliance: '',
  supersedureNotice: '',
  supersedureStatement: '',
  destructionNotice: '',
  classificationDestructionProcedure: '',
  nomenclature: 'INSERT NOMENCLATURE HERE',
  poc: '',
  pcn: '',
  componentsAffected: [],
  materialRequired: [],
  materialDiscarded: [],
  materialRetained: [],
  bulkMaterial: [],
  specialTools: [],
  jigsFixtures: [],
};

export const useITypeStore = create<ITypeFormState>((set) => ({
  formData: defaultFormData,
  sealImageBase64: null,
  isLoading: false,
  updateField: (field: string, value: any) =>
    set((state) => ({
      formData: { ...state.formData, [field]: value },
    })),
  setFormData: (data: any) =>
    set(() => ({
      formData: { ...defaultFormData, ...data },
    })),
  setSealImage: (base64: string) =>
    set(() => ({
      sealImageBase64: base64,
    })),
  setLoading: (loading: boolean) =>
    set(() => ({
      isLoading: loading,
    })),
}));
