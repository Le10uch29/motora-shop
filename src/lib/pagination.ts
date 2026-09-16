/** Pages always shown at each end of the list. */
const EDGE_PAGES = 2;
/** Pages shown either side of the current one, so the next page is always
 * one click away — the whole point of a page list you can walk through. */
const SIBLINGS = 2;

/**
 * The page numbers to show: both ends, a window around the current page, and
 * "ellipsis" wherever a stretch of pages is hidden.
 *
 * A gap of exactly one page is filled with that page instead of an ellipsis —
 * a "…" standing for a single number hides a page while taking the same room.
 */
export function buildPageList(totalPages: number, currentPage: number): (number | "ellipsis")[] {
  if (totalPages <= 1) return [1];

  const current = Math.min(Math.max(Math.round(currentPage) || 1, 1), totalPages);
  const shown = new Set<number>();

  for (let page = 1; page <= Math.min(EDGE_PAGES, totalPages); page++) shown.add(page);
  for (let page = Math.max(1, totalPages - EDGE_PAGES + 1); page <= totalPages; page++) {
    shown.add(page);
  }
  for (
    let page = Math.max(1, current - SIBLINGS);
    page <= Math.min(totalPages, current + SIBLINGS);
    page++
  ) {
    shown.add(page);
  }

  const result: (number | "ellipsis")[] = [];
  let previous = 0;
  for (const page of [...shown].sort((a, b) => a - b)) {
    if (previous > 0) {
      if (page - previous === 2) result.push(previous + 1);
      else if (page - previous > 2) result.push("ellipsis");
    }
    result.push(page);
    previous = page;
  }
  return result;
}
