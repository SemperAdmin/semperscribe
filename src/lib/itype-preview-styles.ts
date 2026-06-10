export const ITYPE_STYLES = {
  page: {
    width: '8.5in',
    height: '11in',
    margin: '0.5in',
    padding: '0.75in',
    fontSize: '12px',
    fontFamily: '"Times New Roman", serif',
    lineHeight: 1.5,
    color: '#000000',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '2px solid #000',
  },
  dateBox: {
    textAlign: 'left',
    fontSize: '11px',
  },
  titleBox: {
    textAlign: 'right',
    fontSize: '11px',
  },
  centerBlock: {
    textAlign: 'center',
    marginTop: '1rem',
    marginBottom: '1rem',
    padding: '1rem 0',
  },
  titleMain: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },
  titleSub: {
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '0.25rem',
  },
  sealContainer: {
    textAlign: 'center',
    margin: '1rem 0',
  },
  sealImage: {
    width: '1.5in',
    height: '1.5in',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '0.75rem',
    marginBottom: '0.75rem',
  },
  tableHeader: {
    backgroundColor: '#003366',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '10px',
    padding: '6px',
    textAlign: 'left',
    border: '1px solid #000',
  },
  tableCell: {
    fontSize: '10px',
    padding: '6px',
    border: '1px solid #cccccc',
    textAlign: 'left',
  },
  section: {
    marginTop: '1rem',
    marginBottom: '1rem',
  },
  sectionHeading: {
    fontSize: '11px',
    fontWeight: 'bold',
    marginTop: '1rem',
    marginBottom: '0.5rem',
    paddingBottom: '0.25rem',
    borderBottom: '1px solid #999',
  },
  signatureBlock: {
    marginTop: '2rem',
    marginBottom: '0.5rem',
  },
  signatureLine: {
    borderTop: '1px solid #000',
    width: '3in',
    marginTop: '0.25rem',
    marginBottom: '0.1rem',
  },
  pageNumber: {
    fontSize: '10px',
    textAlign: 'right',
    marginTop: '1rem',
    color: '#666666',
  },
};

export const PAGE_CONFIG = {
  pageHeightPixels: 1056,
  headerHeight: 80,
  footerHeight: 60,
  usableHeight: 916,
  pageBreakThreshold: 900,
};

export const COLOR_PALETTE = {
  darkBlue: '#003366',
  lightGray: '#f5f5f5',
  borderGray: '#cccccc',
  darkGray: '#999999',
  black: '#000000',
  white: '#ffffff',
};
