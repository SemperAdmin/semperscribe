export interface PageSection {
  type: 'header' | 'title' | 'seal' | 'metadata' | 'nomenclature' | 'headerTable' | 'table' | 'signature' | 'timeCompliance' | 'titleBlock' | 'footerNote';
  estimatedHeight: number;
  data?: any;
}

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
