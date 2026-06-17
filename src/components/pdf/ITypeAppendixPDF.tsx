import React from 'react';
import { Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { APPENDIX_LABEL, ENCLOSURE_LABEL, appendixRunningHeader } from '@/lib/i-type/appendix-spec';
import {
  appendixCitation,
  COLUMN_LABEL,
  type AppendixInlineTable,
  type AppendixParagraph,
} from '@/lib/i-type/appendix-paragraphs';

interface ITypeAppendixPDFProps {
  formData?: Record<string, any>;
}

const MARGIN = 36; // 0.5in top/bottom
const SIDE = 72; // 1in left/right, matching the page-3 letter
const PER_LEVEL_INDENT = 18; // 0.25in per outline level, in points
// 1in side margins on US Letter leave 6.5in = 468pt of content width.

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const day = d.getUTCDate();
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = String(d.getUTCFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
};

const columnWidths = (count: number): number[] => {
  if (count >= 5) return [60, 138, 108, 108, 54];
  if (count === 4) return [187, 117, 117, 47];
  return [234, 117, 117];
};

const styles = StyleSheet.create({
  page: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingLeft: SIDE,
    paddingRight: SIDE,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.3,
    color: '#000000',
  },
  runningHeader: { textAlign: 'center', marginBottom: 18 },
  label: { marginBottom: 0 },
  para: { marginTop: 8 },
  row: { flexDirection: 'row' },
  markerCol: { fontFamily: 'Helvetica-Bold', width: 26 },
  body: { flex: 1 },
  marker: { fontFamily: 'Helvetica-Bold' },
  title: { fontFamily: 'Helvetica-Bold', textDecoration: 'underline' },
  table: { marginBottom: 6, marginTop: 4 },
  tableRow: { flexDirection: 'row' },
  th: { paddingVertical: 2, paddingHorizontal: 4 },
  td: { paddingVertical: 2, paddingHorizontal: 4, minHeight: 16 },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});

const InlineTable = ({ table }: { table: AppendixInlineTable }) => {
  const w = columnWidths(table.columns.length);
  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        {table.columns.map((c, i) => (
          <Text key={c} style={[styles.th, { width: w[i] }]}>
            {COLUMN_LABEL[c]}
          </Text>
        ))}
      </View>
      {table.rows.map((row, r) => (
        <View style={styles.tableRow} key={r}>
          {table.columns.map((c, i) => (
            <Text key={c} style={[styles.td, { width: w[i] }]}>
              {(row?.[c] ?? '').toString() || ' '}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
};

export const ITypeAppendixPDF = ({ formData }: ITypeAppendixPDFProps) => {
  const header = appendixRunningHeader(formData?.shortTitle, formatDate(formData?.date));
  const paragraphs = (formData?.appendixParagraphs as AppendixParagraph[]) ?? [];

  return (
    <Page size="LETTER" style={styles.page}>
      <Text fixed style={styles.runningHeader}>
        {header}
      </Text>

      <Text style={styles.label}>{APPENDIX_LABEL}</Text>
      <Text style={styles.label}>{ENCLOSURE_LABEL}</Text>

      {paragraphs.map((p, i) => {
        const citation = appendixCitation(paragraphs, i);
        const indent = Math.max(0, (p.level - 1) * PER_LEVEL_INDENT);
        const hasContent = !!(p.content && p.content.trim());
        return (
          <View style={[styles.para, { marginLeft: indent }]} key={p.id}>
            <View style={styles.row}>
              <Text style={styles.markerCol}>{citation}</Text>
              <Text style={styles.body}>
              {p.title ? (
                <Text style={styles.title}>
                  {p.title}
                  {hasContent ? '.  ' : ''}
                </Text>
              ) : null}
              {hasContent ? <Text>{p.content}</Text> : null}
              </Text>
            </View>
            {p.table ? <InlineTable table={p.table} /> : null}
          </View>
        );
      })}

      <Text
        fixed
        style={styles.pageNumber}
        render={({ subPageNumber }: { subPageNumber: number }) => `${subPageNumber}`}
      />
    </Page>
  );
};

export default ITypeAppendixPDF;
