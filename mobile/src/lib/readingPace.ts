export type ReadingPace = { seconds: number; fraction: number };

export function sampleReadingPace(
  pace: ReadingPace,
  previousPosition: number,
  position: number,
  elapsed: number,
  pageCount: number,
): ReadingPace {
  const fraction = position - previousPosition;
  const maximumStep = pageCount ? Math.max(1 / pageCount, 0.05) : 0.08;
  // Ignore rapid page flips, backward jumps and long periods of inactivity.
  if (elapsed < 1.5 || elapsed > 180 || fraction <= 0 || fraction > maximumStep + 0.000001) return pace;
  return { seconds: pace.seconds + elapsed, fraction: pace.fraction + fraction };
}

export function estimateRemaining(pace: ReadingPace, position: number, pagesLeft?: number) {
  if (position >= 1) return 'Leitura concluída';
  if (pace.fraction <= 0 || pace.seconds < 8) return pagesLeft === undefined ? 'Estimando no seu ritmo' : `${pagesLeft} ${pagesLeft === 1 ? 'página restante' : 'páginas restantes'}`;
  const minutes = Math.max(1, Math.round((pace.seconds / pace.fraction * (1 - position)) / 60));
  if (minutes < 60) return `≈ ${minutes} min restantes`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `≈ ${hours} h${remainder ? ` ${remainder} min` : ''} restantes`;
}
