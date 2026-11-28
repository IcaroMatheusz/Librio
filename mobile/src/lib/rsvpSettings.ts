export const rsvpFonts = {
  serif: { label: 'Serifada', family: 'Georgia, serif' },
  sans: { label: 'Sem serifa', family: 'system-ui, sans-serif' },
  mono: { label: 'Monoespaçada', family: 'monospace' },
};

export type RsvpSettings = { font: keyof typeof rsvpFonts; wpm: number };
export const rsvpSpeed = { min: 100, max: 1200, initial: 300 };

export function normalizeRsvp(input?: Partial<RsvpSettings> | null): RsvpSettings {
  const font = input?.font;
  const wpm = input?.wpm;
  return {
    font: font && Object.prototype.hasOwnProperty.call(rsvpFonts, font) ? font : 'serif',
    wpm: typeof wpm === 'number' && Number.isFinite(wpm)
      ? Math.min(rsvpSpeed.max, Math.max(rsvpSpeed.min, Math.round(wpm))) : rsvpSpeed.initial,
  };
}
