const EDGE_PAGES = 5;

/** First 5 pages, last 5 pages, plus the current page (with gaps marked) if it falls in between. */
export function buildPageList(totalPages: number, currentPage: number): (number | "ellipsis")[] {
  if (totalPages <= EDGE_PAGES * 2 + 1) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const result: (number | "ellipsis")[] = [];
  for (let p = 1; p <= EDGE_PAGES; p++) result.push(p);

  const inMiddle = currentPage > EDGE_PAGES && currentPage <= totalPages - EDGE_PAGES;
  if (inMiddle) {
    if (currentPage > EDGE_PAGES + 1) result.push("ellipsis");
    result.push(currentPage);
    if (currentPage < totalPages - EDGE_PAGES) result.push("ellipsis");
  } else {
    result.push("ellipsis");
  }

  for (let p = totalPages - EDGE_PAGES + 1; p <= totalPages; p++) result.push(p);
  return result;
}
