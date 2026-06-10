export interface PageSection {
  type: 'header' | 'title' | 'seal' | 'metadata' | 'nomenclature' | 'headerTable' | 'table' | 'signature' | 'timeCompliance' | 'titleBlock' | 'footerNote';
  estimatedHeight: number;
  data?: any;
}

const SECTION_HEIGHTS = {
  header: 80,
  title: 100,
  titleBlock: 120,
  timeCompliance: 40,
  seal: 180,
  metadata: 120,
  nomenclature: 60,
  headerTable: 100,
  table: 40,
  signature: 120,
  footerNote: 30,
};

export function calculatePageBreaks(
  sections: PageSection[],
  maxHeightPerPage: number = 900
): PageSection[][] {
  const pages: PageSection[][] = [];
  let currentPage: PageSection[] = [];
  let currentPageHeight = 0;

  for (const section of sections) {
    const sectionHeight = section.estimatedHeight || 0;

    if (currentPageHeight + sectionHeight > maxHeightPerPage && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [section];
      currentPageHeight = sectionHeight;
    } else {
      currentPage.push(section);
      currentPageHeight += sectionHeight;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [sections];
}

export function estimateTableHeight(rows: number): number {
  return 40 + rows * 25;
}
