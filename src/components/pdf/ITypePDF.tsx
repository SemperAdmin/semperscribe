import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { FormData } from '@/types';

interface ITypePDFProps {
  formData: FormData & {
    service?: string;
    entity?: string;
    address?: string;
    date?: string;
    publicationType?: string;
    shortTitle?: string;
    volume?: string;
    longTitle?: string;
    timeCompliance?: string;
    nomenclature?: string;
    signingAuthority?: string;
    controllingOffice?: string;
    cuiCategory?: string;
    distributionControl?: string;
    category?: string;
    determinationDate?: string;
    poc?: string;
    supersedureNotice?: string;
    supersedureStatement?: string;
    destructionNotice?: string;
    classificationDestructionProcedure?: string;
    pcn?: string;
    componentsAffected?: Array<{ nsn: string; tamcn: string; id: string; model: string }>;
  };
  sealImageUrl?: string;
}

const MARGIN = 36; // 0.5in
const SEAL = 252; // 3.5in
const INDENT = 180; // 2.5in
const ROWS_PER_PAGE = 6;

const styles = StyleSheet.create({
  page: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingLeft: MARGIN,
    paddingRight: MARGIN,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.15,
    color: '#000000',
  },
  coverBottom: {},
  spacer: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerRight: {
    textAlign: 'right',
  },
  serviceLine: {
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginTop: 6,
  },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginVertical: 4,
  },
  centerText: {
    textAlign: 'center',
    marginBottom: 4,
  },
  timeCompliance: {
    textAlign: 'center',
    marginBottom: 8,
  },
  seal: {
    width: SEAL,
    height: SEAL,
    alignSelf: 'center',
    marginVertical: 8,
  },
  nomenclature: {
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
    marginVertical: 8,
  },
  footerInfo: {
    marginLeft: INDENT,
    marginBottom: 8,
  },
  footerSection: {
    marginBottom: 6,
  },
  underlineBold: {
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
  },
  pcn: {
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
  },
  tableRow: {
    flexDirection: 'row',
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  td: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  colNSN: { width: '25%' },
  colTAMCN: { width: '25%' },
  colID: { width: '20%' },
  colMODEL: { width: '30%' },
});

const formatDateAsMonthYear = (dateString?: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    return `${month} ${date.getFullYear()}`;
  } catch {
    return dateString;
  }
};

const join = (parts: Array<string | undefined>, sep: string) =>
  parts.filter(Boolean).join(sep);

const ComponentsTable = ({ rows }: { rows: Array<any> }) => (
  <View>
    <View style={styles.tableRow}>
      <Text style={[styles.th, styles.colNSN]}>NSN</Text>
      <Text style={[styles.th, styles.colTAMCN]}>TAMCN</Text>
      <Text style={[styles.th, styles.colID]}>ID</Text>
      <Text style={[styles.th, styles.colMODEL]}>MODEL</Text>
    </View>
    {rows.map((row, idx) => (
      <View style={styles.tableRow} key={idx}>
        <Text style={[styles.td, styles.colNSN]}>{row.nsn || ''}</Text>
        <Text style={[styles.td, styles.colTAMCN]}>{row.tamcn || ''}</Text>
        <Text style={[styles.td, styles.colID]}>{row.id || ''}</Text>
        <Text style={[styles.td, styles.colMODEL]}>{row.model || ''}</Text>
      </View>
    ))}
  </View>
);

export function ITypePDF({ formData, sealImageUrl }: ITypePDFProps) {
  const sealSrc = sealImageUrl || '/USMC.png';

  const controlledBy = join(
    [formData.entity, formData.signingAuthority, formData.controllingOffice],
    ' '
  );
  const referral = join(
    [
      formData.entity,
      join([formData.signingAuthority, formData.controllingOffice], ' '),
      formData.address,
    ],
    ', '
  );
  const authScope = join([formData.category, formData.determinationDate], ' ');

  const components = formData.componentsAffected || [];
  const chunks: Array<Array<any>> = [];
  for (let i = 0; i < components.length; i += ROWS_PER_PAGE) {
    chunks.push(components.slice(i, i + ROWS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  return (
    <Document>
      {/* PAGE 1 - COVER */}
      <Page size="LETTER" style={styles.page}>
        <View>
          <View style={styles.headerRow}>
            <Text>{formatDateAsMonthYear(formData.date)}</Text>
            <View style={styles.headerRight}>
              <Text>{formData.shortTitle || ''}</Text>
              {formData.volume ? <Text>VOLUME {formData.volume}</Text> : null}
            </View>
          </View>

          <Text style={styles.serviceLine}>
            U.S. MARINE CORPS {formData.publicationType || ''}
          </Text>
          <View style={styles.rule} />
          <Text style={styles.centerText}>{formData.longTitle || ''}</Text>
          <Text style={styles.timeCompliance}>{formData.timeCompliance || ''}</Text>

          <Image src={sealSrc} style={styles.seal} />

          <Text style={styles.nomenclature}>{formData.nomenclature || ''}</Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.coverBottom}>
          <View style={styles.footerInfo}>
            <Text>Controlled by: {controlledBy}</Text>
            <Text>CUI Category: {formData.cuiCategory || ''}</Text>
            <Text>Distribution/Dissemination Control: {formData.distributionControl || ''}</Text>
            <Text>POC: {formData.poc || 'Phone or email address'}</Text>
          </View>

          {formData.supersedureNotice ? (
            <Text style={styles.footerSection}>
              <Text style={styles.underlineBold}>{formData.supersedureNotice}</Text>
              {formData.supersedureStatement ? `: ${formData.supersedureStatement}` : ''}
            </Text>
          ) : null}

          <Text style={styles.footerSection}>
            <Text style={styles.underlineBold}>DISTRIBUTION STATEMENT C:</Text> Distribution authorized to U.S. Government agencies and their contractors for {authScope}. Other requests for this document must be referred to {referral}.
          </Text>

          <Text style={styles.footerSection}>
            <Text style={styles.underlineBold}>{formData.destructionNotice || 'DESTRUCTION NOTICE'}:</Text> {formData.classificationDestructionProcedure || ''}
          </Text>

          <View style={styles.rule} />
          <Text style={styles.pcn}>PCN {formData.pcn || '### ###### ##'}</Text>
        </View>
      </Page>

      {/* PAGE 2+ - COMPONENTS AFFECTED */}
      {chunks.map((rows, idx) => (
        <Page size="LETTER" style={styles.page} key={`components-${idx}`}>
          <ComponentsTable rows={rows} />
        </Page>
      ))}
    </Document>
  );
}
