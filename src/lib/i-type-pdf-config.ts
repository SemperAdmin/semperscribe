import { StyleSheet } from '@react-pdf/renderer';

export const I_TYPE_PDF_MARGINS = {
  top: 72,
  right: 72,
  bottom: 72,
  left: 72,
};

export const I_TYPE_PDF_PAGE_WIDTH = 612;
export const I_TYPE_PDF_PAGE_HEIGHT = 792;
export const I_TYPE_PDF_CONTENT_WIDTH = I_TYPE_PDF_PAGE_WIDTH - I_TYPE_PDF_MARGINS.left - I_TYPE_PDF_MARGINS.right;

export const I_TYPE_PDF_FONTS = {
  SERIF: 'Times-Roman',
  SERIF_BOLD: 'Times-Bold',
  MONO: 'Courier',
};

export const I_TYPE_PDF_SIZES = {
  title: 14,
  heading1: 12,
  heading2: 11,
  body: 10,
  small: 9,
  table: 9,
};

export const I_TYPE_PDF_COLORS = {
  black: '#000000',
  darkBlue: '#002D72',
  tableHeader: '#E8E8E8',
  border: '#000000',
};

export const createITypePDFStyles = () =>
  StyleSheet.create({
    page: {
      paddingTop: I_TYPE_PDF_MARGINS.top,
      paddingRight: I_TYPE_PDF_MARGINS.right,
      paddingBottom: I_TYPE_PDF_MARGINS.bottom,
      paddingLeft: I_TYPE_PDF_MARGINS.left,
      fontFamily: I_TYPE_PDF_FONTS.SERIF,
      fontSize: I_TYPE_PDF_SIZES.body,
      lineHeight: 1.2,
    },

    headerBlock: {
      marginBottom: 12,
      textAlign: 'center',
    },

    headerTitle: {
      fontSize: I_TYPE_PDF_SIZES.heading1,
      fontFamily: I_TYPE_PDF_FONTS.SERIF_BOLD,
      fontWeight: 'bold',
      marginBottom: 4,
      color: I_TYPE_PDF_COLORS.darkBlue,
    },

    publicationType: {
      fontSize: I_TYPE_PDF_SIZES.body,
      fontFamily: I_TYPE_PDF_FONTS.SERIF_BOLD,
      fontWeight: 'bold',
      marginBottom: 6,
      textTransform: 'uppercase',
    },

    sectionTitle: {
      fontSize: I_TYPE_PDF_SIZES.heading2,
      fontFamily: I_TYPE_PDF_FONTS.SERIF_BOLD,
      fontWeight: 'bold',
      marginTop: 12,
      marginBottom: 8,
      borderBottom: `1pt solid ${I_TYPE_PDF_COLORS.border}`,
      paddingBottom: 4,
    },

    metadataRow: {
      display: 'flex',
      flexDirection: 'row',
      marginBottom: 6,
      fontSize: I_TYPE_PDF_SIZES.body,
    },

    metadataLabel: {
      fontFamily: I_TYPE_PDF_FONTS.SERIF_BOLD,
      fontWeight: 'bold',
      width: '120pt',
    },

    metadataValue: {
      flex: 1,
    },

    table: {
      marginVertical: 8,
      borderCollapse: 'collapse',
    },

    tableHeader: {
      backgroundColor: I_TYPE_PDF_COLORS.tableHeader,
      borderBottom: `1pt solid ${I_TYPE_PDF_COLORS.border}`,
    },

    tableHeaderCell: {
      fontSize: I_TYPE_PDF_SIZES.table,
      fontFamily: I_TYPE_PDF_FONTS.SERIF_BOLD,
      fontWeight: 'bold',
      padding: 4,
      borderRight: `1pt solid ${I_TYPE_PDF_COLORS.border}`,
      textAlign: 'left',
    },

    tableCell: {
      fontSize: I_TYPE_PDF_SIZES.table,
      padding: 4,
      borderRight: `1pt solid ${I_TYPE_PDF_COLORS.border}`,
      borderBottom: `1pt solid ${I_TYPE_PDF_COLORS.border}`,
    },

    signatureBlock: {
      marginTop: 24,
      marginBottom: 12,
      textAlign: 'center',
    },

    signatureLine: {
      fontSize: I_TYPE_PDF_SIZES.body,
      marginBottom: 12,
    },

    distributionStatement: {
      fontSize: I_TYPE_PDF_SIZES.small,
      marginTop: 12,
      paddingTop: 8,
      borderTop: `1pt solid ${I_TYPE_PDF_COLORS.border}`,
    },

    pageNumber: {
      fontSize: I_TYPE_PDF_SIZES.small,
      textAlign: 'center',
      marginTop: 12,
      color: '#666666',
    },
  });
