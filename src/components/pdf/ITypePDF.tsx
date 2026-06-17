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
import {
  deriveService,
  deriveEntity,
  splitAddress,
  deriveAppropriatePublication,
  formatLongDate,
  PAGE3_LINKS,
} from '@/lib/i-type/page3-derivations';
import { coverColumnWidths } from '@/lib/i-type/cover-columns';
import { ITypeAppendixPDF } from './ITypeAppendixPDF';

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
    miStatement?: string;
    pcn?: string;
    componentsAffected?: Array<{ nsn: string; tamcn: string; id: string; model: string }>;
  };
  sealImageUrl?: string;
}

const MARGIN = 36; // 0.5in
const SEAL = 144; // 2in x 2in (template Layout dialog, ruling 2026-06-10)
const INDENT = 180; // 2.5in
// Ruling 2026-06-10 (hard stance from the template owner): the first
// SIX NSN/TAMCN/ID/MODEL rows sit ON PAGE 1 — always six rows drawn,
// data or not — and only rows 7+ overflow to page 2.
const padToSix = (rows: Array<{ nsn: string; tamcn: string; id: string; model: string }>) => {
  const out = rows.slice(0, 6);
  while (out.length < 6) out.push({ nsn: '', tamcn: '', id: '', model: '' });
  return out;
};

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
  page3Sheet: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingLeft: 72, // 1in
    paddingRight: 72, // 1in
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
  // Column balance (2026-06-10): MODEL gets half the width so entries
  // like "M18 (Modular Handgun System)" render on one line; NSN keeps
  // room for the full 16-char stock number, TAMCN/ID are short codes.
  colNSN: { width: '22%' },
  colTAMCN: { width: '15%' },
  colID: { width: '13%' },
  colMODEL: { width: '50%' },
  p3HeaderLine: { textAlign: 'center', fontSize: 8 },
  p3Service: { textAlign: 'center', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  p3Date: { textAlign: 'right', marginTop: 12, marginBottom: 12 },
  p3Para: { marginBottom: 12, textAlign: 'left' },
  p3Sub: { marginBottom: 12, textAlign: 'left', textIndent: 29 },
  p3Link: { color: '#0563c1', textDecoration: 'underline' },
  p3Official: { textDecoration: 'underline', marginTop: 14, marginBottom: 14 },
  p3SigSpace: { height: 43 },
  p3Distribution: { marginTop: 29 },
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

const ComponentsTable = ({ rows, colWidths }: { rows: Array<any>; colWidths?: number[] }) => {
  const w = colWidths && colWidths.length === 4 ? colWidths : coverColumnWidths(rows, 540, 6.6, 8);
  return (
    <View>
      <View style={styles.tableRow}>
        <Text style={[styles.th, { width: w[0] }]}>NSN</Text>
        <Text style={[styles.th, { width: w[1] }]}>TAMCN</Text>
        <Text style={[styles.th, { width: w[2] }]}>ID</Text>
        <Text style={[styles.th, { width: w[3] }]}>MODEL</Text>
      </View>
      {rows.map((row, idx) => (
        <View style={styles.tableRow} key={idx}>
          <Text style={[styles.td, { width: w[0] }]}>{row.nsn || ''}</Text>
          <Text style={[styles.td, { width: w[1] }]}>{row.tamcn || ''}</Text>
          <Text style={[styles.td, { width: w[2] }]}>{row.id || ''}</Text>
          <Text style={[styles.td, { width: w[3] }]}>{row.model || ''}</Text>
        </View>
      ))}
    </View>
  );
};

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
  const firstSix = padToSix(components);
  const overflow = components.slice(6);
  const coverColWidths = coverColumnWidths(components, 540, 6.6, 8);

  const p3Service = deriveService(formData.service);
  const p3Entity = deriveEntity(formData.entity);
  const [p3Addr1, p3Addr2] = splitAddress(formData.address);
  const p3Date = formatLongDate(formData.date);
  const p3Pub = deriveAppropriatePublication(formData.publicationType, formData.shortTitle);

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

          <View style={{ marginTop: 12 }}>
            <ComponentsTable rows={firstSix} colWidths={coverColWidths} />
          </View>
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

      {/* PAGE 2 - COMPONENTS AFFECTED OVERFLOW (rows 7+ only; react-pdf
          wraps onto further pages if the overflow itself overruns) */}
      {overflow.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <ComponentsTable rows={overflow} colWidths={coverColWidths} />
        </Page>
      )}

      {/* PAGE 3 - AUTHENTICATION LETTER */}
      <Page size="LETTER" style={styles.page3Sheet}>
        <View>
          <Text style={styles.p3Service}>{p3Service}</Text>
          <Text style={styles.p3HeaderLine}>{p3Entity}</Text>
          <Text style={styles.p3HeaderLine}>{p3Addr1}</Text>
          {p3Addr2 ? <Text style={styles.p3HeaderLine}>{p3Addr2}</Text> : null}
        </View>

        <Text style={styles.p3Date}>{p3Date}</Text>

        <Text style={styles.p3Para}>
          {'1.  '}This {p3Pub} is authenticated for Marine Corps use and is effective upon receipt.
        </Text>

        <Text style={styles.p3Para}>
          {'2.  '}Per MCO 5100.34_, Commanders, Commanding Officers, and Officers-In-Charge shall
          identify and report situations that negatively affect safety of operation via the
          Automated Message Handling System to: COMMARCORSYSCOM DCSEAL QUANTICO VA, PEO LS QUANTICO
          VA, CMC PPO WASHINGTON DC, CMC I WASHINGTON DC, CMC L WASHINGTON DC, and CMC DCI WASHINGTON
          DC. Individuals may report potential hazards to Marine Corps Systems Command System Safety
          at <Text style={styles.p3Link}>{PAGE3_LINKS.safetyEmail1}</Text> and/or to Commandant of
          the Marine Corps Safety Division (CMC SD) at{' '}
          <Text style={styles.p3Link}>{PAGE3_LINKS.safetyEmail2}</Text>. All significant hazards
          that have the potential to affect other commands and require widespread dissemination
          shall be reported via a Hazard Report per MCO 5100.29_.
        </Text>

        <Text style={styles.p3Para}>
          {'3.  '}Use TDM-Publications portal, at{' '}
          <Text style={styles.p3Link}>{PAGE3_LINKS.portal}</Text>, as your central resource for all
          publication feedback and support. Please use this single portal to:
        </Text>

        <Text style={styles.p3Sub}>
          {'a.  '}Submit a Change Request to report discrepancies or suggest changes.
        </Text>
        <Text style={styles.p3Sub}>
          {'b.  '}Access Knowledge Base Articles (KBA) for self-help and guidance (including the
          Change Request Process).
        </Text>
        <Text style={styles.p3Sub}>
          {'c.  '}Open a Support Case for any further questions not addressed by the KBA.
        </Text>

        <Text style={styles.p3Para}>
          {'4.  '}For concerns/issues with the content/procedures contact Equipment Specialist or
          designated Program Office representative (Insert Name, Email, Phone, or Team/PM).
        </Text>

        {formData.miStatement ? (
          <Text style={styles.p3Para}>
            {'5.  '}
            {formData.miStatement}
          </Text>
        ) : null}

        <Text style={styles.p3Official}>OFFICIAL</Text>
        <View style={styles.p3SigSpace} />
        <Text>NAME OF SIGNING OFFICIAL</Text>
        <Text>{formData.signingAuthority || ''}</Text>
        <Text>{formData.controllingOffice || ''}</Text>

        <Text style={styles.p3Distribution}>DISTRIBUTION: EDO</Text>
      </Page>

      {/* PAGES 4+ - APPENDIX A / ENCLOSURE (1). Structure-first: all 13
          paragraphs and placeholder tables, running header and page number
          fixed per appendix page. */}
      <ITypeAppendixPDF formData={formData} />
    </Document>
  );
}
