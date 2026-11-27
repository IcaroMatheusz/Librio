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

export function estimateRemaining(
  pace: ReadingPace,
  position: number,
  format: string,
  pageCount: number,
  words: number,
  screens: number,
) {
  if (position >= 1) return { time: 'Leitura concluída', basis: '' };

  const personalized = pace.fraction >= 0.005 && pace.seconds >= 8;
  const average = format === 'epub'
    ? Math.max(words * 0.3, screens * 22, 60)
    : Math.max(pageCount, 1) * (format === 'pdf' ? 55 : 32);
  const seconds = (personalized ? pace.seconds / pace.fraction : average) * (1 - Math.max(0, position));
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const time = hours ? `${hours} h${remainder ? ` ${remainder} min` : ''}` : `${minutes} min`;

  return { time: `≈ ${time} restantes`, basis: personalized ? 'No seu ritmo' : 'Ritmo médio' };
}
