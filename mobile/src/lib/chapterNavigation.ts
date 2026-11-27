export type ChapterDirection = -1 | 1;
export type ChapterEdge = 'start' | 'end';

export function compareChapterTitles(left: string, right: string) {
  return left.localeCompare(right, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export function adjacentChapters<T>(chapters: readonly T[], current: T) {
  const index = chapters.indexOf(current);
  return {
    index,
    count: chapters.length,
    previous: index > 0 ? chapters[index - 1] : undefined,
    next: index >= 0 ? chapters[index + 1] : undefined,
  };
}

export function positionInChapter(
  pageCount: number,
  savedPage: number | undefined,
  savedPercent: number,
  edge?: ChapterEdge,
) {
  if (edge === 'start') return 1;
  if (edge === 'end') return Math.max(pageCount, 1);
  return Math.max(1, Math.min(pageCount, savedPage ?? Math.round(pageCount * savedPercent / 100)));
}

export function pageStep(current: number, count: number, direction: ChapterDirection) {
  const next = current + direction;
  return next >= 1 && next <= count ? next : undefined;
}
